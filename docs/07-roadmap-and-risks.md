# 07 — Roadmap, Risks & MVP Limitations

> **Project:** Geo Decision Platform  
> **Phase:** Phase 7 DONE (code 0–7); public go-live = ops còn lại  
> **Đọc trước:** `context.md`  
> **Stack cứng:** Payload CMS + PostgreSQL/PostGIS + Docker Compose (`db`, `api`, `web`, `crawler`).

---

## 1. Giới hạn MVP & workaround cho CSKH

Problem Statement liệt kê nhiều loại địa điểm; MVP Phase 1 **chỉ** cover 2 loại. CSKH cần biết rõ phần nào đã có trên platform:

| Loại địa điểm | Phase 1 | Cách xử lý tạm cho CSKH |
|---|---|---|
| Trạm sạc (`charging_station`) | ✅ Có trên map + API | Dùng Geo Decision Platform |
| Cửa hàng (`store`) | ✅ Có trên map + API | Dùng Geo Decision Platform |
| Showroom | ✅ Phase 4 | Geo Decision Platform |
| Đại lý (`dealer`) | ✅ Phase 6 | Geo Decision Platform |
| Xưởng dịch vụ (`service_center`) | ✅ Phase 4 | Geo Decision Platform |
| Đội cứu hộ (`rescue_team`) | ✅ Phase 6 | Geo Decision Platform |
| Điểm đỗ xe (`parking`) | ✅ Phase 6 | Geo Decision Platform |

> Schema đã sẵn enum mở rộng — Phase 1.1 có thể thêm type mà **không đổi kiến trúc**.

---

## 2. Timeline đề xuất (8 tuần)

```
Tuần 1–2  │ Payload Collections + Postgres/PostGIS + Docker Compose skeleton
Tuần 3–4  │ Crawler P0 + pipeline + Photon/Nominatim $0 (container crawler)
Tuần 5    │ REST qua Payload + custom nearby (PostGIS) + OpenAPI
Tuần 6–7  │ Frontend Map UI (container web)
Tuần 8    │ Integration + E2E + demo trên `docker compose up`
```

### Milestone checklist

| Milestone | DoD ngắn |
|---|---|
| M1 Schema | Payload + PostGIS trên Docker `db`; Collections OK |
| M2 Data in | ≥ 1 nguồn P0 đổ được qua crawler container |
| M3 API | 3 endpoint qua Payload pass INT tests |
| M4 Map | User flow demo trên `web` container |
| M5 Hardening | E2E xanh; crawl fail không xoá data; backup |

---

## 3. Risk Register

| ID | Rủi ro | Mức | Tác động | Giảm thiểu |
|---|---|---|---|---|
| R1 | VinFast đổi HTML/SPA → crawler 0 record | Cao | Mất cập nhật data | Alert `records_found=0`; ưu tiên bắt network/XHR API nếu có; selector tách config |
| R2 | ToS / chặn crawl website chính thức | Cao | Không lấy được primary source | Ưu tiên API/open data; OSM hỗ trợ; xin phép nội bộ nếu cần |
| R3 | Nominatim/Photon bị rate-limit | Trung bình | Thiếu toạ độ | Cache; ≤1 req/s; ưu tiên OSM đã có lat/lng |
| R4 | Tile Carto chậm | Thấp | Map chậm | Đổi OpenFreeMap / mirror tile |
| R5 | OSM thiếu / sai địa điểm VN | Trung bình | Data sparse | OSM = supporting; primary = official |
| R6 | Dedup gộp nhầm 2 địa điểm gần nhau | Trung bình | Mất điểm trên map | Ưu tiên `(source_id, source_record_id)`; fuzzy name+address có ngưỡng khoảng cách |
| R7 | Scope creep (AI, multi-city) | Cao | Trễ MVP | Bám `context.md` mục 37; review PR chống AI deps |
| R9 | Payload schema vs PostGIS cột geometry lệch | Trung bình | Nearby hỏng | Migration bổ sung sau Payload; test INT spatial |
| R10 | Docker build/compose phức tạp cho nhóm mới | Trung bình | Dev chậm | Có chế độ `docker compose up -d db` + pnpm dev |

---

