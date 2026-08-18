#!/usr/bin/env bash
# Phase 3 go-live preflight — verifies local/repo readiness.
# Does NOT deploy to VPS (needs DOMAIN + VPS from the team).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

API="${API_BASE_URL:-${APP_BASE_URL:-http://localhost:3001}}"
FAIL=0

ok() { echo "  OK  $*"; }
bad() { echo "  FAIL $*"; FAIL=1; }
skip() { echo "  SKIP $*"; }

echo "== Go-live preflight (repo + local) =="

echo "-- artifacts --"
for f in \
  docker-compose.yml \
  docker-compose.prod.yml \
  deploy/Caddyfile \
  deploy/docker-compose.caddy.yml \
  .env.production.example \
  scripts/backup-db.sh \
  scripts/healthcheck.sh \
  scripts/phase3-validate.sh \
  database/migrations/001_init_schema.sql \
  database/migrations/003_phase7_city.sql
do
  if [[ -f "$f" ]]; then ok "$f"; else bad "missing $f"; fi
done

echo "-- compose prod config --"
if docker compose -f docker-compose.yml -f docker-compose.prod.yml config >/dev/null 2>&1; then
  ok "prod compose config"
else
  bad "prod compose config invalid (is Docker running?)"
fi

echo "-- local app (optional if not running) --"
if curl -sf "$API/api/health" >/dev/null 2>&1; then
  ok "APP health $API"
  curl -sf "$API/" >/dev/null && ok "GET / (map)" || bad "GET / (map)"
  curl -sf "$API/api/locations?limit=1" >/dev/null && ok "GET /api/locations" || bad "GET /api/locations"
  curl -sf -X POST "$API/api/decide" -H 'Content-Type: application/json' \
    -d '{"query":"trạm sạc gần Times City","limit":1}' >/dev/null \
    && ok "POST /api/decide" || bad "POST /api/decide"
else
  skip "App not up at $API — start pnpm --filter @mapplatform/api dev or compose"
fi

echo "-- ops blockers (manual; cannot auto-complete) --"
echo "  NEED DNS + VPS IP"
echo "  NEED https://map.<domain> + https://api.<domain>"
echo "  NEED HTTPS cert (Caddy ACME)"
echo "  NEED cron backup on server"
echo "  NEED uptime monitor"
if [[ -n "${DOMAIN:-}" ]]; then
  ok "DOMAIN env set: $DOMAIN (still need VPS deploy)"
else
  skip "DOMAIN unset — set in .env on VPS when ready"
fi

echo
if [[ "$FAIL" -ne 0 ]]; then
  echo "PREFLIGHT FAILED (repo/local issues)"
  exit 1
fi
echo "PREFLIGHT OK — repo ready; public go-live still needs team VPS/DNS (see docs/03-phase3-status.md Ops)"
exit 0
