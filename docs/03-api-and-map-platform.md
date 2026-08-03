# 03 — API & Map Platform (Chi tiết kỹ thuật)

> **Project:** Geo Decision Platform
> **Phase:** Phase 1 — Geo Data Foundation
> **Document:** API & Map Platform — Technical Specification
> **Geographic Scope:** Hà Nội, Việt Nam
> **Status:** MVP
> **Đọc trước:** [`../context.md`](../context.md) (bắt buộc), [`00-tech-decisions.md`](./00-tech-decisions.md) (Payload CMS + PostgreSQL + Docker + Leaflet/Carto ($0)).
> **Contract máy đọc được:** [`openapi.yaml`](./openapi.yaml) — Agent implement API **khớp OpenAPI**; file prose này giải thích thêm.
> **Frontend chi tiết:** xem [`04-frontend-map-ui.md`](./04-frontend-map-ui.md) — mục Frontend trong file này chỉ nêu Map Adapter + luồng dữ liệu, tránh trùng lặp UI.
> **Nguyên tắc:** Nếu mâu thuẫn với `context.md` → **`context.md` thắng**.

---

## 1. Vị trí của tài liệu này trong Phase 1

Phase 1 gồm 3 phần:

```
01 — Data Modeling & Database Design
02 — Data Crawling & Ingestion
03 — API & Map Platform   ← tài liệu này
```

Sau khi 01 và 02 hoàn tất, hệ thống đã có:

```
External Data → Crawler → Data Processing → PostgreSQL + PostGIS
```

Tài liệu này đặc tả **lớp còn lại**: API Layer (đọc dữ liệu ra) và Map Platform (hiển thị dữ liệu). Tài liệu này **không** mô tả lại crawler hay data pipeline — xem `context.md` mục 11–15 cho phần đó.

Kiến trúc lớp cần xây trong tài liệu này:

```
PostgreSQL + PostGIS
        ↓
Backend / Payload CMS
        ↓
RESTful API
        ↓
Frontend (Next.js + React)
        ↓
Map Hà Nội
```

> ✅ **Backend BẮT BUỘC: Payload CMS 3 + PostgreSQL + Docker** (xem `00-tech-decisions.md`). Custom endpoint PostGIS cho `/api/locations/nearby`. Không thay bằng NestJS/Express làm API chính.

---

## 2. Mục tiêu (Objectives)

API & Map Platform phải cung cấp được các khả năng sau, ánh xạ trực tiếp tới `context.md` mục 4 và mục 38:

| # | Khả năng | API tương ứng |
|---|---|---|
| 1 | Lấy danh sách Location | `GET /api/locations` |
| 2 | Lấy chi tiết 1 Location | `GET /api/locations/:id` |
| 3 | Lọc theo loại Location | `GET /api/locations?type=...` |
| 4 | Lọc theo trạng thái | `GET /api/locations?status=...` |
| 5 | Tìm kiếm theo tên/địa chỉ | `GET /api/locations?search=...` |
| 6 | Tìm Location gần vị trí người dùng | `GET /api/locations/nearby` |
| 7 | Phân trang | `?page=...&limit=...` |
| 8 | (Tuỳ chọn) Lọc theo khung nhìn bản đồ | `?minLat=&maxLat=&minLng=&maxLng=` |
| 9 | Hiển thị Location trên bản đồ Hà Nội theo Layer | Frontend consume các API trên |
| 10 | Chuẩn bị nền tảng (không triển khai) cho AI ở Phase 2 | Không có endpoint riêng — chỉ đảm bảo API đủ generic để Phase 2 gọi lại |

> Mục tiêu số 10 **chỉ là ghi chú kiến trúc**, KHÔNG được hiểu là "cần code thêm gì cho AI". Không tạo endpoint, model, hay field nào dành riêng cho AI trong Phase 1.

---

## 3. Phạm vi MVP (Scope)

Giữ nguyên theo `context.md` mục 5 và mục 6:

