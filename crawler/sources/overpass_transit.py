"""OSM Overpass — bus stops and subway/metro stations per city."""

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

MAX_BUS = int(os.getenv("OVERPASS_BUS_STOP_MAX", "800"))
MAX_SUBWAY = int(os.getenv("OVERPASS_SUBWAY_MAX", "120"))


def _bbox_query_bus(bbox: CityBbox) -> str:
    bb = format_bbox(bbox)
    return f"""
[out:json][timeout:120];
(
  node["highway"="bus_stop"]["name"]({bb});
  node["public_transport"="platform"]["bus"="yes"]["name"]({bb});
  node["amenity"="bus_station"]["name"]({bb});
);
out center tags;
"""


def _bbox_query_subway(bbox: CityBbox) -> str:
    bb = format_bbox(bbox)
    return f"""
[out:json][timeout:90];
(
  node["railway"="station"]["station"="subway"]["name"]({bb});
  node["railway"="subway_entrance"]["name"]({bb});
  node["public_transport"="station"]["subway"="yes"]["name"]({bb});
  node["railway"="station"]["name"~"Metro|metro|Cát Linh|Nhổn"]({bb});
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


def fetch_bus_stops(city: str | None = None) -> list[dict[str, Any]]:
    city_code = city or os.getenv("CRAWL_CITY") or "hanoi"
    query = _bbox_query_bus(get_bbox(city_code))
    try:
        data = fetch_overpass_json(query)
    except RuntimeError:
        seed = load_city_seed("bus_stop", city_code, "bus_stop")
        if seed:
            return seed
        raise
    results = _map_elements(data, city_code, "bus_stop", "Điểm bus", MAX_BUS)
    log.info("Overpass returned %s bus_stop for %s", len(results), city_code)
    if not results:
        seed = load_city_seed("bus_stop", city_code, "bus_stop")
        if seed:
            return seed
    return results


def fetch_subway_stations(city: str | None = None) -> list[dict[str, Any]]:
    city_code = city or os.getenv("CRAWL_CITY") or "hanoi"
    query = _bbox_query_subway(get_bbox(city_code))
    try:
        data = fetch_overpass_json(query)
    except RuntimeError:
        seed = load_city_seed("subway_station", city_code, "subway_station")
        if seed:
            return seed
        raise
    results = _map_elements(data, city_code, "subway_station", "Ga metro", MAX_SUBWAY)
    log.info("Overpass returned %s subway_station for %s", len(results), city_code)
    if not results:
        seed = load_city_seed("subway_station", city_code, "subway_station")
        if seed:
            return seed
    return results
