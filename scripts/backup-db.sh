#!/usr/bin/env bash
# Backup PostGIS DB (custom format). Safe for cron on VPS.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

COMPOSE=(docker compose -f docker-compose.yml)
if [[ "${PROD:-0}" == "1" ]]; then
  COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml)
fi

OUT_DIR="${BACKUP_DIR:-$ROOT/backups}"
mkdir -p "$OUT_DIR"
STAMP="$(date +%F_%H%M%S)"
FILE="$OUT_DIR/geo_${STAMP}.dump"
USER="${POSTGRES_USER:-geouser}"
DB="${POSTGRES_DB:-geo_platform}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-7}"

echo "Backing up $DB → $FILE"
"${COMPOSE[@]}" exec -T db pg_dump -U "$USER" -Fc "$DB" > "$FILE"
ls -lh "$FILE"

find "$OUT_DIR" -name 'geo_*.dump' -mtime "+$KEEP_DAYS" -delete 2>/dev/null || true
echo "Done. Kept last ${KEEP_DAYS} days under $OUT_DIR"
