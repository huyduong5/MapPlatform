# Phase 4 — Platform Expansion (ex-Phase 1.1)

> Roadmap: [`07-roadmap-and-risks.md`](./07-roadmap-and-risks.md) mục Phase 1.1.  
> **Status: DONE** (2026-07-29) trong repo.  
> Phase 3 verify: prod overlay / backup / health / images — OK (ops VPS vẫn cần domain).

## Phạm vi

| Hạng mục | Trạng thái |
|---|---|
| `showroom` + `service_center` data | ✅ seed + VinFast seed JSON |
| Layer UI 4 loại | ✅ Map markers màu riêng |
| Bounding-box viewport load | ✅ `minLat/maxLat/minLng/maxLng` + map `moveend` |
| Crawl-stats API | ✅ `GET /api/admin/crawl-stats` |
| WARNING review queue | ✅ list + `PATCH` resolve/ignore |
| Decision intents showroom/service | ✅ rules NLU |

## API mới

```bash
# Stats (header x-admin-token nếu ADMIN_TOKEN đã set)
curl -s http://localhost:3001/api/admin/crawl-stats | jq .

# Open warnings
curl -s 'http://localhost:3001/api/admin/crawl-warnings?status=open' | jq .

# Resolve
curl -s -X PATCH http://localhost:3001/api/admin/crawl-warnings/<id> \
  -H 'Content-Type: application/json' \
  -d '{"status":"resolved","note":"ok"}'
```

Viewport:

```bash
curl -s 'http://localhost:3001/api/locations?status=active&minLat=20.95&maxLat=21.05&minLng=105.8&maxLng=105.9&limit=50'
```

## Migrate / seed

```bash
docker compose exec -T db psql -U geouser -d geo_platform < database/migrations/002_phase4_review_queue.sql
docker compose exec -T db psql -U geouser -d geo_platform < database/seeds/locations_phase4.sql
docker compose run --rm -e CRAWL_ONLY=vinfast crawler python -m scheduler.run_once
```
