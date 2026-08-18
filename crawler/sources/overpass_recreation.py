"""OSM Overpass — parks and tourist attractions per city."""

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

MAX_PARK = int(os.getenv("OVERPASS_PARK_MAX", "300"))
MAX_ATTRACTION = int(os.getenv("OVERPASS_ATTRACTION_MAX", "400"))


def _bbox_query_park(bbox: CityBbox) -> str:
    bb = format_bbox(bbox)
    return f"""
[out:json][timeout:120];
(
  node["leisure"="park"]["name"]({bb});
  way["leisure"="park"]["name"]({bb});
  relation["leisure"="park"]["name"]({bb});
  node["leisure"="garden"]["name"]({bb});
  way["leisure"="garden"]["name"]({bb});
);
out center tags;
"""


def _bbox_query_attraction(bbox: CityBbox) -> str:
    bb = format_bbox(bbox)
    return f"""
[out:json][timeout:120];
(
  node["tourism"="attraction"]["name"]({bb});
  way["tourism"="attraction"]["name"]({bb});
  node["tourism"="museum"]["name"]({bb});
  node["tourism"="viewpoint"]["name"]({bb});
  node["historic"]["name"]({bb});
  way["historic"]["name"]({bb});
);
out center tags;
"""


def _map_elements(
    data: dict[str, Any],
    city: str,
    loc_type: str,
    default_prefix: str,
    cap: int,
) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    seen: set[str] = set()
    for el in data.get("elements", []):
        rec = map_osm_element(
            el,
            city=city,
            loc_type=loc_type,
            default_name_prefix=default_prefix,
        )
        if not rec:
            continue
        key = rec.get("source_record_id") or f"{rec['latitude']},{rec['longitude']}"
        if key in seen:
            continue
        seen.add(str(key))
        results.append(rec)
    results.sort(key=lambda r: str(r["name"]))
    if len(results) > cap:
        log.info("%s cap %s → %s for city=%s", loc_type, len(results), cap, city)
        results = results[:cap]
    return results


def fetch_parks(city: str | None = None) -> list[dict[str, Any]]:
    city_code = city or os.getenv("CRAWL_CITY") or "hanoi"
    query = _bbox_query_park(get_bbox(city_code))
    try:
        data = fetch_overpass_json(query)
    except RuntimeError:
        seed = load_city_seed("park", city_code, "park")
        if seed:
            return seed
        raise
    results = _map_elements(data, city_code, "park", "Công viên", MAX_PARK)
    log.info("Overpass returned %s park for %s", len(results), city_code)
    if not results:
        seed = load_city_seed("park", city_code, "park")
        if seed:
            return seed
    return results


def fetch_tourist_attractions(city: str | None = None) -> list[dict[str, Any]]:
    city_code = city or os.getenv("CRAWL_CITY") or "hanoi"
    query = _bbox_query_attraction(get_bbox(city_code))
    try:
        data = fetch_overpass_json(query)
    except RuntimeError:
        seed = load_city_seed("tourist_attraction", city_code, "tourist_attraction")
        if seed:
            return seed
        raise
    results = _map_elements(data, city_code, "tourist_attraction", "Điểm tham quan", MAX_ATTRACTION)
    log.info("Overpass returned %s tourist_attraction for %s", len(results), city_code)
    if not results:
        seed = load_city_seed("tourist_attraction", city_code, "tourist_attraction")
        if seed:
            return seed
    return results