- **Location Type** hỗ trợ trong MVP: `charging_station`, `store`.
- Các type khác (`service_center`, `showroom`, `dealer`, `parking`, `rescue_team`) **không cần** có dữ liệu/UI riêng trong Phase 1, nhưng API và data model **phải chấp nhận enum mở rộng được** (không hard-code chỉ 2 giá trị ở tầng validation nếu có thể tránh được — xem mục 8.3).
- **Khu vực địa lý:** chỉ Hà Nội. Không cần bounding-box toàn quốc, không cần multi-city switch.
- **Không triển khai** bất kỳ mục nào thuộc danh sách cấm ở `context.md` mục 37 (AI Chatbot, LLM, RAG, Vector DB, Route Optimization, v.v.).

---

## 4. Kiến trúc tổng thể (Architecture)

```
DATA SOURCES
     ↓
   CRAWLER
     ↓
DATA PROCESSING
     ↓
PostgreSQL + PostGIS         ← nguồn dữ liệu duy nhất (single source of truth)
     ↓
BACKEND (API Layer)          ← Payload CMS (BẮT BUỘC — docs/00-tech-decisions.md)
     ↓
RESTful API  (/api/locations, /api/locations/:id, /api/locations/nearby)
     ↓
FRONTEND (Next.js + React)
     ↓
MAP HÀ NỘI (Leaflet + Carto / OpenFreeMap — $0)
     ├── Charging Station Layer
     └── Store Layer
          ↓
        Marker → Popup → Location Detail
```

### Nguyên tắc bắt buộc

1. **Frontend không bao giờ truy vấn PostgreSQL trực tiếp.** Mọi truy cập dữ liệu phải đi qua REST API.

   ```
   ĐÚNG:  Frontend → REST API → Backend → PostgreSQL
   SAI:   Frontend → PostgreSQL (trực tiếp)
   ```

2. **Map Provider chỉ chịu trách nhiệm render** (tile, hiển thị, tương tác zoom/pan). Map Provider **không** chứa business logic, **không** tự query dữ liệu Location — dữ liệu luôn được Frontend fetch từ REST API rồi truyền vào Map Component dưới dạng props/state.
3. **Map Adapter Pattern:** tách lớp gọi Map Provider SDK (Leaflet / MapLibre (+ Carto or OpenFreeMap tiles)) ra khỏi phần logic Frontend còn lại, để có thể đổi provider mà không sửa toàn bộ codebase.

   ```
   Map Provider SDK → Map Adapter (interface chung) → Map Component (Frontend)
   ```

---

## 5. Data Model tham chiếu (Reference — không định nghĩa lại)

API & Map Platform build trên entity `Location` đã định nghĩa ở `context.md` mục 7. Nhắc lại field tối thiểu để Agent đối chiếu khi thiết kế response payload:

```typescript
type LocationType = "charging_station" | "store" | "service_center" | "showroom" | "dealer" | "parking" | "rescue_team";
type LocationStatus = "active" | "inactive";

interface Location {
  id: string;                // UUID
  name: string;
  type: LocationType;
  address: string;
  phone?: string | null;         // optional, có thể null nếu không crawl được
  openingHours?: string | null;  // optional
  latitude: number;
  longitude: number;
  status: LocationStatus;
  source: string;            // = sources.name (join) — không trả source_id UUID
  sourceUrl?: string | null;
  lastUpdated: string;   // ISO 8601 timestamp
  createdAt: string;
  updatedAt: string;
}
```

> `source` trên API là **tên nguồn** (`sources.name`), map từ `locations.source_id`. Xem `context.md` mục 7 và `openapi.yaml`.
>
> `phone` và `openingHours` cần có trong Location Detail. Nếu chưa crawl được, trả về `null`, **không** để field bị thiếu hoàn toàn khỏi response.

---

## 6. Nguyên tắc thiết kế API chung

- **Chuẩn:** RESTful, resource-based. Resource chính duy nhất trong Phase 1: `locations`.
- **Base path:** `/api`
- **Không dùng GraphQL** trong MVP (xem `context.md` mục 36.11).
- **Versioning:** không bắt buộc version prefix (`/api/v1/...`) trong MVP nếu project chưa có sẵn convention này; nếu project đã có `/api/v1`, giữ nguyên convention hiện tại.
- **Content-Type:** `application/json` cho mọi request/response.
- **Tất cả timestamp** trả về theo chuẩn ISO 8601, UTC.
- **Tất cả toạ độ** dùng hệ WGS84 (chuẩn GPS thông thường: latitude ∈ [-90, 90], longitude ∈ [-180, 180]).

