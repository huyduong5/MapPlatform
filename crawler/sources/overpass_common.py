"""Shared Overpass HTTP helpers ($0 mirrors + seed fallback)."""

from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Any

import httpx

from config.cities import CITIES, CityBbox
from processors.name_quality import resolve_osm_display_name

log = logging.getLogger(__name__)

OVERPASS_URL = os.getenv("OVERPASS_URL", "https://overpass-api.de/api/interpreter")
OVERPASS_MIRROR = os.getenv(
    "OVERPASS_MIRROR_URL", "https://overpass.kumi.systems/api/interpreter"
)
USER_AGENT = os.getenv(
    "OVERPASS_USER_AGENT",
    "MapPlatform-VinSmartFuture/1.0 (geo-decision-platform; contact: dev@example.com)",
)


def overpass_urls() -> list[str]:
    urls = [OVERPASS_URL, OVERPASS_MIRROR]
    if os.getenv("OVERPASS_PREFER_MIRROR", "1") == "1":
        urls = [OVERPASS_MIRROR, OVERPASS_URL]
    return urls


def format_bbox(bbox: CityBbox) -> str:
    return f"{bbox.min_lat},{bbox.min_lng},{bbox.max_lat},{bbox.max_lng}"


def fetch_overpass_json(query: str) -> dict[str, Any]:
    """POST query to Overpass mirrors; raise if all fail."""
    last_err: Exception | None = None
    headers = {"User-Agent": USER_AGENT, "Accept": "application/json"}
    for url in overpass_urls():
        try:
            log.info("Overpass fetch via %s", url)
            with httpx.Client(timeout=180.0, headers=headers) as client:
                r = client.post(url, data={"data": query})
                r.raise_for_status()
                return r.json()
        except Exception as exc:  # noqa: BLE001
            last_err = exc
            log.warning("Overpass failed (%s): %s", url, exc)
    raise RuntimeError(f"Overpass all endpoints failed: {last_err}")


def _build_address(tags: dict[str, Any], city_name: str) -> str:
    """Prefer addr:full; else VN-ordered components; else city fallback."""
    full = (tags.get("addr:full") or "").strip()
    if full:
        return full

    street = tags.get("addr:street")
    housenumber = tags.get("addr:housenumber")
    line1 = None
    if street and housenumber:
        line1 = f"{housenumber} {street}"
    elif street:
        line1 = street
    elif housenumber:
        line1 = housenumber

    parts = [
        line1,
        tags.get("addr:ward") or tags.get("addr:suburb") or tags.get("addr:quarter"),
        tags.get("addr:district") or tags.get("addr:subdistrict"),
        tags.get("addr:city") or tags.get("addr:province") or city_name,
        tags.get("addr:postcode"),
    ]
    joined = ", ".join(p.strip() for p in parts if p and str(p).strip())
    if joined:
        if "Việt Nam" not in joined and "Vietnam" not in joined:
            return f"{joined}, Việt Nam"
        return joined
    return f"{city_name}, Việt Nam"


def _parse_stars(tags: dict[str, Any]) -> tuple[float | None, int | None]:
    raw = tags.get("stars") or tags.get("rating")
    if raw is None:
        return None, None
    try:
        val = float(str(raw).replace(",", ".").strip())
        if 0 < val <= 5:
            return val, None
    except (TypeError, ValueError):
        pass
    return None, None


def map_osm_element(
    el: dict[str, Any],
    *,
    city: str,
    loc_type: str,
    default_name_prefix: str,
) -> dict[str, Any] | None:
    tags = el.get("tags") or {}
    lat = el.get("lat") or (el.get("center") or {}).get("lat")
    lon = el.get("lon") or (el.get("center") or {}).get("lon")
    if lat is None or lon is None:
        return None
    city_cfg = CITIES.get(city)
    city_name = city_cfg.name if city_cfg else "Việt Nam"
    name = resolve_osm_display_name(tags)
    if not name:
        return None
    address = _build_address(tags, city_name)
    phone = (
        tags.get("phone")
        or tags.get("contact:phone")
        or tags.get("mobile")
        or tags.get("contact:mobile")
    )
    website = tags.get("website") or tags.get("contact:website") or tags.get("url")
    brand = tags.get("brand") or tags.get("operator")
    rating, rating_count = _parse_stars(tags)
    return {
        "name": name,
        "type": loc_type,
        "address": address,
        "latitude": float(lat),
        "longitude": float(lon),
        "city": city,
        "phone": phone,
        "opening_hours": tags.get("opening_hours"),
        "website": website,
        "brand": brand if brand and brand != name else tags.get("brand"),
        "rating": rating,
        "rating_count": rating_count,
        "rating_source": "osm" if rating is not None else None,
        "source_record_id": str(el.get("id")),
        "source_url": f"https://www.openstreetmap.org/{el.get('type', 'node')}/{el.get('id')}",
    }


def load_seed_json(
    path: Path,
    *,
    city: str,
    loc_type: str,
    log_as_fallback: bool = True,
) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    data = json.loads(path.read_text(encoding="utf-8"))
    for item in data:
        item.setdefault("city", city)
        item.setdefault("type", loc_type)
    if log_as_fallback:
        log.warning("Using Overpass seed fallback %s (%s records)", path.name, len(data))
    else:
        log.info("Loaded curated seed %s (%s records)", path.name, len(data))
    return data


def seed_path(kind: str, city: str) -> Path:
    """Prefer city-specific seed, else Hanoi seed as last resort template."""
    data = Path(__file__).parent / "data"
    specific = data / f"overpass_{city}_{kind}_seed.json"
    if specific.exists():
        return specific
    return data / f"overpass_hanoi_{kind}_seed.json"


def load_city_seed(
    kind: str,
    city: str,
    loc_type: str,
    *,
    allow: bool | None = None,
) -> list[dict[str, Any]]:
    if allow is None:
        allow = os.getenv("OVERPASS_ALLOW_SEED_FALLBACK", "1") == "1"
    if not allow:
        return []
    path = seed_path(kind, city)
    if not path.exists():
        return []
    # Remap city on rows when falling back to another city's seed file
    rows = load_seed_json(path, city=city, loc_type=loc_type)
    return rows
