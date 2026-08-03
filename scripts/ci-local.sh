#!/usr/bin/env bash
# Phase 5 — local CI gate: migrate → seed → unit → integration → smoke → (optional e2e)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 20 >/dev/null 2>&1 || true

echo "== db up =="
docker compose up -d db
for i in $(seq 1 30); do
  docker compose exec -T db pg_isready -U geouser -d geo_platform && break
  sleep 1
done

echo "== migrate =="
docker compose exec -T db psql -U geouser -d geo_platform < database/migrations/001_init_schema.sql >/dev/null
docker compose exec -T db psql -U geouser -d geo_platform < database/migrations/002_phase4_review_queue.sql >/dev/null
docker compose exec -T db psql -U geouser -d geo_platform < database/migrations/003_phase7_city.sql >/dev/null

echo "== seed =="
docker compose exec -T db psql -U geouser -d geo_platform < database/seeds/sources.sql >/dev/null || true
docker compose exec -T db psql -U geouser -d geo_platform < database/seeds/locations_phase4.sql >/dev/null || true
docker compose exec -T db psql -U geouser -d geo_platform < database/seeds/locations_phase6.sql >/dev/null || true
docker compose exec -T db psql -U geouser -d geo_platform < database/seeds/locations_phase7_hcm.sql >/dev/null || true
docker compose exec -T db psql -U geouser -d geo_platform < database/seeds/locations_phase7_danang.sql >/dev/null || true

echo "== unit api/web =="
pnpm --filter @mapplatform/api test
pnpm --filter @mapplatform/web test

echo "== unit crawler =="
docker compose build crawler >/dev/null
docker compose run --rm -e PYTHONPATH=/app crawler pytest -q

echo "== integration DB =="
pnpm test:integration

echo "== smoke (requires API+web) =="
if curl -sf "http://localhost:3001/api/locations?limit=1" >/dev/null \
  && curl -sf "http://localhost:3002/" >/dev/null; then
  ./scripts/smoke-api.sh
  ./scripts/alert-crawl-fail.sh || true
  if command -v pnpm >/dev/null; then
    echo "== playwright e2e =="
    pnpm --filter @mapplatform/web exec playwright test || {
      echo "Playwright failed — ensure browsers installed: pnpm --filter @mapplatform/web exec playwright install chromium"
      exit 1
    }
  fi
else
  echo "SKIP smoke/e2e (API :3001 or WEB :3002 not up). Start with pnpm dev:api & pnpm dev:web"
fi

echo "CI LOCAL PASSED"
