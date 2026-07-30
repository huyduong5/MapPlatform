"""Tests for POI name quality rules."""

from processors.name_quality import (
    is_real_poi_name,
    is_synthetic_osm_name,
    resolve_osm_display_name,
)


def test_is_synthetic_osm_name():
    assert is_synthetic_osm_name("Trường OSM #4493605992")
    assert is_synthetic_osm_name("Nhà thuốc OSM #1000087196")
    assert not is_synthetic_osm_name("Trường THCS Nguyễn Du")


def test_is_real_poi_name():
    assert is_real_poi_name("Trường THCS Nguyễn Du")
    assert not is_real_poi_name("Trường OSM #1")
    assert not is_real_poi_name("A")
    assert not is_real_poi_name("ATM")
    assert not is_real_poi_name("")


def test_resolve_osm_display_name_prefers_name_then_brand():
    assert resolve_osm_display_name({"name": "PV Power", "brand": "Other"}) == "PV Power"
    assert resolve_osm_display_name({"brand": "Petrolimex"}) == "Petrolimex"
    assert resolve_osm_display_name({"operator": "EVN"}) == "EVN"
    assert resolve_osm_display_name({"amenity": "school"}) is None
