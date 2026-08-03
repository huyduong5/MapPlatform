# Phase 5 — Hardening, CI & E2E

> Spec gốc: [`05-integration-testing.md`](./05-integration-testing.md).  
> **Status: DONE** (repo) — 2026-07-29.

## Phase 4 recheck (trước Phase 5)

| Check | Kết quả |
|---|---|
| Types active | charging 316 · store 6 · showroom 2 · service 2 |
| Smoke + bbox + crawl-stats | PASSED |
| Decide showroom | `find_showroom` OK |
| Unit api/web | 5 + 3 passed |
| review_status cột | OK |

→ Phase 4 **đã xong**.

## Deliverables Phase 5

| Hạng mục | Artifact |
|---|---|
| DB integration tests | `apps/api/src/integration/db.integration.test.ts` (INT-01…06) |
| Crawler type tests | `crawler/tests/test_validate_types.py` |
| Playwright E2E | `apps/web/e2e/map.spec.ts` |
| GitLab CI | `.gitlab-ci.yml` |
| GitHub Actions | `.github/workflows/ci.yml` |
| Local CI gate | `scripts/ci-local.sh` |
| Crawl fail alert | `scripts/alert-crawl-fail.sh` |

## Chạy

```bash
# Unit + integration (cần DB :5433)
pnpm test
pnpm test:integration
docker compose run --rm -e PYTHONPATH=/app crawler pytest -q

# Full local gate
chmod +x scripts/*.sh
./scripts/ci-local.sh

# E2E (API :3001 + WEB :3002 đang chạy)
pnpm --filter @mapplatform/web exec playwright install chromium
pnpm test:e2e

# Alert crawl
pnpm alert:crawl
```

## Verify (2026-07-29)

- Phase 4 recheck: smoke + types + decide showroom OK
- Unit api/web: passed
- Integration INT-01…06: passed (DB `127.0.0.1:5433`)
- Crawler pytest: 8 passed
- Playwright E2E: 3 passed
- Alert crawl (latest per source): OK

## DoD

- [x] Unit api/web/crawler
- [x] Integration PostGIS (nearby, bbox, phase4 types)
- [x] Smoke mở rộng Phase 4
- [x] Playwright E2E map + decide
- [x] CI config GitLab + GitHub
- [x] Alert crawl fail / empty success
