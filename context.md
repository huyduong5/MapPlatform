# Geo Decision Platform — Project Context

> **File:** `context.md`
> **Mục đích:** Tài liệu ngữ cảnh (context) dành cho AI Coding Agent khi triển khai code cho dự án.
> **Phạm vi dự án:** Hà Nội (+ multi-city foundation HCM/ĐN stub — Phase 7)
> **Phase hiện tại:** Phase 7 DONE — Multi-city + CSKH polish (Phase 0–7 code xong; public VPS go-live = ops)
> **Trạng thái:** MVP Phase 0–7 đã implement local (xem `docs/0*-phase*-status.md`). Public deploy: `docs/08-deploy-to-internet.md` + `scripts/golive-preflight.sh`.
> **Agent bắt buộc đọc file này trước khi thực hiện bất kỳ task code nào.**

### Chỉ mục tài liệu

| # | File | Nội dung |
|---|---|---|
| — | [`README.md`](./README.md) | Entry point dự án |
| 0 | [`docs/00-tech-decisions.md`](./docs/00-tech-decisions.md) | Stack đã chốt |
| 0b | [`docs/00-phase0-bootstrap.md`](./docs/00-phase0-bootstrap.md) | **Phase 0 — đã scaffold / cách chạy** |
| 1s | [`docs/01-phase1-status.md`](./docs/01-phase1-status.md) | Phase 1 status |
| 2s | [`docs/02-phase2-status.md`](./docs/02-phase2-status.md) | Phase 2 Decision Engine |
| 3s | [`docs/03-phase3-status.md`](./docs/03-phase3-status.md) | Phase 3 Deploy / Go-Live |
| 4s | [`docs/04-phase4-status.md`](./docs/04-phase4-status.md) | Phase 4 Expansion |
| 5s | [`docs/05-phase5-status.md`](./docs/05-phase5-status.md) | Phase 5 CI / E2E |
| 6s | [`docs/06-phase6-status.md`](./docs/06-phase6-status.md) | Phase 6 Ops + types |
| 7s | [`docs/07-phase7-status.md`](./docs/07-phase7-status.md) | **Phase 7 Multi-city + CSKH** |
| 1 | [`docs/01-data-modeling.md`](./docs/01-data-modeling.md) | Schema + DDL |
| 2 | [`docs/02-data-crawling.md`](./docs/02-data-crawling.md) | Crawl + Source Registry |
| 3 | [`docs/03-api-and-map-platform.md`](./docs/03-api-and-map-platform.md) | REST API |
| 4 | [`docs/04-frontend-map-ui.md`](./docs/04-frontend-map-ui.md) | Map UI |
| 5 | [`docs/05-integration-testing.md`](./docs/05-integration-testing.md) | Tests |
| 6 | [`docs/06-deployment-ops.md`](./docs/06-deployment-ops.md) | Deploy / ops |
| 7 | [`docs/07-roadmap-and-risks.md`](./docs/07-roadmap-and-risks.md) | Timeline, rủi ro, giới hạn MVP |
| 8 | [`docs/08-deploy-to-internet.md`](./docs/08-deploy-to-internet.md) | **Phase cuối — deploy lên internet** |
| 9 | [`docs/09-free-apis-and-urls.md`](./docs/09-free-apis-and-urls.md) | **URL/API miễn phí ($0) — bắt buộc** |
| — | [`docs/openapi.yaml`](./docs/openapi.yaml) | OpenAPI contract |

> Nếu xung đột giữa các tài liệu: **`context.md` luôn là source of truth cao nhất.**

---

## 1. Tổng quan dự án

Dự án là một **Geo Decision Platform** tập trung vào khu vực **Hà Nội, Việt Nam**.

Mục tiêu dài hạn của hệ thống:

- Quản lý dữ liệu địa lý (Geo Data Management).
- Tìm kiếm địa điểm (Location Search).
- Hiển thị địa điểm trên bản đồ (Map Visualization).
- Tìm kiếm địa điểm gần một vị trí (Nearby Search).
- Cung cấp API cho các hệ thống khác sử dụng.
- (Tương lai) Hỗ trợ AI hiểu yêu cầu người dùng bằng ngôn ngữ tự nhiên.
- (Tương lai) Hỗ trợ AI đưa ra khuyến nghị dựa trên dữ liệu địa lý kết hợp Business Rules.

