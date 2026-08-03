# Phase 6 — Ops Console & Full Location Coverage

> **Status: DONE** (2026-07-29).  
> Sau Phase 5 (CI/E2E). Scope vẫn **Hà Nội**, $0.

## Mục tiêu

1. Đủ loại địa điểm trong schema/problem statement: thêm `dealer`, `parking`, `rescue_team`
2. Ops Console UI cho CSKH/ops: crawl stats + WARNING review
3. Health / metrics endpoints

## Deliverables

| Hạng mục | Artifact |
|---|---|
| Seed phase 6 | `database/seeds/locations_phase6.sql` |
| Layers 7 loại | `LayerControl` + marker màu |
| Decision intents | dealer / parking / rescue |
| Ops UI | `apps/web/src/app/ops/page.tsx` → `/ops` |
| Health | `GET /api/health` |
| Metrics | `GET /api/metrics` (admin) |

## Chạy

```bash
docker compose exec -T db psql -U geouser -d geo_platform < database/seeds/locations_phase6.sql
# restart api/web nếu cần
curl -s http://localhost:3001/api/health
open http://localhost:3002/ops
```

## DoD

- [x] dealer / parking / rescue_team có data + layer
- [x] Ops console xem jobs + resolve/ignore warning
- [x] `/api/health` + `/api/metrics`
- [x] Smoke mở rộng + unit intent
