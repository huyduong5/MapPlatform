"""Upsert locations into PostgreSQL geo schema — bulk ON CONFLICT + deactivate-missing."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

import psycopg

from config.cities import resolve_city
from processors.normalize import normalize_name

log = logging.getLogger(__name__)

BATCH_SIZE = 200


def ensure_source(conn: psycopg.Connection, name: str, type_: str, url: str | None) -> str:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO sources (name, type, url, status)
            VALUES (%s, %s, %s, 'active')
            ON CONFLICT (name) DO UPDATE SET url = EXCLUDED.url, updated_at = now()
            RETURNING id::text
            """,
            (name, type_, url),
        )
        row = cur.fetchone()
        assert row
        conn.commit()
        return row[0]


def _prepare_row(
    raw: dict[str, Any], source_id: str, now: datetime
) -> tuple[Any, ...] | None:
    name = normalize_name(raw.get("name") or "")
    address = (raw.get("address") or "").strip()
    lat = raw.get("latitude")
    lng = raw.get("longitude")
    if not name or not address or lat is None or lng is None:
        return None

    flat, flng = float(lat), float(lng)
    city = resolve_city(flat, flng, raw.get("city") if isinstance(raw.get("city"), str) else None)
    if city is None:
        log.debug(
            "Skip %s: coords (%.4f, %.4f) outside all known cities",
            name,
            flat,
            flng,
        )
        return None

    rating = raw.get("rating")
    try:
        rating_f = float(rating) if rating is not None else None
    except (TypeError, ValueError):
        rating_f = None
    rating_count = raw.get("rating_count")
    try:
        rating_count_i = int(rating_count) if rating_count is not None else None
    except (TypeError, ValueError):
        rating_count_i = None

    return (
        name,
        raw.get("type") or "charging_station",
        address,
        flat,
        flng,
        city,
        raw.get("phone"),
        raw.get("opening_hours"),
        raw.get("website"),
        raw.get("brand"),
        rating_f,
        rating_count_i,
        raw.get("rating_source"),
        source_id,
        raw.get("source_record_id"),
        raw.get("source_url"),
        now,
        now,
    )


def deactivate_missing(
    conn: psycopg.Connection,
    source_id: str,
    seen_before: datetime,
) -> int:
    """Mark active rows for this source as inactive if not seen in the current crawl."""
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE locations SET
              status = 'inactive',
              updated_at = now()
            WHERE source_id = %s::uuid
              AND status = 'active'
              AND (last_seen_at IS NULL OR last_seen_at < %s)
            """,
            (source_id, seen_before),
        )
        n = cur.rowcount or 0
    conn.commit()
    if n:
        log.info("Deactivated %s stale locations for source_id=%s", n, source_id)
    return n


_UPSERT_SQL = """
INSERT INTO locations (
  name, type, address, latitude, longitude, status, city,
  phone, opening_hours, website, brand, rating, rating_count, rating_source,
  source_id, source_record_id, source_url,
  last_seen_at, last_updated
) VALUES (
  %s, %s, %s, %s, %s, 'active', %s,
  %s, %s, %s, %s, %s, %s, %s,
  %s::uuid, %s, %s,
  %s, %s
)
ON CONFLICT (source_id, source_record_id) WHERE source_record_id IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  type = EXCLUDED.type,
  address = EXCLUDED.address,
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  city = EXCLUDED.city,
  status = 'active',
  phone = EXCLUDED.phone,
  opening_hours = EXCLUDED.opening_hours,
  website = COALESCE(EXCLUDED.website, locations.website),
  brand = COALESCE(EXCLUDED.brand, locations.brand),
  rating = COALESCE(EXCLUDED.rating, locations.rating),
  rating_count = COALESCE(EXCLUDED.rating_count, locations.rating_count),
  rating_source = COALESCE(EXCLUDED.rating_source, locations.rating_source),
  source_url = EXCLUDED.source_url,
  last_seen_at = EXCLUDED.last_seen_at,
  last_updated = EXCLUDED.last_updated,
  updated_at = now()
