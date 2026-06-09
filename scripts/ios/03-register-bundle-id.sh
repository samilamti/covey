#!/usr/bin/env bash
# Step 03 — Register the bundle ID with Apple Developer (idempotent)
#          and enable PUSH_NOTIFICATIONS capability.

set -euo pipefail
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"
# shellcheck source=lib/asc-jwt.sh
source "$SCRIPT_DIR/lib/asc-jwt.sh"
# shellcheck source=lib/asc-curl.sh
source "$SCRIPT_DIR/lib/asc-curl.sh"

log "Checking if bundle ID '$APP_BUNDLE_ID' is already registered..."
EXISTING=$(asc_get "/bundleIds?filter[identifier]=$APP_BUNDLE_ID&limit=1")
BUNDLE_ID_RESOURCE_ID=$(printf '%s' "$EXISTING" | python3 -c '
import json, sys
d = json.load(sys.stdin)
data = d.get("data", [])
print(data[0]["id"] if data else "")
')

if [[ -n "$BUNDLE_ID_RESOURCE_ID" ]]; then
  ok "Bundle ID already registered (id=$BUNDLE_ID_RESOURCE_ID)"
else
  log "Registering bundle ID $APP_BUNDLE_ID..."
  # Apple requires the human-readable name to be alphanumeric + spaces — strip anything else
  SAFE_NAME=$(printf '%s' "$APP_NAME" | LC_ALL=C tr -cd '[:alnum:] ')
  BODY=$(python3 -c "
import json, os
print(json.dumps({
  'data': {
    'type': 'bundleIds',
    'attributes': {
      'identifier': os.environ['APP_BUNDLE_ID'],
      'name': '$SAFE_NAME',
      'platform': 'IOS',
    },
  }
}))
")
  RESPONSE=$(asc_post "/bundleIds" "$BODY")
  BUNDLE_ID_RESOURCE_ID=$(printf '%s' "$RESPONSE" | python3 -c 'import json,sys; print(json.load(sys.stdin)["data"]["id"])')
  ok "Registered bundle ID (id=$BUNDLE_ID_RESOURCE_ID)"
fi

# Persist the resource ID for the next script
mkdir -p "$BUILD_DIR"
echo "$BUNDLE_ID_RESOURCE_ID" > "$BUILD_DIR/bundle-id-resource-id.txt"

# --- Enable Push Notifications capability ---
log "Ensuring PUSH_NOTIFICATIONS capability is enabled..."
CAP_BODY=$(python3 -c "
import json
print(json.dumps({
  'data': {
    'type': 'bundleIdCapabilities',
    'attributes': { 'capabilityType': 'PUSH_NOTIFICATIONS' },
    'relationships': {
      'bundleId': { 'data': { 'type': 'bundleIds', 'id': '$BUNDLE_ID_RESOURCE_ID' } }
    }
  }
}))
")

# Capture both stdout and the exit code without aborting on non-2xx
set +e
CAP_RESPONSE=$(asc_post "/bundleIdCapabilities" "$CAP_BODY" 2>&1)
CAP_RC=$?
set -e

if [[ $CAP_RC -eq 0 ]]; then
  ok "Push Notifications capability enabled"
elif printf '%s' "$CAP_RESPONSE" | grep -q "ENTITY_ERROR.ATTRIBUTE.INVALID.DUPLICATE\|already exists\|409"; then
  ok "Push Notifications capability already enabled"
else
  warn "Could not enable Push Notifications capability (may already be set):"
  printf '%s\n' "$CAP_RESPONSE" >&2
fi

ok "Bundle ID registration complete."
