# Phase 2 — AI Geo Decision Engine (implementation status)

> Tái sử dụng Phase 1 DB + `/api/locations*` + Map UI.  
> **Status: DONE** (2026-07-28). Chi phí mặc định **$0** (rules + Photon; Ollama optional).  
> **Update 2026-08:** Vehicle wizard + Gemini NLU (optional key) + OSRM road ETA/polyline.

## Pipeline

```
User CTA → chọn loại xe + GPS
→ Intent (rules | Gemini | optional Ollama)
→ Anchor (GPS | landmark alias | Photon)
→ Geo Query (PostGIS nearby)
→ OSRM route ($0) → Ranking → Explanation → Map polyline
```

## API

`POST /api/decide`

```json
{
  "query": "Xe tôi gần Times City, pin còn 10%, tìm trạm sạc phù hợp nhất.",
  "limit": 3,
  "city": "hanoi",
  "latitude": 20.995,
  "longitude": 105.862,
  "vehicle": { "kind": "ev_car", "batteryPercent": 10 }
}
```

`vehicle.kind`: `ev_car` | `ev_moto` | `ice_car` | `ice_moto` (**bắt buộc** từ UI).

Optional: `latitude`, `longitude` (GPS). Không GPS thì cần landmark trong câu.

Response gồm `roadDistanceKm`, `etaMinutes`, `route.geometry`, `directionsUrl`.

## Business rules (MVP)

| Tín hiệu | Hành vi |
|---|---|
| Pin ≤ 15% | `critical` — bán kính nhỏ hơn (xe máy ~2 km) |
| Pin ≤ 30% | `high` |
| EV | ưu tiên `charging_station` + tầm pin ước tính |
| ICE | ưu tiên `gas_station` |
| Landmark | Alias offline hoặc Photon `$0` |

## UI

Panel **Tìm đường với AI**: CTA → chọn xe → mô tả → bật GPS → gợi ý + polyline + “Chỉ đường”.

## Env

```bash
# Optional Gemini NLU (local .env only — never commit)
# GEMINI_API_KEY=
# GEMINI_MODEL=gemini-2.0-flash

# Optional Ollama
# OLLAMA_BASE_URL=http://127.0.0.1:11434

ROUTING_PROVIDER=auto
OSRM_BASE_URL=https://router.project-osrm.org
```

## Chạy / test

```bash
pnpm --filter @mapplatform/api test
pnpm smoke   # gồm POST /api/decide
```
