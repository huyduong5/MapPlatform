# DEPRECATED — `apps/web`

Map UI đã được merge vào monolith **`apps/api`** (`src/app/(frontend)`).

- Chạy app: `pnpm --filter @mapplatform/api dev` → http://localhost:3001  
- Admin / crawl: http://localhost:3001/admin  
- Docker: service `app` (không còn cần `web` mặc định)

Giữ thư mục này tạm thời cho test/e2e legacy và rollback (`docker compose --profile legacy-web up web`). Không phát triển feature mới ở đây.
