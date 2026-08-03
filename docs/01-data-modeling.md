# 01 — Data Modeling & Data Foundation
### (Đặc tả chi tiết cho AI Coding Agent)

> **Project:** Geo Decision Platform
> **Phase:** Phase 1 – Geo Data Foundation
> **Document:** Data Modeling & Database Design
> **Scope địa lý:** Hà Nội, Việt Nam
> **Status:** MVP
> **Tài liệu gốc tham chiếu:** [`../context.md`](../context.md) (bắt buộc đọc trước — tài liệu này **không thay thế** `context.md`, mà **cụ thể hóa** phần Data Modeling).
> **Stack DB:** PostgreSQL 16 + PostGIS 3.4 — xem [`00-tech-decisions.md`](./00-tech-decisions.md).

---

## 0. Cách đọc tài liệu này

Tài liệu này là bản **đặc tả kỹ thuật chi tiết (technical spec)** cho phần Data Modeling & Data Foundation của Phase 1. Nó được viết lại để một **AI Coding Agent** có thể:

- Hiểu **chính xác** từng field, kiểu dữ liệu, ràng buộc (constraint), giá trị hợp lệ.
- Có sẵn **DDL SQL mẫu**, **JSON mẫu**, **pseudo-code** để bám theo khi generate code — không cần tự suy diễn.
- Biết **thứ tự triển khai** (migration order) và **quan hệ giữa các bảng**.
- Biết rõ **ranh giới Phase 1** — cái gì phải làm, cái gì tuyệt đối không được làm.

> ⚠️ **Nguyên tắc ưu tiên khi có xung đột:** Nếu có bất kỳ điểm nào trong tài liệu này mâu thuẫn với `context.md`, **`context.md` luôn là nguồn chân lý cao nhất (source of truth)**. Xem mục 1.1 dưới đây — đây là các điểm đã được đối chiếu và **hiệu chỉnh lại** so với bản gốc trước đó của tài liệu này.

### 1.1. Các điểm đã hiệu chỉnh so với bản gốc (Reconciliation Notes)

| # | Nội dung | Bản gốc (trước) | Đã hiệu chỉnh theo `context.md` |
|---|---|---|---|
| 1 | PostGIS | Ghi là "Future Spatial Database" (mở rộng sau) | **PostGIS là extension bắt buộc ngay từ Phase 1** (xem `context.md` mục 8). Bảng `locations` phải có cột `geometry` (Point, SRID 4326) song song với `latitude`/`longitude` ngay từ đầu. |
| 2 | Payload CMS | Ghi như Backend bắt buộc / hoặc optional không rõ | **BẮT BUỘC Payload CMS 3 + `@payloadcms/db-postgres`** (`00-tech-decisions.md`, `context.md` mục 9). Schema Postgres + PostGIS; Collections map 1-1 bảng. Deploy **Docker Compose**. |
| 3 | Field `last_seen_at` trên `Location` | Chỉ có `last_seen_at` | Bổ sung thêm `last_updated` (đúng tên field trong `context.md` mục 7) mang ý nghĩa "thời điểm dữ liệu được cập nhật gần nhất **từ nguồn**", khác với `updated_at` (thời điểm record được cập nhật **trong DB**). Giữ cả `last_seen_at` (phục vụ logic deactivate) và `last_updated`. |
| 4 | Ranh giới địa lý Hà Nội | Không có validation cụ thể theo bounding box | Bổ sung **Hanoi Bounding Box** cụ thể để Validation Layer dùng kiểm tra tọa độ (mục 9.4). |
| 5 | Loại Location mở rộng | Đúng | Giữ nguyên, khớp `context.md` mục 6. |

---

## 1. Tổng quan & Mục tiêu Data Modeling

Phase 1 là giai đoạn xây dựng **nền tảng dữ liệu (Data Foundation)** cho Geo Decision Platform. Mục tiêu của phần Data Modeling là trả lời rõ 8 câu hỏi sau bằng schema cụ thể, không mơ hồ:

1. Hệ thống lưu những loại dữ liệu nào? → **Location, Source, Crawl Job, Crawl Log**.
2. Dữ liệu có cấu trúc như thế nào? → Xem mục 6–9 (Entity schema đầy đủ).
3. Dữ liệu đến từ nguồn nào? → Entity `Source` + field `source_id`/`source_record_id`/`source_url` trên `Location`.
4. Quan hệ giữa các loại dữ liệu? → Xem ERD mục 5.
5. Dữ liệu lưu ở đâu? → PostgreSQL + PostGIS (bắt buộc, không phải MongoDB/Vector DB/Neo4j).
6. Dữ liệu cập nhật như thế nào? → Upsert Strategy (mục 12).
7. Theo dõi nguồn gốc dữ liệu bằng cách nào? → Source Tracking (mục 13).
8. Theo dõi crawl bằng cách nào? → Crawl Job + Crawl Log (mục 7, 8).

**Phạm vi MVP:** chỉ **Hà Nội, Việt Nam**. Hai loại Location bắt buộc trong MVP: `charging_station`, `store`. Model phải mở rộng được (không hard-code) cho: `service_center`, `showroom`, `dealer`, `parking`, `rescue_team` — và trong tương lai mở rộng ra Hồ Chí Minh, Đà Nẵng, toàn quốc (không giới hạn cứng theo Hà Nội trong schema).

