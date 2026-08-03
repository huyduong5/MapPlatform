# apps/api — Payload CMS 3 + PostgreSQL (Phase 1) — BẮT BUỘC

Service Docker: `api` (xem `docker-compose.yml`, `Dockerfile` tại thư mục này).

## Trách nhiệm

- Payload Collections: `locations`, `sources`, `crawl-jobs`, `crawl-logs`
- REST API public cho Map UI (khớp `docs/openapi.yaml`)
- Custom endpoint PostGIS: `GET /api/locations/nearby`
- Admin UI: xem / debug dữ liệu (không nhập tay thay crawler)

## Tài liệu

- `docs/00-tech-decisions.md`
- `docs/01-data-modeling.md` (Payload Collections)
- `docs/03-api-and-map-platform.md`
- `docs/openapi.yaml`

## Dev nhanh (DB vẫn trong Docker)

```bash
docker compose up -d db
pnpm --filter api dev
# Admin/API: http://localhost:3001
```
