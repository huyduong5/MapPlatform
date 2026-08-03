# 09 — Free API & URL Registry (BẮT BUỘC $0)

> **Project:** Geo Decision Platform  
> **Phase:** Phase 1 MVP  
> **Nguyên tắc cứng:** MVP **không được phụ thuộc** API trả phí (kể cả “free tier rồi tính tiền”). Chỉ dùng nguồn **miễn phí / open data** + tự host.  
> **Đọc trước:** [`00-tech-decisions.md`](./00-tech-decisions.md)

---

## 1. Chính sách chi phí

| Được phép | Không được (MVP) |
|---|---|
| OpenStreetMap / Overpass / ODbL | Google Maps Platform (Maps JS, Geocoding, Places) |
| Leaflet / MapLibre (thư viện OSS) | Mapbox (free tier → tính phí khi vượt) |
| Carto basemaps / OpenFreeMap tiles | Goong Maps (có quota, có gói trả phí) |
| Nominatim / Photon (rate-limit + cache) | Geoapify (free tier → tính phí) |
| Crawl trang public hợp pháp (VinFast) | API thương mại yêu cầu thẻ tín dụng |

> Nếu sau này sponsor/key trả phí: chỉ thêm như **optional provider** qua Map/Geocode Adapter — **không** đổi default MVP.

---

## 2. Stack bản đồ & geocode — $0 (đã chốt)

| Vai trò | Công nghệ | URL / endpoint | API key? | Phí |
|---|---|---|---|---|
| Map library | **Leaflet** (primary) hoặc MapLibre GL | https://leafletjs.com/ · https://maplibre.org/ | Không | $0 |
| Map tiles (raster) | **Carto Positron / Voyager** (OSM-based) | `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png` | Không | $0* |
| Map tiles (vector, tuỳ chọn) | **OpenFreeMap** | https://openfreemap.org/ · style ví dụ `https://tiles.openfreemap.org/styles/liberty` | Không | $0 |
| Geocoding primary | **Photon (Komoot)** | `https://photon.komoot.io/api/?q=...&limit=1` | Không | $0* |
| Geocoding fallback | **Nominatim (OSM)** | `https://nominatim.openstreetmap.org/search?format=json&q=...` | Không (bắt buộc User-Agent) | $0* |
| Spatial DB | PostGIS (tự host Docker) | local / VPS | — | $0 (chỉ trả VPS) |

\* Miễn phí nhưng **có usage policy** — xem mục 4 (rate limit + cache + attribution).

**Attribution bắt buộc trên UI map (footer nhỏ):**

```
© OpenStreetMap contributors · © CARTO
```

(Nếu dùng OpenFreeMap/MapLibre: theo license của style đó + OSM.)

---

## 3. Nguồn dữ liệu Location — URL đầy đủ

### 3.1. Primary / Supporting (crawl & open data)

| ID `sources.name` | Priority | Phí | Entry URL | Docs / ghi chú |
|---|---|---|---|---|
| `vinfast_official` | **P0** | $0 | https://vinfastauto.com/vn_vi/tim-kiem-showroom-tram-sac | SPA — bắt XHR/JSON nếu có. EN: https://vinfastauto.com/vn_en/tim-kiem-showroom-tram-sac |
| `vinfast_faq_charging` | P2 (tham khảo) | $0 | https://vinfastauto.com/vn_vi/node/9242 | Không phải list data |
| `osm_overpass_charging` | **P1** | $0 | https://overpass-api.de/api/interpreter | Mirror dự phòng: https://overpass.kumi.systems/api/interpreter |
| `osm_overpass_shop` | P2 | $0 | https://overpass-api.de/api/interpreter | Supporting |

**Overpass QL — trạm sạc Hà Nội (copy-paste):**

```
[out:json][timeout:60];
(
  node["amenity"="charging_station"](20.53,105.29,21.23,106.02);
  way["amenity"="charging_station"](20.53,105.29,21.23,106.02);
  relation["amenity"="charging_station"](20.53,105.29,21.23,106.02);
);
out center tags;
```

Gọi HTTP:

```bash
curl -G "https://overpass-api.de/api/interpreter" \
  --data-urlencode "data=[out:json][timeout:60];(node[\"amenity\"=\"charging_station\"](20.53,105.29,21.23,106.02););out center tags;"
```

**Ưu điểm OSM:** response thường **đã có lat/lng** → **không cần geocode trả phí**.

### 3.2. Geocoding (chỉ khi thiếu toạ độ)

| Provider | Base URL | Ví dụ | Giới hạn |
|---|---|---|---|
| Photon | `https://photon.komoot.io/api/` | `?q=458%20Minh%20Khai%20Hà%20Nội&limit=1&lang=vi` | Lịch sự; cache kết quả |
| Nominatim | `https://nominatim.openstreetmap.org/search` | `?q=458+Minh+Khai,+Hà+Nội&format=json&limit=1` | **≤ 1 req/s**, User-Agent rõ ràng, **cấm bulk nặng** |

Header Nominatim bắt buộc:

