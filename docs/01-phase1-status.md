# Phase 1 — Geo Data Foundation (implementation status)

> Bám [`../context.md`](../context.md) deliverables + DoD.  
> Bootstrap: [`00-phase0-bootstrap.md`](./00-phase0-bootstrap.md).  
> **Status: DONE** (2026-07-28) — DoD checkbox trong `context.md` đã tick.

## Đã hoàn thành trong code

| # | Deliverable | Trạng thái |
|---|---|---|
| 01 | Data Model | ✅ SQL `database/migrations/001_init_schema.sql` |
| 02 | PostgreSQL + PostGIS | ✅ Docker `db` (host port **5433**) |
| 03 | Crawler | ✅ Overpass live + VinFast curated seed |
| 04 | Data Processing | ✅ clean → validate → geocode → upsert |
| 05 | Geocoding | ✅ Photon → Nominatim + cache |
| 06 | Deduplication | ✅ theo `source_record_id` / name+address |
| 07 | Daily Scheduler | ✅ APScheduler trong `crawler` |
| 08–11 | REST list/detail/search/filter/nearby | ✅ `apps/api` (`:3001`) |
| 12–16 | Map UI layers/markers/popup/detail | ✅ `apps/web` Leaflet (`:3002`) |
| 17 | E2E smoke | ✅ `scripts/smoke-api.sh` |
| 18 | Testing | ✅ pytest processors (5) + vitest query builder (2) |

## Kết quả crawl đã verify

| Nguồn | Kết quả |
|---|---|
| VinFast seed | Store + charging curated → upsert OK |
| OSM Overpass | **312** charging stations (live `overpass-api.de`) |
| DB active | **~316** `charging_station`, **~6** `store` |

## Chạy Phase 1

```bash
docker compose up -d db
# migrate/seed nếu cần (xem phase 0)

nvm use 20 && pnpm install
pnpm dev:api   # :3001
pnpm dev:web   # :3002

# Crawl (VinFast seed + OSM Overpass)
docker compose build crawler
docker compose run --rm -e CRAWL_ON_START=0 crawler python -m scheduler.run_once
# chỉ Overpass: -e CRAWL_ONLY=overpass

# Smoke
chmod +x scripts/smoke-api.sh && ./scripts/smoke-api.sh

# Unit tests
docker compose run --rm -e PYTHONPATH=/app crawler pytest -q
pnpm --filter @mapplatform/web test
```

## Ghi chú VinFast P0

Trang official là SPA, **không** có API JSON công khai ổn định → Phase 1 dùng **seed curated** (`crawler/sources/data/vinfast_hanoi_seed.json`) trỏ về URL official. Khi bắt được XHR thật, thay `sources/vinfast_seed.py`.

Overpass đôi khi timeout trên mirror; crawler thử nhiều endpoint + seed fallback.

## Success criteria

> Ở Hà Nội, các Trạm sạc và Store đang ở đâu?

Người dùng mở map → bật layer → search / Near Me → xem chi tiết.
