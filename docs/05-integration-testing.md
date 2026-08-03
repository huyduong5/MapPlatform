# 05 — Integration & Testing

> **Project:** Geo Decision Platform
> **Phase:** Phase 1 — Geo Data Foundation
> **Document:** Integration & Testing
> **Geographic Scope:** Hà Nội, Việt Nam
> **Status:** MVP
> **Companion:** [`../context.md`](../context.md). File này **không thay thế** `context.md`.
> **Đối tượng:** AI Coding Agent triển khai test suite Phase 1.
> **Ops liên quan:** [`06-deployment-ops.md`](./06-deployment-ops.md), CI gợi ý bên dưới + roadmap [`07-roadmap-and-risks.md`](./07-roadmap-and-risks.md).

---

## 0. Cách dùng tài liệu này

Tài liệu này khác bản gốc ở chỗ: mỗi test case được viết theo cấu trúc **Given / When / Then** kèm **dữ liệu mẫu cụ thể** (JSON, tọa độ thật, mã lỗi HTTP), để Agent có thể:

1. Sinh trực tiếp test code (unit / integration / e2e) từ mô tả, không cần suy diễn thêm.
2. Biết chính xác **input nào** → **output nào** → **pass khi nào, fail khi nào**.
3. Biết **chạy bằng công cụ gì**, đặt ở **thư mục nào**.

Nguyên tắc bắt buộc kế thừa từ `context.md` (mục 35–37): giữ đơn giản, không thêm AI/Vector DB/Microservices, chỉ scope Hà Nội, chỉ 2 type dữ liệu bắt buộc (`charging_station`, `store`).

---

## 1. Vị trí trong toàn bộ pipeline tài liệu

```
01 – Data Modeling
02 – Data Crawling & Ingestion
03 – API & Map Platform
04 – Frontend Map UI
05 – Integration & Testing   ← tài liệu này
```

Tài liệu 05 giả định 01–04 đã có (ít nhất ở dạng skeleton/implementation-in-progress). Mục tiêu của 05 là:

- Xác nhận **toàn bộ chuỗi** `External Source → Crawler → Data Processing → PostgreSQL/PostGIS → REST API → Frontend → Map` hoạt động xuyên suốt, không đứt gãy ở bất kỳ điểm nối nào.
- Cung cấp **bộ test case cụ thể, có thể tự động hóa** cho từng điểm nối và cho toàn bộ luồng End-to-End (E2E).
- Định nghĩa **Definition of Done** ở cấp độ kiểm thử (khác với DoD chức năng đã có ở `context.md` mục 39).

---

## 2. Test Environment Setup

Agent cần chuẩn bị môi trường test **tách biệt** với môi trường dev/production.

### 2.1. Cấu trúc thư mục test đề xuất

```
project/
├── apps/
│   ├── web/
│   │   └── tests/
│   │       ├── unit/
│   │       └── e2e/            # Playwright hoặc Cypress
│   └── api/
│       └── tests/
│           ├── unit/
│           └── integration/    # test API + DB thật (test DB riêng)
├── crawler/
│   └── tests/
│       ├── unit/                # test cleaning/normalization/geocode logic
│       └── integration/         # test crawl → DB write
├── database/
│   └── tests/
│       └── fixtures/            # seed data cho test
└── tests/
    └── e2e/                     # test end-to-end toàn hệ thống (cross-service)
```

> Nếu project hiện tại đã có cấu trúc test khác → **giữ nguyên cấu trúc hiện có**, chỉ bổ sung test theo tinh thần tài liệu này (đúng nguyên tắc `context.md` mục 33).

### 2.2. Test Database

- Dùng **PostgreSQL + PostGIS riêng** cho test (ví dụ database `geo_platform_test`), **không** chạy integration test trên DB dev/production.
- Đề xuất dùng Docker Compose service riêng hoặc schema riêng, reset trước mỗi test suite:

