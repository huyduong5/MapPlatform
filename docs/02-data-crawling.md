# 02 — Data Crawling & Ingestion
### (Đặc tả chi tiết cho AI Coding Agent)

> **Project:** Geo Decision Platform
> **Phase:** Phase 1 – Geo Data Foundation
> **Document:** Data Crawling & Ingestion
> **Geographic Scope:** Hà Nội, Việt Nam
> **Status:** MVP
> **Tài liệu tham chiếu bắt buộc đọc trước:**
> 1. [`../context.md`](../context.md) — nguồn chân lý cao nhất.
> 2. [`01-data-modeling.md`](./01-data-modeling.md) — schema `locations`, `sources`, `crawl_jobs`, `crawl_logs`.
> 3. [`00-tech-decisions.md`](./00-tech-decisions.md) — Python + Crawl4AI; geocode **Photon → Nominatim** ($0).
> 4. [`09-free-apis-and-urls.md`](./09-free-apis-and-urls.md) — **toàn bộ URL API miễn phí** (bắt buộc đọc trước khi gọi API ngoài).

---

## 0. Vị trí của tài liệu này trong Phase 1

```
Phase 1 – Geo Data Foundation
│
├── 01. Data Modeling & Data Foundation   ✅ (đã có schema: locations, sources, crawl_jobs, crawl_logs)
│
├── 02. Data Crawling & Ingestion         ← TÀI LIỆU NÀY
│         (xây dựng pipeline lấy dữ liệu thật, đổ vào schema ở bước 01)
│
└── 03. API & Map Platform                (bước tiếp theo, chưa triển khai ở đây)
```

Tài liệu này **không** định nghĩa lại schema — mọi field, enum, ràng buộc đã được định nghĩa ở tài liệu Data Modeling. Tài liệu này chỉ định nghĩa **pipeline vận hành** (crawl → xử lý → lưu) để đổ dữ liệu đúng vào schema đó.

---

## 1. Reconciliation Notes — Các điểm đã hiệu chỉnh so với bản gốc

> ⚠️ Agent đọc kỹ mục này trước, vì bản gốc của tài liệu này có một số điểm **mâu thuẫn với `context.md`** và với tài liệu Data Modeling đã viết lại. Các điểm dưới đây là bản đã hiệu chỉnh — Agent implement theo bảng này, không theo bản gốc.

| # | Nội dung | Bản gốc (trước) | Đã hiệu chỉnh |
|---|---|---|---|
| 1 | Payload CMS | Trước đây từng ghi optional / NestJS | **BẮT BUỘC Payload CMS** + PostgreSQL. Pipeline kết thúc ghi vào **PostgreSQL** (qua Payload Local/REST API hoặc SQL). Crawler chạy trong Docker service `crawler`. |
| 2 | Coordinate Validation (mục 21 bản gốc) | "Nếu Location nằm ngoài phạm vi Hà Nội → Reject" — áp dụng như một rule tuyệt đối, không phân biệt sai số nhỏ do geocoding | Tách thành **2 lớp filter khác nhau** (mục 8 tài liệu này): **Hanoi Pre-Filter** (heuristic theo địa chỉ/quận huyện, chạy trước Geocoding, để không tốn quota Geocoding API cho data rõ ràng ngoài Hà Nội) và **Coordinate Post-Check** (chạy sau Geocoding, dùng bounding box đã định nghĩa ở Data Modeling doc mục 9.4: `lat ∈ [20.53, 21.23]`, `lng ∈ [105.29, 106.02]`). Trong Post-Check: lệch rõ ràng ra ngoài bbox → **REJECT** (không lưu); nằm sát biên (do sai số geocode) → **WARNING**, vẫn lưu, chờ review. |
| 3 | Thứ tự pipeline (`Clean → Normalize → Filter Hanoi → Geocode → Validate → Dedupe → Upsert`) | Filter Hanoi được đặt **trước** Geocode nhưng lại dựa vào "Coordinates" để filter (mục 16 bản gốc) — mâu thuẫn logic vì tại thời điểm đó có thể chưa có tọa độ | Làm rõ: **Hanoi Pre-Filter** dùng **địa chỉ/text** (không dùng tọa độ, vì có thể chưa geocode). **Hanoi Post-Check bằng tọa độ** chỉ chạy **sau** Geocode, gộp vào bước Validate. Xem pipeline đầy đủ ở mục 4.2. |
| 4 | Cấu trúc thư mục project (mục 47 bản gốc) | Đặt tên khác với `context.md` mục 33 (`extractors/`, `geocoding/` thay vì cấu trúc trong `context.md`) | Nếu project **chưa có cấu trúc sẵn**, ưu tiên dùng cấu trúc đã nêu trong `context.md` mục 33 (`crawler/sources`, `crawler/processors`, `crawler/geocoder`, `crawler/deduplicator`, `crawler/scheduler`) để nhất quán toàn bộ tài liệu Phase 1. Cấu trúc chi tiết hơn ở mục 12 tài liệu này chỉ là gợi ý cách chia nhỏ **bên trong** các thư mục đó — không tạo thư mục top-level mới nếu không cần. Nếu project **đã có cấu trúc khác**, giữ nguyên cấu trúc hiện có (đúng nguyên tắc ở `context.md` mục 33: "Agent phải ưu tiên giữ nguyên cấu trúc hiện có"). |
| 5 | `records_failed` (mục 19, 43 bản gốc) | Nhắc tới field `records_failed` nhưng schema `crawl_jobs` ở tài liệu Data Modeling **không có** field này | Không thêm field mới vào `crawl_jobs`. Số record thất bại (geocoding failed / validation failed) được tính: `records_failed = records_found - records_created - records_updated` và được thể hiện chi tiết qua `crawl_logs` (mức `ERROR`), không cần cột riêng. Nếu Agent muốn tường minh hơn, có thể thêm cột `records_failed INTEGER DEFAULT 0` vào `crawl_jobs` — đây là mở rộng được phép, không bắt buộc. |
| 6 | Retry (mục 38 bản gốc) | Nói "MVP có thể retry 3 lần" nhưng không rõ retry ở cấp nào (toàn bộ job, hay từng request) | Làm rõ: Retry áp dụng ở **cấp request HTTP đơn lẻ** (crawl 1 trang, gọi 1 lần Geocoding API) với backoff, **không** retry toàn bộ Crawl Job. Xem mục 11.2. |

