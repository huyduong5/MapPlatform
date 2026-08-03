# apps/web — Next.js Map UI (Phase 1)

Service Docker: `web`.

Gọi REST từ Payload (`api`) — **không** kết nối Postgres trực tiếp.

## Tài liệu

- `docs/00-tech-decisions.md`
- `docs/04-frontend-map-ui.md`
- `docs/openapi.yaml`

## Dev

```bash
docker compose up -d db api   # hoặc full stack
pnpm --filter web dev         # http://localhost:3000
```
