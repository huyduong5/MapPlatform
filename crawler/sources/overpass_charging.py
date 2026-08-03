"""OSM Overpass source — charging stations per city bbox ($0)."""

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

SEED_FALLBACK = Path(__file__).parent / "data" / "overpass_hanoi_charging_seed.json"


def _build_query(bbox: CityBbox) -> str:
    bb = format_bbox(bbox)
    return f"""
[out:json][timeout:90];
(
  node["amenity"="charging_station"]({bb});
  way["amenity"="charging_station"]({bb});
  relation["amenity"="charging_station"]({bb});
);
out center tags;
"""


def _map_elements(data: dict[str, Any], city: str) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    for el in data.get("elements", []):
        rec = map_osm_element(
            el,
            city=city,
            loc_type="charging_station",
            default_name_prefix="Trạm sạc",
        )
        if rec:
            results.append(rec)
    return results


def fetch_charging_stations(city: str | None = None) -> list[dict[str, Any]]:
    """Fetch charging stations for a given city from Overpass API."""
    city_code = city or os.getenv("CRAWL_CITY") or "hanoi"
    query = _build_query(get_bbox(city_code))
    try:
        data = fetch_overpass_json(query)
    except RuntimeError:
        seed = load_city_seed("charging", city_code, "charging_station")
        if seed:
            return seed
        raise

    results = _map_elements(data, city_code)
    log.info("Overpass returned %s charging stations for %s", len(results), city_code)
    if not results:
        seed = load_city_seed("charging", city_code, "charging_station")
        if seed:
            return seed
    return results
