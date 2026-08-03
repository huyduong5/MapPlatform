# 04 — Frontend Map UI (Chi tiết kỹ thuật)

> **Project:** Geo Decision Platform
> **Phase:** Phase 1 — Geo Data Foundation
> **Document:** Frontend Map UI — Technical Specification
> **Geographic Scope:** Hà Nội, Việt Nam
> **Status:** MVP
> **Đọc trước:** [`../context.md`](../context.md), [`03-api-and-map-platform.md`](./03-api-and-map-platform.md), [`openapi.yaml`](./openapi.yaml).
> **Stack:** Next.js 14 + **Leaflet + Carto tiles ($0)** — [`00-tech-decisions.md`](./00-tech-decisions.md), [`09-free-apis-and-urls.md`](./09-free-apis-and-urls.md).
> **Nguyên tắc:** API request/response **khớp** OpenAPI (`success/data/pagination`, nearby dùng `latitude`/`longitude`/`radius`/`distanceKm`). DB `snake_case` → API `camelCase`.
> **i18n:** UI mặc định **Tiếng Việt** (nhãn Layer, Search placeholder, Near Me, chi tiết địa điểm).

---

## 1. Vị trí của tài liệu này trong Phase 1

```
01 — Data Modeling & Database Design
02 — Data Crawling & Ingestion
03 — API & Map Platform
04 — Frontend Map UI   ← tài liệu này (lớp cuối cùng của Phase 1)
```

Sau khi 01–03 hoàn tất, hệ thống đã có:

```
External Data → Crawler → Data Processing → PostgreSQL + PostGIS → Backend → RESTful API
```

Tài liệu này đặc tả **toàn bộ lớp Frontend**: cách gọi API đã có, cách quản lý state, cách render bản đồ, và trải nghiệm người dùng cuối.

```
RESTful API
     ↓
FRONTEND (Next.js + React)   ← tài liệu này
     ↓
MAP HÀ NỘI
     ↓
Layer → Marker → Popup → Location Detail
```

---

## 2. Mục tiêu (Objectives)

Frontend Map UI cần cung cấp đủ 12 khả năng sau (ánh xạ `context.md` mục 4, 40):

| # | Khả năng |
|---|---|
| 1 | Hiển thị bản đồ Hà Nội |
| 2 | Hiển thị Trạm sạc (Charging Station) trên bản đồ |
| 3 | Hiển thị Store trên bản đồ |
| 4 | Quản lý Layer (bật/tắt độc lập) |
| 5 | Hiển thị Marker theo từng Location |
| 6 | Click Marker → hiển thị Popup |
| 7 | Xem thông tin chi tiết Location |
| 8 | Tìm kiếm Location theo tên/địa chỉ |
| 9 | Lọc Location theo loại |
| 10 | Tìm Location gần vị trí người dùng (Near Me) |
| 11 | Zoom và Pan bản đồ |
| 12 | Xử lý đầy đủ Loading / Error / Empty state |

**Không triển khai trong Phase 1** (giữ nguyên theo `context.md` mục 37):

- AI Chatbot, AI Recommendation, AI Reasoning
- Traffic Prediction, Route Optimization
- Dashboard vận hành phức tạp, Role/Permission management
- 3D Map, Street View, Turn-by-turn Navigation

---

## 3. MVP User Flow

### 3.1. Flow chính — xem Location trên bản đồ

```
User mở Website
      ↓
Map Hà Nội hiển thị (center mặc định)
      ↓
Frontend gọi GET /api/locations (hoặc theo từng type đang bật)
      ↓
Hiển thị Layer (Charging Station, Store)
      ↓
Hiển thị Marker tương ứng
      ↓
User click Marker
      ↓
Popup hiển thị thông tin rút gọn
      ↓
User click "Xem chi tiết" → Location Detail
```

### 3.2. Flow Search

```
User nhập từ khoá tìm kiếm
      ↓
Debounce (300–500ms)
      ↓
GET /api/locations?search=<query>
      ↓
Nhận kết quả (response.data[])
      ↓
Map flyTo/zoom tới kết quả
      ↓
Marker tương ứng được highlight
```

### 3.3. Flow Filter

```
User chọn Filter (All / Charging Station / Store)
      ↓
GET /api/locations?type=<value>&status=active
      ↓
Cập nhật state `locations`
      ↓
Map re-render Marker theo dữ liệu mới
```

### 3.4. Flow Near Me

```
User click nút "Near Me"
      ↓
navigator.geolocation.getCurrentPosition()
      ↓
Lấy (latitude, longitude) thiết bị
      ↓
GET /api/locations/nearby?latitude=..&longitude=..&radius=5000
      ↓
Nhận danh sách kèm distanceKm, đã sort theo khoảng cách
      ↓
Hiển thị danh sách kết quả + Marker trên Map
```

---

## 4. Frontend Architecture

```
Frontend
├── Header (tên platform + Search Box)
├── Search Box
├── Filter Panel
├── Layer Control
└── Map
    ├── Charging Station Layer
    ├── Store Layer
    ├── Marker
    ├── Popup
    └── Location Detail (Side Panel / Bottom Sheet)
```

