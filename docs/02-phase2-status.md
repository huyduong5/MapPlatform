# Phase 2 — AI Geo Decision Engine (implementation status)

> Tái sử dụng Phase 1 DB + `/api/locations*` + Map UI.  
> **Status: DONE** (2026-07-28). Chi phí mặc định **$0** (rules + Photon; Ollama optional).

## Pipeline

```
User Query → Intent (rules | optional Ollama)
→ Anchor (GPS | landmark alias | Photon)
→ Geo Query (PostGIS nearby, reuse Phase 1)
→ Business Rules + Ranking → Explanation → Map highlight
```

## API

`POST /api/decide`

```json
{
  "query": "Xe tôi gần Times City, pin còn 10%, tìm trạm sạc phù hợp nhất.",
  "limit": 3
}
```

Optional: `latitude`, `longitude` (GPS người dùng).

## Business rules (MVP)

| Tín hiệu | Hành vi |
|---|---|
| Pin ≤ 15% | `critical` — chỉ ưu tiên trạm sạc, bán kính ~3 km, phạt khoảng cách mạnh |
| Pin ≤ 30% | `high` — bán kính ~5 km |
| Có “trạm sạc” / “cửa hàng” | Filter type tương ứng |
| Landmark (Times City, …) | Alias offline hoặc Photon `$0` |

## UI

Panel **AI Decision** trên map (`apps/web`): gửi câu hỏi → highlight top gợi ý (marker cam) + vòng bán kính.

## Chạy / test

```bash
pnpm --filter @mapplatform/api test
pnpm smoke   # gồm POST /api/decide
```

Optional LLM local:

```bash
# ollama serve && ollama pull llama3.2
# OLLAMA_BASE_URL=http://127.0.0.1:11434
```
