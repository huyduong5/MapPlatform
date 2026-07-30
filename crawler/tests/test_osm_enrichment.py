"""Tests for OSM address / enrichment mapping."""

from sources.overpass_common import _build_address, map_osm_element


def test_build_address_vn_order():
    tags = {
        "addr:housenumber": "227",
        "addr:street": "Nguyễn Văn Cừ",
        "addr:district": "Quận 5",
        "addr:city": "Hồ Chí Minh",
    }
    addr = _build_address(tags, "Hồ Chí Minh")
    assert addr.startswith("227 Nguyễn Văn Cừ")
    assert "Quận 5" in addr
    assert "Việt Nam" in addr


def test_map_osm_website_brand():
    el = {
        "type": "node",
        "id": 123,
        "lat": 21.02,
        "lon": 105.85,
        "tags": {
            "name": "PV Power",
            "amenity": "charging_station",
            "website": "https://example.com",
            "brand": "PV Power",
            "phone": "+84 24 1234",
            "opening_hours": "Mo-Su 08:00-22:00",
            "addr:street": "Phố Huế",
            "addr:housenumber": "12",
            "addr:city": "Hà Nội",
        },
    }
    rec = map_osm_element(el, city="hanoi", loc_type="charging_station", default_name_prefix="Trạm")
    assert rec is not None
    assert rec["website"] == "https://example.com"
    assert rec["phone"] == "+84 24 1234"
    assert "Phố Huế" in rec["address"]
    assert rec["opening_hours"] == "Mo-Su 08:00-22:00"


def test_map_osm_skips_unnamed_without_brand():
    el = {
        "type": "node",
        "id": 4493605992,
        "lat": 21.02,
        "lon": 105.85,
        "tags": {
            "amenity": "school",
            "addr:street": "Hoàng Đạo Thúy",
            "addr:housenumber": "25T1",
        },
    }
    rec = map_osm_element(el, city="hanoi", loc_type="school", default_name_prefix="Trường")
    assert rec is None


def test_map_osm_uses_brand_when_no_name():
    el = {
        "type": "node",
        "id": 99,
        "lat": 21.02,
        "lon": 105.85,
        "tags": {
            "amenity": "charging_station",
            "brand": "VinFast",
            "addr:city": "Hà Nội",
        },
    }
    rec = map_osm_element(el, city="hanoi", loc_type="charging_station", default_name_prefix="Trạm")
    assert rec is not None
    assert rec["name"] == "VinFast"

