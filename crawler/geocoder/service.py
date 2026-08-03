"""Photon (primary) + Nominatim (fallback) geocoders — $0."""

from __future__ import annotations

import logging
import os
import time
from typing import Optional

import httpx
import psycopg

from processors.normalize import normalize_address

log = logging.getLogger(__name__)

PHOTON_BASE = os.getenv("PHOTON_BASE_URL", "https://photon.komoot.io/api/").rstrip("/") + "/"
NOMINATIM_BASE = os.getenv(
    "NOMINATIM_BASE_URL", "https://nominatim.openstreetmap.org/search"
)
USER_AGENT = os.getenv(
    "NOMINATIM_USER_AGENT",
    "MapPlatform-VinSmartFuture/1.0 (contact: dev@example.com)",
)
MIN_INTERVAL_MS = int(os.getenv("NOMINATIM_MIN_INTERVAL_MS", "1100"))

_last_nominatim_at = 0.0


def _cache_get(conn: psycopg.Connection, address: str) -> Optional[tuple[float, float]]:
    key = normalize_address(address)
    with conn.cursor() as cur:
        cur.execute(
            "SELECT latitude, longitude FROM geocode_cache WHERE address_normalized = %s",
            (key,),
        )
        row = cur.fetchone()
        return (float(row[0]), float(row[1])) if row else None


def _cache_set(
    conn: psycopg.Connection,
    address: str,
    lat: float,
    lng: float,
    provider: str,
) -> None:
    key = normalize_address(address)
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO geocode_cache (address_normalized, latitude, longitude, provider)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (address_normalized) DO NOTHING
            """,
            (key, lat, lng, provider),
        )
    conn.commit()


def geocode_photon(address: str) -> Optional[tuple[float, float]]:
    try:
        with httpx.Client(timeout=20.0) as client:
            r = client.get(PHOTON_BASE, params={"q": address, "limit": 1, "lang": "vi"})
            r.raise_for_status()
            data = r.json()
            feats = data.get("features") or []
            if not feats:
                return None
            coords = feats[0]["geometry"]["coordinates"]  # [lng, lat]
            return float(coords[1]), float(coords[0])
    except Exception as exc:  # noqa: BLE001
        log.warning("Photon failed for %s: %s", address, exc)
        return None


def geocode_nominatim(address: str) -> Optional[tuple[float, float]]:
    global _last_nominatim_at
    elapsed = (time.time() - _last_nominatim_at) * 1000
    if elapsed < MIN_INTERVAL_MS:
        time.sleep((MIN_INTERVAL_MS - elapsed) / 1000.0)
    try:
        with httpx.Client(timeout=20.0, headers={"User-Agent": USER_AGENT}) as client:
            r = client.get(
                NOMINATIM_BASE,
                params={"q": address, "format": "json", "limit": 1},
            )
            _last_nominatim_at = time.time()
            r.raise_for_status()
            data = r.json()
            if not data:
                return None
            return float(data[0]["lat"]), float(data[0]["lon"])
    except Exception as exc:  # noqa: BLE001
        log.warning("Nominatim failed for %s: %s", address, exc)
        return None


def geocode(
    conn: psycopg.Connection,
    address: str,
) -> Optional[tuple[float, float]]:
    cached = _cache_get(conn, address)
    if cached:
        return cached
    result = geocode_photon(address) or geocode_nominatim(address)
    if result:
        provider = "photon"  # approximate; fine for cache provenance
        _cache_set(conn, address, result[0], result[1], provider)
    return result