---

## 2. Tổng quan & Mục tiêu

Sau khi hoàn thành **Data Modeling & Data Foundation** (đã có schema `locations`, `sources`, `crawl_jobs`, `crawl_logs` trong PostgreSQL + PostGIS), bước tiếp theo là xây dựng **pipeline thu thập và đổ dữ liệu thật** vào các bảng đó.

```
External Source
     ↓
Crawl
     ↓
Extract
     ↓
Clean
     ↓
Normalize
     ↓
Hanoi Pre-Filter (theo địa chỉ)
     ↓
Geocode (nếu thiếu tọa độ)
     ↓
Validate (bao gồm Coordinate Post-Check theo bounding box Hà Nội)
     ↓
Deduplicate
     ↓
Upsert
     ↓
PostgreSQL + PostGIS   (qua Payload Local/REST API hoặc SQL — Payload CMS BẮT BUỘC)
     ↑
Docker: crawler → db / api
```

**Ghi chú:** Có thể upsert bằng `INSERT/UPDATE` SQL trực tiếp vào Postgres **hoặc** gọi Payload Local API từ crawler (qua network Docker `api`). Không bỏ Payload khỏi kiến trúc tổng thể.

**Mục tiêu cụ thể:**

1. Thu thập dữ liệu `charging_station` và `store` tại Hà Nội.
2. Chuẩn hóa dữ liệu từ nhiều nguồn khác nhau về đúng schema `Location` (đã định nghĩa ở Data Modeling doc).
3. Geocode địa chỉ thành tọa độ khi nguồn không cung cấp sẵn.
4. Loại bỏ dữ liệu trùng lặp, không tạo duplicate sau mỗi lần crawl.
5. Từ chối (không lưu) dữ liệu không hợp lệ hoặc ngoài phạm vi Hà Nội.
6. Theo dõi đầy đủ nguồn gốc dữ liệu (`sources`) và lịch sử crawl (`crawl_jobs`, `crawl_logs`).
7. Chạy tự động **1 lần/ngày**, không cần can thiệp thủ công.
8. **Không làm mất dữ liệu cũ hợp lệ** khi 1 lần crawl thất bại toàn bộ.

---

## 3. Scope

### 3.1. Geographic Scope

- **Chỉ xử lý:** Hà Nội.
- **Không xử lý** trong Phase 1: Hồ Chí Minh, Đà Nẵng, Hải Phòng, các tỉnh khác. Nếu crawler vô tình lấy được dữ liệu các khu vực này (ví dụ nguồn trả toàn quốc), phải **filter loại bỏ** trước khi lưu (mục 8).
- Mở rộng tương lai (KHÔNG triển khai ở Phase 1): `Hà Nội → toàn miền Bắc → toàn quốc`. Code pipeline không được hard-code theo cách khiến việc mở rộng này trở nên khó khăn (ví dụ: filter Hà Nội nên là 1 module riêng, dễ thay/tắt, không nhúng cứng vào logic chính).

### 3.2. Data Scope — 2 loại Location của MVP

Cả 2 loại đều map vào **cùng một bảng `locations`** (theo Data Modeling doc), khác nhau ở field `type`:

**Charging Station** (`type = "charging_station"`): tên trạm, địa chỉ, latitude, longitude, trạng thái, số điện thoại (nếu có), giờ hoạt động (nếu có), source_url.

**Store** (`type = "store"`): tên cửa hàng, địa chỉ, latitude, longitude, trạng thái, số điện thoại (nếu có), giờ hoạt động (nếu có), source_url.

> Field bắt buộc phải có trước khi lưu vào DB: `name`, `type`, `address`, `latitude`, `longitude`, `source_id` (xem lại Validation, mục 9). `phone`, `opening_hours`, `source_record_id`, `source_url` là optional — **không tự sinh dữ liệu giả** khi nguồn không cung cấp.

Các loại Location mở rộng (`service_center`, `showroom`, `dealer`, `parking`, `rescue_team`) **chưa cần crawl** trong MVP, nhưng pipeline (extractor/mapping) phải viết theo kiểu **có thể thêm loại mới mà không sửa core logic** — ví dụ dùng 1 hàm `detectLocationType()` tách riêng, dễ thêm case mới (mục 7.3).

---

## 4. Data Source Strategy & Pipeline tổng quát

### 4.1. Chiến lược nguồn: Primary + Supporting

```
Primary Source        →  Official Website / Official Location Page / Official API
                          (ưu tiên cao nhất — dữ liệu chính, có thể kiểm chứng)

Supporting Source      →  OpenStreetMap / External Map Data / Search API
                          (bổ sung, đối chiếu, không thay thế Primary Source)
```

Nguyên tắc ưu tiên khi có API chính thức (nhắc lại `context.md` mục 10):

