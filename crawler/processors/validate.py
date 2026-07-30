"""Validate records before upsert (city-aware)."""

from __future__ import annotations

from dataclasses import dataclass

from config.cities import is_city_code, resolve_city
from processors.name_quality import is_real_poi_name

ALLOWED_TYPES = {
    "charging_station",
    "store",
    "service_center",
    "showroom",
    "dealer",
    "parking",
    "rescue_team",
    "gas_station",
    "university",
    "hospital",
    "pharmacy",
    "atm",
    "bank",
    "police",
    "fire_station",
    "school",
    "marketplace",
}


@dataclass
class ValidationResult:
    ok: bool
    reason: str = ""
    warning: str = ""


def validate_record(rec: dict) -> ValidationResult:
    name = rec.get("name") or ""
    address = rec.get("address") or ""
    loc_type = rec.get("type") or ""
    lat = rec.get("latitude")
    lng = rec.get("longitude")
    declared = rec.get("city")

    if not name:
        return ValidationResult(False, "missing name")
    if not is_real_poi_name(name):
        return ValidationResult(False, "invalid or synthetic name")
    if not address:
        return ValidationResult(False, "missing address")
    if loc_type not in ALLOWED_TYPES:
        return ValidationResult(False, f"invalid type: {loc_type}")
    if lat is None or lng is None:
        return ValidationResult(False, "missing coordinates")
    try:
        lat_f = float(lat)
        lng_f = float(lng)
    except (TypeError, ValueError):
        return ValidationResult(False, "invalid coordinates")
    if not (-90 <= lat_f <= 90 and -180 <= lng_f <= 180):
        return ValidationResult(False, "coordinates out of world range")

    # Explicit wrong city vs coords → reject (data quality)
    if is_city_code(declared):
        from config.cities import point_in_city

        if not point_in_city(lat_f, lng_f, declared):
            return ValidationResult(False, f"outside {declared} bbox")
        rec["city"] = declared
        return ValidationResult(True)

    # Missing/unknown city → auto-detect from coords
    city = resolve_city(lat_f, lng_f, declared if isinstance(declared, str) else None)
    if city is None:
        return ValidationResult(False, "outside all known city bboxes")
    rec["city"] = city
    return ValidationResult(True)
