# 06 — Deployment & Operations (Docker bắt buộc)

> **Project:** Geo Decision Platform  
> **Phase:** Phase 1 MVP  
> **Đọc trước:** `context.md`, `00-tech-decisions.md`  
> **Ràng buộc:** Toàn bộ stack chuẩn chạy bằng **Docker Compose** — `db` + `api` (Payload) + `web` + `crawler`.

---

## 1. Mục tiêu

- Dev / staging / prod: **dockerize**
- DB = PostgreSQL + PostGIS
- API = Payload CMS
- Crawl theo lịch trong container `crawler`
- Backup + alert crawl fail

---

## 2. Docker Compose

File: [`../docker-compose.yml`](../docker-compose.yml)

| Service | Port | Image / build | Vai trò |
|---|---|---|---|
| `db` | `5432` | `postgis/postgis:16-3.4` | PostgreSQL + PostGIS |
| `api` | `3001` | `apps/api/Dockerfile` | **Payload CMS** + REST |
| `web` | `3000` | `apps/web/Dockerfile` | Next.js Map UI |
| `crawler` | — | `crawler/Dockerfile` | Python crawl scheduler |

```bash
cp .env.example .env

# Full stack (sau khi code build được)
docker compose up -d --build

# Chỉ DB khi đang viết code
docker compose up -d db

# Xem log
docker compose logs -f api
docker compose logs -f crawler

# Crawl one-shot
docker compose run --rm crawler python -m scheduler.run_once
```

**Healthcheck:**

- `db`: `pg_isready` + `SELECT PostGIS_Version();` (sau init)
- `api`: `GET /api/locations?limit=1`
- `web` phụ thuộc `api` healthy

**Network:** service nói chuyện qua hostname `db`, `api`, `web`, `crawler` trên network `mapplatform`.

---

## 3. Biến môi trường

Mẫu: [`../.env.example`](../.env.example)

| Biến | Bắt buộc | Mô tả |
|---|---|---|
| `POSTGRES_*` | Yes | User/pass/db cho container `db` |
| `DATABASE_URL` | Yes | Dùng khi chạy tool ngoài compose (`localhost`) |
| `PAYLOAD_SECRET` | Yes | Secret Payload (≥ 32 ký tự) |
| `API_BASE_URL` / `NEXT_PUBLIC_API_BASE_URL` | Yes | URL API từ browser |
| `NOMINATIM_USER_AGENT` | Yes (crawler) | Email liên hệ cho Nominatim |
| `CORS_ORIGINS` | Yes (prod) | Whitelist FE |
| `CRAWL_SCHEDULE` | No | Mặc định `0 2 * * *` (02:00 VN) |

❌ Không commit `.env`.

---

## 4. Payload + migration

- Schema Collections do Payload quản lý trên Postgres (`@payloadcms/db-postgres`).
- PostGIS extension: `database/init/01-extensions.sql` (chạy lần đầu volume).
- Cột geometry / trigger spatial: migration bổ sung sau khi Payload tạo bảng (xem `01-data-modeling.md`) — **không bỏ PostGIS**.
- Seed: `database/seeds/sources.sql`, `locations_hanoi.sql` (hoặc seed qua Payload Local API).

```bash
# Ví dụ sau khi api container lên
docker compose exec api pnpm payload migrate   # điều chỉnh theo script thực tế
docker compose exec db psql -U geouser -d geo_platform -f /seeds/...  # hoặc mount seeds
```

---

## 5. Lịch crawler (trong Docker)

Container `crawler` chạy scheduler (APScheduler / cron) với `TZ=Asia/Ho_Chi_Minh`.

- Job `failed` toàn bộ → **không** deactivate hàng loạt location cũ.
- Mỗi source = job độc lập nếu có thể.

---

## 6. Backup PostgreSQL

Khuyến nghị production: chạy script có sẵn (custom format + retention):

```bash
# Giữ BACKUP_KEEP_DAYS ngày (default 7)
pnpm backup
# hoặc
bash scripts/backup-db.sh
```

Thủ công:

```bash
docker compose exec -T db pg_dump -U geouser -Fc geo_platform > backups/geo_$(date +%F).dump
```

Restore: `pg_restore -U geouser -d geo_platform < backups/geo_….dump` vào service `db`.  
Cron gợi ý: hàng ngày lúc 03:00, retention ≥ 7 ngày; trước migrate lớn luôn backup.

---

## 7. Monitoring tối thiểu

| Tín hiệu | Cách | Ngưỡng |
|---|---|---|
| Container exit | `docker compose ps` | restart loop |
| Crawl fail | `crawl_jobs.status=failed` (Payload Admin) | bất kỳ trong 24h |
| `records_found=0` | Admin / query | selector/HTML đổi |
| Geocode ERROR | `crawl_logs` | > 20% / job |
| API down | healthcheck `api` | unhealthy |

Admin Payload thay cho dashboard tự viết ở MVP.

Tuỳ chọn: `GET /api/admin/crawl-stats` (custom endpoint + `ADMIN_TOKEN`).

---

## 8. Geocoding quota

Photon primary → Nominatim fallback ($0); cache theo địa chỉ chuẩn hoá; ưu tiên nguồn đã có lat/lng (Overpass); không geocode lại nếu đã cache.

---

## 9. Environments

| Env | Cách chạy |
|---|---|
| development | `docker compose up` (full) hoặc `db` + `pnpm dev` cho api/web |
| test | Compose + DB `geo_platform_test` |
| staging/prod | Compose (hoặc orchestrator tương đương) — **không** bare-metal không container |

---

## 10. Checklist trước demo

- [ ] `docker compose up -d --build` — 4 service healthy  
- [ ] PostGIS OK trong `db`  
- [ ] Payload Admin mở được, thấy Collections  
- [ ] `GET /api/locations` → `success: true`  
- [ ] Nearby Times City OK  
- [ ] FE map 2 layer  
- [ ] Crawl fail không xoá data cũ  

---

## 11. Liên kết

- Stack: [`00-tech-decisions.md`](./00-tech-decisions.md)
- Testing: [`05-integration-testing.md`](./05-integration-testing.md)
- Risks: [`07-roadmap-and-risks.md`](./07-roadmap-and-risks.md)
- **Go-Live internet:** [`08-deploy-to-internet.md`](./08-deploy-to-internet.md)