```bash
# Ví dụ pseudo-command Agent có thể áp dụng theo stack thực tế
docker compose -f docker-compose.test.yml up -d db_test
npm run migrate:test      # chạy migration lên DB test
npm run seed:test         # seed dữ liệu mẫu (xem mục 3)
```

### 2.3. Biến môi trường cho test

Kế thừa từ `context.md` mục 34, bổ sung biến riêng cho test:

```
DATABASE_URL_TEST=postgres://user:pass@localhost:5432/geo_platform_test
API_BASE_URL_TEST=http://localhost:3001
PHOTON_BASE_URL=https://photon.komoot.io/api/
NOMINATIM_USER_AGENT=MapPlatform-Test/1.0 (contact: test@example.com)
```

- ❌ Không dùng key/token production trong test.
- ❌ Không commit `.env.test` chứa secret thật vào Git — chỉ commit `.env.test.example`.

---

## 3. Test Fixtures — Dữ liệu mẫu chuẩn

Toàn bộ test case trong tài liệu này dùng chung bộ dữ liệu mẫu sau (Agent nên seed đúng bộ này để test có thể predict output chính xác):

```json
[
  {
    "name": "VinFast Times City",
    "type": "store",
    "address": "458 Minh Khai, Hai Bà Trưng, Hà Nội",
    "latitude": 20.9950,
    "longitude": 105.8620,
    "status": "active",
    "source": "vinfast_official",
    "source_url": "https://vinfastauto.com/vn_vi/tim-kiem-showroom-tram-sac"
  },
  {
    "name": "Trạm sạc VinFast Royal City",
    "type": "charging_station",
    "address": "72A Nguyễn Trãi, Thanh Xuân, Hà Nội",
    "latitude": 20.9985,
    "longitude": 105.8115,
    "status": "active",
    "source": "vinfast_official",
    "source_url": "https://vinfastauto.com/charging/royal-city"
  },
  {
    "name": "Trạm sạc Vincom Bà Triệu",
    "type": "charging_station",
    "address": "191 Bà Triệu, Hai Bà Trưng, Hà Nội",
    "latitude": 21.0083,
    "longitude": 105.8497,
    "status": "active",
    "source": "openstreetmap"
  },
  {
    "name": "VinFast Long Biên",
    "type": "store",
    "address": "Số 1 Nguyễn Văn Linh, Long Biên, Hà Nội",
    "latitude": 21.0378,
    "longitude": 105.8880,
    "status": "inactive",
    "source": "vinfast_official"
  },
  {
    "name": "Vinfast Times City",
    "type": "store",
    "address": "458 Minh Khai, Hai Bà Trưng, Hà Nội",
    "latitude": 20.9951,
    "longitude": 105.8621,
    "status": "active",
    "source": "openstreetmap",
    "_note": "Bản ghi này CỐ Ý gần trùng với record #1 — dùng để test Deduplication"
  }
]
```

Ghi chú quan trọng:
- Record #1 và #5 gần như trùng nhau (tên khác hoa/thường, tọa độ lệch < 20m) → dùng làm test case cho **Deduplication**.
- Record #4 có `status = inactive` → dùng để test Filter mặc định (context.md mục 26: MVP mặc định chỉ ưu tiên hiển thị `active`).
- User test point mặc định cho Nearby Search: `latitude=20.9950, longitude=105.8620` (trùng vị trí VinFast Times City) — Agent dùng điểm này xuyên suốt các test Nearby để kết quả có thể dự đoán được.

---

## 4. Sơ đồ kiến trúc tích hợp đầy đủ (tham chiếu)