> ⚠️ **Quan trọng:** Phase 1 **chỉ** tập trung xây dựng nền tảng dữ liệu địa lý và bản đồ cho MVP. Phase 1 **chưa** triển khai AI Decision Engine dưới bất kỳ hình thức nào.

---

## 2. Bài toán cần giải quyết (Problem Statement)

Hiện tại, khi khách hàng hỏi CSKH (chăm sóc khách hàng) các thông tin như:

- Trạm sạc gần nhất
- Cửa hàng gần nhất
- Showroom
- Đại lý
- Xưởng dịch vụ
- Đội cứu hộ
- Điểm đỗ xe

Quy trình xử lý thủ công hiện tại:

```
Khách hàng hỏi
   ↓
CSKH xác định vị trí
   ↓
Mở Google Maps hoặc hệ thống khác
   ↓
Tìm kiếm thủ công
   ↓
Tra cứu dữ liệu
   ↓
Tổng hợp thông tin
   ↓
Trả lời khách hàng
```

**Các vấn đề tồn tại:**

- Dữ liệu phân tán, không tập trung.
- Mất thời gian xử lý.
- Phụ thuộc vào kinh nghiệm cá nhân của nhân viên.
- Khó kiểm soát chất lượng dữ liệu.
- Không có một nguồn dữ liệu địa lý dùng chung (single source of truth).
- Khó mở rộng khi số lượng Location tăng lên.

→ **Geo Decision Platform được xây dựng để giải quyết vấn đề này.**

---

## 3. Tầm nhìn dài hạn (Long-Term Vision)

Kiến trúc dài hạn của toàn bộ hệ thống (không phải scope Phase 1):

```
Customer / CSKH
   ↓
Natural Language
   ↓
AI
   ↓
Intent Detection
   ↓
Location Extraction
   ↓
Geo Decision Engine
   ↓
Business Rules
   ↓
Geo Data Platform
   ↓
Recommendation
   ↓
Map
```

**Ví dụ minh hoạ:**

> User: *"Xe tôi gần Times City và sắp hết pin, tìm trạm sạc phù hợp nhất."*

AI (ở Phase 2+) sẽ hiểu:
- Intent: `Find Charging Station`
- Location: `Times City`
- Battery: `Low`

Sau đó xử lý: `Geo Query → Find Nearby Charging Stations → Business Rules → Ranking → Recommendation → Explanation`

> ⚠️ Toàn bộ AI flow này thuộc **Phase 2 trở đi**, Agent **không** được triển khai trong Phase 1.

---

## 4. Phase hiện tại: PHASE 0–7 COMPLETE (local)

> Header lịch sử bên dưới giữ deliverables Phase 1 gốc. **Trạng thái thực tế:** Phase 0–7 code **DONE**; còn lại public go-live ops (`docs/08`, `docs/03-phase3-status.md` Ops checklist).

Mục tiêu kiến trúc Phase 1 (nền tảng — đã hoàn thành):

```
External Data
   ↓
Crawler
   ↓
Data Processing
   ↓
PostgreSQL + PostGIS
   ↓
REST API
   ↓
Frontend
   ↓
Map Hà Nội
```

Phase 1 cần tạo ra một MVP có khả năng:

1. Crawl dữ liệu Location.
2. Làm sạch dữ liệu (Cleaning).
3. Chuẩn hóa dữ liệu (Normalization).
4. Geocode dữ liệu.
5. Loại bỏ dữ liệu trùng (Deduplication).
6. Lưu dữ liệu vào Database.
7. Cung cấp REST API.
8. Hiển thị dữ liệu trên bản đồ Hà Nội.
9. Search Location.
10. Filter Location.
11. Tìm Location gần vị trí (Nearby Search).
12. Xem chi tiết Location (Location Detail).

---

## 5. Phạm vi địa lý (Geographic Scope)

