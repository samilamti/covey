#!/usr/bin/env bash
# Step 04 — Create the App Store Connect app entry (idempotent).
# Requires: bundle ID already registered (step 03).
# Note: API key role must be App Manager or higher to create apps.

set -euo pipefail
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"
# shellcheck source=lib/asc-jwt.sh
source "$SCRIPT_DIR/lib/asc-jwt.sh"
# shellcheck source=lib/asc-curl.sh
source "$SCRIPT_DIR/lib/asc-curl.sh"

log "Checking if app '$APP_BUNDLE_ID' already exists in App Store Connect..."
EXISTING=$(asc_get "/apps?filter[bundleId]=$APP_BUNDLE_ID&limit=1")
APP_RESOURCE_ID=$(printf '%s' "$EXISTING" | python3 -c '
import json, sys
d = json.load(sys.stdin)
data = d.get("data", [])
print(data[0]["id"] if data else "")
')

if [[ -n "$APP_RESOURCE_ID" ]]; then
  ok "App already exists in App Store Connect (id=$APP_RESOURCE_ID)"
  echo "$APP_RESOURCE_ID" > "$BUILD_DIR/app-resource-id.txt"
  exit 0
fi

# Need the bundle ID resource ID from step 03
BUNDLE_ID_FILE="$BUILD_DIR/bundle-id-resource-id.txt"
if [[ ! -f "$BUNDLE_ID_FILE" ]]; then
  err "$BUNDLE_ID_FILE not found. Run 03-register-bundle-id.sh first."
  exit 1
fi
BUNDLE_ID_RESOURCE_ID=$(cat "$BUNDLE_ID_FILE")

log "Creating app entry (bundleId=$APP_BUNDLE_ID, name=$APP_NAME, sku=$APP_SKU)..."
BODY=$(python3 -c "
import json, os
print(json.dumps({
  'data': {
    'type': 'apps',
    'attributes': {
      'bundleId': os.environ['APP_BUNDLE_ID'],
      'name': os.environ['APP_NAME'],
      'primaryLocale': os.environ.get('PRIMARY_LOCALE', 'en-US'),
      'sku': os.environ['APP_SKU'],
    },
    'relationships': {
      'bundleId': {
        'data': { 'type': 'bundleIds', 'id': '$BUNDLE_ID_RESOURCE_ID' }
      }
    }
  }
}))
")

set +e
RESPONSE=$(asc_post "/apps" "$BODY" 2>&1)
RC=$?
set -e

if [[ $RC -ne 0 ]]; then
  if printf '%s' "$RESPONSE" | grep -qE "FORBIDDEN_ERROR|FORBIDDEN"; then
    err "API key lacks permission to create apps. Required role: App Manager or Account Holder."
    err "Either:"
    err "  1) Recreate the API key in App Store Connect with 'App Manager' role, OR"
    err "  2) Create the app entry manually in App Store Connect web UI:"
    err "     https://appstoreconnect.apple.com/apps  →  '+'  →  New App"
    err "     Bundle ID: $APP_BUNDLE_ID"
    err "     Name:      $APP_NAME"
    err "     SKU:       $APP_SKU"
    err "     Primary language: $PRIMARY_LOCALE"
    err "  Then rerun this script — it will detect the existing app and skip."
    exit 1
  fi
  err "App creation failed:"
  printf '%s\n' "$RESPONSE" >&2
  exit 1
fi

APP_RESOURCE_ID=$(printf '%s' "$RESPONSE" | python3 -c 'import json,sys; print(json.load(sys.stdin)["data"]["id"])')
echo "$APP_RESOURCE_ID" > "$BUILD_DIR/app-resource-id.txt"
ok "App created (id=$APP_RESOURCE_ID)"
