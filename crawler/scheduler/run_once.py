"""One-shot crawl: VinFast seed + OSM Overpass (city-aware) → Postgres.

Env:
  CRAWL_CITIES=hanoi,hcm,danang,haiphong,cantho,hue
  CRAWL_SOURCES=vinfast,charging,parking,rescue,gas,university,hospital,pharmacy,atm,bank,police,fire_station,school,marketplace
  CRAWL_ONLY=vinfast|overpass|charging|...
"""

from __future__ import annotations

import logging
import os
import sys
from datetime import datetime, timezone
from functools import partial
from pathlib import Path
from typing import Callable

import psycopg
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from config.cities import ALL_CITY_CODES, CITIES  # noqa: E402
from deduplicator.upsert import ensure_source  # noqa: E402
from processors.pipeline import process_and_upsert  # noqa: E402
from sources.overpass_atm import fetch_atms  # noqa: E402
from sources.overpass_bank import fetch_banks  # noqa: E402
from sources.overpass_charging import fetch_charging_stations  # noqa: E402
from sources.overpass_fire_station import fetch_fire_stations  # noqa: E402
from sources.overpass_gas import fetch_gas_stations  # noqa: E402
from sources.overpass_hospital import fetch_hospitals  # noqa: E402
from sources.overpass_marketplace import fetch_marketplaces  # noqa: E402
from sources.overpass_parking import fetch_parking  # noqa: E402
from sources.overpass_pharmacy import fetch_pharmacies  # noqa: E402
from sources.overpass_police import fetch_police  # noqa: E402
from sources.overpass_rescue import fetch_rescue  # noqa: E402
from sources.overpass_school import fetch_schools  # noqa: E402
from sources.overpass_university import fetch_universities  # noqa: E402
from sources.vinfast_seed import OFFICIAL_URL, fetch_vinfast_locations  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("crawler.run_once")

# kind -> (source name suffix, fetcher)
OVERPASS_FETCHERS: dict[str, Callable] = {
    "charging": fetch_charging_stations,
    "parking": fetch_parking,
    "rescue": fetch_rescue,
    "gas": fetch_gas_stations,
    "university": fetch_universities,
    "hospital": fetch_hospitals,
    "pharmacy": fetch_pharmacies,
    "atm": fetch_atms,
    "bank": fetch_banks,
    "police": fetch_police,
    "fire_station": fetch_fire_stations,
    "school": fetch_schools,
    "marketplace": fetch_marketplaces,
}
OVERPASS_KINDS = tuple(OVERPASS_FETCHERS.keys())
DEFAULT_SOURCES = ("vinfast",) + OVERPASS_KINDS


