"""City registry for crawler — mirrors apps/api + apps/web cities.ts."""

from __future__ import annotations

from typing import NamedTuple


class CityBbox(NamedTuple):
    min_lat: float
    max_lat: float
    min_lng: float
    max_lng: float


class CityConfig(NamedTuple):
    code: str
    name: str
    lat: float
    lng: float
    bbox: CityBbox


CITIES: dict[str, CityConfig] = {
    "hanoi": CityConfig(
        code="hanoi",
        name="Hà Nội",
        lat=21.0285,
        lng=105.8542,
        bbox=CityBbox(20.53, 21.23, 105.29, 106.02),
    ),
    "hcm": CityConfig(
        code="hcm",
        name="Hồ Chí Minh",
        lat=10.7769,
        lng=106.7009,
        bbox=CityBbox(10.65, 10.9, 106.55, 106.85),
    ),
    "danang": CityConfig(
        code="danang",
        name="Đà Nẵng",
        lat=16.0544,
        lng=108.2022,
        bbox=CityBbox(15.95, 16.15, 108.1, 108.3),
    ),
    "haiphong": CityConfig(
        code="haiphong",
        name="Hải Phòng",
        lat=20.8449,
        lng=106.6881,
        bbox=CityBbox(20.7, 20.95, 106.55, 106.85),
    ),
    "cantho": CityConfig(
        code="cantho",
        name="Cần Thơ",
        lat=10.0452,
        lng=105.7469,
        bbox=CityBbox(9.95, 10.15, 105.65, 105.85),
    ),
    "hue": CityConfig(
        code="hue",
        name="Huế",
        lat=16.4637,
        lng=107.5909,
        bbox=CityBbox(16.35, 16.55, 107.45, 107.7),
    ),
}

ALL_CITY_CODES = list(CITIES.keys())
CITY_BBOX: dict[str, CityBbox] = {code: cfg.bbox for code, cfg in CITIES.items()}


def is_city_code(value: str | None) -> bool:
    return bool(value) and value in CITIES


def get_city(code: str) -> CityConfig:
    return CITIES[code]


def get_bbox(code: str) -> CityBbox:
    if code not in CITIES:
        raise KeyError(f"Unknown city code: {code}")
    return CITIES[code].bbox


def point_in_city(lat: float, lng: float, code: str) -> bool:
    if code not in CITIES:
        return False
    bb = CITIES[code].bbox
    return bb.min_lat <= lat <= bb.max_lat and bb.min_lng <= lng <= bb.max_lng


def detect_city(lat: float, lng: float) -> str | None:
    for code, cfg in CITIES.items():
        bb = cfg.bbox
        if bb.min_lat <= lat <= bb.max_lat and bb.min_lng <= lng <= bb.max_lng:
            return code
    return None


def parse_city(value: str | None, fallback: str = "hanoi") -> str:
    if value and value in CITIES:
        return value
    return fallback


def city_in_bbox(city: str, lat: float, lng: float) -> bool:
    return point_in_city(lat, lng, city)


def resolve_city(lat: float, lng: float, declared: str | None = None) -> str | None:
    if declared and point_in_city(lat, lng, declared):
        return declared
    return detect_city(lat, lng)
