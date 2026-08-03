"""OSM Overpass source — rescue / emergency stations per city bbox ($0, best-effort)."""

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

SEED_FALLBACK = Path(__file__).parent / "data" / "overpass_hanoi_rescue_seed.json"
MAX_PER_CITY = int(os.getenv("OVERPASS_RESCUE_MAX", "80"))


def _build_query(bbox: CityBbox) -> str:
    bb = format_bbox(bbox)
    # OSM tags vary; cover common ambulance / fire / SES stations
    return f"""
[out:json][timeout:90];
(
  node["emergency"="ambulance_station"]({bb});
  way["emergency"="ambulance_station"]({bb});
  node["amenity"="ambulance_station"]({bb});
  way["amenity"="ambulance_station"]({bb});
  node["emergency"="fire_station"]({bb});
  way["emergency"="fire_station"]({bb});
  node["amenity"="fire_station"]({bb});
  way["amenity"="fire_station"]({bb});
  node["emergency"="ses_station"]({bb});
  way["emergency"="ses_station"]({bb});
);
out center tags;
"""


def _map_elements(data: dict[str, Any], city: str) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    for el in data.get("elements", []):
        rec = map_osm_element(
            el,
            city=city,
            loc_type="rescue_team",
            default_name_prefix="Đội cứu hộ",
        )
        if rec:
            results.append(rec)
    if len(results) > MAX_PER_CITY:
        log.info("Rescue cap %s → %s for city=%s", len(results), MAX_PER_CITY, city)
        results = results[:MAX_PER_CITY]
    return results


def fetch_rescue(city: str | None = None) -> list[dict[str, Any]]:
    city_code = city or os.getenv("CRAWL_CITY") or "hanoi"
    query = _build_query(get_bbox(city_code))
    try:
        data = fetch_overpass_json(query)
    except RuntimeError:
        seed = load_city_seed("rescue", city_code, "rescue_team")
        if seed:
            return seed
        raise

    results = _map_elements(data, city_code)
    log.info("Overpass returned %s rescue points for %s", len(results), city_code)
    if not results:
        seed = load_city_seed("rescue", city_code, "rescue_team")
        if seed:
            return seed
    return results
