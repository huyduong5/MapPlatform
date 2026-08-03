# MapPlatform — Geo Decision Platform

Bản đồ địa điểm dịch vụ (trạm sạc, cửa hàng, trường học, nhà thuốc…) + API + crawler OSM.

**Stack:** Next.js (web) · Payload CMS / Next.js (API) · PostgreSQL + PostGIS · Python crawler · Docker Compose

---

## Yêu cầu đã cài

| Công cụ | Ghi chú |
|--------|---------|
| Docker + Docker Compose | Bắt buộc cho DB (và tùy chọn full stack) |
| Node.js ≥ 20 | `node -v` |
| npm | Đi kèm Node — dùng để cài `pnpm` |
| pnpm 9 | Cài bằng: `sudo npm i -g pnpm@9.15.0` |

Kiểm tra nhanh:

```bash
node -v
npm -v
pnpm -v
docker compose version
```

---

## Cổng mặc định

| Dịch vụ | Cổng |
|--------|------|
| Web (map) | **3002** |
| API / Payload Admin | **3001** |
| Postgres | **5433** (máy host) → 5432 trong container |

Nếu cổng bị chiếm (ví dụ 3000):

```bash
sudo fuser -k 3000/tcp
# hoặc chạy web sang 3002 (xem bên dưới)
```

---

## Cách chạy nhanh (khuyến nghị) — 2 terminal

Cách này ổn định nhất: **DB + API bằng Docker**, **web chạy local**.

### Bước 0 — Vào thư mục + tạo file env

```bash
cd ~/LapTrinh/system/VinSmartFuture/MapPlatform

cp -n .env.example .env
```

Mở `.env` và chỉnh tối thiểu (nếu chưa có):

- `PAYLOAD_SECRET` — chuỗi ≥ 32 ký tự
- `NOMINATIM_USER_AGENT` — có email liên hệ
- `WEB_PORT=3002`
- `NEXT_PUBLIC_API_BASE_URL=http://localhost:3001`

> Không commit file `.env` (đã có trong `.gitignore`).

### Terminal 1 — Database + API

```bash
cd ~/LapTrinh/system/VinSmartFuture/MapPlatform
docker compose up -d db api
docker compose ps
```

Đợi API healthy, rồi thử:

```bash
curl -s "http://localhost:3001/api/locations?limit=1" | head
```

### Terminal 2 — Web (map)

```bash
cd ~/LapTrinh/system/VinSmartFuture/MapPlatform
pnpm install
pnpm --filter @mapplatform/web dev -- -p 3002
```

Nếu chưa có `pnpm`:

```bash
sudo npm i -g pnpm@9.15.0
pnpm -v
```

### Mở trình duyệt

- Bản đồ: http://localhost:3002  
- API: http://localhost:3001  
- Ops (admin): http://localhost:3002/ops  

---

## (Tùy chọn) Nạp / cập nhật dữ liệu crawl

Mở thêm terminal:

```bash
cd ~/LapTrinh/system/VinSmartFuture/MapPlatform
pnpm crawl
```

Hoặc crawl có chọn lọc:

```bash
docker compose run --rm \
  -e CRAWL_CITIES=hanoi \
  -e CRAWL_SOURCES=charging,parking,school,pharmacy \
  crawler python -m scheduler.run_once
```

---

## Cách chạy full Docker (1 lệnh)

```bash
cd ~/LapTrinh/system/VinSmartFuture/MapPlatform
cp -n .env.example .env
docker compose up -d --build
```

- Web: http://localhost:3002  
- API: http://localhost:3001  

Kiểm tra:

```bash
pnpm health
# hoặc
bash scripts/healthcheck.sh
```

Dừng:

```bash
docker compose down
```

> Lần build đầu có thể lâu / gặp lỗi mạng npm (`ECONNRESET`). Chạy lại `docker compose up -d --build` là được. Nếu vẫn chậm, dùng cách **2 terminal** ở trên.

---

## Kiểm tra sức khỏe hệ thống

```bash
pnpm health          # API + web + decide
pnpm smoke           # smoke test API chi tiết hơn
docker compose logs -f api
docker compose logs -f web
```

---

## Cấu trúc thư mục (rút gọn)

```
MapPlatform/
├── apps/
│   ├── web/          # Next.js — bản đồ Leaflet
│   └── api/          # Payload + REST (/api/locations, /api/decide, …)
├── crawler/          # Python — Overpass / seed → Postgres
├── database/
│   ├── migrations/   # SQL schema
│   └── seeds/
├── docs/             # Tài liệu kỹ thuật
├── scripts/          # health, smoke, backup, …
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## API chính

| Method | Path | Mô tả |
|--------|------|--------|
| GET | `/api/locations` | List / search / bbox (mặc định chỉ POI có tên hợp lệ) |
| GET | `/api/locations/:id` | Chi tiết (+ reverse-geocode địa chỉ mỏng khi cần) |
| GET | `/api/locations/nearby` | Gần vị trí (PostGIS) |
| POST | `/api/decide` | Gợi ý theo câu hỏi CSKH |
| GET | `/api/cities` | Danh sách thành phố |
| GET | `/api/metrics` | Metrics ops |

Chi tiết: [`docs/openapi.yaml`](./docs/openapi.yaml), [`docs/09-free-apis-and-urls.md`](./docs/09-free-apis-and-urls.md).

---

## Sự cố thường gặp

### `pnpm: command not found` / `corepack: command not found`

```bash
sudo npm i -g pnpm@9.15.0
pnpm -v
```

### Cổng 3000 / 3002 / 3001 bị chiếm

```bash
sudo fuser -k 3000/tcp
sudo fuser -k 3001/tcp
sudo fuser -k 3002/tcp
```

### Web không gọi được API

Kiểm tra `.env`:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
```

### Map trống / ít điểm

Chạy crawl:

```bash
pnpm crawl
```

### Build Docker API lỗi TypeScript / web lỗi mạng

- Dùng cách **2 terminal** (DB+API Docker, web local).
- Hoặc build lại: `docker compose up -d --build`.

### `sed: command not found` khi sửa `.env`

Dùng `perl` hoặc sửa tay `.env`:

```bash
perl -0777 -i -pe 's/^WEB_PORT=.*/WEB_PORT=3002/m' .env
```

---

## Tài liệu thêm

| File | Nội dung |
|------|----------|
| [`context.md`](./context.md) | Ngữ cảnh dự án |
| [`docs/00-tech-decisions.md`](./docs/00-tech-decisions.md) | Stack đã chốt |
| [`docs/06-deployment-ops.md`](./docs/06-deployment-ops.md) | Deploy / ops |
| [`docs/08-deploy-to-internet.md`](./docs/08-deploy-to-internet.md) | Go-live |
| [`docs/09-free-apis-and-urls.md`](./docs/09-free-apis-and-urls.md) | API $0 (không Google Places) |

---

## License / nhóm

VinSmartFuture — MapPlatform
