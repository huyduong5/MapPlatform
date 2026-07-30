"""OSM Overpass source — atm per city bbox."""

from __future__ import annotations

import logging
import os
from typing import Any

from config.cities import CityBbox, get_bbox
from sources.overpass_common import (
    fetch_overpass_json,
    format_bbox,
    load_city_seed,
    map_osm_element,
)

log = logging.getLogger(__name__)

MAX_PER_CITY = int(os.getenv("OVERPASS_ATM_MAX", "500"))

def _build_query(bbox: CityBbox) -> str:
    bb = format_bbox(bbox)
    return f"""
[out:json][timeout:90];
(
  node["amenity"="atm"]["name"]({bb});
  way["amenity"="atm"]["name"]({bb});
);
out center tags;
"""


def _map_elements(data: dict[str, Any], city: str) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    seen: set[str] = set()
    for el in data.get("elements", []):
        rec = map_osm_element(
            el,
            city=city,
            loc_type="atm",
            default_name_prefix="ATM",
        )
        if not rec:
            continue
        key = rec.get("source_record_id") or f"{rec['latitude']},{rec['longitude']}"
        if key in seen:
            continue
        seen.add(str(key))
        results.append(rec)
    results.sort(key=lambda r: str(r["name"]))
    if len(results) > MAX_PER_CITY:
        log.info("atm cap %s → %s for city=%s", len(results), MAX_PER_CITY, city)
        results = results[:MAX_PER_CITY]
    return results


def fetch_atms(city: str | None = None) -> list[dict[str, Any]]:
    city_code = city or os.getenv("CRAWL_CITY") or "hanoi"
    query = _build_query(get_bbox(city_code))
    try:
        data = fetch_overpass_json(query)
    except RuntimeError:
        seed = load_city_seed("atm", city_code, "atm")
        if seed:
            return seed
        raise

    results = _map_elements(data, city_code)
    log.info("Overpass returned %s atm for %s", len(results), city_code)
    if not results:
        seed = load_city_seed("atm", city_code, "atm")
        if seed:
            return seed
    return results