def _run_source(
    conn: psycopg.Connection,
    *,
    name: str,
    type_: str,
    url: str,
    fetcher: Callable[[], list[dict]],
) -> dict:
    started = datetime.now(timezone.utc)
    source_id = ensure_source(conn, name=name, type_=type_, url=url)

    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO crawl_jobs (source_id, started_at, status)
            VALUES (%s::uuid, %s, 'running')
            RETURNING id
            """,
            (source_id, started),
        )
        job_id = cur.fetchone()[0]
        conn.commit()

    try:
        records = fetcher()
        stats = process_and_upsert(
            conn,
            source_id,
            records,
            crawl_job_id=str(job_id),
            crawl_started_at=started,
        )
        msg = (
            f"{name}: found={len(records)} prepared={stats.get('prepared', 0)} "
            f"created={stats['created']} updated={stats['updated']} "
            f"deactivated={stats.get('deactivated', 0)} "
            f"rejected={stats.get('rejected', 0)} geocoded={stats.get('geocoded', 0)} "
            f"warnings={stats.get('warnings', 0)}"
        )
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE crawl_jobs SET
                  status = 'success',
                  finished_at = %s,
                  records_found = %s,
                  records_created = %s,
                  records_updated = %s,
                  records_deactivated = %s
                WHERE id = %s
                """,
                (
                    datetime.now(timezone.utc),
                    len(records),
                    stats["created"],
                    stats["updated"],
                    stats.get("deactivated", 0),
                    job_id,
                ),
            )
            cur.execute(
                "INSERT INTO crawl_logs (crawl_job_id, level, message) VALUES (%s, 'INFO', %s)",
                (job_id, msg),
            )
            conn.commit()
        log.info(msg)
        return {"source": name, "ok": True, **stats, "found": len(records)}
    except Exception as exc:  # noqa: BLE001
        log.exception("Source %s failed", name)
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE crawl_jobs SET status = 'failed', finished_at = %s, error_message = %s
                WHERE id = %s
                """,
                (datetime.now(timezone.utc), str(exc), job_id),
            )
            cur.execute(
                "INSERT INTO crawl_logs (crawl_job_id, level, message) VALUES (%s, 'ERROR', %s)",
                (job_id, str(exc)),
            )
            conn.commit()
        return {"source": name, "ok": False, "error": str(exc)}


def _parse_cities() -> list[str]:
    raw = os.getenv("CRAWL_CITIES", "").strip()
    if not raw:
        return list(ALL_CITY_CODES)
    cities: list[str] = []
    for part in raw.split(","):
        code = part.strip()
        if not code:
            continue
        if code not in CITIES:
            log.warning("Unknown city '%s' in CRAWL_CITIES, skipping", code)
            continue
        cities.append(code)
    return cities or ["hanoi"]


def _parse_sources() -> set[str]:
    only = os.getenv("CRAWL_ONLY", "").strip().lower()
    if only == "vinfast":
        return {"vinfast"}
    if only in ("overpass", "overpass_all"):
        return set(OVERPASS_KINDS)
    aliases = {
        "charging": "charging",
        "overpass_charging": "charging",
        "parking": "parking",
        "overpass_parking": "parking",
        "rescue": "rescue",
        "overpass_rescue": "rescue",
        "gas": "gas",
        "fuel": "gas",
        "gas_station": "gas",
        "overpass_gas": "gas",
        "university": "university",
        "overpass_university": "university",
        "hospital": "hospital",
        "overpass_hospital": "hospital",
        "pharmacy": "pharmacy",
        "atm": "atm",
        "bank": "bank",
        "police": "police",
        "fire_station": "fire_station",
        "fire": "fire_station",
        "school": "school",
        "marketplace": "marketplace",
        "mall": "marketplace",
    }
    if only in aliases:
        return {aliases[only]}

    raw = os.getenv("CRAWL_SOURCES", "").strip().lower()
    if not raw:
        return set(DEFAULT_SOURCES)

    out: set[str] = set()
    for part in raw.split(","):
        s = part.strip()
        if not s:
            continue
        if s in ("overpass", "overpass_all"):
            out.update(OVERPASS_KINDS)
        elif s in aliases:
            out.add(aliases[s])
        elif s in DEFAULT_SOURCES or s in OVERPASS_KINDS:
            out.add(s)
        else:
            log.warning("Unknown CRAWL_SOURCES entry '%s', skipping", s)
    return out or set(DEFAULT_SOURCES)


def main() -> None:
    load_dotenv(ROOT.parent / ".env")
    dsn = os.getenv("DATABASE_URL")
    if not dsn:
        raise SystemExit("DATABASE_URL is required")

    cities = _parse_cities()
    sources = _parse_sources()
    log.info("Crawl cities=%s sources=%s", cities, sorted(sources))

    overpass_url = os.getenv("OVERPASS_URL", "https://overpass-api.de/api/interpreter")
    results: list[dict] = []

    with psycopg.connect(dsn) as conn:
        if "vinfast" in sources:
            results.append(
                _run_source(
                    conn,
                    name="vinfast_official",
                    type_="official_website",
                    url=OFFICIAL_URL,
                    fetcher=fetch_vinfast_locations,
                )
            )

        for city in cities:
            for kind in OVERPASS_KINDS:
                if kind not in sources:
                    continue
                log.info("Overpass %s city=%s", kind, city)
                results.append(
                    _run_source(
                        conn,
                        name=f"osm_overpass_{kind}_{city}",
                        type_="openstreetmap",
                        url=overpass_url,
                        fetcher=partial(OVERPASS_FETCHERS[kind], city),
                    )
                )

    failed = [r for r in results if not r.get("ok")]
    if results and failed and len(failed) == len(results):
        raise SystemExit("All crawl sources failed")
    log.info("Crawl finished: %s", results)


if __name__ == "__main__":
    main()
