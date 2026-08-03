#!/usr/bin/env bash
# Restore from pg_dump -Fc file.
# Usage: ./scripts/restore-db.sh backups/geo_YYYY-MM-DD.dump
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DUMP="${1:-}"
if [[ -z "$DUMP" || ! -f "$DUMP" ]]; then
  echo "Usage: $0 <path-to.dump>" >&2
  exit 1
fi

COMPOSE=(docker compose -f docker-compose.yml)
if [[ "${PROD:-0}" == "1" ]]; then
  COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml)
fi

USER="${POSTGRES_USER:-geouser}"
DB="${POSTGRES_DB:-geo_platform}"

echo "Restoring $DUMP → $DB (destructive --clean)"
"${COMPOSE[@]}" exec -T db pg_restore -U "$USER" -d "$DB" --clean --if-exists < "$DUMP"
echo "Restore finished."
