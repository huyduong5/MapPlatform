# 00 — Tech Decisions (ADR tóm tắt)

> **Project:** Geo Decision Platform  
> **Phase:** Phase 1 — Geo Data Foundation (MVP)  
> **Mục đích:** Chốt stack để AI Coding Agent / developer **không tự chọn ngẫu nhiên**.  
> **Nguyên tắc:** Nếu có mâu thuẫn với `context.md` → `context.md` thắng.  
> **Chi phí:** MVP **$0 API bên thứ ba** — xem [`09-free-apis-and-urls.md`](./09-free-apis-and-urls.md).

---

## 1. Quyết định đã chốt (BẮT BUỘC)

| Thành phần | Quyết định | Lý do ngắn |
|---|---|---|
| **Backend / CMS / API** | **Payload CMS 3 + TypeScript** | Collections, REST, Admin; adapter PostgreSQL |
| **Database** | **PostgreSQL 16 + PostGIS 3.4** | Spatial query; tự host Docker |
| **Runtime deploy** | **Docker + Docker Compose** | `db` + `api` + `web` + `crawler` |
| Frontend Map | **Next.js 14 + React + TypeScript** | Map UI |
| **Map library** | **Leaflet** (primary) | OSS, không vendor lock, $0 |
| **Map tiles** | **Carto basemaps** (primary) hoặc **OpenFreeMap** | Không API key, không free-tier tính phí |
| **Geocoder primary** | **Photon** `https://photon.komoot.io/api/` | Free, không key; + cache DB |
| **Geocoder fallback** | **Nominatim** `https://nominatim.openstreetmap.org` | Free; ≤1 req/s + User-Agent |
| Crawler | **Python 3.11+ + Crawl4AI** | HTML/SPA; Overpass bằng HTTP |
| DB adapter (Payload) | **`@payloadcms/db-postgres`** | |
| Spatial nearby | PostGIS trong custom endpoint Payload | |
| Monorepo | **pnpm workspaces** | `apps/api`, `apps/web`, `crawler/` |
| API contract | **OpenAPI 3** | [`openapi.yaml`](./openapi.yaml) |
| Test FE/E2E | **Playwright** | |
| Test API | Jest/Vitest + DB Compose | |
| Test crawler | **pytest** | |
| Scheduler | Trong container `crawler` | 02:00 `Asia/Ho_Chi_Minh` |

### Kiến trúc bắt buộc

```
┌─────────────────────────────────────────────────────────┐
│                    docker compose                        │
│  ┌──────────┐  ┌──────────────┐  ┌──────┐  ┌─────────┐ │
│  │   db     │←─│ api (Payload │←─│ web  │  │ crawler │ │
│  │ Postgres │  │ CMS + REST)  │  │Next  │  │ Python  │ │
│  │ +PostGIS │  └──────────────┘  └──────┘  └────┬────┘ │
│  └────▲─────┘                                   │      │
│       └─────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────┘

Map tiles (browser) ──► Carto / OpenFreeMap   ($0, no key)
Geocode (crawler)   ──► Photon → Nominatim    ($0, rate-limit + cache)
Location data       ──► VinFast public + OSM Overpass ($0)
```

---

## 2. Payload Collections (bắt buộc)

| Collection | Bảng Postgres | Vai trò |
|---|---|---|
| `locations` | `locations` | Địa điểm |
| `sources` | `sources` | Nguồn crawl |
| `crawl-jobs` | `crawl_jobs` | Job crawl |
| `crawl-logs` | `crawl_logs` | Log chi tiết |

Custom endpoints:

| Method | Path | Ghi chú |
|---|---|---|
| `GET` | `/api/locations` | List / filter / search / pagination |
| `GET` | `/api/locations/:id` | Detail |
| `GET` | `/api/locations/nearby` | PostGIS |

---

## 3. Naming & convention

| Layer | Convention | Ví dụ |
|---|---|---|
| Database columns | `snake_case` | `opening_hours`, `source_id` |
| REST JSON (public) | `camelCase` | `openingHours`, `distanceKm` |
| Env vars | `SCREAMING_SNAKE` | `DATABASE_URL`, `PAYLOAD_SECRET` |

```
DB:     locations.source_id  →  sources
API:    response.source      →  sources.name
```

---

## 4. Phiên bản mục tiêu

| Package / runtime | Version |
|---|---|
| Node.js | 20 LTS |
| pnpm | 9.x |
| Payload CMS | 3.x |
| Python | 3.11+ |
| PostgreSQL / PostGIS | 16 / 3.4 |
| Next.js | 14.x |
| Leaflet | 1.9.x |
| Docker Compose | v2 |

---

## 5. Quyết định *không* làm trong Phase 1

| Không chọn | Lý do |
|---|---|
| NestJS / Express làm API chính | Đã chốt Payload |
| MongoDB adapter | Bắt buộc PostgreSQL |
| **Mapbox / Google Maps / Goong / Geoapify làm default** | **Có thể mất phí** — xem doc 09 |
| Chạy prod không Docker | Bắt buộc dockerize |
| Neo4j / Vector DB / GraphQL / microservices | Ngoài MVP |

Optional sau này (không default): adapter cắm Mapbox/Goong **chỉ khi** có ngân sách rõ ràng.

---

## 6. Docker — service bắt buộc

| Service | Port | Vai trò |
|---|---|---|
| `db` | 5432 (internal prod) | PostgreSQL + PostGIS |
| `api` | 3001 | Payload CMS |
| `web` | 3000 | Next.js + Leaflet map |
| `crawler` | — | Crawl + Photon/Nominatim |

---

## 7. Liên kết

- Free URLs: [`09-free-apis-and-urls.md`](./09-free-apis-and-urls.md) ← **đọc khi chọn API**
- Schema: [`01-data-modeling.md`](./01-data-modeling.md)
- Crawl: [`02-data-crawling.md`](./02-data-crawling.md)
- API: [`03-api-and-map-platform.md`](./03-api-and-map-platform.md)
- Deploy: [`08-deploy-to-internet.md`](./08-deploy-to-internet.md)
