#!/usr/bin/env bash
# Step 10 — Patch the Swedish AppStoreVersionLocalization with description,
# keywords, supportUrl, marketingUrl, whatsNew, and copyright.

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

log "Finding editable AppStoreVersion for app $APP_ID..."
VERSIONS=$(asc_get "/apps/$APP_ID/appStoreVersions?filter[platform]=IOS&filter[appVersionState]=PREPARE_FOR_SUBMISSION,READY_FOR_DISTRIBUTION")
VERSION_ID=$(echo "$VERSIONS" | "$PY" -c '
import json, sys
d = json.load(sys.stdin)
data = d["data"]
# Prefer PREPARE_FOR_SUBMISSION (editable) over RFD
for v in data:
    if v["attributes"]["appVersionState"] == "PREPARE_FOR_SUBMISSION":
        print(v["id"]); sys.exit(0)
print(data[0]["id"] if data else "")
')

if [[ -z "$VERSION_ID" ]]; then
  err "No editable App Store version found for app $APP_ID"
  exit 1
fi
ok "AppStoreVersion $VERSION_ID"
echo "$VERSION_ID" > "$BUILD_DIR/app-store-version-id.txt"

# Set copyright on the version
log "Setting version copyright..."
COPY_BODY=$("$PY" -c "
import json
print(json.dumps({
  'data': {
    'type': 'appStoreVersions',
    'id': '$VERSION_ID',
    'attributes': { 'copyright': '© 2026 Sami Lamti' }
  }
}))
")
asc_patch "/appStoreVersions/$VERSION_ID" "$COPY_BODY" >/dev/null
ok "Copyright set"

log "Looking up Swedish AppStoreVersionLocalization..."
LOCS=$(asc_get "/appStoreVersions/$VERSION_ID/appStoreVersionLocalizations")
SV_LOC_ID=$(echo "$LOCS" | "$PY" -c '
import json, sys
d = json.load(sys.stdin)
for l in d["data"]:
    if l["attributes"]["locale"] == "sv":
        print(l["id"]); break
')

DESCRIPTION='Slipp gå hem ensam. Covey kopplar samman grannar som vill gå tillsammans hem nattetid eller bara känna sig tryggare på vägen.

Med ett snabbt BankID-svep ser du andra i din närhet som också vill ha sällskap. Live-position delas bara mellan er två, bara medan ni går. Allt raderas när ni är framme.

Covey är ideellt och drivs ideellt. Inga annonser, ingen säljreklam, ingen profilering. Bara grannar som hjälper grannar.'

KEYWORDS='trygghet,sällskap,promenad,säkerhet,grannskap,covey,frivillig,kvinna'
SUPPORT_URL='https://covey.se'
MARKETING_URL='https://covey.se'
# whatsNew is only valid for v2+ — Apple rejects it on first version

if [[ -z "$SV_LOC_ID" ]]; then
  log "Swedish version localization not found; creating..."
  BODY=$(DESCRIPTION="$DESCRIPTION" KEYWORDS="$KEYWORDS" SUPPORT_URL="$SUPPORT_URL" MARKETING_URL="$MARKETING_URL" "$PY" -c "
import json, os
print(json.dumps({
  'data': {
    'type': 'appStoreVersionLocalizations',
    'attributes': {
      'locale': 'sv',
      'description': os.environ['DESCRIPTION'],
      'keywords': os.environ['KEYWORDS'],
      'supportUrl': os.environ['SUPPORT_URL'],
      'marketingUrl': os.environ['MARKETING_URL'],
    },
    'relationships': {
      'appStoreVersion': { 'data': { 'type': 'appStoreVersions', 'id': '$VERSION_ID' } }
    }
  }
}))
")
  RESPONSE=$(asc_post "/appStoreVersionLocalizations" "$BODY")
  SV_LOC_ID=$(echo "$RESPONSE" | "$PY" -c 'import json,sys; print(json.load(sys.stdin)["data"]["id"])')
  ok "Created Swedish AppStoreVersionLocalization $SV_LOC_ID"
else
  log "Patching Swedish AppStoreVersionLocalization $SV_LOC_ID..."
  BODY=$(DESCRIPTION="$DESCRIPTION" KEYWORDS="$KEYWORDS" SUPPORT_URL="$SUPPORT_URL" MARKETING_URL="$MARKETING_URL" SV_LOC_ID="$SV_LOC_ID" "$PY" -c "
import json, os
print(json.dumps({
  'data': {
    'type': 'appStoreVersionLocalizations',
    'id': os.environ['SV_LOC_ID'],
    'attributes': {
      'description': os.environ['DESCRIPTION'],
      'keywords': os.environ['KEYWORDS'],
      'supportUrl': os.environ['SUPPORT_URL'],
      'marketingUrl': os.environ['MARKETING_URL'],
    }
  }
}))
")
  asc_patch "/appStoreVersionLocalizations/$SV_LOC_ID" "$BODY" >/dev/null
  ok "Patched Swedish AppStoreVersionLocalization"
fi

echo "$SV_LOC_ID" > "$BUILD_DIR/sv-version-localization-id.txt"

# --- Attach the build to this version ---
log "Looking for processed builds..."
BUILDS=$(asc_get "/builds?filter[app]=$APP_ID&sort=-version&limit=5")
BUILD_ID=$(echo "$BUILDS" | "$PY" -c '
import json, sys
d = json.load(sys.stdin)
# Pick most recent build that is processed and valid
for b in d["data"]:
    a = b["attributes"]
    if a.get("processingState") == "VALID":
        print(b["id"]); sys.exit(0)
# Otherwise pick the newest one
if d["data"]:
    print(d["data"][0]["id"])
')

if [[ -n "$BUILD_ID" ]]; then
  log "Attaching build $BUILD_ID to version $VERSION_ID..."
  BUILD_REL_BODY=$("$PY" -c "
import json
print(json.dumps({ 'data': { 'type': 'builds', 'id': '$BUILD_ID' } }))
")
  set +e
  asc_patch "/appStoreVersions/$VERSION_ID/relationships/build" "$BUILD_REL_BODY" >/dev/null 2>&1
  RC=$?
  set -e
  if [[ $RC -eq 0 ]]; then
    ok "Build attached"
  else
    warn "Build not yet processed; relink later or via web UI"
  fi
else
  warn "No build found yet — Apple is still processing the upload"
fi

ok "App Store version localization complete."
