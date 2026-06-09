#!/usr/bin/env bash
# Step 01 — Ensure frontend/android/app/google-services.json exists.
# Registers the Android app in the Firebase project (idempotent) and downloads
# its config via the Firebase Management API. Falls back to manual instructions
# if the gcloud account can't access the project.

set -euo pipefail
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

DEST="$ANDROID_PROJECT/app/google-services.json"
PROJ="${FIREBASE_PROJECT_ID:?FIREBASE_PROJECT_ID not set}"

if [[ -f "$DEST" ]] && python3 -c "import json,sys; d=json.load(open('$DEST')); sys.exit(0 if any(c['client_info']['android_client_info']['package_name']=='$PACKAGE_NAME' for c in d['client']) else 1)" 2>/dev/null; then
  ok "google-services.json already present for $PACKAGE_NAME"
  exit 0
fi

manual_fallback() {
  warn "Couldn't fetch google-services.json automatically."
  echo
  echo "  Download it manually:"
  echo "   1. https://console.firebase.google.com/project/$PROJ/settings/general"
  echo "   2. If no Android app for $PACKAGE_NAME, click 'Add app' → Android, package '$PACKAGE_NAME'."
  echo "   3. Download google-services.json and save it to:"
  echo "        $DEST"
  exit 1
}

command -v gcloud >/dev/null 2>&1 || manual_fallback
TOKEN=$(gcloud auth print-access-token 2>/dev/null) || manual_fallback
[[ -n "$TOKEN" ]] || manual_fallback

api() { curl -s --globoff -H "Authorization: Bearer $TOKEN" -H "x-goog-user-project: $PROJ" "$@"; }
FB="https://firebase.googleapis.com/v1beta1/projects/$PROJ"

log "Looking up Android app $PACKAGE_NAME in Firebase project $PROJ..."
APPID=$(api "$FB/androidApps" | python3 -c "
import sys,json
d=json.load(sys.stdin)
for a in d.get('apps',[]):
    if a.get('packageName')=='$PACKAGE_NAME':
        print(a['appId']); break
" 2>/dev/null || true)

if [[ -z "$APPID" ]]; then
  log "Not registered — creating Android app..."
  OP=$(api -X POST -H "Content-Type: application/json" \
        -d "{\"packageName\":\"$PACKAGE_NAME\",\"displayName\":\"$APP_NAME Android\"}" \
        "$FB/androidApps" | python3 -c "import sys,json; print(json.load(sys.stdin).get('name',''))" 2>/dev/null)
  [[ -n "$OP" ]] || manual_fallback
  for _ in $(seq 1 30); do
    R=$(api "https://firebase.googleapis.com/v1beta1/$OP")
    if [[ "$(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin).get('done',False))" 2>/dev/null)" == "True" ]]; then
      APPID=$(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin)['response']['appId'])" 2>/dev/null)
      break
    fi
    sleep 2
  done
  [[ -n "$APPID" ]] || manual_fallback
  ok "Registered Android app $APPID"
else
  ok "Android app already registered: $APPID"
fi

log "Fetching google-services.json..."
api "$FB/androidApps/$APPID/config" | python3 -c "
import sys,json,base64
d=json.load(sys.stdin)
if 'configFileContents' not in d:
    print('ERROR:', json.dumps(d)); sys.exit(1)
open('$DEST','w').write(base64.b64decode(d['configFileContents']).decode())
print('wrote $DEST')
" || manual_fallback

ok "google-services.json in place."
