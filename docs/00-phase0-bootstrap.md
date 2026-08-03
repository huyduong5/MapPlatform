# Phase 0 — Bootstrap & Tech Decisions Implementation

> Triển khai scaffold theo [`00-tech-decisions.md`](./00-tech-decisions.md).

## Đã có trong repo

| Thành phần | Đường dẫn |
|---|---|
| Payload CMS + public REST | `apps/api` |
| Next.js + Leaflet map | `apps/web` |
| Crawler Overpass + Photon/Nominatim | `crawler/` |
| SQL schema + seeds | `database/migrations`, `database/seeds` |
| Docker Compose | `docker-compose.yml` (Postgres host port **5433**) |

## Chạy local (Phase 0)

> Postgres host port mặc định: **5433** (tránh conflict 5432).  
> Web dev: **3002** nếu 3000 đang bị chiếm (xem `apps/web/package.json`).

```bash
cp .env.example .env

docker compose up -d db
docker compose exec -T db psql -U geouser -d geo_platform < database/migrations/001_init_schema.sql
docker compose exec -T db psql -U geouser -d geo_platform < database/seeds/sources.sql
docker compose exec -T db psql -U geouser -d geo_platform < database/seeds/locations_hanoi.sql

export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh" && nvm use 20
pnpm install
pnpm dev:api   # http://localhost:3001
pnpm dev:web   # http://localhost:3002 (hoặc 3000)
```

### Kiểm tra nhanh (đã verify)

- `GET http://localhost:3001/api/locations` → `success: true` + seed Hà Nội  
- `GET http://localhost:3001/api/locations/nearby?latitude=20.995&longitude=105.862&radius=5000`  
- `GET http://localhost:3002` → Map UI  
- Payload Admin: `http://localhost:3001/admin` (tạo user lần đầu)  

### Crawler (Docker khuyến nghị)

```bash
docker compose run --rm crawler python -m scheduler.run_once
# hoặc local: python3-venv + pip install -r crawler/requirements.txt
```

### Ghi chú kiến trúc Phase 0

- Bảng geo (`sources`, `locations`, …): **SQL migration** (PostGIS).  
- Payload CMS: Admin + collections mirror (`cms_*`) + Users.  
- Public OpenAPI routes: Next.js `apps/api/src/app/api/locations/*`.  
- Map tiles: Leaflet + Carto (**$0**). Geocode: Photon → Nominatim.
