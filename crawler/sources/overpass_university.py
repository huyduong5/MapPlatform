"""OSM Overpass source — universities / colleges per city bbox ($0)."""

from __future__ import annotations

import logging
import os
import re
import unicodedata
from pathlib import Path
from typing import Any

from config.cities import CityBbox, get_bbox
from sources.overpass_common import (
    fetch_overpass_json,
    format_bbox,
    load_city_seed,
    load_seed_json,
    map_osm_element,
)

log = logging.getLogger(__name__)

SEED_FALLBACK = Path(__file__).parent / "data" / "overpass_hanoi_university_seed.json"
MAX_PER_CITY = int(os.getenv("OVERPASS_UNIVERSITY_MAX", "300"))

# Prefer full campuses over faculty/building fragments / lettered blocks (A1, B2, …)
_FRAGMENT_RE = re.compile(
    r"^(tòa|toa|nhà|nha|hội trường|hoi truong|văn phòng|van phong|khoa\s)",
    re.I,
)
_BUILDING_CODE_RE = re.compile(
    r"^(?:[a-z]{1,3}\d{0,3}[a-z]?|\d{1,3}[a-z]{0,2}|alpha|beta|gamma|delta|b-c)$",
    re.I,
)
_INSTITUTION_RE = re.compile(
    r"(đại\s*học|dai\s*hoc|học\s*viện|hoc\s*vien|cao\s*đẳng|cao\s*dang|"
    r"university|college|institute|trường|truong)",
    re.I,
)

_MAJOR_HINTS = (
    "khoa học tự nhiên",
    "khoa hoc tu nhien",
    "xã hội và nhân văn",
    "xa hoi va nhan van",
    "bách khoa",
    "bach khoa",
    "kinh tế quốc dân",
    "kinh te quoc dan",
    "ngoại thương",
    "ngoai thuong",
    "y hà nội",
    "y ha noi",
    "sư phạm hà nội",
    "su pham ha noi",
    "ngoại ngữ",
    "ngoai ngu",
    "công nghệ",
    "cong nghe",
    "luật hà nội",
    "luat ha noi",
    "xây dựng",
    "xay dung",
    "giao thông",
    "giao thong",
    "thủy lợi",
    "thuy loi",
    "dược",
    "duoc",
    "mỏ - địa chất",
    "mo - dia chat",
    "công nghiệp hà nội",
    "cong nghiep ha noi",
    "mở hà nội",
    "mo ha noi",
    "bưu chính",
    "buu chinh",
    "quốc gia hà nội",
    "quoc gia ha noi",
)


def _fold(s: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", s.lower()) if unicodedata.category(c) != "Mn"
    )


def _build_query(bbox: CityBbox) -> str:
    bb = format_bbox(bbox)
    # Only amenity=university/college — building=university floods lettered blocks (A1, B2)
    return f"""
[out:json][timeout:90];
(
  node["amenity"="university"]["name"]({bb});
  way["amenity"="university"]["name"]({bb});
  relation["amenity"="university"]["name"]({bb});
  node["amenity"="college"]["name"]({bb});
  way["amenity"="college"]["name"]({bb});
  relation["amenity"="college"]["name"]({bb});
);
out center tags;
"""


def _is_fragment(name: str) -> bool:
    n = name.strip()
    if not n or len(n) < 4:
        return True
    if _FRAGMENT_RE.match(n):
        return True
    if _BUILDING_CODE_RE.match(n):
        return True
    folded = _fold(n)
    # "Khoa X - Đại học Y" faculty nodes
    if folded.startswith("khoa ") and "dai hoc" in folded:
        return True
    # Require institution-like wording unless clearly a major campus hint
    if not _INSTITUTION_RE.search(n) and not any(h in folded for h in _MAJOR_HINTS):
        return True
    return False


def _priority(name: str) -> tuple:
    """Lower tuple sorts first. Major ĐH campuses before colleges/noise."""
    folded = _fold(name)
    major = 0 if any(h in folded for h in _MAJOR_HINTS) else 1
    is_uni = 0 if ("dai hoc" in folded or "hoc vien" in folded or "university" in folded) else 1
    fragment = 1 if _is_fragment(name) else 0
    # major first, then non-fragment, then university-like, then alpha
    return (major, fragment, is_uni, folded)


def _map_elements(data: dict[str, Any], city: str) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    seen_ids: set[str] = set()
    seen_names: set[str] = set()
    for el in data.get("elements", []):
        tags = el.get("tags") or {}
        name = tags.get("name") or tags.get("name:vi") or ""
        if name and _is_fragment(name):
            continue
        rec = map_osm_element(
            el,
            city=city,
            loc_type="university",
            default_name_prefix="Trường ĐH",
        )
        if not rec:
            continue
        key = str(rec.get("source_record_id") or f"{rec['latitude']},{rec['longitude']}")
        nkey = _fold(str(rec["name"]))
        if key in seen_ids or nkey in seen_names:
            continue
        seen_ids.add(key)
        seen_names.add(nkey)
        results.append(rec)

    results.sort(key=lambda r: _priority(str(r["name"])))
    if len(results) > MAX_PER_CITY:
        log.info("University cap %s → %s for city=%s", len(results), MAX_PER_CITY, city)
        results = results[:MAX_PER_CITY]
    return results


def _merge_hanoi_seed(results: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Always ensure curated major campuses exist (even if Overpass truncated them)."""
    seed = load_seed_json(
        SEED_FALLBACK, city="hanoi", loc_type="university", log_as_fallback=False
    )
    existing = {_fold(str(r["name"])) for r in results}
    added = 0
    for row in seed:
        nkey = _fold(str(row["name"]))
        if nkey in existing:
            continue
        # also skip if a longer OSM name already contains the seed name
        if any(nkey in e or e in nkey for e in existing if len(e) > 8):
            continue
        results.append(row)
        existing.add(nkey)
        added += 1
    if added:
        log.info("Merged %s curated Hanoi university seed rows", added)
    results.sort(key=lambda r: _priority(str(r["name"])))
    return results


def fetch_universities(city: str | None = None) -> list[dict[str, Any]]:
    city_code = city or os.getenv("CRAWL_CITY") or "hanoi"
    query = _build_query(get_bbox(city_code))
    try:
        data = fetch_overpass_json(query)
    except RuntimeError:
        seed = load_city_seed("university", city_code, "university")
        if seed:
            return seed
        raise

    results = _map_elements(data, city_code)
    log.info("Overpass returned %s universities for %s", len(results), city_code)
    if city_code == "hanoi":
        results = _merge_hanoi_seed(results)
    elif not results:
        seed = load_city_seed("university", city_code, "university")
        if seed:
            return seed
    else:
        # Merge curated major campuses for HCM/DN when available
        seed = load_city_seed("university", city_code, "university")
        if seed:
            existing = {_fold(str(r["name"])) for r in results}
            for row in seed:
                nkey = _fold(str(row["name"]))
                if nkey not in existing:
                    results.append(row)
                    existing.add(nkey)
    return results