- Phạm vi MVP: **Hà Nội, Việt Nam** — chỉ Hà Nội.
- **Không** cần triển khai toàn quốc ở Phase 1.
- Mọi dữ liệu địa lý cần được giới hạn trong khu vực Hà Nội nếu có thể.
- Khi Crawl hoặc Import Data, ưu tiên nguồn tại Hà Nội.
- **Không mở rộng** sang: Hồ Chí Minh, Đà Nẵng, các tỉnh khác trong Phase 1.

---

## 6. Các loại Location (Location Types)

MVP hiện tại tập trung vào **2 loại Location chính**:

| Type value | Mô tả |
|---|---|
| `charging_station` | Trạm sạc |
| `store` | Cửa hàng |

**Các loại sau thuộc phạm vi mở rộng tương lai (KHÔNG bắt buộc trong MVP):**

- `service_center` (Xưởng dịch vụ)
- `rescue_team` (Đội cứu hộ)
- `showroom`
- `dealer` (Đại lý)
- `parking` (Điểm đỗ xe)

> Không cần triển khai đầy đủ các type mở rộng này nếu chưa có dữ liệu, nhưng data model nên đủ linh hoạt để bổ sung sau này (enum/type field mở rộng được).

---

## 7. Core Data Model — Entity `Location`

Entity trung tâm của Phase 1 là **`Location`**, đại diện cho một địa điểm thực tế.

### Field tối thiểu (Database — snake_case):

| Field | Kiểu dữ liệu | Mô tả |
|---|---|---|
| `id` | UUID | ID duy nhất |
| `name` | string | Tên Location |
| `type` | enum (`charging_station`, `store`, ...) | Loại Location |
| `address` | string | Địa chỉ |
| `latitude` | float | Vĩ độ |
| `longitude` | float | Kinh độ |
| `location` | geography/geometry (PostGIS `Point`, SRID 4326) | Spatial field cho nearby query |
| `status` | enum (`active`, `inactive`) | Trạng thái hoạt động |
| `source_id` | UUID (FK → `sources.id`) | Nguồn dữ liệu (bảng `sources`) |
| `source_record_id` | string (nullable) | ID bản ghi phía nguồn — phục vụ dedupe |
| `source_url` | string (nullable) | URL nguồn nếu có |
| `phone` | string (nullable) | Số điện thoại |
| `opening_hours` | string (nullable) | Giờ hoạt động |
| `last_seen_at` | timestamp (nullable) | Lần cuối thấy trên nguồn (deactivate logic) |
| `last_updated` | timestamp (nullable) | Thời điểm dữ liệu được cập nhật gần nhất **từ nguồn** |
| `created_at` | timestamp | Thời điểm tạo record trong DB |
| `updated_at` | timestamp | Thời điểm cập nhật record gần nhất trong DB |

### Ánh xạ ra REST API (camelCase):

| DB | API JSON | Ghi chú |
|---|---|---|
| `source_id` | *(không trả public)* | Join nội bộ |
| `sources.name` | `source` (string) | Ví dụ `"vinfast_official"` |
| `source_url` | `sourceUrl` | |
| `opening_hours` | `openingHours` | |
| `last_updated` | `lastUpdated` | |
| `created_at` / `updated_at` | `createdAt` / `updatedAt` | |

> `location` (PostGIS Point) **bắt buộc** đồng bộ tự động từ `latitude`/`longitude` qua trigger (xem `docs/01-data-modeling.md`). Contract API: `docs/openapi.yaml`.

---

## 8. Database

- **Database chính:** PostgreSQL
- **Extension bắt buộc:** PostGIS

| Thành phần | Vai trò |
|---|---|
| PostgreSQL | Lưu dữ liệu nghiệp vụ |
| PostGIS | Lưu và truy vấn dữ liệu không gian (spatial query) |

**Ví dụ truy vấn:** Find Location within 5km from User Location → sử dụng PostGIS Spatial Query (`ST_DWithin`, `ST_Distance`, v.v.)

### Ràng buộc quan trọng:

- ❌ **Không** sử dụng MongoDB làm database chính trong Phase 1.
- ❌ **Không** sử dụng Vector Database cho dữ liệu Location thông thường.
- ❌ **Không** cần Neo4j trong Phase 1.

---

## 9. Backend API — Payload CMS + PostgreSQL (BẮT BUỘC)