```
EXTERNAL SOURCES
      │
      ▼
   CRAWLER  ──────────────► (retry, timeout, rate-limit, logging)
      │
      ▼
DATA PROCESSING
      │
      ├── Cleaning
      ├── Normalization
      ├── Validation
      ├── Geocoding (chỉ khi thiếu lat/long)
      └── Deduplication
      │
      ▼
PostgreSQL + PostGIS  (bảng `locations`)
      │
      ▼
   REST API   (/api/locations, /api/locations/:id, /api/locations/nearby, ...)
      │
      ▼
   FRONTEND   (Next.js + React)
      │
      ▼
  MAP HÀ NỘI
      ├── Charging Station Layer
      └── Store Layer
           │
           ▼
        MARKER → POPUP → LOCATION DETAIL
```

Đây chính là chuỗi mà mọi Integration Test và E2E Test trong tài liệu này phải bao phủ **không được bỏ sót bất kỳ mắt xích nào**.

---

## 5. Trách nhiệm từng thành phần trong Integration (Component Contract)

| Thành phần | Input | Output | KHÔNG được làm |
|---|---|---|---|
| Crawler | URL nguồn / API nguồn | Raw Location Data (JSON thô) | Không render map, không gọi AI, không validate sâu (chỉ lưu raw + metadata `source`, `source_url`) |
| Data Processing | Raw Data | Clean Location Data (đã chuẩn hoá, đã geocode, đã dedupe) | Không tự ý đổi Business logic của API |
| Database (PostgreSQL+PostGIS) | Clean Location Data | Persisted rows + spatial index | Không chứa logic nghiệp vụ (business rules) |
| REST API | HTTP Request | JSON Response chuẩn hoá | Không crawl trực tiếp website, không chứa AI logic |
| Frontend | JSON từ API | UI Render (Map, Marker, Popup...) | Không tự tính toán lại spatial query (luôn nhờ API/PostGIS) |
| Map tiles (Leaflet + Carto) | Tile request | Tile hiển thị | Không lưu trữ dữ liệu Location |
| Scheduler | Cron trigger | Kích hoạt Crawler | Không xử lý dữ liệu (chỉ trigger) |

---

## 6. Data Contract — API Response Schema (chuẩn hoá, dùng cho mọi test)

### 6.1. Location Object (trả về từ API)

```typescript
interface LocationDTO {
  id: string;                       // UUID
  name: string;
  type: "charging_station" | "store";
  address: string;
  latitude: number;
  longitude: number;
  status: "active" | "inactive";
  source: string;
  source_url: string | null;
  last_updated: string;             // ISO 8601
  distanceKm?: number;             // chỉ có ở endpoint /nearby
}
```

### 6.2. List Response Envelope

```json
{
  "data": [ /* LocationDTO[] */ ],
  "meta": {
    "total": 0
  }
}
```

