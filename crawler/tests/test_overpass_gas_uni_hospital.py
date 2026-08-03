"""Tests for Overpass gas / university / hospital mappers."""

from config.cities import get_bbox
from sources.overpass_gas import _build_query as gas_query
from sources.overpass_gas import _map_elements as gas_map
from sources.overpass_hospital import _build_query as hospital_query
from sources.overpass_hospital import _map_elements as hospital_map
from sources.overpass_university import _build_query as uni_query
from sources.overpass_university import _map_elements as uni_map
from sources.overpass_university import _merge_hanoi_seed
from sources.overpass_university import _priority


def test_gas_query_uses_fuel_tag():
    q = gas_query(get_bbox("hanoi"))
    assert 'amenity"="fuel"' in q
    assert "20.53,105.29,21.23,106.02" in q.replace(" ", "")


def test_university_query_includes_college_not_building_blocks():
    q = uni_query(get_bbox("hanoi"))
    assert 'amenity"="university"' in q
    assert "college" in q
    assert 'building"="university"' not in q


def test_hospital_query():
    q = hospital_query(get_bbox("hanoi"))
    assert 'amenity"="hospital"' in q


def test_gas_map_type():
    data = {
        "elements": [
            {
                "type": "node",
                "id": 1,
                "lat": 21.02,
                "lon": 105.85,
                "tags": {"name": "Petrolimex", "amenity": "fuel"},
            }
        ]
    }
    rows = gas_map(data, "hanoi")
    assert rows[0]["type"] == "gas_station"
    assert rows[0]["name"] == "Petrolimex"


def test_university_map_type():
    data = {
        "elements": [
            {
                "type": "node",
                "id": 2,
                "lat": 21.0,
                "lon": 105.84,
                "tags": {"name": "ĐH Bách Khoa", "amenity": "university"},
            }
        ]
    }
    rows = uni_map(data, "hanoi")
    assert rows[0]["type"] == "university"


def test_university_priority_puts_major_first():
    major = _priority("Trường Đại học Khoa học Tự nhiên")
    minor = _priority("Cao đẳng nghề ABC")
    fragment = _priority("Tòa E3 - Đại học Công Nghệ")
    assert major < minor
    assert major < fragment


def test_merge_seed_adds_khtn_when_missing():
    rows = _merge_hanoi_seed([])
    names = " | ".join(r["name"] for r in rows)
    assert "Khoa học Tự nhiên" in names
    assert "Xã hội và Nhân văn" in names


def test_university_skips_faculty_fragments():
    data = {
        "elements": [
            {
                "type": "node",
                "id": 9,
                "lat": 21.0,
                "lon": 105.84,
                "tags": {
                    "name": "Khoa Công nghệ Thông tin - Đại học Mở Hà Nội",
                    "amenity": "university",
                },
            },
            {
                "type": "node",
                "id": 11,
                "lat": 21.0,
                "lon": 105.85,
                "tags": {"name": "A12", "amenity": "university"},
            },
            {
                "type": "node",
                "id": 10,
                "lat": 20.9959,
                "lon": 105.808,
                "tags": {"name": "Trường Đại học Khoa học Tự nhiên", "amenity": "university"},
            },
        ]
    }
    rows = uni_map(data, "hanoi")
    names = [r["name"] for r in rows]
    assert "Trường Đại học Khoa học Tự nhiên" in names
    assert not any(n.startswith("Khoa ") for n in names)
    assert "A12" not in names


def test_hospital_map_type():
    data = {
        "elements": [
            {
                "type": "node",
                "id": 3,
                "lat": 21.01,
                "lon": 105.84,
                "tags": {"name": "Bạch Mai", "amenity": "hospital"},
            }
        ]
    }
    rows = hospital_map(data, "hanoi")
    assert rows[0]["type"] == "hospital"