- **Phase 1 bắt buộc dùng Payload CMS 3** với adapter **`@payloadcms/db-postgres`** trên **PostgreSQL + PostGIS**.
- Payload cung cấp: Collections, REST API, Admin UI (xem / debug dữ liệu).
- **Không** thay Payload bằng NestJS / Express / FastAPI làm API chính.
- **Không** dùng MongoDB adapter cho Payload.
- Dữ liệu Location được cập nhật **tự động** qua: `Crawler → Data Processing → PostgreSQL` (Local API Payload hoặc SQL/`pg` — Admin không thay crawler nhập tay hàng loạt).
- Custom endpoint **bắt buộc** cho spatial: `GET /api/locations/nearby` (PostGIS) — xem `docs/openapi.yaml`.
- Chi tiết stack: [`docs/00-tech-decisions.md`](./docs/00-tech-decisions.md).

### Deploy — Docker bắt buộc

- Mọi môi trường chuẩn (dev đầy đủ / staging / prod) chạy qua **`docker compose`**: `db` + `api` (Payload) + `web` + `crawler`.
- Local có thể tạm `pnpm dev` cho api/web **miễn là** Postgres vẫn chạy trong Docker.

### Không cần ưu tiên trong Phase 1:

- ❌ Admin Dashboard tự viết phức tạp (dùng Admin sẵn của Payload)
- ❌ Manual Data Management thay crawler
- ❌ Complex Role Management / RBAC đầy đủ

---

## 10. Nguồn dữ liệu (Data Sources)

Dữ liệu thu thập từ nguồn **công khai và hợp pháp**. Chi tiết URL / priority: **`docs/02-data-crawling.md` → Source Registry**.

Tóm tắt Phase 1:

| Ưu tiên | Nguồn | URL chính |
|---|---|---|
| P0 | VinFast Official — Showroom & Trạm sạc | https://vinfastauto.com/vn_vi/tim-kiem-showroom-tram-sac |
| P1 | OpenStreetMap Overpass (charging) | https://overpass-api.de/api/interpreter |
| P2 | Public lists (supporting, cần review ToS) | Chỉ khi P0/P1 thiếu |

**Công cụ crawl:** Crawl4AI (Python) cho HTML; HTTP client cho Overpass/JSON API.

### Nguyên tắc ưu tiên nguồn dữ liệu:

```
Official API  >  Open Data  >  Public Data  >  Web Crawling
```

- Nếu nguồn có API chính thức / XHR JSON → ưu tiên dùng API thay vì parse HTML.
- ❌ **Không** crawl dữ liệu từ nguồn bị hạn chế hoặc vi phạm Terms of Service.

---

## 11. Crawler

**Trách nhiệm của Crawler:**
- ✅ Collect Data

**Crawler KHÔNG chịu trách nhiệm:**
- ❌ Map Rendering
- ❌ AI Recommendation
- ❌ Frontend

**Flow:** `Source → Crawler → Raw Data → Data Processing`

### Crawler cần hỗ trợ:

- Crawl dữ liệu.
- Retry khi lỗi.
- Logging.
- Timeout.
- Rate Limit (không crawl quá tải nguồn).
- Lưu lại nguồn dữ liệu (`source`, `source_url`).

---

## 12. Lịch chạy Crawler (Crawl Schedule)

- **MVP:** chạy **1 lần / ngày**.

**Flow:** `Scheduler → Trigger Crawler → Crawl → Process → Validate → Update Database`

- Công cụ có thể dùng: **Cron Job**, **GitHub Actions**, hoặc scheduler của môi trường deployment.
- ❌ **Không** cần xây dựng Distributed Scheduler phức tạp.

---

## 13. Data Processing Pipeline

**Pipeline tổng quát:**

```
Raw Data → Cleaning → Normalization → Validation → Geocoding → Deduplication → Database
```

### 13.1. Cleaning
Loại bỏ:
- HTML không cần thiết.
- Khoảng trắng thừa.
- Dữ liệu rác.

### 13.2. Normalization
Chuẩn hóa: Tên, Địa chỉ, Type, Status.

### 13.3. Validation
Kiểm tra:
- Có tên.
- Có địa chỉ.
- Có tọa độ hợp lệ.
- Type hợp lệ (nằm trong enum cho phép).

