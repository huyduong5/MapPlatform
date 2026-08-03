#!/usr/bin/env bash
# Health checks for local or public endpoints.
set -euo pipefail

API="${API_BASE_URL:-http://localhost:3001}"
WEB="${WEB_BASE_URL:-http://localhost:3002}"
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

echo "Health — API=$API WEB=$WEB"
check_get "locations" "$API/api/locations?limit=1"
check_get "nearby" "$API/api/locations/nearby?latitude=21.0285&longitude=105.8542&radius=3000&limit=1"

if curl -sf --max-time 20 -X POST "$API/api/decide" \
  -H 'Content-Type: application/json' \
  -d '{"query":"pin 10% trạm sạc Times City","limit":1}' | grep -q '"success":true'; then
  echo "OK  decide POST"
else
  echo "FAIL decide POST"
  FAIL=1
fi

if curl -sf --max-time 15 -o /dev/null "$WEB/"; then
  echo "OK  web  $WEB/"
else
  echo "FAIL web  $WEB/"
  FAIL=1
fi

if [[ $FAIL -ne 0 ]]; then
  echo "HEALTH CHECK FAILED"
  exit 1
fi
echo "HEALTH CHECK PASSED"
