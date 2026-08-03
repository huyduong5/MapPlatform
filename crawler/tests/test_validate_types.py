"""Extra Phase 5 validation coverage."""

from processors.validate import validate_record


def test_accepts_showroom():
    r = validate_record(
        {
            "name": "Showroom Test",
            "type": "showroom",
            "address": "Hà Nội",
            "city": "hanoi",
            "latitude": 21.0,
            "longitude": 105.85,
        }
    )
    assert r.ok


def test_accepts_service_center():
    r = validate_record(
        {
            "name": "Service Test",
            "type": "service_center",
            "address": "Hà Nội",
            "city": "hanoi",
            "latitude": 21.01,
            "longitude": 105.86,
        }
    )
    assert r.ok


def test_accepts_hcm_if_city_hcm():
    r = validate_record(
        {
            "name": "HCM",
            "type": "store",
            "address": "TP HCM",
            "city": "hcm",
            "latitude": 10.77,
            "longitude": 106.7,
        }
    )
    assert r.ok


def test_rejects_hcm_if_city_hanoi():
    r = validate_record(
        {
            "name": "HCM but tagged Hanoi",
            "type": "store",
            "address": "TP HCM",
            "city": "hanoi",
            "latitude": 10.77,
            "longitude": 106.7,
        }
    )
    assert not r.ok