---

## 2. Nguyên tắc thiết kế (Design Principles)

Data Model của Phase 1 tuân theo 3 nguyên tắc:

```
SIMPLE      →  Một bảng locations dùng chung cho mọi loại địa điểm (phân loại bằng field `type`), 
               không tạo bảng riêng cho từng loại (charging_stations, stores, ...).

SCALABLE    →  Enum `type` và cấu trúc bảng phải cho phép thêm loại Location mới, thêm nguồn mới, 
               mở rộng địa lý mới KHÔNG cần đổi schema (chỉ thêm giá trị enum / thêm record Source).

TRACEABLE   →  Mọi Location phải biết: nó từ nguồn nào (source_id), bản ghi gốc nào (source_record_id), 
               lần cuối thấy trên nguồn khi nào (last_seen_at), và lần crawl nào tạo/sửa nó (qua Crawl Job).
```

Các mục tiêu bắt buộc đạt được:

| # | Mục tiêu |
|---|---|
| 1 | Lưu trữ dữ liệu địa điểm với tọa độ chuẩn (lat/lng + PostGIS geometry) |
| 2 | Hỗ trợ nhiều loại địa điểm qua 1 bảng `locations` |
| 3 | Theo dõi được nguồn dữ liệu (bảng `sources`) |
| 4 | Theo dõi được quá trình crawl (bảng `crawl_jobs`, `crawl_logs`) |
| 5 | Hỗ trợ cập nhật tự động hàng ngày (Upsert Strategy) |
| 6 | Chống dữ liệu trùng lặp (Deduplication Strategy) |
| 7 | Hỗ trợ Geocoding khi thiếu tọa độ |
| 8 | Sẵn sàng cho Spatial Query bằng PostGIS ngay từ Phase 1 |
| 9 | Hỗ trợ RESTful API (List/Detail/Search/Filter/Nearby) |
| 10 | Có khả năng mở rộng cho AI Recommendation ở Phase 2+ (không chứa logic AI trong Phase 1) |

---

## 3. Data Categories (Nhóm dữ liệu)

```
Location Data
    ├── charging_station
    └── store
        (mở rộng: service_center, showroom, dealer, parking, rescue_team)

Source Data
    ├── official_website
    ├── openstreetmap
    └── external_api / other

Crawling Data
    ├── Crawl Job   (1 lần crawler chạy)
    └── Crawl Result (kết quả tổng hợp của 1 job — lưu ngay trên record Crawl Job, không cần bảng riêng)

System Log Data
    └── Crawl Log   (log chi tiết theo từng dòng, gắn với 1 Crawl Job)
```

4 **Entity chính** cần tạo trong database: `Location`, `Source`, `CrawlJob`, `CrawlLog`.

---

## 4. Database Architecture

```
                         ┌────────────────────────────┐
                         │     BACKEND — BẮT BUỘC      │
                         │  Payload CMS 3 + REST API   │
                         │  (Docker service: api)       │
                         └──────────────┬──────────────┘
                                        │
                                        ▼
                         ┌────────────────────────────┐
                         │   PostgreSQL + PostGIS     │
                         │   (Docker service: db)     │
                         └──────────────┬──────────────┘
             ┌───────────────┬──────────┴──────────┬───────────────┐
             ▼               ▼                     ▼               ▼
        locations         sources             crawl_jobs      crawl_logs
```

**PostgreSQL** chịu trách nhiệm: Persistent Storage, Relational Integrity, Query (bao gồm Spatial Query qua PostGIS).

**PostGIS** (bắt buộc) chịu trách nhiệm: cột `location` kiểu Point, hàm `ST_DWithin` / `ST_Distance` cho Nearby Search.

**Payload CMS** (bắt buộc): Collections + REST + Admin. Schema thật vẫn nằm ở PostgreSQL; Payload **không** thay crawler nhập liệu thủ công hàng loạt. Custom endpoint bắt buộc cho `/api/locations/nearby` (PostGIS).

**Docker** (bắt buộc): `db` + `api` + `web` + `crawler` — xem `docker-compose.yml`.

**Ràng buộc:** ❌ không MongoDB, ❌ không NestJS làm API chính, ❌ không Vector DB / Neo4j trong Phase 1.

---

## 5. Entity Relationship Diagram (ERD)