### 6.3. Error Response Envelope (chuẩn hoá — bản gốc chưa định nghĩa, bổ sung)

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Location not found"
  }
}
```

Bảng mã lỗi tối thiểu Agent cần dùng nhất quán trong toàn bộ API:

| HTTP Status | `error.code` | Khi nào xảy ra |
|---|---|---|
| 400 | `INVALID_PARAMS` | Thiếu/sai kiểu `latitude`, `longitude`, `radius`, `type` |
| 404 | `NOT_FOUND` | `GET /api/locations/:id` không tồn tại |
| 500 | `INTERNAL_ERROR` | Lỗi không xác định phía server |
| 503 | `SERVICE_UNAVAILABLE` | Database không kết nối được |

---

## 7. Integration Test Suite — Chi tiết từng test case

Quy ước ID: `INT-<số>`. Mỗi test có: **Mục tiêu / Given / When / Then / Công cụ đề xuất**.

### INT-01 — Crawler lấy dữ liệu thành công

- **Mục tiêu:** Xác nhận Crawler trả về dữ liệu hợp lệ từ nguồn.
- **Given:** Crawler được cấu hình trỏ tới 1 nguồn test (có thể mock HTTP server trả về HTML/JSON mẫu).
- **When:** Chạy `crawler.run(source)`.
- **Then:**
  - Kết quả trả về là mảng object, mỗi object có tối thiểu: `name`, `address` **hoặc** (`latitude` + `longitude`), `type`, `source`.
  - Mảng không rỗng khi mock server trả dữ liệu hợp lệ.
  - Khi mock server trả lỗi (timeout/500) → Crawler không throw unhandled exception, mà trả về kết quả có field `status: "failed"` + log lỗi.
- **Công cụ:** Jest/Vitest (Node) hoặc Pytest (Python) tuỳ stack crawler; mock HTTP bằng `nock` (Node) hoặc `responses`/`httpx.MockTransport` (Python).

### INT-02 — Data Processing chuẩn hoá đúng

- **Given:** Input là raw data thô, ví dụ:
```json
{ "name": "  vinfast times city  ", "type": "STORE", "address": "458 Minh Khai,  Hà Nội", "latitude": "20.995", "longitude": "105.862" }
```
- **When:** Chạy qua pipeline `clean() → normalize() → validate()`.
- **Then:**
  - `name` → `"VinFast Times City"` (trim khoảng trắng thừa, chuẩn hoá viết hoa theo rule đã định nghĩa trong 01-Data-Modeling).
  - `type` → `"store"` (lowercase, khớp enum).
  - `latitude`/`longitude` → kiểu `number`, không phải `string`.
  - Nếu `type` không nằm trong enum cho phép (`charging_station`, `store`) → record bị đánh dấu `invalid` và **không** được insert vào DB.
- **Pass criteria:** 0 record thiếu toạ độ sau xử lý (trừ khi bị Geocode fail — xem INT-03), 0 record có `type` ngoài enum lọt vào DB.

### INT-03 — Geocoding khi thiếu toạ độ

- **Given:** Record có `address` nhưng **không có** `latitude`/`longitude`.
- **When:** Chạy `geocode(record)`.
- **Then:**
  - Nếu geocode thành công → record có `latitude`, `longitude` hợp lệ (nằm trong bounding box Hà Nội xấp xỉ: lat `20.5–21.5`, long `105.3–106.1`).
  - Nếu geocode thất bại (địa chỉ không tìm được) → record bị đánh dấu `invalid`, **không** insert, và được log vào bảng/log riêng để xử lý thủ công sau (không làm crash pipeline).

### INT-04 — Deduplication phát hiện bản ghi trùng

- **Given:** Seed dữ liệu gồm record #1 và #5 ở mục 3 (tên khác nhau nhẹ, toạ độ lệch < 20m).
- **When:** Chạy `deduplicate([...])` với rule: so khớp trên `normalized_name + coordinates` (làm tròn toạ độ ~4 chữ số thập phân ≈ sai số 11m, hoặc dùng `ST_DWithin` bán kính 20m).
- **Then:** Chỉ 1 trong 2 record được giữ lại (ưu tiên record có `source` đáng tin hơn theo thứ tự `context.md` mục 10: Official > Open Data > Public > Crawling, hoặc record có `last_updated` mới hơn nếu cùng cấp nguồn).
- **Pass criteria:** Sau dedupe, DB không có 2 row cùng đại diện 1 địa điểm thực tế.

### INT-05 — Database Insert / Update / Reject

- **Given:** DB test trống hoặc đã seed sẵn.
- **When:**
  1. Insert 1 Location mới hợp lệ → `SELECT` lại → tồn tại đúng field.
  2. Crawl lại cùng Location nhưng `address` đã đổi → hệ thống phải `UPDATE` (không tạo row mới, `id` giữ nguyên, `updated_at` thay đổi).
  3. Crawl lại Location y hệt, không đổi → `NO ACTION` (không có write nào xảy ra, `updated_at` không đổi).
  4. Insert record có `latitude = null` → bị **REJECT**, không xuất hiện trong DB.
- **Pass criteria:** Không có duplicate row sau nhiều lần chạy crawler liên tiếp với cùng dữ liệu nguồn.

### INT-06 — Spatial Query cơ bản (PostGIS)

- **Given:** DB đã seed dữ liệu mục 3 (bỏ record #5 trùng).
- **When:** Chạy SQL tương đương:
```sql
SELECT name, type,
       ST_Distance(location, ST_SetSRID(ST_MakePoint(105.8620, 20.9950), 4326)::geography) / 1000 AS distanceKm
