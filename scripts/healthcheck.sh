#!/usr/bin/env bash
# Health checks for local or public endpoints (monolith app).
set -euo pipefail

APP="${APP_BASE_URL:-${API_BASE_URL:-http://localhost:3001}}"
FAIL=0

check_get() {
  local name="$1" url="$2"
  if curl -sf --max-time 15 "$url" >/dev/null; then
    echo "OK  $name  $url"
  else
    echo "FAIL $name  $url"
    FAIL=1
  fi
}

echo "Health — APP=$APP"
check_get "map" "$APP/"
check_get "locations" "$APP/api/locations?limit=1"
check_get "cities" "$APP/api/cities"
check_get "nearby" "$APP/api/locations/nearby?latitude=21.0285&longitude=105.8542&radius=3000&limit=1"

if curl -sf --max-time 20 -X POST "$APP/api/decide" \
  -H 'Content-Type: application/json' \
  -d '{"query":"pin 10% trạm sạc Times City","limit":1}' | grep -q '"success":true'; then
  echo "OK  decide POST"
else
  echo "FAIL decide POST"
  FAIL=1
fi

if [[ $FAIL -ne 0 ]]; then
  echo "HEALTH CHECK FAILED"
  exit 1
fi
echo "HEALTH CHECK PASSED"
