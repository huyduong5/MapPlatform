"""End-to-end processing pipeline for one source batch."""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

import psycopg

from geocoder.service import geocode
from processors.clean import clean_record
from processors.normalize import normalize_name
from processors.validate import validate_record
from deduplicator.upsert import upsert_locations

log = logging.getLogger(__name__)


def process_and_upsert(
    conn: psycopg.Connection,
    source_id: str,
    raw_records: list[dict[str, Any]],
    crawl_job_id: str | None = None,
    crawl_started_at: datetime | None = None,
) -> dict[str, int]:
    prepared: list[dict[str, Any]] = []
    rejected = 0
    geocoded = 0
    warnings = 0

    for raw in raw_records:
        rec = clean_record(raw)
        rec["name"] = normalize_name(rec.get("name") or "")

        # If we don't have coords yet, geocode by address.
        # Validation (city bbox) happens later in validate_record/upsert_locations.
        if rec.get("latitude") is None or rec.get("longitude") is None:
            coords = geocode(conn, rec["address"])
            if not coords:
                rejected += 1
                log.warning("Geocode failed: %s", rec.get("address"))
                continue
            rec["latitude"], rec["longitude"] = coords
            geocoded += 1

        result = validate_record(rec)
        if not result.ok:
            rejected += 1
            log.debug("Reject %s: %s", rec.get("name"), result.reason)
            continue
        if result.warning:
            warnings += 1
            log.info("Warning %s: %s", rec.get("name"), result.warning)
            if crawl_job_id:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO crawl_logs (crawl_job_id, level, message, review_status)
                        VALUES (%s, 'WARNING', %s, 'open')
                        """,
                        (crawl_job_id, f"{rec.get('name')}: {result.warning}"),
                    )
                conn.commit()
        prepared.append(rec)

    stats = upsert_locations(
        conn,
        source_id,
        prepared,
        crawl_started_at=crawl_started_at,
        deactivate_stale=True,
    )
    stats["rejected"] = rejected
    stats["geocoded"] = geocoded
    stats["prepared"] = len(prepared)
    stats["warnings"] = warnings
    return stats