---

## 7. Chuẩn hoá Response Envelope

Toàn bộ API trong Phase 1 phải trả về theo **đúng một format** dưới đây — không được để mỗi endpoint tự ý trả cấu trúc khác nhau.

### 7.1. Response thành công — danh sách (list, có phân trang)

```json
{
  "success": true,
  "data": [ /* mảng Location */ ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "totalDocs": 200,
    "totalPages": 10
  }
}
```

### 7.2. Response thành công — 1 object (detail)

```json
{
  "success": true,
  "data": { /* 1 Location object */ }
}
```

### 7.3. Response lỗi

```json
{
  "success": false,
  "error": {
    "code": "LOCATION_NOT_FOUND",
    "message": "Location not found"
  }
}
```

> Mọi endpoint bắt buộc trả `success: boolean` ở top-level để Frontend có thể xử lý logic thống nhất (`if (res.success) {...} else {...}`), tránh phải parse HTTP status code riêng lẻ ở nhiều nơi trong code Frontend.

---

## 8. Đặc tả từng Endpoint

### 8.1. `GET /api/locations` — Danh sách Location

**Mục đích:** Endpoint tổng hợp cho List + Filter + Search + Pagination + Bounding Box. Đây là 1 endpoint duy nhất nhận nhiều query param tuỳ chọn, không tách thành nhiều endpoint riêng lẻ cho từng loại filter.

**Query Parameters:**

| Param | Kiểu | Bắt buộc | Mặc định | Mô tả |
|---|---|---|---|---|
| `type` | string (enum `LocationType`) | Không | (không lọc) | Lọc theo loại Location. Ví dụ: `type=store` |
| `status` | string (`active`\|`inactive`) | Không | `active` | MVP mặc định chỉ trả Location `active` nếu không truyền param này (xem `context.md` mục 26) |
| `search` | string | Không | (không tìm) | Tìm theo `name` hoặc `address`, case-insensitive, không phân biệt dấu tiếng Việt nếu có thể (ILIKE hoặc full-text search đơn giản) |
| `page` | integer | Không | `1` | Trang hiện tại, bắt đầu từ 1 |
| `limit` | integer | Không | `20` | Số record mỗi trang. Giới hạn tối đa `limit=100` để tránh trả toàn bộ dữ liệu trong 1 request |
| `minLat`, `maxLat`, `minLng`, `maxLng` | float | Không | (không lọc) | Bounding box theo khung nhìn bản đồ hiện tại. Cả 4 giá trị phải được truyền cùng lúc, nếu thiếu 1 trong 4 → bỏ qua toàn bộ bounding box filter (không lỗi) |

**Ví dụ request:**

```
GET /api/locations?type=charging_station&status=active&page=1&limit=20
GET /api/locations?search=Times%20City
GET /api/locations?minLat=20.90&maxLat=21.10&minLng=105.70&maxLng=106.00
```

**Ví dụ response (200 OK):**

```json
{
  "success": true,
  "data": [
    {
      "id": "9f1c2e6a-...",
      "name": "VinFast Times City",
      "type": "store",
      "address": "458 Minh Khai, Hà Nội",
      "latitude": 20.995,
      "longitude": 105.862,
      "status": "active"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "totalDocs": 42,
    "totalPages": 3
  }
}
```

> Ở dạng list, response item **có thể rút gọn field** so với full Location object (không cần `phone`, `openingHours`, `source` — những field này chỉ cần ở Detail). Điều này giảm payload size cho Map rendering.

**Validation cần có:**
- Nếu `type` không nằm trong enum hợp lệ → trả `400 BAD_REQUEST`.
- Nếu `page` hoặc `limit` không phải số nguyên dương → trả `400 BAD_REQUEST`.
- Nếu `limit` > 100 → tự động clamp về 100 (không lỗi, chỉ giới hạn).

---

### 8.2. `GET /api/locations/:id` — Chi tiết Location

**Mục đích:** Trả về đầy đủ thông tin 1 Location, dùng khi user click Marker → "View Detail".

**Ví dụ request:**

```
GET /api/locations/9f1c2e6a-...
```