```
┌──────────────────────────┐
│         sources          │
│───────────────────────────│
│ id                (PK)   │
│ name                     │
│ type              (enum) │
│ url                      │
│ status            (enum) │
│ last_crawled_at          │
│ created_at               │
│ updated_at                │
└────────────┬──────────────┘
             │ 1
             │
             │ N
┌────────────▼──────────────┐        ┌────────────┬──────────────┐
│        locations          │        │            │
│───────────────────────────│        │  sources   │ 1        N   │
│ id                (PK)   │        └────────────┴──────┬───────┘
│ name                      │                            ▼
│ type              (enum) │                  ┌──────────────────────────┐
│ address                   │                  │        crawl_jobs        │
│ latitude                  │                  │───────────────────────────│
│ longitude                 │                  │ id                (PK)   │
│ location   (PostGIS Point)│                  │ source_id     (FK→sources)│
│ status            (enum) │                  │ started_at                │
│ phone                     │                  │ finished_at               │
│ opening_hours             │                  │ status            (enum) │
│ source_id     (FK→sources)│                  │ records_found             │
│ source_record_id          │                  │ records_created           │
│ source_url                │                  │ records_updated           │
│ last_seen_at              │                  │ records_deactivated       │
│ last_updated               │                  │ error_message             │
│ created_at                 │                  │ created_at                │
│ updated_at                 │                  └────────────┬──────────────┘
└───────────────────────────┘                                │ 1
                                                              │
                                                              │ N
                                                  ┌───────────▼──────────────┐
                                                  │        crawl_logs        │
                                                  │───────────────────────────│
                                                  │ id                (PK)   │
                                                  │ crawl_job_id  (FK→crawl_jobs)│
                                                  │ level             (enum) │
                                                  │ message                  │
                                                  │ created_at                │
                                                  └───────────────────────────┘
```

**Quan hệ:**

- `sources` **1—N** `locations` (1 nguồn có nhiều Location).
- `sources` **1—N** `crawl_jobs` (1 nguồn được crawl nhiều lần, mỗi lần là 1 job).
- `crawl_jobs` **1—N** `crawl_logs` (1 job sinh ra nhiều dòng log).
- `locations` **không** có quan hệ trực tiếp với `crawl_jobs` — việc liên kết "location này được tạo/sửa bởi job nào" là **tùy chọn (nice-to-have)**, có thể suy ra qua thời gian (`locations.updated_at` nằm giữa `crawl_jobs.started_at`/`finished_at`) mà không cần thêm cột FK bắt buộc trong MVP. Nếu Agent muốn traceability chặt hơn, có thể thêm cột `last_crawl_job_id` (nullable) vào `locations` — đây là mở rộng được phép, không bắt buộc.

`Location` là **entity trung tâm và quan trọng nhất** của toàn hệ thống.

---

## 6. Entity: `Location`

### 6.1. Mục đích

`Location` lưu **tất cả** địa điểm địa lý trong hệ thống bằng **một bảng duy nhất** (`locations`), phân loại bằng field `type`, thay vì tạo bảng riêng cho từng loại (`charging_stations`, `stores`, `service_centers`, ...). Cách này giữ hệ thống đơn giản và dễ mở rộng loại địa điểm mới mà không cần migration lớn.

### 6.2. Schema đầy đủ

