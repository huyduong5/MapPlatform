"""Tests for Overpass parking / rescue query builders + mappers."""

from sources.overpass_parking import _build_query as parking_query
from sources.overpass_parking import _map_elements as parking_map
from sources.overpass_rescue import _build_query as rescue_query
from sources.overpass_rescue import _map_elements as rescue_map
from config.cities import get_bbox


def test_parking_query_uses_city_bbox():
    q = parking_query(get_bbox("hcm"))
    assert "10.65,106.55,10.9,106.85" in q.replace(" ", "")
    assert 'amenity"="parking"' in q


def test_rescue_query_includes_emergency_tags():
    q = rescue_query(get_bbox("danang"))
    assert "15.95,108.1,16.15,108.3" in q.replace(" ", "")
    assert "ambulance_station" in q
    assert "fire_station" in q


def test_parking_map_sets_type_and_city():
    data = {
        "elements": [
            {
                "type": "node",
                "id": 1,
                "lat": 10.78,
                "lon": 106.70,
                "tags": {"name": "Bãi Q1", "amenity": "parking"},
            }
        ]
    }
    rows = parking_map(data, "hcm")
    assert len(rows) == 1
    assert rows[0]["type"] == "parking"
    assert rows[0]["city"] == "hcm"
    assert rows[0]["name"] == "Bãi Q1"


def test_rescue_map_sets_rescue_team():
    data = {
        "elements": [
            {
                "type": "node",
                "id": 99,
                "lat": 21.03,
                "lon": 105.85,
                "tags": {"name": "PCCC Ba Đình", "amenity": "fire_station"},
            }
        ]
    }
    rows = rescue_map(data, "hanoi")
    assert len(rows) == 1
    assert rows[0]["type"] == "rescue_team"
    assert rows[0]["city"] == "hanoi"