**Nguyên tắc bắt buộc:**

- Frontend **không bao giờ** gọi PostgreSQL trực tiếp — chỉ gọi qua REST API đã định nghĩa ở `03-api-and-map-platform.md`.
- Map Component **chỉ nhận dữ liệu qua props/state** từ tầng API Client, không tự ý fetch song song ở nhiều nơi khác nhau trong component tree (tránh gọi API trùng lặp).
- Tách biệt rõ: **API Client layer** (gọi REST API) — **State layer** (React state/store) — **Presentation layer** (Map, Marker, Popup, Detail).

---

## 5. Technology Stack (MVP)

| Layer | Công nghệ đề xuất |
|---|---|
| Framework | Next.js |
| UI Library | React |
| Map Provider | **Leaflet + Carto** (default $0). Tuỳ chọn OpenFreeMap/MapLibre. Không bắt buộc API key trả phí. |
| Data Fetching | `fetch`/`axios` thuần với `useState`/`useEffect`, hoặc React Query (TanStack Query) nếu project đã dùng sẵn |
| Styling | Tuỳ theo convention hiện tại của project (Tailwind CSS, CSS Modules, v.v.) — không tự ý đổi nếu project đã có sẵn |

> Không thêm thư viện state-management nặng (Redux, MobX, Zustand...) nếu MVP chỉ cần vài state đơn giản — dùng `useState`/`useEffect`/Context API là đủ, giữ đúng nguyên tắc "Keep It Simple" ở `context.md` mục 35.

---

## 6. Page Structure

MVP chỉ cần **1 trang chính**: route `/`.

**Wireframe tổng thể (desktop):**

```
┌──────────────────────────────────────────────────────┐
│  Geo Decision Platform     [ Search Location... 🔍 ]  │  ← Header
├──────────────────────────────────────────────────────┤
│  ┌─────────────┐                                      │
│  │ Layers      │                                      │
│  │ ☑ Trạm sạc  │                                      │
│  │ ☑ Store     │              MAP HÀ NỘI              │
│  │             │                                      │
│  │ [Near Me]   │                 📍                   │
│  └─────────────┘                                      │
│                                📍                      │
│                     📍                                 │
└──────────────────────────────────────────────────────┘
```

Khi click Marker và mở Location Detail (desktop dùng Side Panel bên phải):

```
┌──────────────────────────────────────────────────────┐
│  Geo Decision Platform     [ Search Location... 🔍 ]  │
├─────────────────────────────────────┬────────────────┤
│                                      │ Location Detail│
│                                      │             X  │
│              MAP HÀ NỘI              │ VinFast Times  │
│                                      │ City           │
│                    📍                 │ Store          │
│                                      │ 458 Minh Khai  │
│                                      │ Status: Active │
│                                      │ [Open in Google│
│                                      │  Maps]         │
└─────────────────────────────────────┴────────────────┘
```

---

## 7. Header

**Nội dung:**

```
[ Logo/Tên: "Geo Decision Platform" ]     [ Search Box ]
```

- MVP **không cần** navigation menu phức tạp (không cần multi-page nav, không cần user account menu).
- Search Box có thể nằm trong Header (desktop) hoặc tách riêng bên dưới Header (mobile — xem mục 20 Responsive).

---

## 8. Search Box

**Chức năng:** tìm theo `name` hoặc `address` của Location.

**Component:** `SearchBox`

**Props/State:**

```typescript
interface SearchBoxProps {
  value: string;
  onChange: (value: string) => void;
  onSelectResult: (location: LocationSummary) => void;
  placeholder?: string; // mặc định: "Tìm kiếm địa điểm..."
}
```

**Flow xử lý:**

```
User gõ input
     ↓
onChange cập nhật state `searchQuery` (local, ngay lập tức — để input không bị giật)
     ↓
Debounce 300–500ms (dùng setTimeout/clearTimeout hoặc hook useDebounce)
     ↓
Khi debounce xong VÀ searchQuery.length >= 2 ký tự:
     gọi apiClient.searchLocations(searchQuery)
     ↓
Nhận response.data[]
     ↓
Hiển thị Search Result dropdown
```

**Quy tắc bắt buộc:**
- Không gọi API khi `searchQuery` rỗng hoặc dưới 2 ký tự (tránh gọi API thừa).
- Luôn debounce — không gọi API trên mỗi keystroke.
- Khi user xoá hết input → clear kết quả tìm kiếm, không hiển thị dropdown.

---

## 9. Search Result

**Hiển thị dạng danh sách dropdown ngay dưới Search Box:**

```
┌────────────────────────────────────┐
│ VinFast Times City                 │
│ 458 Minh Khai, Hà Nội              │
├────────────────────────────────────┤
│ Trạm sạc Royal City                │
│ 72A Nguyễn Trãi, Hà Nội            │
└────────────────────────────────────┘
```

**Khi user click 1 kết quả:**

```
Click Search Result
      ↓
Map.flyTo({ center: [longitude, latitude], zoom: 15 })  (hoặc tương đương theo Map Provider)
      ↓
Marker tương ứng được highlight (đổi màu/scale to hơn tạm thời)
      ↓
Đóng dropdown Search Result
```