| Field | Kiểu dữ liệu (SQL) | Bắt buộc | Default | Mô tả |
|---|---|---|---|---|
| `id` | `UUID` | Yes | `gen_random_uuid()` | Khóa chính, do hệ thống tự sinh, độc lập với ID nguồn ngoài |
| `name` | `TEXT` | Yes | – | Tên địa điểm, đã normalize (trim, gộp khoảng trắng thừa) |
| `type` | `TEXT` (enum ràng buộc bằng `CHECK` hoặc bảng tra) | Yes | – | Loại địa điểm. MVP: `charging_station`, `store`. Mở rộng: `service_center`, `showroom`, `dealer`, `parking`, `rescue_team` |
| `address` | `TEXT` | Yes | – | Địa chỉ đầy đủ, dùng cho hiển thị, geocoding, search |
| `latitude` | `DOUBLE PRECISION` | Yes | – | Vĩ độ, khoảng hợp lệ Hà Nội: `20.53` – `21.23` |
| `longitude` | `DOUBLE PRECISION` | Yes | – | Kinh độ, khoảng hợp lệ Hà Nội: `105.29` – `106.02` |
| `location` | `GEOGRAPHY(Point, 4326)` (PostGIS) | Yes (tự sinh) | trigger từ lat/lng | Cột spatial dùng cho Nearby Search / Spatial Query. **Không cho phép insert tay lệch với lat/lng** — phải luôn đồng bộ qua trigger (xem mục 6.4) |
| `status` | `TEXT` (enum) | Yes | `'active'` | `active` \| `inactive` |
| `phone` | `TEXT` | No | `NULL` | Số điện thoại nếu nguồn có cung cấp; không tự sinh dữ liệu giả |
| `opening_hours` | `TEXT` | No | `NULL` | Giờ mở cửa dạng chuỗi tự do, ví dụ `"08:00 - 22:00"` hoặc `"24/7"`. Chuẩn hóa cấu trúc (JSON theo từng ngày) là việc của Phase sau, KHÔNG bắt buộc ở MVP |
| `source_id` | `UUID` (FK → `sources.id`) | Yes | – | Nguồn dữ liệu tạo ra record này |
| `source_record_id` | `TEXT` | No | `NULL` | ID của record ở phía nguồn dữ liệu (dùng cho dedup ưu tiên #1) |
| `source_url` | `TEXT` | No | `NULL` | URL cụ thể tới record gốc nếu có |
| `last_seen_at` | `TIMESTAMPTZ` | No | `NULL` | Lần gần nhất crawler còn thấy record này tồn tại trên nguồn — dùng để xác định khi nào chuyển `status` sang `inactive` |
| `last_updated` | `TIMESTAMPTZ` | No | `NULL` | Thời điểm dữ liệu (nội dung) được cập nhật gần nhất **từ phía nguồn** (khác với `updated_at` là thời điểm record trong DB được sửa) |
| `created_at` | `TIMESTAMPTZ` | Yes | `now()` | Thời điểm tạo record trong DB |
| `updated_at` | `TIMESTAMPTZ` | Yes | `now()`, auto update | Thời điểm record trong DB được sửa lần cuối |

> Ghi chú quan trọng cho Agent: **`latitude`/`longitude` vẫn phải giữ lại** như 2 cột riêng (không chỉ dựa vào `location`), vì Frontend, JSON response và các phần code không có PostGIS driver cần đọc trực tiếp 2 field này. `location` là cột **phái sinh (derived)**, không phải nguồn nhập liệu chính.

### 6.3. SQL DDL mẫu

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto; -- cho gen_random_uuid()

CREATE TABLE sources (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL UNIQUE,
  type             TEXT NOT NULL CHECK (type IN ('official_website', 'openstreetmap', 'external_api', 'other')),
  url              TEXT,
  status           TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  last_crawled_at  TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE locations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  type              TEXT NOT NULL CHECK (type IN (
                       'charging_station', 'store',
                       'service_center', 'showroom', 'dealer', 'parking', 'rescue_team'
                     )),
  address           TEXT NOT NULL,
  latitude          DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude         DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  location          GEOGRAPHY(Point, 4326), -- tự sinh bằng trigger, xem mục 6.4
  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  phone             TEXT,
  opening_hours     TEXT,
  source_id         UUID NOT NULL REFERENCES sources(id),
  source_record_id  TEXT,
  source_url        TEXT,
  last_seen_at      TIMESTAMPTZ,
  last_updated      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE crawl_jobs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id             UUID NOT NULL REFERENCES sources(id),
  started_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at           TIMESTAMPTZ,
  status                TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'success', 'failed')),
  records_found         INTEGER DEFAULT 0,
  records_created       INTEGER DEFAULT 0,
  records_updated       INTEGER DEFAULT 0,
  records_deactivated   INTEGER DEFAULT 0,
  error_message         TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE crawl_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crawl_job_id   UUID NOT NULL REFERENCES crawl_jobs(id),
  level          TEXT NOT NULL CHECK (level IN ('INFO', 'WARNING', 'ERROR')),
  message        TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 6.4. Trigger đồng bộ `location` (PostGIS) từ `latitude`/`longitude`

> Bắt buộc theo `context.md` mục 7: `location` phải luôn được đồng bộ tự động, không insert tay riêng.

```sql
CREATE OR REPLACE FUNCTION sync_location_geometry()
RETURNS TRIGGER AS $$
BEGIN
  NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_location_geometry
BEFORE INSERT OR UPDATE OF latitude, longitude ON locations
FOR EACH ROW
EXECUTE FUNCTION sync_location_geometry();
```

> Lưu ý thứ tự tham số: PostGIS dùng `ST_MakePoint(longitude, latitude)` — **kinh độ trước, vĩ độ sau**. Đây là lỗi rất dễ mắc phải, Agent cần cẩn thận.

### 6.5. Indexing bắt buộc

```sql
CREATE INDEX locations_type_idx     ON locations (type);
CREATE INDEX locations_status_idx   ON locations (status);
CREATE INDEX locations_source_idx   ON locations (source_id);
CREATE INDEX locations_geom_idx     ON locations USING GIST (location);   -- bắt buộc cho Nearby Search hiệu quả
CREATE INDEX locations_name_trgm_idx ON locations USING GIN (name gin_trgm_ops); -- tùy chọn, hỗ trợ Search theo tên (cần extension pg_trgm)
```

Mục tiêu: tăng tốc filter theo `type`/`status`, tăng tốc Nearby Search (GiST trên `location`), và (tùy chọn) tăng tốc search text theo tên.

---

## 7. Entity: `Source`

### 7.1. Mục đích

Lưu nguồn gốc dữ liệu (nơi crawler lấy dữ liệu). Mỗi `Location` **phải** biết nó đến từ `Source` nào.

### 7.2. Schema

| Field | Type | Required | Default | Mô tả |
|---|---|---|---|---|
| `id` | UUID | Yes | tự sinh | Khóa chính |
| `name` | TEXT | Yes | – | Tên nguồn, ví dụ `"VinFast Official Website"` |
| `type` | Enum | Yes | – | `official_website` \| `openstreetmap` \| `external_api` \| `other` |
| `url` | TEXT | No | `NULL` | URL gốc của nguồn |
| `status` | Enum | Yes | `active` | `active` \| `inactive` — cho phép tạm dừng crawl 1 nguồn mà không xóa |
| `last_crawled_at` | TIMESTAMPTZ | No | `NULL` | Lần crawl gần nhất (thành công hoặc không) |
| `created_at` | TIMESTAMPTZ | Yes | `now()` | |
| `updated_at` | TIMESTAMPTZ | Yes | `now()` | |