FROM locations
WHERE ST_DWithin(location, ST_SetSRID(ST_MakePoint(105.8620, 20.9950), 4326)::geography, 5000)
  AND status = 'active'
ORDER BY distanceKm ASC;
```
- **Then:** Kết quả trả về được sắp xếp tăng dần theo `distanceKm`, và **không** bao gồm record #4 (status = `inactive`).

### INT-07 — REST API: List & Detail

- `GET /api/locations` → `200 OK`, body theo Response Envelope (mục 6.2), `meta.total` khớp số lượng record `active` trong DB (mặc định API chỉ trả `active` trừ khi có query `status=all`).
- `GET /api/locations/:id` với `id` tồn tại → `200 OK`, trả đúng 1 `LocationDTO`.
- `GET /api/locations/:id` với `id` không tồn tại (UUID hợp lệ nhưng không có trong DB) → `404 Not Found`, body theo Error Envelope, `error.code = "NOT_FOUND"`.
- `GET /api/locations/not-a-uuid` → `400 Bad Request`, `error.code = "INVALID_PARAMS"`.

### INT-08 — REST API: Filter theo type

- `GET /api/locations?type=store` → chỉ trả record có `type = "store"` và `status = "active"`.
- `GET /api/locations?type=charging_station` → tương tự cho `charging_station`.
- `GET /api/locations?type=invalid_type` → `400 Bad Request`, `error.code = "INVALID_PARAMS"`.

### INT-09 — REST API: Search

- `GET /api/locations?search=Times City` → trả về record có `name` hoặc `address` chứa (không phân biệt hoa/thường, không dấu tiếng Việt nếu có normalize) chuỗi `"Times City"`.
- **Pass criteria:** Với fixture ở mục 3, kết quả phải chứa record "VinFast Times City" và **không** chứa các record khác không liên quan.
- Search không khớp gì → `200 OK`, `data: []`, `meta.total: 0` (không phải lỗi 404).

### INT-10 — REST API: Nearby Search

- **Request:**
```
GET /api/locations/nearby?latitude=20.9950&longitude=105.8620&radius=5000&type=charging_station
```
- **Expected Response (200 OK):**
```json
{
  "data": [
    { "name": "Trạm sạc VinFast Royal City", "distanceKm": 4.9, "...": "..." },
    { "name": "Trạm sạc Vincom Bà Triệu", "distanceKm": 2.1, "...": "..." }
  ],
  "meta": { "total": 2 }
}
```
  (Giá trị `distanceKm` thực tế phụ thuộc công thức tính, Agent tự tính lại bằng haversine hoặc `ST_Distance` để so khớp trong assertion — sai số cho phép ±0.05km.)
- **Then:** Danh sách phải được sắp xếp `distanceKm` tăng dần.
- **Edge case bắt buộc test thêm:**
  - Thiếu `latitude` hoặc `longitude` → `400 INVALID_PARAMS`.
  - `radius` âm hoặc không phải số → `400 INVALID_PARAMS`.
  - Không có `type` → trả về cả 2 loại, vẫn sort theo distance.
  - Không có location nào trong bán kính → `200 OK`, `data: []`.

### INT-11 — Scheduler

- **Given:** Scheduler cấu hình chạy 1 lần/ngày (cron hoặc GitHub Actions).
- **When:** Trigger thủ công job scheduler trong môi trường test (`npm run crawl:trigger` hoặc tương đương).
- **Then:**
  1. Crawler được gọi.
  2. Log ghi nhận: thời điểm bắt đầu, số record crawl được, số insert/update/duplicate/reject, thời điểm kết thúc, `status: SUCCESS | FAILED`.
  3. Nếu Crawler fail (nguồn không truy cập được) → Scheduler **không** xoá dữ liệu cũ trong DB, chỉ log lỗi và retry tối đa 1–3 lần (theo `context.md` mục 12).

### INT-12 — Frontend gọi API và render Marker

- **Given:** Frontend chạy với `API_BASE_URL` trỏ tới API test đã seed dữ liệu mục 3.
- **When:** Mở trang, bật layer Charging Station.
- **Then:** Số lượng Marker hiển thị trên map khớp đúng số record `charging_station` + `active` trả về từ API (dùng Playwright/Cypress để đếm DOM element hoặc kiểm tra state layer).
- **Công cụ đề xuất:** Playwright (`page.locator('[data-testid="marker"]').count()`).

### INT-13 — Layer Toggle

- Bật `Charging Station`, tắt `Store` → chỉ marker charging station hiển thị (assert bằng `data-testid` hoặc class riêng theo type).
- Đảo ngược lại → chỉ marker store hiển thị.

### INT-14 — Popup

- Click vào 1 marker → Popup mở, hiển thị đúng `name`, `type`, `address`, `status` của Location tương ứng (so khớp với dữ liệu seed).

### INT-15 — Location Detail

- Click "View Detail" trên Popup → Frontend gọi `GET /api/locations/:id` → hiển thị đầy đủ: `name`, `type`, `address`, `phone` (nếu có), `opening_hours` (nếu có), `status`, `source`, `last_updated`.
- Không hiển thị raw JSON hoặc field nội bộ không có trong `LocationDTO`.

---

## 8. End-to-End (E2E) Test — Quan trọng nhất của Phase 1

### E2E-01 — Full pipeline với dữ liệu mới

**Kịch bản:**

| Bước | Hành động | Điểm cần assert |
|---|---|---|
| 1 | Mock nguồn crawl trả về 1 Store mới (`"VinFast Cầu Giấy"`, có toạ độ hợp lệ trong Hà Nội) | Crawler nhận đúng raw data |
| 2 | Chạy pipeline xử lý (clean → normalize → validate → geocode nếu cần → dedupe) | Record không bị reject |
| 3 | Ghi vào PostgreSQL/PostGIS | `SELECT` thấy đúng 1 row mới, chưa từng tồn tại trước đó |
| 4 | Gọi `GET /api/locations?type=store&search=Cầu Giấy` | Trả về đúng record vừa insert, HTTP 200 |
| 5 | Frontend load lại / gọi API | State frontend có location mới |
| 6 | Map render | Marker mới xuất hiện đúng toạ độ |
| 7 | Click marker | Popup hiển thị đúng thông tin Store mới |

**Pass criteria:** Toàn bộ 7 bước chạy thành công liên tiếp trong **1 lần chạy test duy nhất** (không phải 7 test case rời rạc) — đây là điểm khác biệt quan trọng so với Integration Test (INT-xx test từng mắt xích riêng lẻ, E2E test cả chuỗi liền mạch).

**Công cụ đề xuất:** Test script kết hợp (ví dụ Node script hoặc Playwright test) chạy tuần tự: gọi hàm crawler trực tiếp (không qua HTTP thật) → verify DB → gọi API thật (supertest/axios) → verify response → mở browser thật (Playwright) → verify UI.

### E2E-02 — Update lan truyền toàn hệ thống

- Location đã tồn tại thay đổi `address` ở nguồn → sau khi crawl lại → API trả `address` mới → Frontend/Location Detail hiển thị `address` mới, `last_updated` được cập nhật.

---

## 9. Error Handling — Test Matrix đầy đủ

| Tình huống lỗi | Nguyên nhân giả lập | Hành vi mong đợi | HTTP Status | Log |
|---|---|---|---|---|
| Crawler không truy cập được nguồn | Mock timeout/DNS fail | Không xoá dữ liệu cũ, retry 1–3 lần, log `CRAWLER_FAILED` | — | Có |
| Dữ liệu thiếu toạ độ & không geocode được | Address rác/không tồn tại | Record bị đánh dấu `invalid`, không lên Map | — | Có (invalid records log) |
| Database mất kết nối | Tắt DB trong lúc gọi API | API trả lỗi có kiểm soát, không crash process | 503 `SERVICE_UNAVAILABLE` | Có |
| API lỗi bất kỳ khác | Exception không lường trước | Frontend hiển thị thông báo "Không thể tải dữ liệu, vui lòng thử lại." — **không** để trắng trang | 500 `INTERNAL_ERROR` | Có |
| Map Provider lỗi (tile không load) | Chặn domain tile server trong test | Frontend hiển thị "Bản đồ tạm thời không khả dụng", các chức năng Search/Filter/List vẫn hoạt động nếu API còn sống | — | Tuỳ chọn |
| Request nhập sai kiểu param | `radius=abc` | `400 INVALID_PARAMS`, có message rõ ràng | 400 | Không bắt buộc |

---

## 10. Logging — Schema chuẩn cho mỗi lần Crawl

Agent nên log dưới dạng structured JSON để dễ test và dễ giám sát:

```json
{
  "job": "daily_crawl",
  "started_at": "2026-07-22T00:00:00Z",
  "finished_at": "2026-07-22T00:02:14Z",
  "status": "SUCCESS",
  "source": "vinfast_official",
  "total_records": 500,
  "valid_records": 490,
  "invalid_records": 5,
  "duplicate_records": 5,
  "inserted_records": 20,
  "updated_records": 30,
  "no_action_records": 440,
  "errors": []
}
```

**Test cần verify:** tổng `valid_records = inserted + updated + no_action_records`, và nếu `valid_records = 0` thì **không** có write nào xảy ra lên bảng chính (an toàn dữ liệu — `context.md` mục 14).

---

## 11. Performance Testing (ngưỡng MVP, không phải SLA production)

| Endpoint / Hành động | Ngưỡng mục tiêu | Công cụ đề xuất |
|---|---|---|
| `GET /api/locations` | < 1–2s | k6, Artillery, hoặc autocannon |
| `GET /api/locations?search=...` | < 2s | k6/Artillery |
| `GET /api/locations/nearby` | < 2s | k6/Artillery (test với 500–1000 record seed) |
| Map load lần đầu (frontend) | Không đặt ngưỡng cứng ở Phase 1, chỉ đo baseline | Lighthouse/Playwright trace |

> Đây là ngưỡng để phát hiện sớm vấn đề, không phải cam kết SLA. Nếu vượt ngưỡng, ghi nhận nhưng không nhất thiết block release MVP.

---

## 12. Security Testing Checklist (mức MVP)

- [ ] Không có API Key/Secret hard-code trong source code (`grep -r "MAPBOX_ACCESS_TOKEN\|GEOAPIFY_API_KEY\|DATABASE_URL" --include=*.ts` không match giá trị thật).
- [ ] `.env` không nằm trong Git (`git ls-files | grep .env$` phải rỗng, chỉ `.env.example` được commit).
- [ ] CORS được cấu hình đúng cho domain frontend, chặn origin lạ ở mức cơ bản.
- [ ] Input validation cho toàn bộ query param (`type`, `search`, `latitude`, `longitude`, `radius`) — không cho phép SQL injection qua raw string concatenation (dùng parameterized query / ORM).
- [ ] Rate limiting cơ bản cho API (không cần phức tạp, có thể dùng middleware đơn giản) để tránh lạm dụng endpoint `nearby`/`search`.

---

## 13. CI Pipeline đề xuất (tối thiểu cho Phase 1)

```yaml
# Ví dụ minh hoạ — Agent điều chỉnh theo stack thực tế của project
name: ci
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgis/postgis:16-3.4
        env:
          POSTGRES_DB: geo_platform_test
        ports: ["5432:5432"]
    steps:
      - uses: actions/checkout@v4
      - name: Install deps
        run: npm ci
      - name: Run migrations (test DB)
        run: npm run migrate:test
      - name: Seed fixtures
        run: npm run seed:test
      - name: Unit tests (crawler + api)
        run: npm run test:unit
      - name: Integration tests (api + db)
        run: npm run test:integration
      - name: E2E tests (playwright)
        run: npm run test:e2e
