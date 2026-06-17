#!/usr/bin/env bash
# List the app's existing TestFlight builds and print the next build number.
#
# Run BEFORE shipping (the pipeline does NOT auto-increment): the value it
# prints is what BUILD_NUMBER in .env.ios must be set to, or `altool` rejects
# the upload as a duplicate.
#
# Usage:
#   scripts/ios/list-builds.sh
#
# Reads APP_BUNDLE_ID + the ASC API key from scripts/ios/.env.ios (via common.sh).
# No arguments. Read-only (GET requests only).

set -euo pipefail
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"
# shellcheck source=lib/asc-jwt.sh
source "$SCRIPT_DIR/lib/asc-jwt.sh"
# shellcheck source=lib/asc-curl.sh
source "$SCRIPT_DIR/lib/asc-curl.sh"

log "Bundle=$APP_BUNDLE_ID  MarketingVersion=$MARKETING_VERSION  BUILD_NUMBER(.env)=$BUILD_NUMBER"

APP_JSON=$(asc_get "/apps?filter[bundleId]=$APP_BUNDLE_ID&limit=1") || {
  err "App Store Connect query failed (check .env.ios credentials)."; exit 1; }
APP_ID=$(printf '%s' "$APP_JSON" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['data'][0]['id'] if d.get('data') else '')")
[[ -n "$APP_ID" ]] || { err "No app found for bundle id $APP_BUNDLE_ID"; exit 1; }
ok "App id: $APP_ID"

BUILDS=$(asc_get "/builds?filter[app]=$APP_ID&limit=50&sort=-uploadedDate&fields[builds]=version,uploadedDate,processingState,expired") || {
  err "Builds query failed."; exit 1; }

printf '%s' "$BUILDS" | python3 -c "
import sys, json
d = json.load(sys.stdin); rows = d.get('data', [])
print('Existing builds (%d):' % len(rows))
nums = []
for b in rows:
    a = b['attributes']; v = a.get('version'); nums.append(v)
    print('  build %-4s | %-12s | expired=%s | %s' % (v, a.get('processingState'), a.get('expired'), a.get('uploadedDate')))
if not rows:
    print('  (none uploaded yet)')
ints = [int(n) for n in nums if n and str(n).isdigit()]
nxt = (max(ints) + 1) if ints else 1
print()
print('NEXT build number -> set BUILD_NUMBER=%d in scripts/ios/.env.ios' % nxt)
"