### 7.3. Quan hệ

```
Source (1) ──── (N) Location
Source (1) ──── (N) Crawl Job
```

Khóa ngoại: `locations.source_id → sources.id`, `crawl_jobs.source_id → sources.id`.

---

## 8. Entity: `Crawl Job`

### 8.1. Mục đích

Đại diện cho **một lần chạy crawler** trên một `Source`. Dùng để theo dõi tiến độ, thống kê, và debug khi có lỗi.

### 8.2. Schema

| Field | Type | Mô tả |
|---|---|---|
| `id` | UUID | Khóa chính |
| `source_id` | UUID (FK) | Nguồn được crawl trong job này |
| `started_at` | TIMESTAMPTZ | Thời điểm job bắt đầu |
| `finished_at` | TIMESTAMPTZ (nullable) | Thời điểm job kết thúc (NULL nếu đang chạy) |
| `status` | Enum | `pending` → `running` → `success` \| `failed` |
| `records_found` | INTEGER | Tổng số record crawler tìm thấy trong job |
| `records_created` | INTEGER | Số record mới được `INSERT` |
| `records_updated` | INTEGER | Số record đã tồn tại được `UPDATE` |
| `records_deactivated` | INTEGER | Số record bị chuyển `status = inactive` vì không còn thấy trên nguồn |
| `error_message` | TEXT (nullable) | Thông báo lỗi nếu `status = failed` |
| `created_at` | TIMESTAMPTZ | |

### 8.3. State machine của `status`

```
pending → running → success
                  └→ failed
```

Không có trạng thái nào được phép bỏ qua bước `running`. `finished_at` chỉ được set khi status là `success` hoặc `failed`.

---

## 9. Entity: `Crawl Log`

### 9.1. Mục đích

Lưu log chi tiết theo từng dòng trong quá trình chạy 1 `Crawl Job`, phục vụ debug (khớp yêu cầu Logging ở `context.md` mục 11 và mục 14).

### 9.2. Schema

| Field | Type | Mô tả |
|---|---|---|
| `id` | UUID | Khóa chính |
| `crawl_job_id` | UUID (FK) | Job sinh ra log này |
| `level` | Enum | `INFO` \| `WARNING` \| `ERROR` |
| `message` | TEXT | Nội dung log |
| `created_at` | TIMESTAMPTZ | Thời điểm ghi log |

### 9.3. Ví dụ log thực tế trong một job

```
INFO     Starting crawl for source "Official Website"...
INFO     Found 200 locations.
WARNING  Location "XYZ" missing phone number.
WARNING  Location "ABC" missing latitude/longitude — will attempt geocoding.
ERROR    Geocoding failed for location "ABC" (API timeout).
INFO     Crawl finished: 200 found, 20 created, 30 updated, 5 deactivated.
```

### 9.4. Hanoi Bounding Box (dùng cho Validation)

Để hỗ trợ Validation "tọa độ phải thuộc khu vực hợp lý của Hà Nội" (nêu ở bản gốc mục 33, nhưng chưa có số cụ thể), Agent dùng bounding box xấp xỉ sau khi validate:

```
latitude  ∈ [20.53, 21.23]
longitude ∈ [105.29, 106.02]
```

> Đây là bounding box **nới rộng** (bao trọn địa giới hành chính Hà Nội, kể cả ngoại thành).
>
> **Quy tắc validate toạ độ (đồng bộ với `02-data-crawling.md`):**
> - Ngoài `[-90,90]` / `[-180,180]` hoặc null → **REJECT**
> - Nằm rõ ngoài bbox Hà Nội sau geocode → **REJECT** (không lưu)
> - Nằm sát biên (sai số geocode nhẹ) → **WARNING**, vẫn lưu, chờ review
>
> Chi tiết 2 lớp Hanoi Pre-Filter (text) + Post-Check (toạ độ): xem doc crawling.

---

## 10. Data Lifecycle của một Location

```
SOURCE
   ↓
CRAWLED          (crawler lấy được raw data)
   ↓
CLEANED          (loại bỏ HTML, khoảng trắng thừa, dữ liệu rác)
   ↓
NORMALIZED       (chuẩn hóa tên field, tên, địa chỉ, type, status)
   ↓
VALIDATED        (kiểm tra field bắt buộc + tọa độ hợp lệ)
   ↓
GEOCODED         (nếu thiếu lat/lng thì gọi Geocoding API để bổ sung)
   ↓
DEDUPLICATED     (so khớp với dữ liệu đã có trong DB)
   ↓
UPSERTED         (CREATE nếu mới / UPDATE nếu đã tồn tại)
   ↓
STORED (ACTIVE)  (lưu vào bảng locations, status = active)
```

Khi 1 Location không còn xuất hiện trong lần crawl kế tiếp:

```
ACTIVE → NOT FOUND (trong lần crawl mới nhất) → INACTIVE
```

> Quy tắc an toàn (nhắc lại `context.md` mục 14): nếu **toàn bộ** job crawl bị lỗi (ví dụ nguồn down, parser lỗi hàng loạt), **KHÔNG được** tự động deactivate hàng loạt Location — chỉ deactivate khi job **thành công** và Location cụ thể không xuất hiện trong kết quả job đó.