**Ví dụ response (200 OK):**

```json
{
  "success": true,
  "data": {
    "id": "9f1c2e6a-...",
    "name": "VinFast Times City",
    "type": "store",
    "address": "458 Minh Khai, Hà Nội",
    "phone": "1900xxxx",
    "openingHours": "08:00-22:00",
    "latitude": 20.995,
    "longitude": 105.862,
    "status": "active",
    "source": "official-website",
    "sourceUrl": "https://example.com/store/123",
    "lastUpdated": "2026-07-20T09:00:00Z",
    "createdAt": "2026-06-01T00:00:00Z",
    "updatedAt": "2026-07-20T09:00:00Z"
  }
}
```

**Response lỗi (404 Not Found):**

```json
{
  "success": false,
  "error": {
    "code": "LOCATION_NOT_FOUND",
    "message": "Location not found"
  }
}
```

> Không hiển thị toàn bộ raw data crawl được (`context.md` mục 24 → Location Detail đã nói rõ điều này). Chỉ trả các field đã chuẩn hoá.

---

### 8.3. `GET /api/locations/nearby` — Tìm Location gần vị trí (quan trọng nhất Phase 1)

**Mục đích:** Chức năng cốt lõi nhất của Phase 1 (xem `context.md` mục 18, mục 41). Dùng PostGIS để tính khoảng cách thực tế trên bề mặt trái đất, không dùng công thức Euclidean thô.

**Query Parameters:**

| Param | Kiểu | Bắt buộc | Mặc định | Mô tả |
|---|---|---|---|---|
| `latitude` | float | **Có** | — | Vĩ độ vị trí người dùng |
| `longitude` | float | **Có** | — | Kinh độ vị trí người dùng |
| `radius` | integer | Không | `5000` | Bán kính tìm kiếm, **đơn vị: mét** |
| `type` | string (enum) | Không | (không lọc, trả mọi type) | Lọc theo loại Location |
| `limit` | integer | Không | `20` | Giới hạn số kết quả trả về |

> ⚠️ **Chuẩn hoá tên tham số:** Dùng `latitude` / `longitude` (không dùng viết tắt `lat`/`lng`) để đồng bộ với field name trong Location model và tránh nhầm lẫn giữa các phần của hệ thống. Đây là quyết định chuẩn hoá bắt buộc cho Phase 1 (tài liệu gốc dùng `lat`/`lng` không nhất quán với `context.md` — file này chọn `latitude`/`longitude` làm chuẩn chính thức).

**Ví dụ request:**

```
GET /api/locations/nearby?latitude=20.995&longitude=105.862&radius=5000&type=charging_station
```

**Flow xử lý bắt buộc:**

```
User Location (lat, lng)
      ↓
REST API nhận request, validate input
      ↓
PostGIS Spatial Query:
   ST_DWithin(location, ST_MakePoint(:lng, :lat)::geography, :radius)
      ↓
Tính khoảng cách chính xác:
   ST_Distance(location, ST_MakePoint(:lng, :lat)::geography)
      ↓
Sắp xếp theo khoảng cách tăng dần (ORDER BY distance ASC)
      ↓
Áp dụng limit
      ↓
Trả kết quả kèm distance
```

**Gợi ý SQL tham khảo (PostGIS):**

```sql
SELECT
  id, name, type, address, latitude, longitude, status,
  ST_Distance(location, ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)::geography) AS distance_m
FROM locations
WHERE status = 'active'
  AND (:type IS NULL OR type = :type)
  AND ST_DWithin(
        location,
        ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)::geography,
        :radius
      )
ORDER BY distance_m ASC
LIMIT :limit;
```

> Lưu ý thứ tự tham số của `ST_MakePoint(longitude, latitude)` — PostGIS nhận **longitude trước, latitude sau**. Đây là lỗi phổ biến nhất khi implement, Agent cần đặc biệt cẩn thận.

**Ví dụ response (200 OK):**

```json
{
  "success": true,
  "data": [
    {
      "id": "a1b2...",
      "name": "Station A",
      "type": "charging_station",
      "address": "...",
      "latitude": 21.005,
      "longitude": 105.850,
      "status": "active",
      "distanceKm": 1.2
    },
    {
      "id": "c3d4...",
      "name": "Station B",
      "type": "charging_station",
      "address": "...",
      "latitude": 21.010,
      "longitude": 105.870,
      "status": "active",
      "distanceKm": 2.5
    }
  ]
}
```

