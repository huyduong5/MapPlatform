# crawler — Python + Crawl4AI (Phase 1)

Service Docker: **`crawler`** (bắt buộc trong `docker-compose.yml`).

Ghi dữ liệu vào **PostgreSQL** (SQL hoặc Payload REST tại `PAYLOAD_API_URL=http://api:3001`).

## Tài liệu

- `docs/00-tech-decisions.md`
- `docs/02-data-crawling.md` (Source Registry)

## Layout

```
crawler/
├── config/cities.py     # City bbox registry (hanoi|hcm|danang)
├── sources/
├── processors/
├── geocoder/
├── deduplicator/
├── scheduler/
├── Dockerfile
└── requirements.txt
```

## Chạy

```bash
docker compose up -d crawler
# All cities (default) — VinFast seed + Overpass charging per city
docker compose run --rm crawler python -m scheduler.run_once

# Chỉ Hà Nội / chỉ Overpass
docker compose run --rm -e CRAWL_CITIES=hanoi -e CRAWL_ONLY=overpass crawler python -m scheduler.run_once

docker compose logs -f crawler
```

## City-aware (Step 1)

- Overpass query dùng bbox theo `CRAWL_CITIES` (không hardcode Hà Nội).
- Upsert/validate chấp nhận `hanoi|hcm|danang`; toạ độ ngoài bbox → skip/reject.
- Seed VinFast/Overpass fallback stamp `city=hanoi`.

## Parking + rescue (Step 2)

```bash
# Chỉ parking + rescue, Hà Nội
docker compose run --rm \
  -e CRAWL_CITIES=hanoi \
  -e CRAWL_SOURCES=parking,rescue \
  crawler python -m scheduler.run_once

# Full: vinfast + charging + parking + rescue (3 cities)
docker compose run --rm crawler python -m scheduler.run_once
```

- `sources/overpass_parking.py` — `amenity=parking` (ưu tiên có `name` / multi-storey), cap `OVERPASS_PARKING_MAX` (default 80)
- `sources/overpass_rescue.py` — ambulance / fire / SES stations → type `rescue_team`, cap `OVERPASS_RESCUE_MAX` (default 40)
- Seed fallback HN: `data/overpass_hanoi_parking_seed.json`, `data/overpass_hanoi_rescue_seed.json`

## Gas / university / hospital

```bash
docker compose build crawler
docker compose run --rm \
  -e CRAWL_CITIES=hanoi \
  -e CRAWL_SOURCES=gas,university,hospital \
  crawler python -m scheduler.run_once
```

- `overpass_gas.py` — `amenity=fuel` → `gas_station` (cap `OVERPASS_GAS_MAX`, default 120)
- `overpass_university.py` — `amenity=university|college` → `university` (cap 80)
- `overpass_hospital.py` — `amenity=hospital` → `hospital` (cap 100)
- Apply migration: `database/migrations/004_poi_gas_uni_hospital.sql`
