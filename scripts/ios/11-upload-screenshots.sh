#!/usr/bin/env bash
# Step 11 — Upload PNGs from build/ios/screenshots/ to App Store Connect.
#
# For each PNG, ensure an APP_IPHONE_69 AppScreenshotSet exists on the
# Swedish AppStoreVersionLocalization, then upload using the 3-step
# reservation protocol from lib/asc-asset-upload.sh.

set -euo pipefail
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"
# shellcheck source=lib/asc-jwt.sh
source "$SCRIPT_DIR/lib/asc-jwt.sh"
# shellcheck source=lib/asc-curl.sh
source "$SCRIPT_DIR/lib/asc-curl.sh"
# shellcheck source=lib/asc-asset-upload.sh
source "$SCRIPT_DIR/lib/asc-asset-upload.sh"

PY="$SCRIPT_IOS_DIR/.venv/bin/python3"
SHOTS_DIR="$BUILD_DIR/screenshots"
SV_LOC_ID=$(cat "$BUILD_DIR/sv-version-localization-id.txt")

[[ -d "$SHOTS_DIR" ]] || { err "$SHOTS_DIR not found. Run 08-screenshots.sh first."; exit 1; }

# --- Find or create the APP_IPHONE_69 screenshot set ---
DISPLAY_TYPE="APP_IPHONE_69"
log "Looking for existing $DISPLAY_TYPE screenshot set on locale $SV_LOC_ID..."
SETS=$(asc_get "/appStoreVersionLocalizations/$SV_LOC_ID/appScreenshotSets")
SET_ID=$(echo "$SETS" | "$PY" -c "
import json, sys
d = json.load(sys.stdin)
for s in d.get('data', []):
    if s['attributes']['screenshotDisplayType'] == '$DISPLAY_TYPE':
        print(s['id']); break
")

if [[ -z "$SET_ID" ]]; then
  log "Creating $DISPLAY_TYPE screenshot set..."
  BODY=$("$PY" -c "
import json
print(json.dumps({
  'data': {
    'type': 'appScreenshotSets',
    'attributes': { 'screenshotDisplayType': '$DISPLAY_TYPE' },
    'relationships': {
      'appStoreVersionLocalization': {
        'data': { 'type': 'appStoreVersionLocalizations', 'id': '$SV_LOC_ID' }
      }
    }
  }
}))
")
  RESP=$(asc_post "/appScreenshotSets" "$BODY")
  SET_ID=$(echo "$RESP" | "$PY" -c 'import json,sys; print(json.load(sys.stdin)["data"]["id"])')
fi
ok "Screenshot set $SET_ID"

# --- Upload each PNG ---
shopt -s nullglob
PNGS=("$SHOTS_DIR"/*.png)
[[ ${#PNGS[@]} -gt 0 ]] || { err "No PNGs in $SHOTS_DIR"; exit 1; }

UPLOADED_IDS=()
for png in "${PNGS[@]}"; do
  fname=$(basename "$png")
  size=$(stat -f%z "$png")
  log "Uploading $fname ($size bytes)..."

  CREATE_BODY=$("$PY" -c "
import json
print(json.dumps({
  'data': {
    'type': 'appScreenshots',
    'attributes': { 'fileSize': $size, 'fileName': '$fname' },
    'relationships': {
      'appScreenshotSet': { 'data': { 'type': 'appScreenshotSets', 'id': '$SET_ID' } }
    }
  }
}))
")

  ASSET_ID=$(asc_upload_asset "/appScreenshots" "$CREATE_BODY" "$png")
  UPLOADED_IDS+=("$ASSET_ID")
  ok "  → asset $ASSET_ID"
done

ok "Uploaded ${#UPLOADED_IDS[@]} screenshot(s)."
echo "View: https://appstoreconnect.apple.com/apps/$(cat "$BUILD_DIR/app-resource-id.txt")/distribution/info"
