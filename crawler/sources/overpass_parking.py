"""OSM Overpass source — parking (named / multi-storey) per city bbox ($0)."""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any

from config.cities import CityBbox, get_bbox
from sources.overpass_common import (
    fetch_overpass_json,
    format_bbox,
    load_city_seed,
    map_osm_element,
)

log = logging.getLogger(__name__)

SEED_FALLBACK = Path(__file__).parent / "data" / "overpass_hanoi_parking_seed.json"
# Cap per city to avoid flooding map with unnamed lots
MAX_PER_CITY = int(os.getenv("OVERPASS_PARKING_MAX", "300"))


def _build_query(bbox: CityBbox) -> str:
    bb = format_bbox(bbox)
    # Prefer named lots + multi-storey / parking buildings (less noise than all amenity=parking)
    return f"""
[out:json][timeout:90];
(
  node["amenity"="parking"]["name"]({bb});
  way["amenity"="parking"]["name"]({bb});
  relation["amenity"="parking"]["name"]({bb});
  node["amenity"="parking"]["parking"="multi-storey"]({bb});
  way["amenity"="parking"]["parking"="multi-storey"]({bb});
  way["building"="parking"]({bb});
);
out center tags;
"""


def _map_elements(data: dict[str, Any], city: str) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    for el in data.get("elements", []):
        rec = map_osm_element(
            el,
            city=city,
            loc_type="parking",
            default_name_prefix="Bãi đỗ",
        )
        if rec:
            results.append(rec)
    # Prefer records with real names over auto prefixes
    results.sort(key=lambda r: str(r["name"]))
    if len(results) > MAX_PER_CITY:
        log.info("Parking cap %s → %s for city=%s", len(results), MAX_PER_CITY, city)
        results = results[:MAX_PER_CITY]
    return results


def fetch_parking(city: str | None = None) -> list[dict[str, Any]]:
    city_code = city or os.getenv("CRAWL_CITY") or "hanoi"
    query = _build_query(get_bbox(city_code))
    try:
        data = fetch_overpass_json(query)
    except RuntimeError:
        seed = load_city_seed("parking", city_code, "parking")
        if seed:
            return seed
        raise

    results = _map_elements(data, city_code)
    log.info("Overpass returned %s parking for %s", len(results), city_code)
    if not results:
        seed = load_city_seed("parking", city_code, "parking")
        if seed:
            return seed
    return results
