# Hà Nội GTFS for OpenTripPlanner (optional transit profile)

Place a validated GTFS zip (or extracted feed) here, plus a Vietnam/Hanoi OSM extract if building a graph from scratch.

## Quick start

1. Download a Hanoi GTFS feed (e.g. TUMI / World Bank catalog) into this folder as `hanoi.gtfs.zip`.
2. Build an OTP graph (one-time, heavy). Example with OTP CLI:

```bash
# After placing GTFS + OSM PBF in this directory:
docker compose --profile transit run --rm otp --build --save
docker compose --profile transit up -d otp
```

3. Point the API at OTP:

```bash
OTP_BASE_URL=http://127.0.0.1:8080
OTP_CITIES=hanoi
```

Without OTP, `/api/decide` with `travelMode=transit` still works in **degraded** mode (walk stubs + Google Maps transit deep-link + nearby `bus_stop` / `subway_station` from Overpass crawl).

## Crawl transit stops into PostGIS

```bash
CRAWL_SOURCES=bus_stop,subway_station CRAWL_CITY=hanoi python -m scheduler.run_once
```

Apply DB migration `database/migrations/007_transit_stop_types.sql` before upserting.
