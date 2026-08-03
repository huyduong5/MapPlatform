#!/usr/bin/env bash
# Alert if the latest crawl job per source (within lookback) failed or found 0.
# Optional: set ALERT_WEBHOOK_URL to POST a JSON payload (Slack/Discord-compatible text).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

COMPOSE=(docker compose -f docker-compose.yml)
HOURS="${ALERT_LOOKBACK_HOURS:-24}"
USER="${POSTGRES_USER:-geouser}"
DB="${POSTGRES_DB:-geo_platform}"

SQL=$(cat <<SQL
WITH latest AS (
  SELECT DISTINCT ON (source_id)
    source_id, status, records_found, error_message, started_at
  FROM crawl_jobs
  WHERE started_at > now() - interval '${HOURS} hours'
  ORDER BY source_id, started_at DESC
)
SELECT
  COUNT(*) FILTER (WHERE status='failed')::int AS failed,
  COUNT(*) FILTER (WHERE status='success' AND COALESCE(records_found,0)=0)::int AS empty_success,
  COUNT(*)::int AS total
FROM latest;
SQL
)

ROW=$("${COMPOSE[@]}" exec -T db psql -U "$USER" -d "$DB" -At -F ',' -c "$SQL")
FAILED=$(echo "$ROW" | cut -d, -f1)
EMPTY=$(echo "$ROW" | cut -d, -f2)
TOTAL=$(echo "$ROW" | cut -d, -f3)

echo "latest crawl jobs last ${HOURS}h: sources=$TOTAL failed=$FAILED empty_success=$EMPTY"

post_webhook() {
  local text="$1"
  if [[ -z "${ALERT_WEBHOOK_URL:-}" ]]; then
    return 0
  fi
  # Slack Incoming Webhook / Discord-compatible {text}; also sends generic {content,text}
  curl -sS -X POST "$ALERT_WEBHOOK_URL" \
    -H 'Content-Type: application/json' \
    -d "$(python3 -c "
import json,sys
print(json.dumps({
  'text': sys.argv[1],
  'content': sys.argv[1],
  'username': 'mapplatform-alert',
}))
" "$text")" >/dev/null || echo "WARN: webhook POST failed" >&2
}

if [[ "${FAILED:-0}" -gt 0 || "${EMPTY:-0}" -gt 0 ]]; then
  DETAIL=$("${COMPOSE[@]}" exec -T db psql -U "$USER" -d "$DB" -At -F ' | ' -c "
    WITH latest AS (
      SELECT DISTINCT ON (j.source_id)
        s.name, j.status, j.records_found, j.error_message, j.started_at
      FROM crawl_jobs j JOIN sources s ON s.id=j.source_id
      WHERE j.started_at > now() - interval '${HOURS} hours'
      ORDER BY j.source_id, j.started_at DESC
    )
    SELECT name || ' ' || status || ' found=' || COALESCE(records_found::text,'null')
    FROM latest
    WHERE status='failed' OR (status='success' AND COALESCE(records_found,0)=0);
  ")
  MSG="ALERT MapPlatform crawl: failed=${FAILED} empty_success=${EMPTY} (last ${HOURS}h)
${DETAIL}"
  echo "ALERT: crawl anomalies detected (latest job per source)"
  echo "$DETAIL"
  post_webhook "$MSG"
  exit 2
fi

echo "OK no crawl alerts"