```
User-Agent: MapPlatform-VinSmartFuture/1.0 (contact: your-email@example.com)
```

**Chiến lược $0 trong crawler:**

```
1. Nếu nguồn đã có lat/lng (OSM / XHR VinFast) → dùng luôn, KHÔNG geocode
2. Nếu thiếu → Photon (1 req, có delay)
3. Nếu Photon fail → Nominatim (1 req/s)
4. Cache mọi kết quả vào bảng geocode_cache (address_normalized → lat/lng)
5. Không bao giờ geocode lại địa chỉ đã cache
```

### 3.3. API nội bộ dự án (tự host — $0 ngoài VPS)

| Method | URL (local) | URL (prod ví dụ) |
|---|---|---|
| List | `http://localhost:3001/api/locations` | `https://api.yourdomain.com/api/locations` |
| Detail | `http://localhost:3001/api/locations/:id` | `https://api.yourdomain.com/api/locations/:id` |
| Nearby | `http://localhost:3001/api/locations/nearby` | `https://api.yourdomain.com/api/locations/nearby` |
| Decide (Phase 2) | `http://localhost:3001/api/decide` | `https://api.yourdomain.com/api/decide` |
| Payload Admin | `http://localhost:3001/admin` | `https://api.yourdomain.com/admin` |
| Map UI | `http://localhost:3000` | `https://map.yourdomain.com` |

Contract: [`openapi.yaml`](./openapi.yaml).

### 3.4. Deep-link miễn phí (không SDK)

| Mục đích | URL |
|---|---|
| Mở vị trí trên Google Maps (chỉ link, không gọi API) | `https://www.google.com/maps/search/?api=1&query=<lat>,<lng>` |
| OpenStreetMap xem điểm | `https://www.openstreetmap.org/?mlat=<lat>&mlon=<lng>#map=17/<lat>/<lng>` |

---

## 4. Usage policy — để không bị chặn (vẫn $0)

| Dịch vụ | Policy | Việc Agent/code phải làm |
|---|---|---|
| Overpass | Không spam; timeout hợp lý | Delay giữa job; dùng mirror nếu 429 |
| Nominatim | https://operations.osmfoundation.org/policies/nominatim/ | ≤1 req/s, User-Agent, cache, không bulk lớn |
| OSM tiles chính thức | https://operations.osmfoundation.org/policies/tiles/ | **Không** dùng `tile.openstreetmap.org` làm tile production nặng → dùng **Carto / OpenFreeMap** |
| Carto basemaps | Attribution + dùng hợp lý | Ghi © CARTO + © OSM trên UI |
| Photon public | Best-effort community | Cache; có fallback Nominatim |

---

## 5. Những URL / API **cấm làm default MVP** (có thể mất phí)

| API | Docs | Lý do |
|---|---|---|
| Mapbox GL / tiles | https://docs.mapbox.com/ | Free tier → tính phí |
| Goong Maps | https://docs.goong.io/ | Có gói trả phí / quota |
| Geoapify | https://www.geoapify.com/geocoding-api | Free tier → tính phí |
| Google Maps JS / Geocoding / Places | https://developers.google.com/maps | Tính phí theo request |

Có thể giữ **adapter interface** để cắm sau — nhưng `.env.example` và code default **không** yêu cầu các key này.

**Rating / Places:** cột `locations.rating*` sẵn cho UI place-card, nhưng **không** bulk-fill từ Google Places (trả phí). Chỉ hiện sao khi OSM/`stars` (hoặc nguồn $0 khác) đã có; thiếu thì ẩn hoặc “Chưa có đánh giá” + deep-link Google Maps (không SDK).

**Reverse address (on-demand):** khi user mở detail và địa chỉ mỏng (`Hà Nội`, `…, Việt Nam`), API gọi Photon `/reverse` → Nominatim, ghi `address_normalized` + `geocode_cache` (provider `reverse-*`). Không reverse hàng loạt lúc crawl.

---

## 6. Checklist cho Agent khi implement

- [ ] Map = Leaflet (hoặc MapLibre) + Carto/OpenFreeMap — **không** bắt buộc `MAPBOX_ACCESS_TOKEN`
- [ ] Geocode = Photon → Nominatim + `geocode_cache` — **không** bắt buộc `GOONG_API_KEY` / `GEOAPIFY_API_KEY`
- [ ] Ưu tiên nguồn đã có toạ độ (Overpass) trước khi geocode
- [ ] Attribution OSM/Carto trên map
- [ ] Seed `sources` đúng URL mục 3.1
- [ ] Không commit API key / không gọi Google Maps SDK

---

## 7. Liên kết cập nhật

- Tech decisions: [`00-tech-decisions.md`](./00-tech-decisions.md)  
- Source Registry chi tiết crawl: [`02-data-crawling.md`](./02-data-crawling.md)  
- Frontend map: [`04-frontend-map-ui.md`](./04-frontend-map-ui.md)  
- Deploy: [`08-deploy-to-internet.md`](./08-deploy-to-internet.md)  
