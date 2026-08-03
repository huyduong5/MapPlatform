"""Unit tests for city-aware config + validation."""

from config.cities import (
    ALL_CITY_CODES,
    detect_city,
    get_bbox,
    point_in_city,
    resolve_city,
)
from processors.validate import validate_record


def test_all_city_codes():
    assert ALL_CITY_CODES == ["hanoi", "hcm", "danang", "haiphong", "cantho", "hue"]


def test_wave4_cities_detect():
    assert detect_city(20.8449, 106.6881) == "haiphong"
    assert detect_city(10.0452, 105.7469) == "cantho"
    assert detect_city(16.4637, 107.5909) == "hue"


def test_point_in_city_hanoi():
    assert point_in_city(21.0285, 105.8542, "hanoi")
    assert not point_in_city(10.7769, 106.7009, "hanoi")


def test_detect_city_hcm_danang():
    assert detect_city(10.7769, 106.7009) == "hcm"
    assert detect_city(16.0544, 108.2022) == "danang"
    assert detect_city(0.0, 0.0) is None


def test_resolve_city_prefers_matching_declared():
    assert resolve_city(10.77, 106.70, "hcm") == "hcm"
    # Declared wrong → fall back to detect
    assert resolve_city(10.77, 106.70, "hanoi") == "hcm"


def test_get_bbox_overpass_format():
    bb = get_bbox("hcm")
    assert bb.min_lat < bb.max_lat
    assert bb.min_lng < bb.max_lng


def test_validate_auto_detects_city_when_missing():
    rec = {
        "name": "HCM Store",
        "type": "store",
        "address": "Quận 1",
        "latitude": 10.77,
        "longitude": 106.70,
    }
    result = validate_record(rec)
    assert result.ok
    assert rec["city"] == "hcm"


def test_validate_rejects_explicit_mismatch():
    result = validate_record(
        {
            "name": "Mismatch",
            "type": "store",
            "address": "HCM",
            "city": "hanoi",
            "latitude": 10.77,
            "longitude": 106.70,
        }
    )
    assert not result.ok
    assert "outside" in result.reason
