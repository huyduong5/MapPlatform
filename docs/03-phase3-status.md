# Phase 3 — Deploy to Internet / Go-Live (implementation status)

> Spec đầy đủ: [`08-deploy-to-internet.md`](./08-deploy-to-internet.md).  
> **Repo readiness: DONE** (2026-07-28).  
> **Public go-live trên VPS:** cần domain + VPS của nhóm (ops), không tự hoàn tất trong CI local.

## Phase 2 check (trước Phase 3)

| Hạng mục | Kết quả |
|---|---|
| `POST /api/decide` | ✅ |
| Intent + rules + ranking | ✅ `apps/api/src/decision/` |
| UI AI Decision panel | ✅ |
| Unit tests decision | ✅ 4 passed |
| Smoke (locations + decide) | ✅ |

→ Phase 2 **đã xong**, đủ điều kiện sang Phase 3.

## Deliverables trong repo

| Artifact | Vai trò |
|---|---|
| `docker-compose.prod.yml` | Ẩn port DB/API/Web khỏi public |
| `deploy/Caddyfile` + `deploy/docker-compose.caddy.yml` | HTTPS Let's Encrypt |
| `.env.production.example` | Template secret + domain |
| `apps/*/Dockerfile` | Image production api/web |
| `scripts/backup-db.sh` / `restore-db.sh` | Backup/restore PostGIS |
| `scripts/healthcheck.sh` | Ping locations/nearby/decide/web |
| `scripts/phase3-validate.sh` | Compose config + docker build |
| `scripts/golive-preflight.sh` | Preflight repo/local + liệt kê ops blocker |
| Rate limit middleware | `RATE_LIMIT_*` trên `/api/*` |

## Validate local (không cần domain)

```bash
chmod +x scripts/*.sh
./scripts/phase3-validate.sh   # compose + docker build api/web/crawler
./scripts/backup-db.sh
./scripts/healthcheck.sh
```

Đã verify (2026-07-29 recheck):

- Prod overlay ẩn ports `db`/`api`/`web`
- Backup dump OK
- Health (locations/nearby/decide/web) OK
- Docker images `mapplatform-{api,web,crawler}:latest` present
- **Repo Phase 3: DONE** — public VPS/DNS vẫn là ops thủ công

## Go-live thật (cần VPS)

Theo [`deploy/README.md`](../deploy/README.md) + checklist mục 10 trong `08-deploy-to-internet.md`.

**Handoff cho ops nhóm (audit 2026-07-29):**

1. Cấp VPS (≥2 vCPU / 4GB) + domain
2. DNS A: `map` + `api` → IP VPS
3. Copy `.env.production.example` → `.env` trên server; set `DOMAIN`, secrets
4. `./scripts/golive-preflight.sh` trên máy có Docker (xác nhận repo)
5. Trên VPS: lệnh trong `deploy/README.md` (compose prod + Caddy)
6. Gắn cron backup + UptimeRobot
7. Tick Ops DoD bên dưới khi xong từng mục

```bash
chmod +x scripts/golive-preflight.sh
./scripts/golive-preflight.sh
```

## DoD

### Repo (Phase 3 code) — mục tiêu agent

- [x] Prod compose overlay (không expose Postgres)
- [x] Caddy TLS reverse proxy mẫu
- [x] Env production example
- [x] Backup / restore / health scripts
- [x] Dockerfile api/web/crawler usable (**build verified**)
- [x] Rate limit cơ bản
- [x] Docs Phase 3 status
- [x] Fix Payload `payload.config.ts` / `importMap.js` để `next build` prod chạy được

### Ops (cần tài nguyên nhóm)

- [ ] DNS + VPS
- [ ] `https://map.<domain>` public
- [ ] HTTPS cert hợp lệ
- [ ] Cron backup trên server
- [ ] Uptime monitor