### 13.4. Geocoding
Nếu có `Address` nhưng **không có** `Latitude`/`Longitude` → cần Geocode để lấy tọa độ.

### 13.5. Deduplication
Loại bỏ Location trùng, dựa trên tổ hợp: `Normalized Name + Address + Coordinates`.

---

## 14. Chất lượng dữ liệu (Data Quality)

Mỗi lần Crawl cần thống kê và log lại:

| Metric | Ví dụ |
|---|---|
| Total Records | 500 |
| Valid Records | 490 |
| Invalid Records | 5 |
| Duplicate Records | 5 |
| Inserted Records | 20 |
| Updated Records | 30 |

> ⚠️ **Quy tắc an toàn dữ liệu:** Nếu dữ liệu Crawl lỗi toàn bộ → **KHÔNG được ghi đè (overwrite)** dữ liệu hợp lệ hiện có. Dữ liệu cũ hợp lệ phải được giữ nguyên.

---

## 15. Chiến lược cập nhật dữ liệu (Data Update Strategy)

Mỗi lần Crawler chạy:

```
New Data + Existing Data → Compare → Insert / Update / No Change
```

- Location mới → `INSERT`
- Location đã tồn tại nhưng thay đổi → `UPDATE`
- Location không thay đổi → `NO ACTION`

> ❌ Không được tạo Duplicate Location sau mỗi lần Crawl.

---

## 16. REST API

Backend cung cấp RESTful API. Các endpoint chính:

```
GET /api/locations
GET /api/locations/:id
GET /api/locations?type=store
GET /api/locations?type=charging_station
GET /api/locations?search=...
GET /api/locations/nearby
```

API cần hỗ trợ các chức năng: **List, Detail, Search, Filter, Nearby**.

> ❌ Không cần GraphQL trong MVP nếu REST API đã đáp ứng đủ nhu cầu.

---

## 17. API Pattern

Resource chính: **`locations`**

| Chức năng | Endpoint |
|---|---|
| List | `GET /api/locations` |
| Detail | `GET /api/locations/:id` |
| Filter | `GET /api/locations?type=store` |
| Search | `GET /api/locations?search=Times City` |
| Nearby | `GET /api/locations/nearby` |

---

## 18. Nearby Search

Chức năng quan trọng nhất của Phase 1.

**Input:**
- `latitude`
- `longitude`
- `radius`
- `type` (optional)

**Ví dụ request:**
```
GET /api/locations/nearby?latitude=20.995&longitude=105.862&radius=5000&type=charging_station
```

**Flow xử lý:**
```
User Location → REST API → PostGIS → Spatial Query → Calculate Distance → Sort Nearest → Return Result
```

**Kết quả trả về nên bao gồm** `location` + `distance`, ví dụ:

```json
[
  { "name": "Station A", "distanceKm": 1.2 },
  { "name": "Station B", "distanceKm": 2.5 }
]
```

---

## 19. Frontend

**Nhiệm vụ:** Display Geo Data.

- **Stack MVP:** Next.js + React.
- **Các thành phần giao diện chính:** Search, Filter, Layer Control, Map, Marker, Popup, Location Detail.

---

## 20. Map

- Map là thành phần trung tâm của Frontend.
- Phạm vi hiển thị: Hà Nội.
- **Map MVP ($0, bắt buộc):** **Leaflet** + tile **Carto** (hoặc OpenFreeMap). Chi tiết URL: [`docs/09-free-apis-and-urls.md`](./docs/09-free-apis-and-urls.md).
- ❌ Không dùng Mapbox / Google Maps / Goong làm default (có thể mất phí).
- Map library **chỉ** chịu trách nhiệm: Map Rendering, Tile, Map Visualization.
- Dữ liệu Location luôn lấy từ **REST API** (Payload) — Map Adapter Pattern để đổi tile provider sau này nếu cần.

---

## 21. Map Layer

MVP có **2 Layer**:

```
☑ Charging Station
☑ Store
```

User có thể **Enable / Disable** từng Layer độc lập.

---

## 22. Marker

**Flow:** `API → Location → Latitude + Longitude → Marker`

Marker có icon khác nhau theo `type`:

| Type | Icon |
|---|---|
| `charging_station` | Charging Icon |
| `store` | Store Icon |