> Nếu API trả về nhiều kết quả, chỉ cần zoom tới kết quả đầu tiên khi click — **không** tự động mở Popup, để user chủ động click Marker nếu muốn xem thêm.

---

## 10. Search API Integration

**Endpoint sử dụng (đúng theo `03-api-and-map-platform.md` mục 8.1):**

```
GET /api/locations?search=Times%20City
```

**Response thực tế (đúng envelope chuẩn — KHÔNG dùng format `docs[]` cũ):**

```json
{
  "success": true,
  "data": [
    {
      "id": "123",
      "name": "VinFast Times City",
      "type": "store",
      "address": "458 Minh Khai, Hà Nội",
      "latitude": 20.995,
      "longitude": 105.862,
      "status": "active"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "totalDocs": 1, "totalPages": 1 }
}
```

Frontend đọc `response.data` (mảng `LocationSummary`), **không** đọc `response.docs`.

---

## 11. Map

Map là component trung tâm của toàn bộ UI.

- **Center mặc định:** `latitude: 21.0285, longitude: 105.8542` (Hà Nội — đúng theo `context.md`/`03`).
- **Zoom mặc định:** đủ để nhìn thấy phần lớn nội thành Hà Nội (gợi ý zoom ~11–12 tuỳ Map Provider).
- Map luôn hiển thị dữ liệu lấy từ REST API — Map Component **không** tự lưu trạng thái dữ liệu Location, chỉ nhận qua props từ tầng state cha.

---

## 12. Map Provider & Map Adapter Pattern

MVP chọn 1 trong: **Leaflet + Carto basemaps** (default). URL tile: `NEXT_PUBLIC_MAP_TILE_URL` trong `.env.example`.

**Bắt buộc tách lớp Adapter** để không hard-couple logic Frontend vào 1 provider cụ thể:

```
Map Component (MapView)
        ↓  (gọi qua interface chung, không gọi thẳng SDK)
Map Adapter (interface: initMap, addMarker, removeMarker, flyTo, fitBounds, on(event))
        ↓
Map Adapter (Leaflet + Carto tiles — $0; optional MapLibre/OpenFreeMap)
```

**Ví dụ interface Adapter (TypeScript):**

```typescript
interface MapAdapter {
  init(container: HTMLElement, center: [number, number], zoom: number): void;
  addMarker(location: LocationSummary, onClick: (id: string) => void): void;
  removeMarker(locationId: string): void;
  clearMarkers(): void;
  flyTo(center: [number, number], zoom?: number): void;
  destroy(): void;
}
```

> Mục tiêu: nếu sau này đổi từ Mapbox sang Geoapify (hoặc ngược lại), chỉ cần viết 1 implementation mới của `MapAdapter`, không sửa `MapView` hay bất kỳ component nào khác.

---

## 13. Map Component (`MapView`)

**Component chính:** `<MapView />`

**Nhiệm vụ:**

- Khởi tạo Map qua Map Adapter khi component mount.
- Render Marker dựa trên `locations` (props/state truyền vào).
- Xử lý sự kiện click Marker → gọi callback `onMarkerClick(locationId)` lên component cha.
- Xử lý Zoom/Pan (do Map Provider SDK xử lý native, Frontend không tự viết logic zoom/pan).
- Cleanup (destroy map instance) khi component unmount — tránh memory leak.

**Props gợi ý:**

```typescript
interface MapViewProps {
  locations: LocationSummary[];
  onMarkerClick: (locationId: string) => void;
  center?: [number, number];
  zoom?: number;
}
```

---

## 14. Layer Control

**UI:**

```
┌───────────────────┐
│ Map Layers        │
│                   │
│ ☑ Charging Station│
│ ☑ Store           │
└───────────────────┘
```

- User có thể **Enable/Disable** từng layer độc lập.
- Component: `LayerControl`, nhận state hiện tại và callback toggle:

```typescript
interface LayerControlProps {
  showChargingStation: boolean;
  showStore: boolean;
  onToggleChargingStation: (value: boolean) => void;
  onToggleStore: (value: boolean) => void;
}
```

---

## 15. Charging Station Layer

**Endpoint:** `GET /api/locations?type=charging_station&status=active`

**Flow:**

```
API → Charging Station data (response.data[]) → filter theo showChargingStation === true → Map renders Marker
```

---

## 16. Store Layer

**Endpoint:** `GET /api/locations?type=store&status=active`

**Flow:**

```
API → Store data (response.data[]) → filter theo showStore === true → Map renders Marker
```

> **Cách tiếp cận đề xuất cho MVP:** gọi **1 lần** `GET /api/locations?status=active` (không truyền `type`) để lấy toàn bộ Location đang active, lưu vào state `locations` chung, sau đó **lọc ở client-side** theo `showChargingStation`/`showStore` khi render Marker. Cách này giảm số lần gọi API khi user toggle layer liên tục. Chỉ tách gọi API riêng theo từng `type` nếu số lượng Location đủ lớn để việc tải toàn bộ ảnh hưởng performance (xem mục 21 Performance).

---

## 17. Layer State

