#!/usr/bin/env bash
set -euo pipefail

BASE="${FLOK_APP_URL:-http://127.0.0.1:8080}"
BASE="${BASE%/}"
HANDLE="smoke$(date +%s | tail -c 6)"

echo "smoke against $BASE handle=$HANDLE"

health="$(curl -sf "$BASE/api/health")"
echo "$health" | grep -q '"ok":true'

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
grep -a -q "Maya" "$page_file"
rm -f "$page_file"

status="$(curl -s -o /tmp/flok-bad.json -w "%{http_code}" -X POST "$BASE/api/v1/chirps" \
  -H "authorization: Bearer $token" \
  -H 'content-type: application/json' \
  -d '{"bird":"Jarvis","text":"here is sk-test secret"}')"
test "$status" = "400"

echo "smoke ok"