> `distance_m` từ PostGIS (đơn vị mét) cần được convert sang `distanceKm` (làm tròn 1–2 chữ số thập phân) trước khi trả về Frontend, vì Frontend hiển thị theo km cho người dùng dễ đọc.

**Validation bắt buộc:**
- Thiếu `latitude` hoặc `longitude` → `400 BAD_REQUEST`.
- `latitude` ngoài [-90, 90] hoặc `longitude` ngoài [-180, 180] → `400 BAD_REQUEST`.
- `radius` ≤ 0 hoặc không phải số → `400 BAD_REQUEST`.
- Không tìm thấy Location nào trong bán kính → trả `200 OK` với `data: []` (không phải lỗi — không có kết quả không đồng nghĩa với lỗi hệ thống).

---

## 9. Pagination — Quy tắc chung

- Áp dụng cho `GET /api/locations` (không áp dụng cho `nearby` — nearby dùng `limit` đơn giản vì luôn sort theo distance).
- Mặc định: `page=1`, `limit=20`.
- Response luôn kèm block `pagination` như mô tả ở mục 7.1.
- Mục tiêu: giảm tải API, tăng tốc Frontend, hỗ trợ dữ liệu lớn dần theo thời gian (xem `context.md` — dữ liệu sẽ tăng khi crawler chạy hằng ngày).

---

## 10. Bounding Box (khung nhìn bản đồ) — Tuỳ chọn, triển khai sau nếu cần

- Dùng khi Frontend muốn chỉ tải Location đang nằm trong khung nhìn hiện tại của bản đồ (thay vì tải toàn bộ Hà Nội).
- Có thể **triển khai sau** Nearby Search nếu số lượng Location trong MVP còn nhỏ (dưới vài trăm record, tải hết vẫn nhanh).
- Khi triển khai: kết hợp với `type`/`status` filter trong cùng 1 query tới `GET /api/locations`.

```
Map Viewport → Bounding Box (minLat, maxLat, minLng, maxLng) → API → Database → Locations in View
```

---

## 11. Error Handling — Chuẩn mã lỗi

Mọi lỗi phải trả **đủ 3 thành phần**: HTTP Status, `error.code`, `error.message`.

| HTTP Status | `error.code` | Tình huống |
|---|---|---|
| 400 | `BAD_REQUEST` | Query param sai định dạng, thiếu param bắt buộc, giá trị ngoài phạm vi hợp lệ |
| 400 | `INVALID_LOCATION_TYPE` | `type` không nằm trong enum hợp lệ |
| 404 | `LOCATION_NOT_FOUND` | `GET /api/locations/:id` không tìm thấy record |
| 429 | `TOO_MANY_REQUESTS` | Vượt rate limit (xem mục 13) |
| 500 | `INTERNAL_SERVER_ERROR` | Lỗi không xác định phía server (DB down, query lỗi, v.v.) |

**Nguyên tắc:** Không để lỗi tầng dưới (DB error, exception) làm crash toàn bộ server — luôn bắt exception ở tầng API và trả về đúng format lỗi chuẩn ở trên (xem `context.md` mục 35.5).

---

## 12. Security

- **CORS:** chỉ cho phép origin của Frontend (whitelist domain cụ thể, không dùng `*` ở môi trường production).
- **Rate Limiting:** áp dụng giới hạn số request/phút theo IP cho các endpoint public, đặc biệt `nearby` và `search` (dễ bị lạm dụng để scrape toàn bộ dữ liệu).
- **Input Validation:** validate mọi query param trước khi đưa vào query DB — chống SQL Injection (dùng parameterized query / ORM, tuyệt đối không nối chuỗi SQL trực tiếp từ input).
- **Không expose:** database credentials, connection string, internal error stack trace ra response cho client.
- **Secrets:** đọc từ biến môi trường (`DATABASE_URL`, `PAYLOAD_SECRET`, `API_BASE_URL`, `NEXT_PUBLIC_MAP_TILE_URL`) — xem `context.md` mục 34. Không hard-code, không commit `.env`.

