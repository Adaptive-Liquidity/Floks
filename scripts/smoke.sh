#!/usr/bin/env bash
set -euo pipefail

BASE="${FLOK_APP_URL:-http://127.0.0.1:8080}"
BASE="${BASE%/}"
HANDLE="smoke$(date +%s | tail -c 6)"
SEED_RESPONSE="$(mktemp)"
DRAIN_RESPONSE="$(mktemp)"
DRAIN_DISABLED_RESPONSE="$(mktemp)"
FLOCK_RESPONSE="$(mktemp)"
CHIRP_RESPONSE="$(mktemp)"
PAGE_FILE="$(mktemp)"
RACK_RESPONSE="$(mktemp)"
THIN_RACK_RESPONSE="$(mktemp)"
OG_IMAGE="$(mktemp)"
BAD_RESPONSE="$(mktemp)"
trap 'rm -f "$SEED_RESPONSE" "$DRAIN_RESPONSE" "$DRAIN_DISABLED_RESPONSE" "$FLOCK_RESPONSE" "$CHIRP_RESPONSE" "$PAGE_FILE" "$RACK_RESPONSE" "$THIN_RACK_RESPONSE" "$OG_IMAGE" "$BAD_RESPONSE"' EXIT

echo "smoke against $BASE handle=$HANDLE"

health="$(curl -sf "$BASE/api/health")"
echo "$health" | grep -q '"ok":true'

health_legacy="$(curl -s -o /dev/null -w "%{http_code}" "$BASE/health")"
test "$health_legacy" = "404"

seed_status="$(curl -s -o "$SEED_RESPONSE" -w "%{http_code}" -X POST "$BASE/api/v1/seed")"
test "$seed_status" = "403"
grep -q seed_disabled "$SEED_RESPONSE"

drain_status="$(curl -s -o "$DRAIN_RESPONSE" -w "%{http_code}" -X POST "$BASE/api/internal/oc-evidence/drain")"
test "$drain_status" = "401"
grep -q unauthorized "$DRAIN_RESPONSE"

if [ -n "${FLOK_OC_DRAIN_SECRET:-}" ]; then
  drain_disabled_status="$(curl -s -o "$DRAIN_DISABLED_RESPONSE" -w "%{http_code}" \
    -X POST "$BASE/api/internal/oc-evidence/drain" \
    -H "authorization: Bearer $FLOK_OC_DRAIN_SECRET")"
  test "$drain_disabled_status" = "503"
  grep -q staging_egress_disabled "$DRAIN_DISABLED_RESPONSE"
fi

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
  >"$FLOCK_RESPONSE"

curl -sf -X POST "$BASE/api/v1/chirps" \
  -H "authorization: Bearer $token" \
  -H 'content-type: application/json' \
  -d '{"bird":"Maya","text":"Drafted 12 follow-ups"}' \
  >"$CHIRP_RESPONSE"

curl -sf "$BASE/$HANDLE" -o "$PAGE_FILE"
grep -a -q "Clusters" "$PAGE_FILE"
grep -a -q "Crew" "$PAGE_FILE"
# Per-crew share card must survive HTML (Grok PWA must not overwrite og:image).
grep -a -E "property=[\"']og:image[\"'][^>]*content=[\"'][^\"']*/$HANDLE/opengraph-image|content=[\"'][^\"']*/$HANDLE/opengraph-image[\"'][^>]*property=[\"']og:image[\"']" "$PAGE_FILE"
if grep -a -q "grok-app-builder/extensions.js" "$PAGE_FILE"; then
  echo "unexpected grok extensions.js on crew page" >&2
  exit 1
fi
if grep -a -q '/__grok/manifest' "$PAGE_FILE"; then
  echo "unexpected /__grok/manifest on crew page" >&2
  exit 1
fi
if grep -a -q '/__grok/icon-180.png' "$PAGE_FILE"; then
  echo "unexpected /__grok/icon-180.png on crew page" >&2
  exit 1