```
Official API  >  Open Data (OSM)  >  Public Data  >  Web Crawling (HTML)
```

Mỗi nguồn tương ứng với **1 record trong bảng `sources`** (đã định nghĩa ở Data Modeling doc), với `type` ∈ `official_website | openstreetmap | external_api | other`.

### 4.1.1. Source Registry — Phase 1 MVP (URL cụ thể)

> Agent **bắt buộc** implement theo registry này. Không tự bịa URL. Khi HTML/SPA đổi, cập nhật registry + selector config, không hard-code selector trong core pipeline.

| ID seed `sources.name` | Priority | `sources.type` | Location types | Entry URL / Endpoint | Ghi chú |
|---|---|---|---|---|---|
| `vinfast_official` | **P0** | `official_website` | `store`, `charging_station`, (sau: `showroom`) | https://vinfastauto.com/vn_vi/tim-kiem-showroom-tram-sac | **$0**. SPA — ưu tiên XHR/JSON. EN: https://vinfastauto.com/vn_en/tim-kiem-showroom-tram-sac |
| `vinfast_faq_charging` | P2 (docs) | `other` | — | https://vinfastauto.com/vn_vi/node/9242 | **$0**. FAQ — không phải nguồn list |
| `osm_overpass_charging` | **P1** | `openstreetmap` | `charging_station` | https://overpass-api.de/api/interpreter | **$0**. Mirror: https://overpass.kumi.systems/api/interpreter |
| `osm_overpass_shop` | P2 | `openstreetmap` | `store` | https://overpass-api.de/api/interpreter | **$0**. Supporting |
| `photon_geocoder` | (service) | `external_api` | — | https://photon.komoot.io/api/ | **$0**, không API key — geocode primary |
| `nominatim_geocoder` | (service) | `external_api` | — | https://nominatim.openstreetmap.org/search | **$0**, ≤1 req/s + User-Agent — fallback |

> ❌ **Không** dùng Goong / Geoapify / Google / Mapbox Geocoding làm default (có thể mất phí). Chi tiết: [`09-free-apis-and-urls.md`](./09-free-apis-and-urls.md).

**Hanoi bbox (filter / Overpass):**

```
latitude  ∈ [20.53, 21.23]
longitude ∈ [105.29, 106.02]
```

**Overpass QL mẫu — trạm sạc trong bbox Hà Nội:**

```
[out:json][timeout:60];
(
  node["amenity"="charging_station"](20.53,105.29,21.23,106.02);
  way["amenity"="charging_station"](20.53,105.29,21.23,106.02);
  relation["amenity"="charging_station"](20.53,105.29,21.23,106.02);
);
out center tags;
```

**Seed SQL gợi ý (`database/seeds/sources.sql`):**

```sql
INSERT INTO sources (name, type, url, status) VALUES
  ('vinfast_official', 'official_website', 'https://vinfastauto.com/vn_vi/tim-kiem-showroom-tram-sac', 'active'),
  ('osm_overpass_charging', 'openstreetmap', 'https://overpass-api.de/api/interpreter', 'active')
ON CONFLICT DO NOTHING;  -- điều chỉnh nếu có unique trên name
```

**Legal / ToS:**