**State cần quản lý:**

```typescript
interface LayerState {
  showChargingStation: boolean; // mặc định: true
  showStore: boolean;           // mặc định: true
}
```

Khi `showChargingStation = false` → Frontend **ẩn Marker loại `charging_station` khỏi Map** (client-side filter, không xoá dữ liệu khỏi state `locations`).

---

## 18. Marker

**Dữ liệu tối thiểu Marker cần có:** `id`, `name`, `type`, `latitude`, `longitude`, `status`.

**Icon phân biệt theo `type`:**

| Type | Icon |
|---|---|
| `charging_station` | Icon trạm sạc (tia sét/phích cắm) |
| `store` | Icon cửa hàng |

**Component:** `Marker` (thường được Map Adapter/SDK render trực tiếp lên bản đồ, không phải React DOM component thông thường — tuỳ theo Map Provider được chọn).

---

## 19. Marker Interaction

```
User click Marker
      ↓
onClick(locationId)
      ↓
setSelectedLocation(locationId)  (cập nhật state Frontend)
      ↓
Hiển thị Popup ngay tại vị trí Marker
```

---

## 20. Popup

**Hiển thị (dữ liệu rút gọn — lấy trực tiếp từ `LocationSummary` đã có trong state `locations`, KHÔNG cần gọi thêm API):**

```
┌──────────────────────────────┐
│ VinFast Times City           │
│ Store                        │
│ 458 Minh Khai, Hà Nội        │
│                               │
│ [ Xem chi tiết ]             │
└──────────────────────────────┘
```

**Component:**

```typescript
interface PopupProps {
  location: LocationSummary;
  onViewDetail: (locationId: string) => void;
  onClose: () => void;
}
```

> Không hiển thị toàn bộ thông tin trong Popup — chỉ `name`, `type`, `address`, `status`. Thông tin đầy đủ nằm ở Location Detail.

---

## 21. Location Detail

**Khi user click "Xem chi tiết":**

```
onViewDetail(locationId)
      ↓
apiClient.getLocationById(locationId)   →   GET /api/locations/:id
      ↓
Nhận response.data (full Location object)
      ↓
Hiển thị Location Detail Panel
```

**Thông tin hiển thị đầy đủ:** `name`, `type`, `address`, `phone`, `openingHours`, `status`, `source`, `lastUpdated` (đúng field đã đặc tả ở `03-api-and-map-platform.md` mục 5, 8.2).

> Không hiển thị raw crawl data hoặc field nội bộ không cần thiết cho người dùng cuối (`context.md` mục 24).

---

## 22. Detail Panel (Side Panel)

**Wireframe (desktop — mở từ bên phải):**

```
┌─────────────────────────────┐
│ Location Detail          X  │
├─────────────────────────────┤
│ VinFast Times City          │
│                              │
│ Store                        │
│                              │
│ 458 Minh Khai, Hà Nội        │
│                              │
│ Status: Active               │
│ Source: Official Website     │
│ Last Updated: 2026-07-20     │
│                              │
│ [ Open in Google Maps ]      │
└─────────────────────────────┘
```

- Nút **[Open in Google Maps]** dùng deep-link đơn giản dạng: `https://www.google.com/maps/search/?api=1&query=<latitude>,<longitude>` — không cần tích hợp Google Maps SDK.
- Trên mobile, Detail Panel hiển thị dưới dạng **Bottom Sheet** thay vì Side Panel (xem mục 20 Responsive).

---

## 23. Filter

**Options MVP:** `All`, `Charging Station`, `Store`.

**Component:** `LocationFilter`

```typescript
type FilterType = "all" | "charging_station" | "store";

interface LocationFilterProps {
  value: FilterType;
  onChange: (value: FilterType) => void;
}
```

**Flow:**

```
User chọn Filter = "charging_station"
      ↓
apiClient.getLocations({ type: "charging_station", status: "active" })
      ↓
Cập nhật state `locations`
      ↓
Map chỉ hiển thị Marker Charging Station
```

---

## 24. Status Filter

**Options:** `Active`, `Inactive` (tuỳ chọn nâng cao — không bắt buộc UI riêng trong MVP).

**Mặc định:** chỉ hiển thị `active` (đúng theo `context.md` mục 26 và `03` mục 8.1 — API mặc định `status=active` khi không truyền param).

> MVP không bắt buộc phải có UI toggle Active/Inactive; mặc định luôn lọc `active` là đủ đáp ứng yêu cầu.

---

## 25. Nearby Location — Lấy vị trí người dùng

```typescript
navigator.geolocation.getCurrentPosition(
  (position) => {
    const { latitude, longitude } = position.coords;
    // gọi apiClient.getNearbyLocations(latitude, longitude)
  },
  (error) => {
    // xử lý user từ chối quyền hoặc lỗi GPS — hiển thị thông báo thân thiện
  }
);
```

---

## 26. Nearby UI

**Nút:** `📍 Near Me` (đặt trong Layer Control hoặc Header).

**Flow:**