---

## 23. Popup

Khi click Marker → hiển thị Popup gồm: `Name`, `Type`, `Address`, `Status`, có thể kèm nút **View Detail**.

---

## 24. Location Detail

Hiển thị: `Name`, `Type`, `Address`, `Phone`, `Opening Hours`, `Status`, `Source`, `Last Updated`.

> ❌ Không cần hiển thị toàn bộ raw data.

---

## 25. Search

Hỗ trợ tìm kiếm theo: `Location Name`, `Address` (ví dụ: "Times City").

**Flow:** `Search Input → API → Database → Results → Map Zoom`

---

## 26. Filter

MVP: `All`, `Charging Station`, `Store`.
Có thể thêm: `Active` / `Inactive` (MVP mặc định chỉ ưu tiên hiển thị `Active`).

---

## 27. Near Me

Frontend lấy vị trí người dùng bằng **Browser Geolocation API**.

**Flow:** `Near Me button → Browser GPS → (Latitude, Longitude) → Nearby API → Nearest Locations`

---

## 28. Frontend Architecture

```
Frontend
├── Search
├── Filter
├── Layer Control
└── Map
    ├── Charging Station Layer
    ├── Store Layer
    ├── Marker
    ├── Popup
    └── Location Detail
```

---

## 29. Backend Architecture

```
API
├── Locations
│   ├── List
│   ├── Detail
│   ├── Search
│   ├── Filter
│   └── Nearby
└── Data Pipeline
    ├── Crawl
    ├── Process
    ├── Validate
    ├── Deduplicate
    └── Save
```

---

## 30. Complete Architecture (Full Diagram)

```
DATA SOURCES
     ↓
  CRAWLER
     ↓
DATA PROCESSING
     ├── Clean
     ├── Geocode
     └── Validate
     ↓
DEDUPLICATE
     ↓
PostgreSQL + PostGIS
     ↓
  REST API
     ↓
  FRONTEND
     ↓
 MAP HÀ NỘI
     ├── CHARGING STATION
     └── STORE
          ↓
        MARKER
          ↓
        POPUP
          ↓
    LOCATION DETAIL
```

---

## 31. Main Data Flow

```
External Source → Crawler → Raw Data → Cleaning → Normalization
→ Validation → Geocoding → Deduplication → PostgreSQL + PostGIS
→ REST API → Frontend → Map
```

---

## 32. Integration Flow (End-to-End quan trọng nhất của Phase 1)

```
Crawler → Database → API → Frontend → Map
```

**Ví dụ cụ thể:**

```
Crawler lấy Store mới
   ↓
Store được lưu vào Database
   ↓
GET /api/locations?type=store
   ↓
Frontend nhận Store
   ↓
Marker xuất hiện trên Map
```

> Đây là **End-to-End Flow quan trọng nhất** cần đảm bảo hoạt động thông suốt trong Phase 1.

---

## 33. Cấu trúc thư mục dự án (Project Folder Structure)

```
MapPlatform/
├── apps/
│   ├── web/                 # Next.js frontend (Map UI) — Docker service `web`
│   └── api/                 # Payload CMS + REST — Docker service `api`
├── crawler/                 # Python crawler — Docker service `crawler`
│   ├── sources/
│   ├── processors/
│   ├── geocoder/
│   ├── deduplicator/
│   └── scheduler/
├── database/
│   ├── init/                # Docker first-boot (extensions)
│   ├── migrations/
│   └── seeds/
├── docs/
├── context.md
├── .env.example
├── docker-compose.yml       # BẮT BUỘC: db + api + web + crawler
├── .gitignore
└── README.md
```

> ⚠️ **Lưu ý cho Agent:** Stack **bắt buộc**: Payload CMS + PostgreSQL/PostGIS + Docker Compose. Không chuyển sang NestJS-only hay MongoDB.

---

## 34. Environment Variables

Secret **không được hard-code**. Danh sách đầy đủ: [`.env.example`](./.env.example).

Biến tối thiểu:

