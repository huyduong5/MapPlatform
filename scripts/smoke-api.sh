#!/usr/bin/env bash
# Simple Phase 1 smoke / integration checks (API + DB seed/crawl assumptions)
set -euo pipefail
API="${API_BASE_URL:-http://localhost:3001}"

echo "== GET /api/locations =="
curl -sf "$API/api/locations?status=active&limit=5" | python3 -c "
import sys, json
d=json.load(sys.stdin)
assert d.get('success') is True, d
assert isinstance(d.get('data'), list)
print('ok locations', len(d['data']))
"

echo "== GET /api/locations/nearby =="
curl -sf "$API/api/locations/nearby?latitude=20.995&longitude=105.862&radius=8000&limit=5" | python3 -c "
import sys, json
d=json.load(sys.stdin)
assert d.get('success') is True, d
assert 'data' in d
if d['data']:
  assert 'distanceKm' in d['data'][0]
print('ok nearby', len(d['data']))
"

echo "== GET search =="
curl -sf "$API/api/locations?search=Times&status=active" | python3 -c "
import sys, json
d=json.load(sys.stdin)
assert d.get('success') is True
print('ok search', len(d['data']))
"

echo "== GET filter type =="
curl -sf "$API/api/locations?type=charging_station&status=active" | python3 -c "
import sys, json
d=json.load(sys.stdin)
assert d.get('success') is True
assert all(x['type']=='charging_station' for x in d['data'])
print('ok filter', len(d['data']))
"

echo "== POST /api/decide =="
curl -sf -X POST "$API/api/decide" \
  -H 'Content-Type: application/json' \
  -d '{"query":"Xe tôi gần Times City, pin còn 10%, tìm trạm sạc phù hợp nhất.","limit":3}' | python3 -c "
import sys, json
d=json.load(sys.stdin)
assert d.get('success') is True, d
data=d['data']
assert data['intent']['intent']=='find_charging'
assert data['intent']['batteryPercent']==10
assert 'recommendations' in data
assert 'explanation' in data
print('ok decide', len(data['recommendations']), data['anchor']['label'])
"

echo "== GET bbox viewport =="
curl -sf "$API/api/locations?status=active&minLat=20.95&maxLat=21.05&minLng=105.80&maxLng=105.90&limit=50" | python3 -c "
import sys, json
d=json.load(sys.stdin)
assert d.get('success') is True, d
print('ok bbox', len(d['data']))
"

echo "== GET admin crawl-stats =="
curl -sf "$API/api/admin/crawl-stats" | python3 -c "
import sys, json
d=json.load(sys.stdin)
assert d.get('success') is True, d
assert 'locationsByType' in d['data']
print('ok crawl-stats', d['data']['locationsByType'])
"

echo "== GET /api/health =="
curl -sf "$API/api/health" | python3 -c "
import sys, json
d=json.load(sys.stdin)
assert d.get('success') is True
assert d['data']['status']=='ok'
print('ok health', d['data']['db'])
"

echo "== GET /api/metrics =="
curl -sf "$API/api/metrics" | python3 -c "
import sys, json
d=json.load(sys.stdin)
assert d.get('success') is True
assert 'locationsByType' in d['data']
print('ok metrics types', len(d['data']['locationsByType']))
"

echo "== GET phase6 types =="
for t in dealer parking rescue_team; do
  curl -sf "$API/api/locations?type=$t&status=active" | python3 -c "
import sys, json
d=json.load(sys.stdin)
assert d.get('success') is True
assert all(x['type']=='$t' for x in d['data'])
print('ok', '$t', len(d['data']))
"
done

echo "== GET /api/cities =="
curl -sf "$API/api/cities" | python3 -c "
import sys, json
d=json.load(sys.stdin)
assert d.get('success') is True, d
codes={c['code'] for c in d['data']}
assert 'hanoi' in codes and 'hcm' in codes
print('ok cities', [(c['code'], c['locationCount']) for c in d['data']])
"

echo "== GET locations city=hcm =="
curl -sf "$API/api/locations?city=hcm&status=active&limit=20" | python3 -c "
import sys, json
d=json.load(sys.stdin)
assert d.get('success') is True, d
assert len(d['data']) >= 1, d
assert all(x.get('city')=='hcm' for x in d['data'])
print('ok hcm', len(d['data']))
"

echo "== GET locations city=danang =="
curl -sf "$API/api/locations?city=danang&status=active&limit=20" | python3 -c "
import sys, json
d=json.load(sys.stdin)
assert d.get('success') is True, d
assert len(d['data']) >= 1, d
assert all(x.get('city')=='danang' for x in d['data'])
print('ok danang', len(d['data']))
"

echo "== POST decide city=hcm =="
curl -sf -X POST "$API/api/decide" \
  -H 'Content-Type: application/json' \
  -d '{"query":"Tìm trạm sạc gần Landmark 81","city":"hcm","limit":3}' | python3 -c "
import sys, json
d=json.load(sys.stdin)
assert d.get('success') is True, d
recs=d['data']['recommendations']
assert all(r.get('city','hcm')=='hcm' for r in recs), recs
print('ok decide-hcm', len(recs), d['data']['anchor']['label'])
"

echo "== GET admin CSV export =="
curl -sf "$API/api/admin/export/locations.csv?city=hanoi" | python3 -c "
import sys
body=sys.stdin.read()
assert body.startswith('id,city,type'), body[:80]
assert 'hanoi' in body
print('ok csv lines', body.count(chr(10))+1)
"

echo "ALL SMOKE CHECKS PASSED"