---

## 11. Data Processing Pipeline chi tiết

```
Raw Data → Clean → Normalize → Validate → Geocode → Deduplicate → Upsert → PostgreSQL
```

Mapping sang cấu trúc thư mục crawler (khớp `context.md` mục 33):

| Bước pipeline | Module tương ứng (`crawler/...`) |
|---|---|
| Crawl (lấy raw data) | `crawler/sources/<source_name>.ts` |
| Clean + Normalize + Validate | `crawler/processors/*.ts` |
| Geocode | `crawler/geocoder/*.ts` |
| Deduplicate | `crawler/deduplicator/*.ts` |
| Trigger + lịch chạy | `crawler/scheduler/*.ts` |

### 11.1. Cleaning

Loại bỏ:
- Tag HTML còn sót lại trong text.
- Khoảng trắng thừa / khoảng trắng kép (`"  VinFast   Times City "` → `"VinFast Times City"`).
- Ký tự rác / encoding lỗi.

### 11.2. Normalization

Chuẩn hóa **tên field** (mapping từ schema của từng nguồn về schema chung `name`, `address`, `type`, `status`, ...), vì các nguồn khác nhau có thể dùng tên field khác nhau:

```
Source A: { store_name, location }   →  { name, address }
Source B: { name, address }          →  { name, address }   (không đổi)
```

Chuẩn hóa **giá trị**: `type` phải map về đúng 1 trong các enum hợp lệ; `status` phải map về `active`/`inactive`.

### 11.3. Validation

Field bắt buộc phải có giá trị hợp lệ trước khi cho qua bước tiếp theo:

```
name != null && name.length > 0
address != null && address.length > 0
type ∈ enum hợp lệ
latitude, longitude hợp lệ về kỹ thuật (nếu có)
source_id != null
```

Nếu **thiếu lat/lng nhưng có address** → không reject, chuyển sang bước Geocoding.
Nếu **thiếu cả address và lat/lng** → reject, ghi `crawl_log` mức `ERROR`, tăng `records_found` nhưng không tăng `records_created`/`records_updated`.

### 11.4. Geocoding

```
Address → Geocoding FREE (Photon → Nominatim) → { latitude, longitude }
```

Nếu Geocoding thất bại (timeout, không tìm thấy kết quả): ghi log `ERROR`, **không** insert Location đó vào DB (vì thiếu tọa độ là field bắt buộc), nhưng **không** làm crash toàn bộ job — job tiếp tục xử lý các record khác.

### 11.5. Deduplication

Thứ tự ưu tiên so khớp với dữ liệu đã tồn tại trong DB:

```
1. So khớp theo (source_id, source_record_id)   — nếu nguồn có ID riêng cho record
2. Nếu không có source_record_id:
   so khớp theo (normalized(name) + normalized(address))
3. (Tương lai, không bắt buộc MVP):
   name similarity + address similarity + geo distance (fuzzy matching)
```

> Bản gốc trước đây chỉ dùng `name + address` làm fallback; bản này giữ nguyên logic đó nhưng làm rõ: **"normalized"** nghĩa là đã qua bước Cleaning + Normalization (viết thường, trim, gộp khoảng trắng) trước khi so sánh, để tránh 2 chuỗi lệch nhau chỉ vì khác hoa/thường hoặc khoảng trắng.

### 11.6. Upsert Strategy (pseudo-code)

```
for each incoming_record in crawl_result:
    existing = findExisting(incoming_record)   // theo mục 11.5

    if existing == null:
        CREATE new Location (status = active, last_seen_at = now(), last_updated = now())
        records_created += 1
    else:
        if hasChanged(existing, incoming_record):
            UPDATE existing Location với dữ liệu mới
            existing.last_updated = now()
        existing.last_seen_at = now()   // luôn cập nhật dù nội dung không đổi
        existing.status = 'active'      // nếu trước đó bị inactive mà giờ lại thấy → reactivate
        records_updated += 1

    seen_ids.add(existing?.id ?? new.id)

// Sau khi xử lý hết incoming_record của job:
for each location in DB where location.source_id == current_source_id:
    if location.id NOT IN seen_ids:
        location.status = 'inactive'
        records_deactivated += 1
```

> ❌ Không tạo Location trùng lặp sau mỗi lần crawl — đây là điều kiện bắt buộc (`context.md` mục 15).

---

## 12. Source Tracking

Mỗi `Location` **phải** lưu:

```
source_id          → nguồn nào tạo ra record này
source_record_id    → ID của record ở phía nguồn (nếu có)
source_url          → URL cụ thể tới record gốc (nếu có)
```