---

## 13. Performance & Indexing

Index bắt buộc trên bảng `locations`:

| Cột | Loại Index | Lý do |
|---|---|---|
| `type` | B-tree | Filter theo loại Location |
| `status` | B-tree | Filter mặc định `active` |
| `location` (PostGIS geometry/geography Point) | **GiST index** | Bắt buộc để `ST_DWithin`/`ST_Distance` chạy nhanh; không có index này, nearby search sẽ full table scan |
| `name`, `address` | B-tree hoặc GIN (nếu dùng full-text search) | Tăng tốc `search` param |

```sql
CREATE INDEX idx_locations_type ON locations (type);
CREATE INDEX idx_locations_status ON locations (status);
CREATE INDEX idx_locations_geom ON locations USING GIST (location);
```

**Mục tiêu:** Nearby Search phải trả kết quả nhanh (mức mili-giây đến vài trăm ms) ngay cả khi dữ liệu tăng lên hàng nghìn record trong Hà Nội.

---

## 14. Frontend Architecture

**Stack:** Next.js + React (đã chốt ở `context.md` mục 19).

```
Frontend
├── Search Box
├── Filter Panel
├── Layer Control
└── Map
    ├── Charging Station Layer
    ├── Store Layer
    ├── Marker
    ├── Popup
    └── Location Detail Panel
```

### 14.1. Data flow tổng quát trong Frontend

```
PostgreSQL + PostGIS
      ↓
Backend / REST API
      ↓
Frontend fetch (React Query / SWR / fetch API)
      ↓
Map Component (nhận Location[] qua props/state)
      ↓
   ┌───────┴───────┐
   ▼               ▼
Charging Layer   Store Layer
   │               │
   └───────┬───────┘
           ▼
        Marker
           ▼
        Popup
           ▼
   Location Detail
```

### 14.2. Map

- **Map Provider (MVP, $0):** Leaflet + Carto basemaps (hoặc OpenFreeMap). Không dùng Mapbox/Google/Goong làm default — xem `09-free-apis-and-urls.md`.
- **Map Center mặc định:** Hà Nội — `latitude: 21.0285, longitude: 105.8542`.
- **Zoom mặc định:** đủ để nhìn thấy phần lớn nội thành Hà Nội (gợi ý zoom level ~11–12, tuỳ provider).
- Dữ liệu Location luôn lấy từ REST API — **không hard-couple vào Map Provider**, đảm bảo đổi provider sau này không cần viết lại toàn bộ logic hiển thị dữ liệu.

### 14.3. Map Layer

MVP có đúng 2 layer, độc lập bật/tắt:

```
☑ Charging Station Layer
☑ Store Layer
```

- Tắt 1 layer → chỉ ẩn Marker khỏi bản đồ (client-side), **không** xoá dữ liệu, **không** gọi lại API (trừ khi Frontend chọn cách implement là gọi API riêng theo `type` mỗi khi toggle — cả 2 cách đều chấp nhận được, ưu tiên cách nào đơn giản hơn với kiến trúc hiện tại của project).

### 14.4. Marker

- Mỗi Location active → 1 Marker trên bản đồ.
- Icon phân biệt theo `type`:

| Type | Icon gợi ý |
|---|---|
| `charging_station` | Icon trạm sạc (tia sét / phích cắm) |
| `store` | Icon cửa hàng |

- Marker cần lưu tối thiểu: `id`, `name`, `type`, `latitude`, `longitude` để phục vụ click → gọi Detail API.

### 14.5. Popup

Khi click Marker → hiện Popup ngắn gọn:

```
[Tên Location]
[Type]
[Address]
[Status]
[Nút: Xem chi tiết]
```

> Không nhồi quá nhiều thông tin vào Popup — Popup chỉ là preview, thông tin đầy đủ nằm ở Location Detail (khi click "Xem chi tiết" → gọi `GET /api/locations/:id`).

### 14.6. Location Detail

Hiển thị đầy đủ: `name`, `type`, `address`, `phone`, `openingHours`, `status`, `source`, `lastUpdated`. Không hiển thị raw crawl data.

### 14.7. Search