RETURNING (xmax = 0) AS inserted
"""


def upsert_locations(
    conn: psycopg.Connection,
    source_id: str,
    records: list[dict[str, Any]],
    *,
    crawl_started_at: datetime | None = None,
    deactivate_stale: bool = True,
) -> dict[str, int]:
    created = updated = skipped = 0
    deactivated = 0
    now = datetime.now(timezone.utc)
    job_start = crawl_started_at or now

    with_ids: list[tuple[Any, ...]] = []
    without_ids: list[tuple[Any, ...]] = []

    for raw in records:
        row = _prepare_row(raw, source_id, now)
        if row is None:
            skipped += 1
            continue
        if row[14]:  # source_record_id
            with_ids.append(row)
        else:
            without_ids.append(row)

    with conn.cursor() as cur:
        for i in range(0, len(with_ids), BATCH_SIZE):
            batch = with_ids[i : i + BATCH_SIZE]
            for row in batch:
                cur.execute(_UPSERT_SQL, row)
                r = cur.fetchone()
                if r and r[0]:
                    created += 1
                else:
                    updated += 1

        for row in without_ids:
            (
                name,
                typ,
                address,
                flat,
                flng,
                city,
                phone,
                hours,
                website,
                brand,
                rating,
                rating_count,
                rating_source,
                sid,
                _srid,
                surl,
                seen,
                upd,
            ) = row
            cur.execute(
                """
                SELECT id FROM locations
                WHERE source_id = %s::uuid AND lower(name) = lower(%s) AND lower(address) = lower(%s)
                LIMIT 1
                """,
                (sid, name, address),
            )
            existing = cur.fetchone()
            if existing:
                cur.execute(
                    """
                    UPDATE locations SET
                      name = %s, type = %s, address = %s,
                      latitude = %s, longitude = %s, city = %s, status = 'active',
                      phone = %s, opening_hours = %s,
                      website = COALESCE(%s, website),
                      brand = COALESCE(%s, brand),
                      rating = COALESCE(%s, rating),
                      rating_count = COALESCE(%s, rating_count),
                      rating_source = COALESCE(%s, rating_source),
                      source_url = %s,
                      last_seen_at = %s, last_updated = %s, updated_at = now()
                    WHERE id = %s
                    """,
                    (
                        name,
                        typ,
                        address,
                        flat,
                        flng,
                        city,
                        phone,
                        hours,
                        website,
                        brand,
                        rating,
                        rating_count,
                        rating_source,
                        surl,
                        seen,
                        upd,
                        existing[0],
                    ),
                )
                updated += 1
            else:
                cur.execute(
                    """
                    INSERT INTO locations (
                      name, type, address, latitude, longitude, status, city,
                      phone, opening_hours, website, brand, rating, rating_count, rating_source,
                      source_id, source_record_id, source_url,
                      last_seen_at, last_updated
                    ) VALUES (
                      %s, %s, %s, %s, %s, 'active', %s,
                      %s, %s, %s, %s, %s, %s, %s,
                      %s::uuid, NULL, %s, %s, %s
                    )
                    """,
                    (
                        name,
                        typ,
                        address,
                        flat,
                        flng,
                        city,
                        phone,
                        hours,
                        website,
                        brand,
                        rating,
                        rating_count,
                        rating_source,
                        sid,
                        surl,
                        seen,
                        upd,
                    ),
                )
                created += 1

        cur.execute(
            "UPDATE sources SET last_crawled_at = %s, updated_at = now() WHERE id = %s::uuid",
            (now, source_id),
        )
    conn.commit()

    if deactivate_stale:
        deactivated = deactivate_missing(conn, source_id, job_start)

    return {
        "created": created,
        "updated": updated,
        "skipped": skipped,
        "deactivated": deactivated,
    }