Mục đích: **Traceability** (biết dữ liệu từ đâu ra), **Debug** (khi dữ liệu sai, biết tra ở đâu), **Deduplication** (so khớp ưu tiên #1), **Verification** (con người kiểm tra lại nguồn khi cần).

Ví dụ JSON:

```json
{
  "name": "VinFast Times City",
  "source_id": "550e8400-e29b-41d4-a716-446655440000",
  "source_record_id": "store-123",
  "source_url": "https://example.com/store-123"
}
```

---

## 13. Ví dụ dữ liệu đầy đủ (Example Records)

### 13.1. Source

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "VinFast Official Website",
  "type": "official_website",
  "url": "https://vinfastauto.com",
  "status": "active",
  "last_crawled_at": "2026-07-21T02:00:00Z"
}
```

### 13.2. Location

```json
{
  "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "name": "VinFast Times City",
  "type": "store",
  "address": "458 Minh Khai, Hai Bà Trưng, Hà Nội",
  "latitude": 20.9945,
  "longitude": 105.8621,
  "status": "active",
  "phone": "1900xxxx",
  "opening_hours": "08:00 - 22:00",
  "source_id": "550e8400-e29b-41d4-a716-446655440000",
  "source_record_id": "store-123",
  "source_url": "https://vinfastauto.com/store-123",
  "last_seen_at": "2026-07-21T02:03:12Z",
  "last_updated": "2026-07-21T02:03:12Z",
  "created_at": "2026-06-01T02:00:00Z",
  "updated_at": "2026-07-21T02:03:12Z"
}
```

### 13.3. Crawl Job

```json
{
  "id": "b3f1c2a0-1111-4a2b-9c3d-000000000001",
  "source_id": "550e8400-e29b-41d4-a716-446655440000",
  "started_at": "2026-07-21T02:00:00Z",
  "finished_at": "2026-07-21T02:05:30Z",
  "status": "success",
  "records_found": 200,
  "records_created": 20,
  "records_updated": 30,
  "records_deactivated": 5,
  "error_message": null
}
```

### 13.4. Crawl Log

```json
{
  "id": "d4e5f6a7-2222-4b3c-8d4e-000000000002",
  "crawl_job_id": "b3f1c2a0-1111-4a2b-9c3d-000000000001",
  "level": "WARNING",
  "message": "Location \"ABC\" missing latitude/longitude — attempting geocoding.",
  "created_at": "2026-07-21T02:02:45Z"
}
```

---

## 14. Ví dụ luồng End-to-End (khớp với API & Frontend ở `context.md`)

```
1. Crawler lấy được:
     name = "VinFast Times City"
     address = "458 Minh Khai, Hà Nội"
     (không có tọa độ)

2. Cleaning + Normalization:
     name = "VinFast Times City"   (đã trim)
     address giữ nguyên

3. Validation:
     name ✓, address ✓, latitude ✗ (thiếu) → không reject, chuyển bước Geocoding

4. Geocoding:
     "458 Minh Khai, Hà Nội" → { latitude: 20.9945, longitude: 105.8621 }

5. Deduplication:
     Không tìm thấy record trùng (source_record_id mới) → sẽ CREATE

6. Upsert:
     CREATE Location mới, status = active
     Trigger PostGIS tự sinh cột `location` từ latitude/longitude

7. Lưu vào PostgreSQL, bảng `locations`

8. REST API:
     GET /api/locations?type=store  → trả về Location này trong danh sách

9. Frontend:
     JSON → Marker trên Map Hà Nội (icon Store)