```
Click "Near Me"
      ↓
Xin quyền Geolocation (nếu chưa cấp)
      ↓
Lấy (latitude, longitude)
      ↓
apiClient.getNearbyLocations(latitude, longitude, radius=5000)
      ↓
GET /api/locations/nearby?latitude=..&longitude=..&radius=5000
      ↓
Hiển thị danh sách kết quả + Marker trên Map
```

**Xử lý lỗi bắt buộc:**
- Nếu user từ chối cấp quyền Geolocation → hiển thị thông báo: *"Không thể lấy vị trí của bạn. Vui lòng cấp quyền truy cập vị trí để sử dụng tính năng này."* — không crash app.
- Nếu trình duyệt không hỗ trợ Geolocation → ẩn nút "Near Me" hoặc hiển thị disabled kèm tooltip giải thích.

---

## 27. Nearby Result

**Hiển thị danh sách kèm khoảng cách (lấy trực tiếp từ field `distanceKm` mà API `03` đã trả sẵn — không tự tính lại ở Frontend):**

```
Nearby Charging Stations

1. Station A — 1.2 km
2. Station B — 2.5 km
3. Station C — 3.1 km
```

**Khi click 1 kết quả trong danh sách:**

```
Click Result
      ↓
Map.flyTo tới vị trí Location đó
      ↓
Mở Popup tương ứng
```

---

## 28. Map Interaction

**MVP hỗ trợ:** Zoom In, Zoom Out, Pan, Click Marker (đều là native behavior của Map Provider SDK, Frontend không tự viết lại logic này).

**Không cần trong MVP:** 3D Map, Street View, Turn-by-turn Navigation.

---

## 29. API Integration — Danh sách Endpoint sử dụng

Toàn bộ endpoint dưới đây **phải khớp chính xác** với `03-api-and-map-platform.md`:

```
GET /api/locations
GET /api/locations/:id
GET /api/locations?type=charging_station | store
GET /api/locations?status=active
GET /api/locations?search=<query>
GET /api/locations?page=&limit=
GET /api/locations/nearby?latitude=&longitude=&radius=&type=
```

**Flow chung:**

```
Frontend
    ↓
API Client (services/locationApi.ts)
    ↓
REST API (Backend)
    ↓
PostgreSQL + PostGIS
```

---

## 30. API Client

**File:** `services/locationApi.ts`

**Các function bắt buộc (đúng theo `context.md` mục 35.3 — Reusable functions):**

```typescript
// services/locationApi.ts

import type { Location, LocationSummary, LocationType, ApiListResponse, ApiDetailResponse } from "@/types/location";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL; // đọc từ .env, không hard-code

interface GetLocationsParams {
  type?: LocationType;
  status?: "active" | "inactive";
  search?: string;
  page?: number;
  limit?: number;
}

export async function getLocations(params: GetLocationsParams = {}): Promise<ApiListResponse<LocationSummary>> {
  const query = new URLSearchParams();
  if (params.type) query.set("type", params.type);
  if (params.status) query.set("status", params.status);
  if (params.search) query.set("search", params.search);
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));

  const res = await fetch(`${API_BASE_URL}/api/locations?${query.toString()}`);
  return res.json();
}

export async function getLocationById(id: string): Promise<ApiDetailResponse<Location>> {
  const res = await fetch(`${API_BASE_URL}/api/locations/${id}`);
  return res.json();
}

export async function searchLocations(query: string): Promise<ApiListResponse<LocationSummary>> {
  return getLocations({ search: query });
}

export async function getLocationsByType(type: LocationType): Promise<ApiListResponse<LocationSummary>> {
  return getLocations({ type });
}

export async function getNearbyLocations(
  latitude: number,
  longitude: number,
  radius: number = 5000,
  type?: LocationType
): Promise<ApiListResponse<LocationSummary & { distanceKm: number }>> {
  const query = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    radius: String(radius),
  });
  if (type) query.set("type", type);

  const res = await fetch(`${API_BASE_URL}/api/locations/nearby?${query.toString()}`);
  return res.json();
}
```

> **Lưu ý quan trọng:** dùng đúng tên param `latitude`/`longitude` (không dùng `lat`/`lng`) khi gọi `nearby`, khớp chính xác với `03-api-and-map-platform.md` mục 8.3.

---

## 31. Data Flow tổng quát (Frontend nội bộ)

```
API Client (services/locationApi.ts)
      ↓
Fetch Data
      ↓
Frontend State (locations, selectedLocation, ...)
      ↓
MapView Component (nhận qua props)
      ↓
Render Layer (lọc theo showChargingStation/showStore)
      ↓
Render Marker
```

**Ví dụ cụ thể:**

```
getLocations({ status: "active" })
      ↓
response.data → locations[]
      ↓
setLocations(locations)
      ↓
<MapView locations={locations} ... />
      ↓
locations
  .filter(loc => (loc.type === "charging_station" ? showChargingStation : showStore))
  .map(loc => renderMarker(loc))
```

---

## 32. State Management

**MVP dùng React State** (`useState`/`useEffect`, hoặc Context API nếu state cần share qua nhiều component sâu). Không cần Redux/Zustand cho MVP.

**Danh sách state cần quản lý ở component cha (`app/page.tsx` hoặc tương đương):**