- Chỉ crawl phần public được phép; tôn trọng `robots.txt` và điều khoản VinFast.
- OSM: tuân thủ [OSM Copyright / ODbL](https://www.openstreetmap.org/copyright) — ghi attribution khi hiển thị dữ liệu OSM.
- Không scrape dữ liệu login-walled hoặc API nội bộ không được cấp phép.

**Thứ tự triển khai crawler:**

1. `osm_overpass_charging` (JSON + sẵn lat/lng → ít cần geocode, $0)  
2. `vinfast_official` (P0 nghiệp vụ)  
3. Geocode chỉ khi thiếu toạ độ: **Photon → Nominatim** (+ cache) — không dùng Goong/Geoapify/Google 

---

### 4.2. Pipeline đầy đủ (đã hiệu chỉnh thứ tự — xem Reconciliation #3)

```
Scheduler (1 lần/ngày)
     ↓
Create Crawl Job (status = pending → running)
     ↓
Load Source + Load Crawl URL(s) đã định nghĩa cho Source đó
     ↓
CRAWL           → lấy HTML/JSON thô từ nguồn                         [Raw Data]
     ↓
EXTRACT         → parse HTML/JSON thành object thô theo field nguồn  [Extracted Data]
     ↓
CLEAN           → trim, gộp khoảng trắng, bỏ HTML rác, chuẩn hóa SĐT [Cleaned Data]
     ↓
NORMALIZE       → map field nguồn → field chuẩn (name/address/type/status/phone/...) [Normalized Data]
     ↓
HANOI PRE-FILTER (theo địa chỉ/text) → loại bỏ record rõ ràng không thuộc Hà Nội
     ↓
GEOCODE         → nếu thiếu lat/lng thì gọi Geocoding API             [Geocoded Data]
     ↓
VALIDATE        → check field bắt buộc + Coordinate Post-Check (bounding box Hà Nội) [Valid Data]
     ↓
DEDUPLICATE     → so khớp với dữ liệu đã có trong DB
     ↓
UPSERT          → CREATE / UPDATE trong bảng locations
     ↓
DEACTIVATE MISSING → Location cũ của Source này mà không xuất hiện trong lần crawl này → status = inactive
     ↓
Finish Crawl Job (status = success | failed), ghi thống kê + crawl_logs
     ↓
PostgreSQL + PostGIS (Payload CMS BẮT BUỘC)
```

---

## 5. Crawler Engine — Crawl4AI

Crawler chính dùng **Crawl4AI** cho các nguồn dạng website (HTML). Với nguồn có API (OSM Overpass API, Official API) thì gọi trực tiếp HTTP client thông thường, **không cần Crawl4AI**.

```
Website  →  Crawl4AI  →  HTML  →  Parser  →  Structured Data (Extracted Data)
```

**Crawl4AI dùng để:** tải HTML, thực thi JS nếu cần (site render bằng JS), extract nội dung theo selector/LLM-assisted extraction, trả về dữ liệu có cấu trúc.

**Trách nhiệm của Crawler** (nhắc lại `context.md` mục 11): chỉ **Collect Data**. Crawler **không** làm Map Rendering, AI Recommendation, hay Frontend.

### 5.1. Crawl Strategy — không crawl toàn bộ Internet

Crawler chỉ crawl các **URL đã xác định trước** cho từng Source, lưu trong config (không hard-code rải rác trong code):

```
Source: "Official Website"
  urls:
    - charging_station_page: "https://example.com/charging-stations"
    - store_page:             "https://example.com/stores"
```

Nếu nguồn trả về dữ liệu toàn quốc (không lọc theo tỉnh/thành sẵn), bắt buộc chạy qua **Hanoi Pre-Filter** (mục 8.1) trước khi đi tiếp pipeline.

### 5.2. Crawl Flow (1 lần chạy)

```
02:00 AM
   ↓
Load Source "Official Website"
   ↓
Load Crawl URL(s): [charging_station_page, store_page]
   ↓
Crawl từng URL bằng Crawl4AI
   ↓
Extract Data (parse HTML → object)
   ↓
Raw Data: ví dụ 500 records
```

---

## 6. Extraction & Mapping

### 6.1. Raw Data

Dữ liệu ngay sau bước Extract, **chưa** được lưu trực tiếp vào `locations`:

```json
{
  "store_name": "VinFast Times City",
  "location": "458 Minh Khai, Hà Nội",
  "phone_number": "1900xxxx"
}
```

### 6.2. Field cần lấy khi Extract

| Field cần lấy | Bắt buộc? | Ghi chú |
|---|---|---|
| tên (tên field tùy nguồn, ví dụ `name`/`store_name`/`title`) | Yes | |
| địa chỉ (`address`/`location`/`addr`) | Yes | |
| latitude, longitude | No | Lấy trực tiếp nếu nguồn có; nếu không → Geocode ở bước sau |
| phone | No | Không tự sinh nếu thiếu |
| opening_hours | No | |
| type (nếu nguồn tự phân loại, ví dụ page riêng cho từng loại) | Yes (suy ra được) | Có thể suy ra từ URL/page (ví dụ crawl từ `charging_station_page` → `type = charging_station`) thay vì cần nguồn cung cấp field `type` |
| source_url | Yes | URL cụ thể tới record — dùng cho traceability |
| source_record_id | No (nhưng nên có) | ID phía nguồn nếu tồn tại (ví dụ data-id trong HTML, hoặc id trong JSON API) — ưu tiên dùng cho Deduplication |

### 6.3. Data Mapping (chuẩn hóa tên field)

Các nguồn khác nhau dùng tên field khác nhau — Agent viết 1 **mapping config theo từng Source** (không dùng if/else rải rác):

```
Source A:  store_name   → name
           location     → address
           phone_number → phone

Source B:  name         → name     (không đổi)
           address      → address  (không đổi)
           phone        → phone    (không đổi)
```

Gợi ý implementation — mapping declaration dạng object, không phải hard-code từng field trong function xử lý:

```ts
// crawler/sources/official_website.mapping.ts
export const fieldMapping = {
  store_name: "name",
  location: "address",
  phone_number: "phone",
};
```

### 6.4. Normalized Data (sau khi map)

```json
{
  "name": "VinFast Times City",
  "type": "store",
  "address": "458 Minh Khai, Hà Nội",
  "phone": "1900xxxx"
}
```

### 6.5. Location Type Detection

Cách xác định `type`, theo thứ tự ưu tiên:

```
1. Nếu Source đã tách sẵn theo trang/section (ví dụ charging_station_page vs store_page)
   → gán type cố định theo URL crawl, không cần detect.
2. Nếu Source trả chung 1 danh sách nhiều loại
   → dùng field/category có sẵn từ nguồn, map qua bảng tra (dictionary), ví dụ:
       "Trạm sạc" → charging_station
       "Cửa hàng" → store
3. Nếu không xác định được loại → KHÔNG cố gán mặc định, reject record + log WARNING
   (tránh gán sai type gây nhiễu dữ liệu).
```

---

## 7. Data Cleaning & Normalization (chi tiết)

### 7.1. Cleaning

| Bước | Ví dụ trước | Ví dụ sau |
|---|---|---|
| Trim + gộp khoảng trắng | `"  VinFast   Times City  "` | `"VinFast Times City"` |
| Bỏ tag HTML sót lại | `"Times City<br/>"` | `"Times City"` |
| Chuẩn hóa số điện thoại (bỏ ký tự lạ, giữ định dạng nhất quán) | `"1900.xxxx"` / `"(1900) xxxx"` | `"1900xxxx"` |
| Bỏ giá trị rỗng/placeholder (`"N/A"`, `"-"`, `""`) | `"N/A"` | `null` |

### 7.2. Normalization mục tiêu

> Toàn bộ record — dù từ nguồn nào — sau bước này phải có **cùng cấu trúc field** (`name`, `type`, `address`, `latitude?`, `longitude?`, `phone?`, `opening_hours?`, `status?`, `source_url?`, `source_record_id?`), sẵn sàng cho bước Hanoi Pre-Filter và Geocoding.

`status` (nếu nguồn có cung cấp, ví dụ `"Active"`, `"Open"`, `"Đang hoạt động"`) → map về đúng 2 giá trị enum: `active` \| `inactive`. Nếu nguồn không cung cấp `status` → mặc định `active` (record đang crawl được nghĩa là đang tồn tại).

---

## 8. Hanoi Filtering (2 lớp — xem Reconciliation #2, #3)

### 8.1. Hanoi Pre-Filter (theo địa chỉ/text — chạy TRƯỚC Geocoding)

Mục đích: loại sớm các record **rõ ràng** không thuộc Hà Nội, tránh tốn quota Geocoding API.

```
Kiểm tra (theo thứ tự, dừng ở điều kiện đầu tiên match được):
1. address chứa "Hà Nội" / "Ha Noi" / "Hanoi"  → PASS
2. address chứa tên quận/huyện thuộc Hà Nội (danh sách cấu hình sẵn,
   ví dụ: "Hai Bà Trưng", "Cầu Giấy", "Đống Đa", "Hoàng Mai", ... 
   + các huyện ngoại thành) → PASS
3. address chứa tên tỉnh/thành khác rõ ràng ("Hồ Chí Minh", "Đà Nẵng", 
   "Hải Phòng", ...) → REJECT ngay, log INFO "skipped: outside Hanoi scope"
4. Không xác định được (address quá ngắn/không rõ) → KHÔNG reject ở bước này,
   để bước Geocode + Coordinate Post-Check (8.2) quyết định.
```

> Đây là bước **heuristic** (dựa trên text), không tuyệt đối chính xác — vì vậy không dùng để `REJECT` cứng khi không chắc; chỉ `REJECT` khi **chắc chắn** thuộc tỉnh/thành khác.

### 8.2. Coordinate Post-Check (theo bounding box — chạy SAU Geocoding)

Dùng lại bounding box đã định nghĩa ở Data Modeling doc (mục 9.4):

```
latitude  ∈ [20.53, 21.23]
longitude ∈ [105.29, 106.02]
```

```
Nếu latitude/longitude nằm rõ ràng NGOÀI bounding box này
    → REJECT (không lưu vào locations), log ERROR "coordinates outside Hanoi scope"

Nếu latitude/longitude nằm SÁT biên (trong khoảng nới rộng thêm ~0.05 độ quanh bbox,
tương đương ~5km — do sai số Geocoding)
    → WARNING, vẫn lưu, đánh dấu để review sau (không có cột riêng, log qua crawl_logs)

Nếu nằm hẳn trong bbox → PASS, không cần log gì thêm.
```

---

## 9. Geocoding

### 9.1. Flow

```
Nếu record có sẵn latitude + longitude từ nguồn → dùng trực tiếp, KHÔNG geocode lại.
Nếu record chỉ có address, thiếu latitude/longitude:

    address → Geocoding API → { latitude, longitude }
```

Ví dụ: `"458 Minh Khai, Hà Nội"` → `{ latitude: 20.9945, longitude: 105.8621 }`.

### 9.2. Provider — chỉ dùng nguồn $0 (bắt buộc)

```
GeocodingService (interface)
    ├── PhotonProvider      (primary)  https://photon.komoot.io/api/
    └── NominatimProvider   (fallback) https://nominatim.openstreetmap.org/search
```

```ts
// crawler/geocoder/geocoding-service.ts
interface GeocodingProvider {
  geocode(address: string): Promise<{ latitude: number; longitude: number } | null>;
}

class GeocodingService {
  constructor(
    private primary: GeocodingProvider,   // Photon
    private fallback: GeocodingProvider,  // Nominatim
  ) {}

  async geocode(address: string) {
    const cached = await this.cacheGet(address);
    if (cached) return cached;
    const result =
      (await this.primary.geocode(address)) ??
      (await this.fallback.geocode(address));
    if (result) await this.cacheSet(address, result);
    return result;
  }
}
```

- Photon: không cần API key.  
- Nominatim: **User-Agent** bắt buộc, **≤ 1 request/giây**, luôn cache.  
- ❌ Không cấu hình `GOONG_API_KEY` / `GEOAPIFY_API_KEY` / Google làm default.  
- Chi tiết URL + policy: [`09-free-apis-and-urls.md`](./09-free-apis-and-urls.md).

### 9.3. Geocoding Error

```
Nếu Geocoding trả về null / lỗi / timeout:
    → KHÔNG tạo Location (thiếu tọa độ = thiếu field bắt buộc)
    → Log crawl_logs mức ERROR: "Geocoding failed: <address>"
    → Job vẫn tiếp tục xử lý các record còn lại (không dừng toàn bộ job)
    → Job kết thúc với status = "success" nếu phần còn lại chạy ổn,
      nhưng records_found > records_created + records_updated
      (chênh lệch = số record thất bại, có thể suy ra hoặc thêm cột records_failed — xem Reconciliation #5)
```

---

## 10. Validation (đầy đủ, sau Geocoding)

### 10.1. Field bắt buộc

```
name             != null && length > 0
type             ∈ enum hợp lệ (charging_station | store | ...)
address          != null && length > 0
latitude         != null && -90 <= latitude <= 90
longitude        != null && -180 <= longitude <= 180
source_id        != null
```

### 10.2. Coordinate Post-Check

Áp dụng bounding box Hà Nội như mục 8.2 — đây là bước **cuối cùng** quyết định record có được lưu hay không (ngoài field bắt buộc ở trên).

### 10.3. Kết quả Validation

```
Valid Data    → đi tiếp Deduplication
Invalid Data  → REJECT, log ERROR với lý do cụ thể (thiếu field nào / tọa độ nào sai)
```

---

## 11. Deduplication & Upsert

### 11.1. Deduplication Flow

```
New Record
     ↓
Check (source_id, source_record_id)
     │
     ├── Match found  → sẽ UPDATE record đó
     │
     └── Không match
             ↓
       Check (normalized(name) + normalized(address))
             │
             ├── Match found  → sẽ UPDATE record đó
             │
             └── Không match  → sẽ CREATE record mới
```

> `normalized(...)` nghĩa là đã qua Cleaning + Normalization (lowercase, trim, gộp khoảng trắng) trước khi so sánh chuỗi — tránh lệch nhau chỉ vì hoa/thường hoặc khoảng trắng thừa.

Mở rộng tương lai (KHÔNG bắt buộc MVP): fuzzy matching bằng `name similarity + address similarity + geo distance` khi 2 bước trên đều không chắc chắn.

### 11.2. Retry Policy (áp dụng ở cấp request, KHÔNG áp dụng cho toàn bộ Job — xem Reconciliation #6)

```
Áp dụng cho: 1 lần gọi HTTP crawl 1 trang, HOẶC 1 lần gọi Geocoding API cho 1 address.

Attempt 1 → FAILED (timeout/network error) 
   ↓ chờ backoff (ví dụ 2s)
Attempt 2 → FAILED
   ↓ chờ backoff (ví dụ 4s)
Attempt 3 → FAILED
   ↓
Bỏ qua record/trang này, log ERROR, tiếp tục record/trang tiếp theo.
(Không retry toàn bộ Crawl Job — 1 job chỉ chạy đúng 1 lần theo Scheduler.)
```

### 11.3. Upsert Strategy — pseudo-code đầy đủ

```python
def crawl_source(source):
    job = create_crawl_job(source)   # status = pending
    job.status = "running"

    seen_location_ids = set()
    stats = {"found": 0, "created": 0, "updated": 0, "deactivated": 0}

    try:
        for url in source.crawl_urls:
            raw_records = crawl(url)                       # Crawl4AI hoặc HTTP client
            for raw in raw_records:
                stats["found"] += 1
                try:
                    extracted   = extract(raw)
                    cleaned     = clean(extracted)
                    normalized  = normalize(cleaned, source.field_mapping)

                    if not hanoi_pre_filter(normalized):    # mục 8.1
                        log(job, "INFO", f"skipped (outside Hanoi): {normalized.get('name')}")
                        continue

                    if not normalized.get("latitude") or not normalized.get("longitude"):
                        coords = geocoding_service.geocode(normalized["address"])
                        if coords is None:
                            log(job, "ERROR", f"Geocoding failed: {normalized['address']}")
                            continue
                        normalized["latitude"] = coords["latitude"]
                        normalized["longitude"] = coords["longitude"]

                    if not validate(normalized):            # mục 10, bao gồm Coordinate Post-Check
                        log(job, "ERROR", f"Invalid record: {normalized.get('name')}")
                        continue

                    existing = find_existing(normalized, source.id)   # mục 11.1
                    if existing is None:
                        location = create_location(normalized, source.id)
                        stats["created"] += 1
                    else:
                        location = update_location(existing, normalized)
                        stats["updated"] += 1

                    location.last_seen_at = now()
                    location.status = "active"
                    seen_location_ids.add(location.id)

                except Exception as record_error:
                    log(job, "ERROR", f"Record processing failed: {record_error}")
                    continue

        # Deactivate: location cũ của source này mà KHÔNG xuất hiện trong lần crawl này
        stats["deactivated"] = deactivate_missing_locations(source.id, seen_location_ids)

        job.status = "success"

    except Exception as job_error:
        # Lỗi ở cấp toàn bộ job (ví dụ website hoàn toàn không truy cập được)
        job.status = "failed"
        job.error_message = str(job_error)
        log(job, "ERROR", f"Crawl job failed: {job_error}")
        # QUAN TRỌNG: KHÔNG deactivate bất kỳ Location nào trong nhánh này —
        # dữ liệu cũ hợp lệ phải được giữ nguyên (context.md mục 14).

    finally:
        job.finished_at = now()
        job.records_found = stats["found"]
        job.records_created = stats["created"]
        job.records_updated = stats["updated"]
        job.records_deactivated = stats["deactivated"]
        save(job)
```

> Điểm quan trọng nhất trong pseudo-code trên: **`deactivate_missing_locations` chỉ được gọi trong nhánh `try` thành công**, không nằm trong `except`/`finally` toàn cục — đảm bảo đúng quy tắc an toàn dữ liệu ở `context.md` mục 14: *"Nếu dữ liệu Crawl lỗi toàn bộ → KHÔNG được ghi đè dữ liệu hợp lệ hiện có."*

---

## 12. Crawl Job, Crawl Log & Monitoring

### 12.1. Crawl Job Lifecycle

```
pending → running → success
                  └→ failed
```

Không có bước nào được bỏ qua `running`. `finished_at` chỉ set khi `success` hoặc `failed`.

### 12.2. Ví dụ log thực tế của 1 Job

```
Crawl Job #1001 (source = "Official Website")
  INFO     Crawl started for source "Official Website"
  INFO     Found 500 records
  INFO     skipped (outside Hanoi): "VinFast Landmark 81" (Hồ Chí Minh)
  WARNING  10 records missing phone
  WARNING  5 records missing coordinates — attempting geocoding
  ERROR    Geocoding failed: "123 Unknown St"
  ERROR    Invalid record: missing address — "Store XYZ"
  INFO     Crawl completed: 500 found, 10 created, 480 updated, 10 deactivated
```

### 12.3. Crawl Monitoring — dữ liệu cần xem được (qua Admin/Payload/dashboard đơn giản, không cần phức tạp)

```
Last Crawl:          thời gian crawl_jobs.started_at gần nhất theo source
Crawl Status:        crawl_jobs.status gần nhất
Records Found/Created/Updated/Deactivated: từ crawl_jobs
Errors:               đếm số crawl_logs.level = 'ERROR' theo job
```

> MVP **không cần** dashboard phức tạp — 1 query đơn giản join `crawl_jobs` + `crawl_logs` là đủ, có thể hiển thị qua Payload Admin (nếu dùng) hoặc 1 trang debug đơn giản.

---

## 13. Error Handling & Security

### 13.1. Các loại lỗi cần xử lý (không để crash toàn bộ pipeline)

```
Website unavailable    → job.status = failed, giữ nguyên dữ liệu cũ
Timeout                → retry cấp request (mục 11.2), sau 3 lần thì skip record/page đó
Parsing error           → skip record đó, log ERROR, tiếp tục record khác
Invalid data            → reject record đó ở bước Validate (mục 10)
Geocoding failed        → skip record đó (mục 9.3)
Database error          → job.status = failed, log ERROR, không partial-commit dữ liệu hỏng
```

### 13.2. Security / Compliance (nhắc lại `context.md` mục 10, mở rộng chi tiết)

Crawler **không được**:
- Crawl dữ liệu cá nhân không cần thiết cho mục đích Location (ví dụ: thông tin khách hàng, nhân viên).
- Vượt Rate Limit của nguồn.
- Bypass Authentication / CAPTCHA.
- Crawl nội dung bị nguồn hạn chế truy cập hoặc vi phạm Terms of Service.

Crawler **phải**:
- Tôn trọng `robots.txt` khi phù hợp.
- Giới hạn tốc độ request (rate limit ở tầng crawler, ví dụ tối đa N request/giây tới 1 domain).
- Ưu tiên dùng API chính thức nếu nguồn có cung cấp (thay vì crawl HTML).

---

## 14. Daily Scheduler

```
02:00 AM (giờ VN) mỗi ngày
   ↓
Scheduler trigger → crawl_source(source) cho từng Source đang active
   ↓
(pipeline đầy đủ ở mục 4.2)
   ↓
Update crawl_jobs + crawl_logs
```

Công cụ: **Cron Job** hoặc **GitHub Actions** hoặc scheduler của môi trường deploy (nhắc lại `context.md` mục 12) — **không** cần Distributed Scheduler phức tạp trong MVP.

Nếu có nhiều Source, mỗi Source chạy **độc lập** (1 Source lỗi không ảnh hưởng Source khác):

```
Scheduler
    ↓
Crawl Service
    │
    ├── Source A → crawl_source(A) → Crawl Job A
    └── Source B → crawl_source(B) → Crawl Job B
```

---

## 15. Data Quality Metrics (theo dõi mỗi lần crawl)

| Metric | Nguồn lấy số liệu |
|---|---|
| Total Records (found) | `crawl_jobs.records_found` |
| Created | `crawl_jobs.records_created` |
| Updated | `crawl_jobs.records_updated` |
| Deactivated | `crawl_jobs.records_deactivated` |
| Failed / Invalid | `records_found - records_created - records_updated` (hoặc đếm `crawl_logs` mức `ERROR` theo job) |
| Skipped (outside Hanoi) | đếm `crawl_logs` có message dạng `"skipped (outside Hanoi)"` theo job |

---

## 16. Ví dụ End-to-End

### 16.1. Crawling Store

```
Raw:        { "store_name": "VinFast Times City", "location": "458 Minh Khai, Hà Nội" }
Normalize:  { "name": "VinFast Times City", "type": "store", "address": "458 Minh Khai, Hà Nội" }
Hanoi Pre-Filter: PASS (address chứa "Hà Nội")
Geocode:    "458 Minh Khai, Hà Nội" → { latitude: 20.9945, longitude: 105.8621 }
Validate:   PASS (đủ field bắt buộc + trong bounding box)
Dedupe:     Không tìm thấy record trùng → CREATE
Final:      {
              "name": "VinFast Times City",
              "type": "store",
              "address": "458 Minh Khai, Hà Nội",
              "latitude": 20.9945,
              "longitude": 105.8621,
              "status": "active",
              "source_id": "<id của Source>",
            }
Lưu vào:    PostgreSQL, bảng locations (trigger tự sinh cột `location` PostGIS)
```

### 16.2. Crawling Charging Station

```
Raw:        { "station_name": "Charging Station A", "location": "Hà Nội", "status": "Active" }
Normalize:  { "name": "Charging Station A", "type": "charging_station", "address": "Hà Nội", "status": "active" }
Hanoi Pre-Filter: PASS
Geocode:    "Hà Nội" → { latitude: 21.02, longitude: 105.82 }  (địa chỉ mơ hồ — nên ưu tiên nguồn có địa chỉ chi tiết hơn)
Validate:   PASS
Final:      { "name": "Charging Station A", "type": "charging_station",
              "latitude": 21.02, "longitude": 105.82, "status": "active" }
```

> Ghi chú cho Agent: ví dụ 16.2 có địa chỉ quá mơ hồ (`"Hà Nội"` — không có số nhà/đường) — trong thực tế nên coi đây là dữ liệu **chất lượng thấp**, log `WARNING "address too vague for reliable geocoding"`, dù vẫn cho qua Validate về mặt kỹ thuật.

---

## 17. Project Structure (khớp `context.md` mục 33 — xem Reconciliation #4)

```
project/
├── crawler/
│   ├── sources/            # 1 file/module cho mỗi Source: crawl logic + field mapping + crawl URLs
│   │   ├── official_website.ts
│   │   └── osm.ts
│   ├── processors/         # clean(), normalize(), validate(), hanoi_pre_filter()
│   │   ├── cleaner.ts
│   │   ├── normalizer.ts
│   │   └── validator.ts
│   ├── geocoder/           # Photon (primary) + Nominatim (fallback) + cache — $0
│   │   └── geocoding-service.ts
│   ├── deduplicator/        # find_existing(), so khớp theo mục 11.1
│   │   └── deduplicator.ts
│   └── scheduler/          # cấu hình lịch chạy + orchestration crawl_source()
│       └── scheduler.ts
├── database/
│   ├── migrations/
│   └── seeds/
├── docs/
├── .env.example
├── docker-compose.yml
└── README.md
```

> Nếu project hiện tại đã có cấu trúc khác — **giữ nguyên cấu trúc hiện có**, chỉ áp dụng logic/mapping ở trên vào đúng vị trí tương ứng trong cấu trúc đó.

---

## 18. Definition of Done — Data Crawling & Ingestion

- [ ] Đã xác định Primary Source và Supporting Source cụ thể, lưu trong bảng `sources`.
- [ ] Crawl4AI (hoặc HTTP client cho nguồn API) hoạt động, lấy được Raw Data thật.
- [ ] Đã crawl được dữ liệu `charging_station` và `store` thật (không phải mock data).
- [ ] Pipeline Clean → Normalize → Hanoi Pre-Filter → Geocode → Validate → Deduplicate → Upsert chạy đúng thứ tự (mục 4.2).
- [ ] Chỉ dữ liệu thuộc Hà Nội được lưu vào `locations` (verify bằng cả Pre-Filter và Coordinate Post-Check).
- [ ] Geocoding hoạt động, có xử lý lỗi khi geocode thất bại, không tạo Location thiếu tọa độ.
- [ ] Deduplication không tạo duplicate Location sau nhiều lần crawl liên tiếp.
- [ ] Upsert đúng: CREATE / UPDATE / DEACTIVATE (không DELETE cứng).
- [ ] `crawl_jobs` ghi đúng số liệu sau mỗi lần chạy; `crawl_logs` ghi đủ 3 mức log.
- [ ] Retry hoạt động ở cấp request (mục 11.2), không retry toàn bộ Job.
- [ ] Khi 1 Job thất bại toàn bộ, dữ liệu cũ hợp lệ **không bị deactivate hoặc mất**.
- [ ] Daily Scheduler chạy đúng 1 lần/ngày, độc lập theo từng Source.
- [ ] Đã test Crawl End-to-End: từ Source thật → dữ liệu xuất hiện đúng trong bảng `locations`.

---

## 19. Những gì KHÔNG được làm ở phần Data Crawling & Ingestion

❌ Không crawl toàn quốc — chỉ Hà Nội (dữ liệu ngoài Hà Nội phải bị filter, không lưu).
✅ Payload CMS BẮT BUỘC; crawler ghi Postgres/Payload; Admin không thay crawler.
❌ Không retry toàn bộ Crawl Job khi thất bại — chỉ retry ở cấp request đơn lẻ.
❌ Không tự sinh dữ liệu giả (phone, opening_hours) khi nguồn không cung cấp.
❌ Không DELETE Location — chỉ chuyển `status = inactive`.
❌ Không bypass CAPTCHA/Authentication, không vượt Rate Limit của nguồn.
❌ Không thêm AI/LLM vào bước Extract/Normalize trong Phase 1 trừ khi chỉ dùng ở mức hỗ trợ kỹ thuật của Crawl4AI để parse HTML (không phải AI Decision/Recommendation — điều này vẫn thuộc Phase 2+ theo `context.md` mục 37).

---

## 20. Tóm tắt (Summary)

Data Crawling & Ingestion là cầu nối giữa **External Data** và **Geo Decision Platform Database**, vận hành theo pipeline:

```
Crawl → Extract → Clean → Normalize → Hanoi Pre-Filter
     → Geocode → Validate (+ Coordinate Post-Check) → Deduplicate → Upsert
     → PostgreSQL + PostGIS (+ Payload CMS API/Admin, Docker)
```

- Chạy tự động **1 lần/ngày**, mỗi Source độc lập, có Retry ở cấp request, không retry toàn bộ Job.
- Mọi Location được lưu đều **truy nguyên được nguồn gốc** (`source_id`, `source_record_id`, `source_url`) và **có lịch sử crawl minh bạch** (`crawl_jobs`, `crawl_logs`).
- Dữ liệu cũ hợp lệ **luôn được bảo toàn** khi có lỗi crawl toàn bộ.
- Payload CMS là API/Admin **bắt buộc**; nguồn chân lý dữ liệu là PostgreSQL + PostGIS; Docker Compose bắt buộc.
- Kết quả cuối: 2 loại dữ liệu (`charging_station`, `store`) tại Hà Nội, cập nhật tự động, sẵn sàng cho bước tiếp theo — **RESTful API & Map Platform** (`03-api-and-map-platform.md`), nơi Frontend sẽ lấy dữ liệu qua API và hiển thị trên bản đồ Hà Nội dưới dạng Layer, Marker, Popup và Location Detail.
