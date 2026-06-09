#!/usr/bin/env bash
# Step 09 — Patch the Swedish AppInfoLocalization with name, subtitle, privacyPolicyUrl
# and set primary category on the AppInfo itself.

set -euo pipefail
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"
# shellcheck source=lib/asc-jwt.sh
source "$SCRIPT_DIR/lib/asc-jwt.sh"
# shellcheck source=lib/asc-curl.sh
source "$SCRIPT_DIR/lib/asc-curl.sh"

APP_ID=$(cat "$BUILD_DIR/app-resource-id.txt")
PY="$SCRIPT_IOS_DIR/.venv/bin/python3"

log "Looking up editable AppInfo for app $APP_ID..."
APP_INFOS=$(asc_get "/apps/$APP_ID/appInfos")
APP_INFO_ID=$(echo "$APP_INFOS" | "$PY" -c '
import json, sys
d = json.load(sys.stdin)
for ai in d["data"]:
    if ai["attributes"]["state"] == "PREPARE_FOR_SUBMISSION":
        print(ai["id"]); break
')
[[ -n "$APP_INFO_ID" ]] || { err "No editable AppInfo found"; exit 1; }
ok "AppInfo $APP_INFO_ID"
echo "$APP_INFO_ID" > "$BUILD_DIR/app-info-id.txt"

log "Looking up Swedish AppInfoLocalization..."
LOCS=$(asc_get "/appInfos/$APP_INFO_ID/appInfoLocalizations")
SV_LOC_ID=$(echo "$LOCS" | "$PY" -c '
import json, sys
d = json.load(sys.stdin)
for l in d["data"]:
    if l["attributes"]["locale"] == "sv":
        print(l["id"]); break
')

if [[ -z "$SV_LOC_ID" ]]; then
  log "Swedish localization not found; creating..."
  BODY=$("$PY" -c "
import json
print(json.dumps({
  'data': {
    'type': 'appInfoLocalizations',
    'attributes': {
      'locale': 'sv',
      'name': 'Covey',
      'subtitle': 'Gå tryggt hem tillsammans',
      'privacyPolicyUrl': 'https://covey.se/privacy',
    },
    'relationships': {
      'appInfo': { 'data': { 'type': 'appInfos', 'id': '$APP_INFO_ID' } }
    }
  }
}))
")
  RESPONSE=$(asc_post "/appInfoLocalizations" "$BODY")
  SV_LOC_ID=$(echo "$RESPONSE" | "$PY" -c 'import json,sys; print(json.load(sys.stdin)["data"]["id"])')
  ok "Created Swedish AppInfoLocalization $SV_LOC_ID"
else
  log "Patching Swedish AppInfoLocalization $SV_LOC_ID..."
  BODY=$("$PY" -c "
import json
print(json.dumps({
  'data': {
    'type': 'appInfoLocalizations',
    'id': '$SV_LOC_ID',
    'attributes': {
      'name': 'Covey',
      'subtitle': 'Gå tryggt hem tillsammans',
      'privacyPolicyUrl': 'https://covey.se/privacy',
    }
  }
}))
")
  asc_patch "/appInfoLocalizations/$SV_LOC_ID" "$BODY" >/dev/null
  ok "Patched Swedish AppInfoLocalization"
fi

# --- Set primary category — required for review ---
# Categories: SOCIAL_NETWORKING, LIFESTYLE, HEALTH_AND_FITNESS, NAVIGATION, UTILITIES.
# 'Lifestyle' fits best for a community-safety app.
# Note: must be PATCHed via the appInfo resource itself; the relationship
# endpoint rejects UPDATE.
log "Setting primary category to LIFESTYLE..."
CAT_BODY=$("$PY" -c "
import json
print(json.dumps({
  'data': {
    'type': 'appInfos',
    'id': '$APP_INFO_ID',
    'relationships': {
      'primaryCategory': { 'data': { 'type': 'appCategories', 'id': 'LIFESTYLE' } }
    }
  }
}))
")
asc_patch "/appInfos/$APP_INFO_ID" "$CAT_BODY" >/dev/null
ok "Primary category set"

ok "App info localization complete."