```typescript
interface AppState {
  locations: LocationSummary[];        // danh sách Location hiện tại đang hiển thị
  selectedLocation: Location | null;   // Location đang xem chi tiết (full object)
  searchQuery: string;                 // giá trị ô tìm kiếm
  searchResults: LocationSummary[];    // kết quả tìm kiếm (dropdown)
  filterType: FilterType;              // "all" | "charging_station" | "store"
  showChargingStation: boolean;
  showStore: boolean;
  nearbyResults: (LocationSummary & { distanceKm: number })[];
  loading: boolean;
  error: string | null;
}
```

| State | Mô tả |
|---|---|
| `locations` | Danh sách Location đang hiển thị trên Map |
| `selectedLocation` | Location đang được chọn (sau khi click "Xem chi tiết") |
| `searchQuery` | Từ khoá tìm kiếm hiện tại |
| `filterType` | Filter loại Location đang áp dụng |
| `showChargingStation`/`showStore` | Trạng thái bật/tắt từng Layer |
| `loading` | Đang gọi API |
| `error` | Thông báo lỗi (nếu có) |

---

## 33. Loading State

**Khi API đang tải dữ liệu Location lần đầu:**

```
Loading locations...
```

**Khi Map Provider đang khởi tạo:**

```
Loading Map Data...
```

> **Bắt buộc:** không được để màn hình trắng trong lúc chờ dữ liệu — luôn hiển thị skeleton/spinner tối thiểu.

---

## 34. Error State

**Khi API lỗi (network error, 500, timeout...):**

```
Unable to load locations. Please try again.
[ Retry ]
```

**Flow:**

```
API Error (response.success === false hoặc network exception)
      ↓
setError(errorMessage)
      ↓
Hiển thị Error State + nút Retry
      ↓
User click Retry
      ↓
Gọi lại API tương ứng
```

> Đọc `error.code`/`error.message` từ response envelope chuẩn (`03-api-and-map-platform.md` mục 7.3 và mục 11) để hiển thị thông báo phù hợp — ví dụ `LOCATION_NOT_FOUND` hiển thị khác với `INTERNAL_SERVER_ERROR`.

---

## 35. Empty State

**Khi search hoặc filter không có kết quả:**

```
No locations found.
```

**Ví dụ:** search `"ABC Store"` (không tồn tại) → `response.data = []` → hiển thị Empty State, **không** phải Error State (đây là 2 trạng thái khác nhau — quan trọng: `success: true, data: []` là Empty, không phải lỗi).

---

## 36. Map Loading Sequence

```
Load Page
      ↓
Khởi tạo Map (Map Adapter → Map Provider SDK)
      ↓
Hiển thị "Loading Map..." trong lúc khởi tạo
      ↓
Map sẵn sàng (onLoad event của SDK)
      ↓
Gọi API lấy Location Data
      ↓
Render Markers lên Map
```

---

## 37. Responsive UI

**MVP hỗ trợ:** Desktop, Tablet, Mobile.

| Breakpoint | Layout |
|---|---|
| Desktop | Search + Filter/Layer Control ở sidebar trái, Map chiếm phần còn lại, Location Detail mở Side Panel bên phải |
| Tablet | Tương tự Desktop, thu gọn sidebar nếu cần |
| Mobile | Search ở trên cùng, Filter/Layer Control có thể thu gọn thành dropdown/collapsible, Map chiếm toàn màn hình, Location Detail hiển thị dạng **Bottom Sheet** trượt lên từ dưới |

---

## 38. Performance

**Bắt buộc:**

- **Debounce Search** (300–500ms) — không gọi API trên mỗi keystroke.
- **Không gọi API liên tục/lặp lại không cần thiết** — cache kết quả trong state, chỉ gọi lại khi filter/search/vị trí thay đổi thực sự.
- **Chỉ render Marker của Layer đang bật** — lọc client-side trước khi render (xem mục 16).
- **Áp dụng Pagination** khi danh sách lớn (đúng theo `03` mục 9) — Map có thể không cần phân trang khi hiển thị toàn bộ, nhưng danh sách dạng list (nếu có UI list riêng ngoài Map) nên phân trang.

**Khi dữ liệu lớn (ước tính 1000+ Location):**
- Áp dụng **Marker Clustering** (xem mục 39).
- Áp dụng **Bounding Box Query** khi Map di chuyển (xem `03-api-and-map-platform.md` mục 10) — chỉ tải Location trong khung nhìn hiện tại.

> MVP với dữ liệu ban đầu (Hà Nội, 2 loại Location) thường chưa cần Clustering/Bounding Box ngay — chỉ triển khai khi số lượng Marker thực tế gây giật/lag khi render.

---

## 39. Marker Clustering

**Khi số Marker lớn**, thay vì hiển thị từng Marker riêng lẻ gây rối mắt:

```
📍📍📍📍📍📍📍📍📍   (không tốt khi quá nhiều)
```

→ dùng Cluster:

```
   ┌─────┐
   │ 100 │
   └─────┘
```

**Click vào Cluster:**

```
Click Cluster
      ↓
Zoom In tự động
      ↓
Cluster tách thành các Marker riêng lẻ (hoặc Cluster nhỏ hơn)
```