```
DATABASE_URL
PAYLOAD_SECRET
API_BASE_URL
NEXT_PUBLIC_API_BASE_URL
NEXT_PUBLIC_MAP_TILE_URL
NEXT_PUBLIC_MAP_ATTRIBUTION
CORS_ORIGINS
POSTGRES_USER
POSTGRES_PASSWORD
POSTGRES_DB
PHOTON_BASE_URL
NOMINATIM_BASE_URL
NOMINATIM_USER_AGENT
OVERPASS_URL
```

> Không bắt buộc `MAPBOX_*` / `GOONG_*` / `GEOAPIFY_*`. Registry miễn phí: [`docs/09-free-apis-and-urls.md`](./docs/09-free-apis-and-urls.md).

- Sử dụng file `.env` (thực tế, không commit) và `.env.example` (mẫu, có commit).
- ❌ **Không commit `.env` vào Git.**

---

## 35. Nguyên tắc code (Coding Principles)

1. **Keep It Simple** — Đây là MVP, không xây dựng kiến trúc quá phức tạp khi chưa cần.
2. **Modular** — Tách riêng: Crawler, Processing, Database, API, Frontend.
3. **Reusable** — Các hàm dùng chung cần tái sử dụng, ví dụ: `getLocations()`, `getLocationById()`, `searchLocations()`, `getNearbyLocations()`.
4. **Type Safety** — Nếu dùng TypeScript, các type `Location`, `LocationType`, `LocationStatus` phải được định nghĩa rõ ràng.
5. **Error Handling** — Không để lỗi làm crash toàn bộ hệ thống.
6. **Logging** — Các pipeline quan trọng (crawl, process, geocode, dedupe) phải có log.

---

## 36. Quy tắc bắt buộc cho Agent (Agent Rules)

Khi code, Agent **phải**:

1. Đọc `context.md` này trước khi bắt đầu bất kỳ task nào.
2. Kiểm tra code hiện tại trước khi sửa (không code mù).
3. Không tự ý thay đổi kiến trúc lớn của hệ thống.
4. Không thêm AI vào Phase 1.
5. Không thêm Vector Database nếu chưa cần.
6. Không thêm Neo4j nếu chưa cần.
7. Không thêm Microservices nếu MVP chưa cần.
8. Không xây dựng Admin Dashboard phức tạp.
9. Không mở rộng phạm vi ngoài Hà Nội.
10. Ưu tiên code đơn giản, dễ hiểu, dễ maintain.
11. Ưu tiên REST API (không tự ý chuyển sang GraphQL).
12. **Bắt buộc** PostgreSQL + PostGIS làm database chính (không MongoDB).
13. **Bắt buộc** Payload CMS làm Backend/API (không thay bằng NestJS/Express/FastAPI làm API chính).
14. **Bắt buộc** Docker Compose: services `db`, `api`, `web`, `crawler`.
15. **Bắt buộc API $0:** map Leaflet+Carto/OpenFreeMap; geocode Photon→Nominatim; data VinFast+Overpass. Không default Mapbox/Goong/Geoapify/Google Maps API (xem `docs/09-free-apis-and-urls.md`).
16. Không hard-code API Keys.
17. Không commit Secret vào Git.
18. Mỗi chức năng mới phải có Error Handling.

---

## 37. Những gì KHÔNG được xây dựng trong Phase 1

❌ Tuyệt đối không triển khai các hạng mục sau (thuộc Phase 2 hoặc Phase 3):

- AI Chatbot
- LLM
- RAG
- Vector Database
- AI Recommendation
- AI Reasoning
- Agentic Workflow
- LangGraph
- Traffic Prediction
- Route Optimization
- Advanced Business Rules
- Complex Dashboard
- Nationwide Data (dữ liệu toàn quốc)

---

## 38. Phase 1 Deliverables (Checklist hạng mục cần hoàn thành)

| # | Deliverable |
|---|---|
| 01 | Data Model |
| 02 | PostgreSQL + PostGIS |
| 03 | Crawler |
| 04 | Data Processing |
| 05 | Geocoding |
| 06 | Deduplication |
| 07 | Daily Scheduler |
| 08 | REST API |
| 09 | Search API |
| 10 | Filter API |
| 11 | Nearby API |
| 12 | Frontend Map |
| 13 | Map Layers |
| 14 | Markers |
| 15 | Popup |
| 16 | Location Detail |
| 17 | End-to-End Integration |
| 18 | Testing |