## 4. Trạng thái phase (sau audit 2026-07-29)

| Phase | Status | Doc |
|---|---|---|
| 0 Bootstrap | DONE | [`00-phase0-bootstrap.md`](./00-phase0-bootstrap.md) |
| 1 Geo foundation | DONE | [`01-phase1-status.md`](./01-phase1-status.md) |
| 2 Decision Engine | DONE | [`02-phase2-status.md`](./02-phase2-status.md) |
| 3 Deploy (repo) | DONE | [`03-phase3-status.md`](./03-phase3-status.md) |
| 3 Deploy (public VPS) | **Ops chưa** — cần domain/VPS | [`08-deploy-to-internet.md`](./08-deploy-to-internet.md) |
| 4 Expansion | DONE | [`04-phase4-status.md`](./04-phase4-status.md) |
| 5 CI / E2E | DONE | [`05-phase5-status.md`](./05-phase5-status.md) |
| 6 Ops + full types | DONE | [`06-phase6-status.md`](./06-phase6-status.md) |
| 7 Multi-city + CSKH | DONE | [`07-phase7-status.md`](./07-phase7-status.md) |

### Việc còn lại (không phải phase code mới)

1. **Public go-live:** VPS + DNS + HTTPS + cron backup + uptime — handoff trong `03-phase3-status.md`; preflight `./scripts/golive-preflight.sh`
2. Crawl HCM/ĐN đầy đủ (Overpass) — hiện dùng curated seed stub

---

## 5. Definition of Done (trạng thái theo dõi)

> Cập nhật Phase 7 audit — code 0–7 xanh; chi tiết status docs. Public VPS vẫn ops.

### Chức năng (`context.md`)

- [x] PostgreSQL + PostGIS hoạt động
- [x] Location data model + migrations
- [x] Crawler + processing + geocoding + dedupe
- [x] Scheduler 1 lần/ngày
- [x] REST: list, detail, search, filter, nearby
- [x] Frontend map Hà Nội: layers, marker, popup, detail
- [x] End-to-end: crawl → DB → API → map marker

### Testing (`05-integration-testing.md`)

- [x] INT lõi PostGIS (nearby/bbox/types) — `apps/api/src/integration`
- [x] E2E Playwright map + decide
- [x] CI migrate → seed → unit → integration (GitLab + GitHub)

### Ops

- [x] `.env.example` đủ biến
- [x] Backup script
- [x] Alert crawl fail (`scripts/alert-crawl-fail.sh`)

### Phase 6 — Ops Console & Full Location Coverage

- [x] `dealer` / `parking` / `rescue_team` + layers
- [x] Ops UI `/ops` (crawl-stats + WARNING review)
- [x] `/api/health`, `/api/metrics`

Chi tiết: [`06-phase6-status.md`](./06-phase6-status.md).

### Phase 7 — Multi-city + CSKH polish

- [x] Cột `city` + filter API + seed HCM stub
- [x] City switcher + deep-link `/?city=&id=`
- [x] Ops CSV export + webhook alert optional

Chi tiết: [`07-phase7-status.md`](./07-phase7-status.md).

### Phase 5 — Hardening / CI / E2E

Xem [`05-phase5-status.md`](./05-phase5-status.md).

---

## 6. Liên kết nguồn chính thức (tham khảo nhanh)

| Nguồn | URL |
|---|---|
| VinFast — Tìm Showroom & Trạm sạc | https://vinfastauto.com/vn_vi/tim-kiem-showroom-tram-sac |
| VinFast FAQ tìm trạm sạc | https://vinfastauto.com/vn_vi/node/9242 |
| OpenStreetMap Overpass | https://overpass-api.de/api/interpreter |
| Photon Geocoder | https://photon.komoot.io/ |
| Nominatim | https://nominatim.openstreetmap.org/ |
| Carto basemaps | https://carto.com/basemaps/ |
| OpenFreeMap | https://openfreemap.org/ |
| Free API registry | [`09-free-apis-and-urls.md`](./09-free-apis-and-urls.md) |
| PostGIS | https://postgis.net/documentation/ |

Chi tiết crawl: [`02-data-crawling.md`](./02-data-crawling.md) mục **Source Registry**.
