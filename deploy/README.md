# Deploy nhanh lên Internet (VPS) — Phase 3

Đọc đầy đủ: [`../docs/08-deploy-to-internet.md`](../docs/08-deploy-to-internet.md) · status [`../docs/03-phase3-status.md`](../docs/03-phase3-status.md).

## Trước khi chạy

1. Copy `.env.production.example` → `.env`, điền secret (`openssl rand -base64 32`).
2. Sửa `DOMAIN` / `CADDY_ACME_EMAIL` trong `.env`.
3. DNS A record `map` + `api` → IP VPS.
4. `chmod 600 .env`

## Lệnh trên VPS

```bash
cd /opt/mapplatform

docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
docker compose -f deploy/docker-compose.caddy.yml --env-file .env up -d

# migrate/seed nếu volume mới
docker compose exec -T db psql -U geouser -d geo_platform < database/migrations/001_init_schema.sql
docker compose exec -T db psql -U geouser -d geo_platform < database/migrations/002_phase4_review_queue.sql
docker compose exec -T db psql -U geouser -d geo_platform < database/migrations/003_phase7_city.sql
docker compose exec -T db psql -U geouser -d geo_platform < database/seeds/locations_phase7_hcm.sql || true
docker compose exec -T db psql -U geouser -d geo_platform < database/seeds/locations_phase7_danang.sql || true
docker compose run --rm -e CRAWL_ON_START=0 crawler python -m scheduler.run_once
```

## Backup / health

```bash
PROD=1 ./scripts/backup-db.sh
API_BASE_URL=https://api.$DOMAIN WEB_BASE_URL=https://map.$DOMAIN ./scripts/healthcheck.sh
```

## Cron backup (ví dụ)

```cron
0 3 * * * cd /opt/mapplatform && PROD=1 ./scripts/backup-db.sh >> /var/log/mapplatform-backup.log 2>&1
```

## Cập nhật

```bash
git pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
docker compose -f deploy/docker-compose.caddy.yml --env-file .env up -d
```
