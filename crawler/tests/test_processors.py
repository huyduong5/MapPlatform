from processors.clean import clean_phone, clean_record, clean_text
from processors.validate import validate_record


def test_clean_text_strips_html_and_spaces():
    assert clean_text("  <b>VinFast</b>   Times  ") == "VinFast Times"


def test_clean_phone():
    assert clean_phone("1900-23-23-89") == "1900232389"
    assert clean_phone(None) is None


def test_clean_record():
    rec = clean_record(
        {
            "name": "  Store  ",
            "address": "Hà Nội",
            "type": "STORE",
            "phone": "0123 456",
        }
    )
    assert rec["name"] == "Store"
    assert rec["type"] == "store"
    assert rec["phone"] == "0123456"


def test_validate_ok_hanoi():
    result = validate_record(
        {
            "name": "Trạm A",
            "type": "charging_station",
            "address": "Hai Bà Trưng, Hà Nội",
            "city": "hanoi",
            "latitude": 21.01,
            "longitude": 105.85,
        }
    )
    assert result.ok


def test_validate_accepts_hcm_bbox_when_city_matches():
    result = validate_record(
        {
            "name": "VinFast HCM",
            "type": "store",
            "address": "Quận 1, TP.HCM",
            "city": "hcm",
            "latitude": 10.77,
            "longitude": 106.70,
        }
    )
    assert result.ok


def test_validate_rejects_when_city_mismatch():
    result = validate_record(
        {
            "name": "Mismatch city",
            "type": "store",
            "address": "Quận 1, TP.HCM",
            "city": "hanoi",
            "latitude": 10.77,
            "longitude": 106.70,
        }
    )
    assert not result.ok
    assert "outside" in result.reason


def test_validate_rejects_synthetic_osm_name():
    result = validate_record(
        {
            "name": "Trường OSM #4493605992",
            "type": "school",
            "address": "Hoàng Đạo Thúy, Hà Nội",
            "city": "hanoi",
            "latitude": 21.01,
            "longitude": 105.85,
        }
    )
    assert not result.ok
    assert "synthetic" in result.reason


def test_validate_rejects_single_letter_name():
    result = validate_record(
        {
            "name": "A",
            "type": "atm",
            "address": "Hà Nội, Việt Nam",
            "city": "hanoi",
            "latitude": 21.01,
            "longitude": 105.85,
        }
    )
    assert not result.ok