```
Search Box (user gõ "Times City")
      ↓
GET /api/locations?search=Times City
      ↓
Nhận kết quả
      ↓
Map zoom tới vị trí kết quả đầu tiên (hoặc hiển thị danh sách để user chọn)
```

### 14.8. Filter

```
Filter options: All | Charging Station | Store
      ↓
GET /api/locations?type=<value>
      ↓
Cập nhật lại Marker hiển thị trên Map
```

### 14.9. "Near Me" (Nearby từ phía Frontend)

```
Nút "Near Me"
      ↓
Browser Geolocation API → lấy (latitude, longitude) của thiết bị user
      ↓
GET /api/locations/nearby?latitude=...&longitude=...&radius=5000
      ↓
Hiển thị danh sách + Marker các Location gần nhất, sắp xếp theo distanceKm
```

> Cần xử lý trường hợp user từ chối cấp quyền Geolocation (hiển thị thông báo lỗi thân thiện, không crash app).

---

## 15. End-to-End Flow quan trọng nhất (phải hoạt động thông suốt)

```
Crawler lấy Store mới
      ↓
Store được lưu vào PostgreSQL + PostGIS
      ↓
GET /api/locations?type=store
      ↓
Frontend nhận danh sách Store
      ↓
Marker xuất hiện trên Map Hà Nội
```

Đây là luồng bắt buộc phải test và đảm bảo chạy ổn định trước khi coi Phase 1 hoàn thành (xem `context.md` mục 32, 41).

---

## 16. Testing Checklist

### 16.1. API Testing

Test tối thiểu cho mỗi endpoint:

```
GET /api/locations                              → valid request, trả đúng format envelope
GET /api/locations?type=store                   → filter đúng
GET /api/locations?type=invalid_type             → 400 BAD_REQUEST
GET /api/locations?status=active                 → filter đúng
GET /api/locations?search=Times%20City           → tìm đúng, không phân biệt hoa/thường
GET /api/locations/:id (id hợp lệ)               → 200, đầy đủ field
GET /api/locations/:id (id không tồn tại)        → 404 LOCATION_NOT_FOUND
GET /api/locations/nearby (đủ tham số)           → trả đúng, sort theo distance
GET /api/locations/nearby (thiếu latitude)       → 400 BAD_REQUEST
GET /api/locations/nearby (không có kết quả)     → 200, data: []
GET /api/locations?page=1&limit=20               → pagination đúng
```

Các trường hợp cần bao phủ: **Valid Request, Invalid Request, No Result, Not Found, Server Error**.

### 16.2. Map Testing

```
Map Load
Layer Toggle (bật/tắt Charging Station, Store)
Marker Render (đúng vị trí, đúng icon theo type)
Marker Click → Popup hiển thị đúng
Popup → View Detail → Location Detail hiển thị đúng
Search → Map zoom đúng vị trí
Filter → Marker cập nhật đúng
Zoom / Pan hoạt động bình thường
Near Me → xin quyền Geolocation → hiển thị kết quả gần nhất
```

---

## 17. Definition of Done — API & Map Platform

Phần này hoàn thành khi **tất cả** các mục sau đạt:

- [ ] Backend API layer hoạt động (Payload CMS + Docker theo `00-tech-decisions.md`)
- [ ] PostgreSQL + PostGIS kết nối và hoạt động ổn định
- [ ] `GET /api/locations` hoạt động, hỗ trợ filter + search + pagination
- [ ] `GET /api/locations/:id` hoạt động, trả 404 đúng khi không tìm thấy
- [ ] `GET /api/locations/nearby` hoạt động, dùng đúng PostGIS `ST_DWithin`/`ST_Distance`, sort theo khoảng cách
- [ ] Toàn bộ response tuân theo chuẩn envelope (`success`, `data`, `pagination`/`error`)
- [ ] Toàn bộ lỗi trả đúng HTTP status + `error.code` + `error.message`
- [ ] Index GiST trên cột `location` đã được tạo
- [ ] Map Hà Nội hiển thị đúng, center mặc định đúng toạ độ Hà Nội
- [ ] Charging Station Layer và Store Layer hoạt động độc lập
- [ ] Marker hiển thị đúng icon theo type, đúng vị trí
- [ ] Popup hiển thị đúng thông tin rút gọn
- [ ] Location Detail hiển thị đầy đủ thông tin, không lộ raw data
- [ ] Search hoạt động, Map zoom đúng kết quả
- [ ] Filter theo type và status hoạt động
- [ ] Near Me hoạt động, dùng đúng Browser Geolocation API
- [ ] End-to-End flow (mục 15) chạy thông suốt, đã test thủ công hoặc tự động