fi
if grep -a -q 'x:game' "$PAGE_FILE"; then
  echo "unexpected x:game metadata on crew page" >&2
  exit 1
fi

curl -sf "$BASE/$HANDLE/c/crew" -o "$PAGE_FILE"
grep -a -q "Maya" "$PAGE_FILE"
grep -a -q "Roost" "$PAGE_FILE"

jarvis_id="$(python3 -c 'import json,sys; from pathlib import Path; birds=json.loads(Path(sys.argv[1]).read_text()).get("birds") or []; print(next(b["id"] for b in birds if b.get("name")=="Jarvis"))' "$FLOCK_RESPONSE")"
test -n "$jarvis_id"
curl -sf -X PUT "$BASE/api/v1/birds/$jarvis_id" \
  -H "authorization: Bearer $token" \
  -H 'content-type: application/json' \
  -d '{"state":"racing"}' >/dev/null
curl -sf "$BASE/$HANDLE/c/crew" -o "$PAGE_FILE"
grep -a -q "racing" "$PAGE_FILE"

curl -sf -X POST "$BASE/api/v1/flocks" \
  -H "authorization: Bearer $token" \
  -H 'content-type: application/json' \
  -d '{"title":"Smoke","bio":"Two birds. One test.","birds":[{"name":"Jarvis","role":"Chief of staff","cluster":"Studio"},{"name":"Maya","role":"Sales","cluster":"Desk"}]}' \
  >"$FLOCK_RESPONSE"

curl -sf "$BASE/$HANDLE" -o "$PAGE_FILE"
grep -a -q "Studio" "$PAGE_FILE"
grep -a -q "Desk" "$PAGE_FILE"

curl -sf "$BASE/$HANDLE/c/desk" -o "$PAGE_FILE"
grep -a -q "Maya" "$PAGE_FILE"

crew_code="$(curl -s -o /dev/null -w "%{http_code}" "$BASE/$HANDLE/c/crew")"
test "$crew_code" = "404"

curl -sf -X PUT "$BASE/api/v1/racks" \
  -H "authorization: Bearer $token" \
  -H 'content-type: application/json' \
  -d '{"name":"Shift","clusters":["studio","desk"]}' >"$RACK_RESPONSE"
curl -sf "$BASE/$HANDLE" -o "$PAGE_FILE"
grep -a -q "Shift" "$PAGE_FILE"
grep -a -q "Racks" "$PAGE_FILE"
curl -sf "$BASE/$HANDLE/r/shift" -o "$PAGE_FILE"
grep -a -q "Rack" "$PAGE_FILE"
grep -a -q "Studio" "$PAGE_FILE"
grep -a -q "Desk" "$PAGE_FILE"
grep -a -q "Maya" "$PAGE_FILE"
grep -a -q "Jarvis" "$PAGE_FILE"
thin_rack="$(curl -s -o "$THIN_RACK_RESPONSE" -w "%{http_code}" -X PUT "$BASE/api/v1/racks" \
  -H "authorization: Bearer $token" \
  -H 'content-type: application/json' \
  -d '{"name":"Thin","clusters":["desk"]}')"
test "$thin_rack" = "400"

og_code="$(curl -s -o "$OG_IMAGE" -w "%{http_code}" "$BASE/$HANDLE/opengraph-image")"
test "$og_code" = "200"
python3 - "$OG_IMAGE" <<'PY'
from pathlib import Path
import sys
p = Path(sys.argv[1]).read_bytes()[:8]
assert p == bytes.fromhex("89504e470d0a1a0a"), p
print("og png ok")
PY

status="$(curl -s -o "$BAD_RESPONSE" -w "%{http_code}" -X POST "$BASE/api/v1/chirps" \
  -H "authorization: Bearer $token" \
  -H 'content-type: application/json' \
  -d '{"bird":"Jarvis","text":"here is sk-test secret"}')"
test "$status" = "400"

echo "smoke ok"