```

Không bắt buộc chạy đúng file này — chỉ là khung tối thiểu: **migrate → seed → unit → integration → e2e**, chạy trên DB test riêng, không đụng vào production.

---

## 14. Acceptance Criteria — Cấp độ Testing (bổ sung, khác với DoD chức năng ở `context.md` mục 39)

Phase 1 được coi là **pass ở khía cạnh Integration & Testing** khi:

- [ ] Toàn bộ INT-01 → INT-15 pass.
- [ ] E2E-01 và E2E-02 pass trong 1 lần chạy liên tục, không cần can thiệp thủ công giữa các bước.
- [ ] Error Handling Matrix (mục 9) — mọi tình huống lỗi đều có hành vi kiểm soát được (không crash, không mất dữ liệu cũ).
- [ ] Logging đúng schema mục 10, số liệu khớp nhau (`valid = inserted + updated + no_action`).
- [ ] Performance đạt ngưỡng ở mục 11 trên tập dữ liệu seed cỡ vài trăm record (không cần test tải lớn ở Phase 1).
- [ ] Security checklist mục 12 hoàn thành.
- [ ] CI pipeline chạy xanh (migrate → seed → unit → integration → e2e).

---

## 15. Demo Script cuối Phase 1 (chi tiết hoá từ bản gốc, có thể dùng làm E2E script)

| Bước | Thao tác | Assertion tương ứng |
|---|---|---|
| 1 | Mở Geo Decision Platform | Trang load, không lỗi console |
| 2 | Map Hà Nội hiển thị | Map container render, tile load được |
| 3 | Bật Layer Charging Station | Marker charging station xuất hiện đúng số lượng (INT-13) |
| 4 | Bật Layer Store | Marker store xuất hiện thêm, không mất marker charging station |
| 5 | Search "Times City" | Kết quả trả về đúng record, Map zoom tới vị trí đó |
| 6 | Click Marker "VinFast Times City" | Popup hiển thị `name/type/address/status` đúng |
| 7 | Click "View Detail" | Location Detail hiển thị đầy đủ field theo mục 6.1, không lộ raw data thừa |

---

## 16. Phạm vi KHÔNG kiểm thử trong Phase 1 (loại trừ tường minh)

Kế thừa `context.md` mục 37 — các mục sau **không** nằm trong scope của test suite Phase 1, Agent không cần viết test cho:

- AI Chatbot / LLM / RAG / Vector Database liên quan đến Location.
- AI Recommendation / Ranking theo Business Rules.
- Route Optimization / Traffic Prediction.
- Test tải lớn (load test hàng chục nghìn request) — chỉ cần performance baseline như mục 11.
- Test dữ liệu ngoài Hà Nội.

---

## 17. Chuyển tiếp sang Phase 2 (chỉ tham khảo, không triển khai)

Sau khi test suite Phase 1 pass đầy đủ theo mục 14, hệ thống có nền tảng dữ liệu + API đáng tin cậy để Phase 2 (AI Geo Decision Engine) xây dựng thêm lớp Intent Detection → Business Rules → Ranking → Recommendation, tái sử dụng toàn bộ Database, REST API và Frontend Map đã được kiểm thử ở Phase 1. Không viết bất kỳ test hay code nào cho phần này trong Phase 1.
