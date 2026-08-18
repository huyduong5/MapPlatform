# MapPlatform — Geo Decision Platform

Bản đồ địa điểm dịch vụ (trạm sạc, cửa hàng, trường học, nhà thuốc…) + Payload Admin + crawler OSM.

**Stack:** một Next.js app (Payload Admin + map UI + REST) · PostgreSQL + PostGIS · Python crawler · Docker Compose

---

## Yêu cầu đã cài

| Công cụ | Ghi chú |
|--------|---------|
| Docker + Docker Compose | Bắt buộc cho DB (và tùy chọn full stack) |
| Node.js ≥ 20 | `node -v` |
| npm | Đi kèm Node — dùng để cài `pnpm` |
| pnpm 9 | Cài bằng: `sudo npm i -g pnpm@9.15.0` |

---

## Cổng mặc định

| Dịch vụ | Cổng |
|--------|------|
| App (map + Admin + API) | **3001** |
| Postgres | **5433** (host) → 5432 trong container |

---

## Cách chạy nhanh (khuyến nghị) — 1–2 terminal

### Bước 0 — Env

```bash
cd ~/LapTrinh/system/VinSmartFuture/MapPlatform
cp -n .env.example .env
```

Tối thiểu trong `.env`:

- `PAYLOAD_SECRET` — ≥ 32 ký tự
- `NOMINATIM_USER_AGENT` — có email liên hệ
- `NEXT_PUBLIC_API_BASE_URL=` (để trống = same-origin monolith)

### Terminal 1 — Database

```bash
docker compose up -d db
```

### Terminal 2 — App (monolith)

```bash
pnpm install
pnpm --filter @mapplatform/api dev
```

### Mở trình duyệt

- Bản đồ: http://localhost:3001  
- Payload Admin: http://localhost:3001/admin  
  - **Cities** — bật/tắt, bbox (không sửa code)  
  - **Crawl Jobs** — tạo job → chạy crawl → xem status/log  
  - **Payload Jobs** — queue debug  

---

## Crawl (đường chính = Admin)

Luồng cũ Python (`scheduler.run_once`) **giữ nguyên**. Payload Admin chỉ điều phối qua bridge `invokeCrawl`.

### Thủ công
1. `/admin` → **Crawl Jobs** → Create (cities + sources) → Save.  
2. Queue + `jobs.run` → `invokeCrawl` → `run_once`.  
3. Xem status/counters/`logTail`; debug **Payload Jobs**.

### Tự động mỗi 6 giờ (theo từng city)
- Task Payload **`scheduleCrawl`** (cron `0 */6 * * *` → 0h, 6h, 12h, 18h).  
- Mặc định **`CRAWL_SCHEDULE_MODE=per_city`**: mỗi lần tick tạo **1 Crawl Job / city** với **đủ loại trên bản đồ** (`CRAWL_SOURCES`: vinfast + charging/parking/rescue/gas/university/hospital/pharmacy/atm/bank/police/fire_station/school/marketplace), queue chạy **tuần tự** (`CRAWL_QUEUE_LIMIT=1`).  
- `round_robin`: mỗi tick chỉ 1 city (xoay theo giờ UTC) — nên dùng cron hàng giờ.  
- `all`: legacy 1 job gồm mọi city.  
- Cần app chạy lâu dài + `PAYLOAD_JOBS_AUTORUN=1` (mặc định).  
- Tắt tạm: `CRAWL_AUTO_SCHEDULE=0`. Đổi lịch: `CRAWL_AUTO_CRON=...`.

### Tự động điểm dừng transit (HN + HCM, mỗi 4 giờ)
- Task Payload **`scheduleTransitCrawl`** (cron `0 */4 * * *`).  
- Mỗi tick tạo **2 Crawl Job riêng**: một cho `hanoi`, một cho `hcm`, chỉ `bus_stop` + `subway_station`.  
- Tắt: `CRAWL_TRANSIT_AUTO_SCHEDULE=0`. Cities: `CRAWL_TRANSIT_CITIES=hanoi,hcm`.  
- Chạy tay một lần: `cd apps/api && node --import tsx/esm scripts/agent-schedule-transit-crawl.mjs`.

Cùng contract (CLI / internal API):

```bash
pnpm crawl
docker compose run --rm \
  -e CRAWL_CITIES=hanoi \
  -e CRAWL_SOURCES=charging,parking,school,pharmacy \
  crawler python -m scheduler.run_once

curl -s -X POST http://localhost:3001/api/internal/crawl \
  -H "Content-Type: application/json" \
  -H "x-admin-token: $ADMIN_TOKEN" \
  -d '{"cities":["hanoi"],"sources":["charging","pharmacy"]}'
```

Env: `CRAWL_EXEC=docker|python`, `CITIES_JSON`, `PAYLOAD_CRAWL_JOB_ID`.  
Python APScheduler trong service `crawler` **tắt mặc định** (`CRAWL_ENABLE_SCHEDULER=0`) để tránh crawl trùng với lịch 6h của Payload.

---

## Full Docker (1 lệnh)

```bash
docker compose up -d --build db app crawler
```

- App: http://localhost:3001  
- Service `web` đã deprecate (profile `legacy-web` chỉ khi cần rollback).

```bash
pnpm health
docker compose down
```

---

## Kiểm tra sức khỏe

```bash
pnpm health          # app (map+API) + decide
pnpm smoke
docker compose logs -f app
```

---

## Cấu trúc thư mục (rút gọn)

```
MapPlatform/
├── apps/
│   ├── api/          # Monolith: Payload Admin + map + REST
│   └── web/          # DEPRECATED — map đã merge vào apps/api
├── crawler/          # Python Overpass — điều phối bởi Payload Jobs
├── database/
├── docs/
├── scripts/
├── docker-compose.yml
└── README.md
```

---

## API chính

| Method | Path | Mô tả |
|--------|------|--------|
| GET | `/api/locations` | List / search / bbox |
| GET | `/api/locations/:id` | Chi tiết |
| GET | `/api/locations/nearby` | Gần vị trí (PostGIS) |
| POST | `/api/decide` | Gợi ý CSKH |
| GET | `/api/cities` | Cities từ Payload (+ counts) |
| GET | `/api/metrics` | Metrics ops |

---

## Sự cố thường gặp

### `pnpm: command not found`

```bash
sudo npm i -g pnpm@9.15.0
```

### Cổng 3001 bị chiếm

```bash
sudo fuser -k 3001/tcp
```

### Crawl job failed (docker)

Chạy app trên host (`pnpm --filter @mapplatform/api dev`) với Docker available, hoặc trong compose đảm bảo `/var/run/docker.sock` mount vào service `app`.

### Map trống

Tạo Crawl Job trên Admin hoặc `pnpm crawl`.

---

## License / nhóm

 MapPlatform
