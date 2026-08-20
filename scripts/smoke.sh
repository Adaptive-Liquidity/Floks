#!/usr/bin/env bash
set -euo pipefail

BASE="${FLOK_APP_URL:-http://127.0.0.1:8080}"
BASE="${BASE%/}"
HANDLE="smoke$(date +%s | tail -c 6)"

echo "smoke against $BASE handle=$HANDLE"

health="$(curl -sf "$BASE/api/health")"
echo "$health" | grep -q '"ok":true'

health_legacy="$(curl -s -o /dev/null -w "%{http_code}" "$BASE/health")"
test "$health_legacy" = "404"

seed_status="$(curl -s -o /tmp/flok-seed.json -w "%{http_code}" -X POST "$BASE/api/v1/seed")"
test "$seed_status" = "403"
grep -q seed_disabled /tmp/flok-seed.json

join="$(curl -sf -X POST "$BASE/api/v1/join" \
  -H 'content-type: application/json' \
  -d "{\"handle\":\"$HANDLE\"}")"
echo "$join"
code="$(printf '%s' "$join" | sed -n 's/.*"code":"\([^"]*\)".*/\1/p')"
test -n "$code"

claim="$(curl -sf -X POST "$BASE/api/v1/claim" \
  -H 'content-type: application/json' \
  -d "{\"code\":\"$code\"}")"
echo "$claim"
token="$(printf '%s' "$claim" | sed -n 's/.*"flock_token":"\([^"]*\)".*/\1/p')"
test -n "$token"

curl -sf -X POST "$BASE/api/v1/flocks" \
  -H "authorization: Bearer $token" \
  -H 'content-type: application/json' \
  -d '{"title":"Smoke","bio":"Two birds. One test.","birds":[{"name":"Jarvis","role":"Chief of staff"},{"name":"Maya","role":"Sales"}]}' \
  >/tmp/flok-flock.json

curl -sf -X POST "$BASE/api/v1/chirps" \
  -H "authorization: Bearer $token" \
  -H 'content-type: application/json' \
  -d '{"bird":"Maya","text":"Drafted 12 follow-ups"}' \
  >/tmp/flok-chirp.json

page_file="$(mktemp)"
curl -sf "$BASE/$HANDLE" -o "$page_file"
grep -a -q "Clusters" "$page_file"
grep -a -q "Crew" "$page_file"

curl -sf "$BASE/$HANDLE/c/crew" -o "$page_file"
grep -a -q "Maya" "$page_file"
grep -a -q "Roost" "$page_file"

jarvis_id="$(python3 -c 'import json; from pathlib import Path; birds=json.loads(Path("/tmp/flok-flock.json").read_text()).get("birds") or []; print(next(b["id"] for b in birds if b.get("name")=="Jarvis"))')"
test -n "$jarvis_id"
curl -sf -X PUT "$BASE/api/v1/birds/$jarvis_id" \
  -H "authorization: Bearer $token" \
  -H 'content-type: application/json' \
  -d '{"state":"racing"}' >/dev/null
curl -sf "$BASE/$HANDLE/c/crew" -o "$page_file"
grep -a -q "racing" "$page_file"

curl -sf -X POST "$BASE/api/v1/flocks" \
  -H "authorization: Bearer $token" \
  -H 'content-type: application/json' \
  -d '{"title":"Smoke","bio":"Two birds. One test.","birds":[{"name":"Jarvis","role":"Chief of staff","cluster":"Studio"},{"name":"Maya","role":"Sales","cluster":"Desk"}]}' \
  >/tmp/flok-flock.json

curl -sf "$BASE/$HANDLE" -o "$page_file"
grep -a -q "Studio" "$page_file"
grep -a -q "Desk" "$page_file"

curl -sf "$BASE/$HANDLE/c/desk" -o "$page_file"
grep -a -q "Maya" "$page_file"

crew_code="$(curl -s -o /dev/null -w "%{http_code}" "$BASE/$HANDLE/c/crew")"
test "$crew_code" = "404"

curl -sf -X PUT "$BASE/api/v1/racks" \
  -H "authorization: Bearer $token" \
  -H 'content-type: application/json' \
  -d '{"name":"Shift","clusters":["studio","desk"]}' >/tmp/flok-rack.json
curl -sf "$BASE/$HANDLE" -o "$page_file"
grep -a -q "Shift" "$page_file"
grep -a -q "Racks" "$page_file"
curl -sf "$BASE/$HANDLE/r/shift" -o "$page_file"
grep -a -q "Rack" "$page_file"
grep -a -q "Studio" "$page_file"
grep -a -q "Desk" "$page_file"
grep -a -q "Maya" "$page_file"
grep -a -q "Jarvis" "$page_file"
thin_rack="$(curl -s -o /tmp/flok-thin-rack.json -w "%{http_code}" -X PUT "$BASE/api/v1/racks" \
  -H "authorization: Bearer $token" \
  -H 'content-type: application/json' \
  -d '{"name":"Thin","clusters":["desk"]}')"
test "$thin_rack" = "400"
rm -f "$page_file"

og_code="$(curl -s -o /tmp/flok-og.png -w "%{http_code}" "$BASE/$HANDLE/opengraph-image")"
test "$og_code" = "200"
python3 - <<'PY'
from pathlib import Path
p = Path("/tmp/flok-og.png").read_bytes()[:8]
assert p == bytes.fromhex("89504e470d0a1a0a"), p
print("og png ok")
PY

status="$(curl -s -o /tmp/flok-bad.json -w "%{http_code}" -X POST "$BASE/api/v1/chirps" \
  -H "authorization: Bearer $token" \
  -H 'content-type: application/json' \
  -d '{"bird":"Jarvis","text":"here is sk-test secret"}')"
test "$status" = "400"

echo "smoke ok"
