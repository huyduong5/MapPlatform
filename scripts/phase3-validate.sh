#!/usr/bin/env bash
# Phase 3 — validate deploy artifacts (no public VPS required).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "== compose config (prod overlay) =="
docker compose -f docker-compose.yml -f docker-compose.prod.yml config >/tmp/mapplatform-prod.yml
echo "OK compose config written /tmp/mapplatform-prod.yml"

echo "== required files =="
for f in \
  docker-compose.yml \
  docker-compose.prod.yml \
  deploy/Caddyfile \
  deploy/docker-compose.caddy.yml \
  apps/api/Dockerfile \
  apps/web/Dockerfile \
  crawler/Dockerfile \
  scripts/backup-db.sh \
  scripts/restore-db.sh \
  scripts/healthcheck.sh \
  .env.production.example
do
  test -f "$f" && echo "OK $f" || { echo "MISSING $f"; exit 1; }
done

echo "== scripts executable =="
chmod +x scripts/backup-db.sh scripts/restore-db.sh scripts/healthcheck.sh scripts/phase3-validate.sh

echo "== build images (api + web + crawler) =="
# Keep DB running; build only app images to validate Dockerfiles.
docker compose build app crawler

echo "PHASE 3 VALIDATE PASSED (repo-ready). Public go-live still needs VPS + DNS."