---

## 39. Definition of Done (DoD)

> ✅ **Trạng thái hiện tại: PHASE 1 DONE** (implementation verified 2026-07-28). Chi tiết: [`docs/01-phase1-status.md`](./docs/01-phase1-status.md).

Phase 1 được coi là **hoàn thành** khi tất cả các mục sau đều đạt:

- [x] PostgreSQL hoạt động
- [x] PostGIS hoạt động
- [x] Location Data Model hoàn thành
- [x] Crawler hoạt động
- [x] Data Processing hoạt động
- [x] Geocoding hoạt động
- [x] Deduplication hoạt động
- [x] Scheduler chạy 1 lần/ngày
- [x] REST API hoạt động
- [x] Search hoạt động
- [x] Filter hoạt động
- [x] Nearby Search hoạt động
- [x] Frontend hoạt động
- [x] Map Hà Nội hiển thị
- [x] Charging Station Layer hoạt động
- [x] Store Layer hoạt động
- [x] Marker hoạt động
- [x] Popup hoạt động
- [x] Location Detail hoạt động
- [x] End-to-End Flow hoạt động

> Cập nhật: Phase 1 implementation — xem [`docs/01-phase1-status.md`](./docs/01-phase1-status.md). VinFast dùng seed curated vì SPA không có API public ổn định.

---

## 40. Expected MVP User Flow

**Flow chính (xem trên bản đồ):**
```
Mở Geo Decision Platform → Map Hà Nội → Bật Charging Station
→ Xem Marker → Click Marker → Xem Popup → Xem Location Detail
```

**Flow tìm kiếm:**
```
Search: "Times City" → API → Search Result → Map Zoom → Marker
```

**Flow tìm gần tôi:**
```
Near Me → Get User Location → Nearby API → Nearest Location
```

---

## 41. Phase 1 Success Criteria

Phase 1 thành công khi hệ thống có thể trả lời được câu hỏi cơ bản:

> **"Ở Hà Nội, các Trạm sạc và Store đang ở đâu?"**

Và người dùng có thể: **Xem, Tìm kiếm, Lọc, Tìm gần nhất, Xem chi tiết** — tất cả trên bản đồ.

**Giá trị cốt lõi của Phase 1:**

```
Reliable Geo Data + Centralized Geo Database + Reusable REST API + Visual Map
```

---

## 42. Phase 2 — AI GEO DECISION ENGINE

```
User Query → LLM/Rules → Intent Detection → Entity Extraction → Location Extraction
→ Geo Query → Business Rules → Ranking → Recommendation → Explanation
```

**Ví dụ:**
> "Xe tôi gần Times City, pin còn 10%, tìm trạm sạc phù hợp nhất."

```
AI → Understand Intent → Find Location → Query Geo Platform
→ Apply Business Rules → Rank Stations → Recommend → Explain Why → Show On Map
```

> ✅ **Implemented** — xem [`docs/02-phase2-status.md`](./docs/02-phase2-status.md). Endpoint `POST /api/decide`. Default $0 (rules + Photon); Ollama optional.

---

## 43. Chỉ dẫn cuối cùng cho AI Coding Agent

Khi thực hiện task Phase 2+:

1. Scope địa lý mặc định vẫn **Hà Nội** trừ khi user mở rộng.
2. Tái sử dụng Phase 1 API — **không** duplicate geo query ad-hoc ngoài PostGIS/nearby.
3. LLM **optional**; NLU rule-based phải chạy được không cần key trả phí.
4. Không phụ thuộc Google/Mapbox/Goong làm default.
5. Giữ contract OpenAPI cập nhật khi thêm endpoint.

**Kiến trúc Phase 1+2:**

```
DATA SOURCES → CRAWLER → POSTGRESQL + POSTGIS
→ PAYLOAD / REST (/api/locations*) → DECISION (/api/decide)
→ FRONTEND MAP + AI panel
```

**Mục tiêu Phase 2:**

> Từ câu hỏi ngôn ngữ tự nhiên, hệ thống hiểu intent, truy vấn geo foundation, xếp hạng theo business rules, giải thích và hiển thị gợi ý trên bản đồ.