> Thư viện gợi ý tuỳ Map Provider: Leaflet dùng `leaflet.markercluster` (default MVP). Chỉ triển khai khi thực sự cần (xem mục 38).

---

## 40. Map Data Refresh

- Crawler chạy **1 lần/ngày** (`context.md` mục 12).
- Sau mỗi lần crawl, PostgreSQL được cập nhật.
- **Frontend không tự crawl và không cần tự động poll/refresh liên tục** — mỗi lần user mở lại trang (hoặc reload), Frontend gọi lại API và nhận dữ liệu mới nhất.

```
Crawler (1 lần/ngày) → Database Updated
      ↓ (lần sau user mở app)
Frontend gọi GET /api/locations → Get Latest Data
```

---

## 41. Data Source Display

Location Detail hiển thị field `source` để đảm bảo tính minh bạch dữ liệu (Data Transparency):

```
Source: Official Website
```

hoặc:

```
Source: OpenStreetMap
```

---

## 42. Last Updated

Hiển thị field `lastUpdated` trong Location Detail:

```
Last Updated: 2026-07-20
```

> Format hiển thị: chuyển từ ISO 8601 (API trả về) sang định dạng ngày dễ đọc (`YYYY-MM-DD` hoặc `DD/MM/YYYY` tuỳ convention project) — xử lý format ở tầng Frontend, không yêu cầu Backend đổi format.

---

## 43. Frontend Components — Cấu trúc thư mục components

```
components/
│
├── Map/
│   ├── MapView.tsx
│   ├── MapLayer.tsx
│   ├── Marker.tsx
│   └── Popup.tsx
│
├── Search/
│   └── SearchBox.tsx
│
├── Filter/
│   └── LocationFilter.tsx
│
├── Layer/
│   └── LayerControl.tsx
│
└── Location/
    ├── LocationDetail.tsx
    └── LocationCard.tsx
```

---

## 44. Suggested Project Structure

```
src/
│
├── app/
│   └── page.tsx              # trang chính duy nhất của MVP
│
├── components/
│   ├── Map/
│   ├── Search/
│   ├── Filter/
│   ├── Layer/
│   └── Location/
│
├── services/
│   └── locationApi.ts        # API Client (mục 30)
│
├── types/
│   └── location.ts           # type definitions (mục 45)
│
└── utils/
    └── map.ts                # helper functions (format distance, debounce, v.v.)
```

> ⚠️ **Lưu ý cho Agent:** Nếu project hiện tại đã có cấu trúc thư mục khác, **ưu tiên giữ nguyên cấu trúc hiện có** (đúng nguyên tắc ở `context.md` mục 33), không tự ý rewrite toàn bộ theo cấu trúc mẫu ở trên.

---

## 45. TypeScript Types (`types/location.ts`)

**Đồng bộ chính xác với Data Model ở `context.md` mục 7 và `03-api-and-map-platform.md` mục 5:**

```typescript
export type LocationType =
  | "charging_station"
  | "store"
  | "service_center"
  | "showroom"
  | "dealer"
  | "parking"
  | "rescue_team";

export type LocationStatus = "active" | "inactive";

// Dùng cho danh sách/Map (payload rút gọn — khớp GET /api/locations)
export interface LocationSummary {
  id: string;
  name: string;
  type: LocationType;
  address: string;
  latitude: number;
  longitude: number;
  status: LocationStatus;
}

// Dùng cho Location Detail (payload đầy đủ — khớp GET /api/locations/:id)
export interface Location extends LocationSummary {
  phone?: string | null;
  openingHours?: string | null;
  source: string;
  sourceUrl?: string | null;
  lastUpdated: string;
  createdAt: string;
  updatedAt: string;
}

// Response envelope chuẩn — khớp 03-api-and-map-platform.md mục 7
export interface ApiListResponse<T> {
  success: boolean;
  data: T[];
  pagination?: {
    page: number;
    limit: number;
    totalDocs: number;
    totalPages: number;
  };
  error?: { code: string; message: string };
}

export interface ApiDetailResponse<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

export type FilterType = "all" | LocationType;
```

---

## 46. Map Component Flow

```
MapView
   │
   ├── LayerControl
   │
   ├── ChargingStationLayer
   │      └── Marker (icon: charging_station)
   │
   └── StoreLayer
          └── Marker (icon: store)
```

**Khi Marker click:**

```
Marker.onClick(locationId)
      ↓
setSelectedLocationId(locationId)
      ↓
Popup hiển thị (dựa vào LocationSummary đã có sẵn trong state `locations`)
```

---

## 47. Frontend to API Flow (tổng quát)

```
User
  ↓
Search / Filter / Near Me action
  ↓
Frontend (component xử lý event)
  ↓
API Client (services/locationApi.ts)
  ↓
API Request → Backend → PostgreSQL + PostGIS
  ↓
API Response (đúng envelope chuẩn)
  ↓
Frontend State cập nhật (setLocations / setSearchResults / setNearbyResults)
  ↓
Map Update (re-render Marker)
```

---

## 48. MVP User Scenarios