---

## 18. Demo Flow cuối Phase 1 (tham khảo khi trình bày kết quả)

```
1. User mở Web
2. Map Hà Nội hiển thị, center đúng vị trí
3. API tự động lấy dữ liệu từ PostgreSQL + PostGIS
4. Charging Station Layer hiển thị Marker
5. Store Layer hiển thị Marker
6. User click 1 Marker → Popup hiện ra
7. User bấm "Xem chi tiết" → Location Detail hiển thị đầy đủ
8. User gõ tìm kiếm ("Times City") → Map zoom tới kết quả
9. User chọn Filter (chỉ Charging Station) → Marker cập nhật
10. User bấm "Near Me" → hệ thống trả về các Location gần nhất, sắp xếp theo khoảng cách
```

---

## 19. Kiến trúc hoàn chỉnh Phase 1 (tham chiếu nhanh)

```
┌─────────────────────────────────────────────┐
│                DATA SOURCES                 │
│      Official Website / OSM / Public API     │
└───────────────────────┬─────────────────────┘
                         ▼
┌─────────────────────────────────────────────┐
│                  CRAWLER                     │
└───────────────────────┬─────────────────────┘
                         ▼
┌─────────────────────────────────────────────┐
│             DATA PROCESSING                  │
│  Clean → Normalize → Validate → Geocode      │
│                    → Deduplicate             │
└───────────────────────┬─────────────────────┘
                         ▼
┌─────────────────────────────────────────────┐
│         PostgreSQL + PostGIS (Database)      │
└───────────────────────┬─────────────────────┘
                         ▼
┌─────────────────────────────────────────────┐
│            API LAYER (Tài liệu này)         │
│   locations / locations/:id / nearby         │
└───────────────────────┬─────────────────────┘
                         ▼
┌─────────────────────────────────────────────┐
│         FRONTEND (Tài liệu này)              │
│              Map Hà Nội                      │
│  Layer → Marker → Popup → Location Detail    │
└─────────────────────────────────────────────┘
```

---

## 20. Ranh giới với Phase 2 (chỉ để tham khảo, KHÔNG triển khai)

Phase 2 — AI & Geo Decision Engine — sẽ **tái sử dụng nguyên vẹn** các API được đặc tả trong tài liệu này (`/api/locations`, `/api/locations/nearby`) làm nền tảng dữ liệu cho tầng AI phía trên. Vì vậy:

- API trong Phase 1 phải **đủ tổng quát, ổn định, có contract rõ ràng** (đúng như đặc tả ở mục 8) để Phase 2 gọi lại mà không cần sửa đổi breaking change.
- Phase 1 **tuyệt đối không** tự thêm bất kỳ thành phần nào thuộc Phase 2: không AI Intent Detection, không Business Rules Engine, không Ranking/Recommendation logic, không LLM call nào trong API layer này.

```
Phase 2 (tương lai, không triển khai ở đây):
User Query → LLM → Intent Detection → Location Extraction
→ gọi lại GET /api/locations/nearby (API đã có sẵn từ Phase 1)
→ Business Rules → Ranking → Recommendation → Explanation
```

---

## 21. Tóm tắt

Tài liệu này hoàn thiện lớp kết nối:

```
DATABASE (PostgreSQL + PostGIS) → API (REST) → MAP (Frontend)
```

Sau khi hoàn thành đúng đặc tả trong tài liệu này, hệ thống Phase 1 có khả năng: crawl → lưu → cung cấp API (list/detail/search/filter/nearby/pagination) → hiển thị bản đồ Hà Nội với đầy đủ Layer, Marker, Popup, Location Detail — chạy ổn định End-to-End. Đây là nền tảng để Phase 2 xây dựng AI-powered Geo Decision Engine mà không cần thay đổi cấu trúc dữ liệu hay API đã xây ở Phase 1.
