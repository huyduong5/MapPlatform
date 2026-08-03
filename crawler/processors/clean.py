"""Clean raw extracted fields."""

from __future__ import annotations

import re


def clean_text(value: str | None) -> str:
    if not value:
        return ""
    text = re.sub(r"<[^>]+>", " ", value)
    text = text.replace("\xa0", " ")
    return re.sub(r"\s+", " ", text).strip()


def clean_phone(value: str | None) -> str | None:
    if not value:
        return None
    digits = re.sub(r"[^\d+]", "", value)
    return digits or None


def clean_record(raw: dict) -> dict:
    return {
        **raw,
        "name": clean_text(raw.get("name")),
        "address": clean_text(raw.get("address")),
        "phone": clean_phone(raw.get("phone")),
        "opening_hours": clean_text(raw.get("opening_hours")) or None,
        "source_url": clean_text(raw.get("source_url")) or None,
        "source_record_id": clean_text(raw.get("source_record_id")) or None,
        "type": (raw.get("type") or "charging_station").strip().lower(),
    }
