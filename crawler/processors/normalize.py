"""Normalize Vietnamese address / name helpers."""

from __future__ import annotations

import re
import unicodedata


def strip_accents(text: str) -> str:
    normalized = unicodedata.normalize("NFD", text)
    return "".join(c for c in normalized if unicodedata.category(c) != "Mn")


def normalize_whitespace(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def normalize_address(address: str) -> str:
    return normalize_whitespace(address).lower()


def normalize_name(name: str) -> str:
    return normalize_whitespace(name)


def looks_like_hanoi(address: str) -> bool:
    a = strip_accents(address).lower()
    keywords = [
        "ha noi",
        "hanoi",
        "hoan kiem",
        "ba dinh",
        "cau giay",
        "dong da",
        "hai ba trung",
        "thanh xuan",
        "long bien",
        "nam tu liem",
        "bac tu liem",
        "ha dong",
        "gia lam",
        "dong anh",
        "soc son",
        "thuong tin",
        "thanh tri",
        "hoang mai",
        "tay ho",
    ]
    return any(k in a for k in keywords)