10. User click Marker → xem Popup → xem Location Detail
```

---

## 15. Data Quality Checklist (khớp `context.md` mục 14)

Mỗi lần crawl phải log đủ các số liệu sau (lưu trực tiếp trên `crawl_jobs`):

| Metric | Field lưu trên `crawl_jobs` |
|---|---|
| Total Records tìm thấy | `records_found` |
| Records tạo mới | `records_created` |
| Records cập nhật | `records_updated` |
| Records bị deactivate | `records_deactivated` |
| Records invalid / bị reject | tính = `records_found - records_created - records_updated` (hoặc log riêng qua `crawl_logs` mức `ERROR`, đếm số dòng) |

5 tiêu chí Data Quality cần đảm bảo:

```
Completeness  → field bắt buộc luôn có giá trị (ràng buộc NOT NULL + CHECK trong DDL)
Accuracy      → lat/lng hợp lệ về kỹ thuật, nằm trong bounding box Hà Nội (mục 9.4)
Consistency   → mọi Location dùng chung 1 schema, bất kể nguồn nào
Uniqueness    → không duplicate (Deduplication Strategy, mục 11.5)
Freshness     → cập nhật hàng ngày qua Scheduler (1 lần/ngày, theo context.md mục 12)
```

---

## 16. Payload CMS Collections (BẮT BUỘC)

> Payload CMS 3 + PostgreSQL là **bắt buộc** (`context.md` mục 9, `00-tech-decisions.md`). Agent **không** được bỏ Payload để viết NestJS/Express thuần.

Mapping Collection ↔ Table:

```
Payload Collection "locations"     ↔  table locations
Payload Collection "sources"       ↔  table sources
Payload Collection "crawl-jobs"    ↔  table crawl_jobs
Payload Collection "crawl-logs"    ↔  table crawl_logs
```

Payload Admin UI trong Phase 1: xem dữ liệu, debug, theo dõi Crawl Job / Error Log — **không** dùng để nhập liệu thủ công thay crawler.

Sau khi Payload tạo bảng, **bổ sung migration PostGIS** (cột `location` geography + trigger + GiST index) theo DDL mục 6 — Payload không thay thế PostGIS.

---

## 17. Indexing & Migration Order

Thứ tự tạo bảng (migration order) — phải theo đúng thứ tự này vì có khóa ngoại:

```
1. Extension: postgis, pgcrypto (và pg_trgm nếu dùng search theo tên)
2. sources          (không phụ thuộc bảng nào khác)
3. locations        (phụ thuộc sources qua source_id)
4. crawl_jobs       (phụ thuộc sources qua source_id)
5. crawl_logs       (phụ thuộc crawl_jobs qua crawl_job_id)
6. Trigger sync_location_geometry trên locations
7. Indexes (mục 6.5)
```

---

## 18. Definition of Done — Phase Data Modeling & Data Foundation

Phần Data Modeling được coi là **hoàn thành** khi:

- [ ] Đã tạo đủ 4 bảng: `locations`, `sources`, `crawl_jobs`, `crawl_logs` đúng schema mục 6–9.
- [ ] Extension `postgis` đã được enable, cột `location` (geography Point, SRID 4326) hoạt động đúng.
- [ ] Trigger đồng bộ `location` từ `latitude`/`longitude` hoạt động đúng (test insert/update).
- [ ] Toàn bộ Foreign Key (`locations.source_id`, `crawl_jobs.source_id`, `crawl_logs.crawl_job_id`) hoạt động đúng.
- [ ] Index bắt buộc (`type`, `status`, `source_id`, GiST trên `location`) đã được tạo.
- [ ] Validation logic (field bắt buộc + bounding box Hà Nội) đã implement đúng mục 9.4 và 11.3.
- [ ] Geocoding flow hoạt động khi thiếu lat/lng.
- [ ] Deduplication logic hoạt động đúng thứ tự ưu tiên ở mục 11.5.
- [ ] Upsert Strategy hoạt động đúng: CREATE / UPDATE / DEACTIVATE, không tạo duplicate.
- [ ] `crawl_jobs` ghi đúng số liệu `records_found/created/updated/deactivated` sau mỗi lần chạy.
- [ ] `crawl_logs` ghi log đủ 3 mức `INFO`/`WARNING`/`ERROR` cho các bước quan trọng.
- [ ] Dữ liệu cũ hợp lệ **không bị mất** khi một lần crawl thất bại toàn bộ.
- [ ] Toàn bộ dữ liệu test nằm trong phạm vi Hà Nội.

---

## 19. Những gì KHÔNG được làm ở phần Data Modeling (nhắc lại `context.md` mục 37)

❌ Không thêm bảng/cột phục vụ AI Recommendation, Vector Embedding, Business Rules Engine.
❌ Không thêm Vector Database, Neo4j, MongoDB.
❌ Không thiết kế multi-tenant / multi-region phức tạp cho toàn quốc — chỉ cần đủ linh hoạt để **không chặn** việc mở rộng sau này (ví dụ: không hard-code "Hà Nội" trong tên bảng/cột).
❌ Không xây Admin Dashboard phức tạp hay Role Management phức tạp.
❌ Không chuẩn hóa `opening_hours` thành cấu trúc JSON chi tiết theo ngày trong tuần — giữ dạng String tự do ở MVP.

---

## 20. Tóm tắt (Summary)

```
                     PostgreSQL + PostGIS
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
    locations              sources              crawl_jobs
   (entity trung tâm,                                │
    phân loại bằng type,                             ▼
    có cột geometry                              crawl_logs
    PostGIS ngay từ đầu)
```

- **`Location`** là entity trung tâm, phân loại bằng `type`, luôn có tọa độ (`latitude`/`longitude`) **và** cột spatial `location` (PostGIS) được đồng bộ tự động qua trigger.
- **`Source`** quản lý nguồn dữ liệu; mọi Location đều truy nguyên được về đúng 1 Source.
- **`Crawl Job`** + **`Crawl Log`** quản lý và theo dõi từng lần crawler chạy, phục vụ debug và data quality.
- Dữ liệu được thu thập, xử lý và cập nhật **hoàn toàn tự động** theo pipeline: `Crawl → Clean → Normalize → Validate → Geocode → Deduplicate → Upsert → PostgreSQL`.
- PostGIS **đã** được tích hợp ngay từ Phase 1 (không chờ đến "tương lai") để sẵn sàng cho Nearby Search / Spatial Query mà `context.md` yêu cầu ngay trong MVP.
- Payload CMS là lớp API/Admin **bắt buộc**; nguồn chân lý dữ liệu vẫn là PostgreSQL + PostGIS; deploy **Docker Compose**.

**Kết quả cuối cùng:** một Data Foundation tập trung, nơi mọi Location tại Hà Nội có cấu trúc dữ liệu thống nhất, có tọa độ địa lý chuẩn (bao gồm cột spatial PostGIS), có nguồn gốc rõ ràng, có lịch sử crawl minh bạch, và có thể cập nhật tự động hàng ngày — làm nền tảng trực tiếp cho REST API (List/Detail/Search/Filter/Nearby) và Frontend Map ở các phần tiếp theo của Phase 1.
