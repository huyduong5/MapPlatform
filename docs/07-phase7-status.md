# Phase 7 — Multi-city Foundation + CSKH Polish

> **Status: DONE** (2026-07-29).  
> Sau Phase 6. Scope: multi-city foundation ($0), city switcher, share deep-link, CSV export, webhook alert.  
> **Audit follow-up:** city-scoped `/api/decide` + seed Đà Nẵng stub.

## Mục tiêu

1. Cột `city` trên `locations` + filter API (default `hanoi`)
2. City switcher UI + deep-link `/?city=&id=` + nút chia sẻ
3. Ops CSV export theo city
4. Optional webhook khi crawl fail (`ALERT_WEBHOOK_URL`)
5. Decision engine scoped theo `city` + seed Đà Nẵng

## Deliverables

| Hạng mục | Artifact |
|---|---|
| Migration | `database/migrations/003_phase7_city.sql` |
| Seed HCM / ĐN | `locations_phase7_hcm.sql`, `locations_phase7_danang.sql` |
| City registry | `apps/api/src/lib/cities.ts`, `apps/web/src/lib/cities.ts` |
| Cities API | `GET /api/cities` |
| Filter | `GET /api/locations?city=`, nearby optional `city` |
| Decide city | `POST /api/decide` body `{ city }` — filter + default anchor |
| CSV export | `GET /api/admin/export/locations.csv?city=` |
| UI | `CitySwitcher`, deep-link + share in `LocationDetail` |
| Ops | CSV download trên `/ops` |
| Alert webhook | `scripts/alert-crawl-fail.sh` + `.env.example` |

## Chạy

```bash
docker compose exec -T db psql -U geouser -d geo_platform < database/migrations/003_phase7_city.sql
docker compose exec -T db psql -U geouser -d geo_platform < database/seeds/locations_phase7_hcm.sql
docker compose exec -T db psql -U geouser -d geo_platform < database/seeds/locations_phase7_danang.sql
curl -s http://localhost:3001/api/cities
curl -s -X POST http://localhost:3001/api/decide \
  -H 'Content-Type: application/json' \
  -d '{"query":"trạm sạc gần Landmark 81","city":"hcm","limit":3}'
```

## DoD

- [x] `city` column + indexes + check constraint
- [x] API list/nearby/cities trả về / lọc theo city
- [x] HCM + Đà Nẵng stub ≥ 1 location
- [x] City switcher + URL deep-link + share
- [x] Ops CSV export
- [x] Webhook optional trên crawl alert
- [x] `/api/decide` nhận `city` (filter candidates + city default anchor)
- [x] Smoke mở rộng cities / hcm / csv

## Giới hạn

- Crawl Overpass vẫn ưu tiên bbox Hà Nội; HCM/ĐN dùng curated seed.
- Landmark aliases ngoài HN/HCM/ĐN tối thiểu; Photon fallback theo city bias.