### Scenario 1 — Xem trạm sạc

```
User mở Website → Map Hà Nội → Bật Charging Station Layer
→ Marker hiển thị → Click Marker → Popup
```

### Scenario 2 — Xem Store

```
User bật Store Layer → Store Markers hiển thị
→ Click Marker → Xem chi tiết → Location Detail
```

### Scenario 3 — Search

```
User nhập "Times City" → API Search → Result
→ Map Zoom → Marker hiển thị
```

### Scenario 4 — Nearby

```
User click "Near Me" → Get GPS → API Nearby
→ Danh sách Location gần nhất (kèm distanceKm) → Map hiển thị
```

---

## 49. MVP Definition of Done

Frontend hoàn thành khi:

- [ ] Next.js/React chạy ổn định
- [ ] Map Hà Nội hiển thị, center đúng toạ độ mặc định
- [ ] Map Provider (đã chọn) hoạt động qua Map Adapter
- [ ] API kết nối thành công với `03-api-and-map-platform.md` (đúng envelope, đúng tên param)
- [ ] Charging Station Layer hoạt động
- [ ] Store Layer hoạt động
- [ ] Layer Toggle (bật/tắt độc lập) hoạt động
- [ ] Marker hiển thị đúng icon theo type, đúng vị trí
- [ ] Marker Click hoạt động, mở đúng Popup
- [ ] Popup hiển thị đúng thông tin rút gọn
- [ ] Location Detail hoạt động, gọi đúng `GET /api/locations/:id`
- [ ] Search hoạt động, có debounce, Map zoom đúng kết quả
- [ ] Filter hoạt động (All/Charging Station/Store)
- [ ] Nearby ("Near Me") hoạt động, dùng đúng `latitude`/`longitude`
- [ ] Loading State hoạt động (không có màn hình trắng)
- [ ] Error State hoạt động, có nút Retry
- [ ] Empty State hoạt động, phân biệt rõ với Error State
- [ ] Responsive: hoạt động tốt trên Desktop, Tablet, Mobile

---

## 50. Final MVP Flow

```
                  USER
                     │
                     ▼
                 WEBSITE
                     │
                     ▼
              HANOI MAP UI
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
      Search       Filter       Layer
        │            │            │
        └────────────┼────────────┘
                     ▼
                  REST API
                     │
                     ▼
          PostgreSQL + PostGIS
                     │
          ┌──────────┴──────────┐
          ▼                     ▼
   Charging Station           Store
          │                     │
          └──────────┬──────────┘
                     ▼
                  Marker
                     │
                     ▼
                   Popup
                     │
                     ▼
             Location Detail
```

---

## 51. Phase 1 Complete Architecture (tham chiếu nhanh)

```
DATA SOURCES
      │
      ▼
    CRAWL
      │
      ▼
DATA PROCESSING
      │
      ▼
POSTGRESQL + POSTGIS
      │
      ▼
BACKEND (API Layer — mục 3 của 03-api-and-map-platform.md)
      │
      ▼
 REST API
      │
      ▼
FRONTEND (tài liệu này)
      │
      ▼
 HANOI MAP
      │
┌───────────┴───────────┐
▼                       ▼
CHARGING STATION       STORE
      │                       │
      └───────────┬───────────┘
                  ▼
               MARKER
                  │
                  ▼
                POPUP
                  │
                  ▼
          LOCATION DETAIL
```

---

## 52. Phase 1 Final MVP — Tiêu chí trải nghiệm người dùng

MVP hoàn thành khi người dùng có thể thực hiện tuần tự:

```
1. Mở bản đồ Hà Nội
2. Xem Trạm sạc
3. Xem Store
4. Bật/Tắt Layer
5. Click Marker
6. Xem thông tin Location
7. Search Location
8. Filter Location
9. Tìm Location gần mình (Near Me)
```

Dữ liệu được cập nhật tự động (không cần thao tác gì từ Frontend):

```
Crawler (1 lần/ngày) → Update Database → API → Frontend (lần mở tiếp theo)
```

---

## 53. Bước tiếp theo (Next Step)

Sau khi hoàn thành 01–04 (Data Modeling, Data Crawling, API & Map Platform, Frontend Map UI), bước cần thực hiện tiếp:

```
05 — Integration & Testing
```

**Mục tiêu:** đảm bảo toàn bộ luồng `Crawler → Database → API → Frontend → Map` được kết nối **End-to-End**, chạy ổn định, có test coverage cho các case chính (xem `03-api-and-map-platform.md` mục 16).

Sau khi Phase 1 ổn định, dự án mới chuyển sang **PHASE 2 — AI & GEO DECISION ENGINE** (Natural Language Understanding → Intent Detection → Location Extraction → Geo Query → Business Rules → Ranking → Recommendation → AI Explanation).

> ⚠️ Nhắc lại: Phase 1 (bao gồm tài liệu Frontend này) **tuyệt đối không** triển khai bất kỳ thành phần nào thuộc Phase 2. Frontend trong Phase 1 chỉ là lớp hiển thị dữ liệu (visualization layer), không chứa logic AI hay Business Rules dưới bất kỳ hình thức nào.
