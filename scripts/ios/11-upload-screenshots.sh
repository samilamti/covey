#!/usr/bin/env bash
# Step 11 — Upload PNGs from build/ios/screenshots/ to App Store Connect.
#
# Usage:
#   11-upload-screenshots.sh              # DRY-RUN: validate + show the plan
#   11-upload-screenshots.sh --apply      # upload (refuses if the set is non-empty)
#   11-upload-screenshots.sh --apply --replace   # delete the set's shots, then upload
#   SHOTS_DIR=/some/dir 11-upload-screenshots.sh ...
#
# Targets the APP_IPHONE_67 set on the Swedish AppStoreVersionLocalization.
# Files upload in sorted filename order, which is their order on the product page.
#
# Why it looks like this:
#   * Apple has NO APP_IPHONE_69. APP_IPHONE_67 (1290x2796) is the largest iPhone
#     display type, and an iPhone 16 Plus simulator produces it natively. Every
#     PNG is checked against that size before anything is sent.
#   * Existing shots are listed via GET /appScreenshotSets/{id}/appScreenshots.
#     `?include=appScreenshots` on a parent drops the owning-set relationship, so a
#     full set reads as empty and you upload duplicates until the 10-per-set cap 409s.
#   * The upload itself is lib/asc-asset-upload.sh, which sends the chunk PUTs WITHOUT
#     the ASC bearer token (the asset store answers a bare 400 if it gets one).
#   * Success is checked by fetching Apple's own copy back through
#     imageAsset.templateUrl and reading its pixel size, not by trusting the 200s.

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

APPLY=0
REPLACE=0
for arg in "$@"; do
  case "$arg" in
    --apply)   APPLY=1 ;;
    --replace) REPLACE=1 ;;
    -h|--help) sed -n '2,11p' "$0"; exit 0 ;;
    *) err "unknown argument: $arg"; exit 2 ;;
  esac
done

PY="$SCRIPT_IOS_DIR/.venv/bin/python3"
[[ -x "$PY" ]] || PY="python3"
SHOTS_DIR="${SHOTS_DIR:-$BUILD_DIR/screenshots}"
DISPLAY_TYPE="APP_IPHONE_67"
WANT_W=1290
WANT_H=2796
MAX_PER_SET=10

[[ -d "$SHOTS_DIR" ]] || { err "$SHOTS_DIR not found. Run 08-screenshots.sh first."; exit 1; }
SV_LOC_ID=$(cat "$BUILD_DIR/sv-version-localization-id.txt")

# PNG width/height straight from the IHDR chunk, so no Pillow dependency.
png_dims() {
  "$PY" - "$1" <<'PY'
import sys
b = open(sys.argv[1], "rb").read(24)
if b[:8] != b"\x89PNG\r\n\x1a\n":
    print("not-a-png"); sys.exit()
print(f"{int.from_bytes(b[16:20],'big')}x{int.from_bytes(b[20:24],'big')}")
PY
}

# --- Validate the local files before touching the API ---
PNGS=()
while IFS= read -r f; do PNGS+=("$f"); done < <(find "$SHOTS_DIR" -maxdepth 1 -name '*.png' | LC_ALL=C sort)
[[ ${#PNGS[@]} -gt 0 ]] || { err "No PNGs in $SHOTS_DIR"; exit 1; }
(( ${#PNGS[@]} <= MAX_PER_SET )) || { err "${#PNGS[@]} PNGs; a set holds at most $MAX_PER_SET"; exit 1; }

bad=0
log "Files, in upload order:"
for png in "${PNGS[@]}"; do
  dims=$(png_dims "$png")
  if [[ "$dims" == "${WANT_W}x${WANT_H}" ]]; then
    printf '   %-32s %s  %8s bytes\n' "$(basename "$png")" "$dims" "$(stat -f%z "$png")"
  else
    err "  $(basename "$png") is $dims; $DISPLAY_TYPE needs ${WANT_W}x${WANT_H}"
    bad=1
  fi
done
(( bad == 0 )) || exit 1

# --- Resolve the localization and its set ---
LOC=$(asc_get "/appStoreVersionLocalizations/$SV_LOC_ID")
LOCALE=$(printf '%s' "$LOC" | "$PY" -c 'import json,sys; print(json.load(sys.stdin)["data"]["attributes"]["locale"])')
[[ "$LOCALE" == "sv" ]] || { err "localization $SV_LOC_ID is '$LOCALE', expected 'sv'"; exit 1; }
ok "Localization $SV_LOC_ID (sv)"

SETS=$(asc_get "/appStoreVersionLocalizations/$SV_LOC_ID/appScreenshotSets?limit=50")
SET_ID=$(printf '%s' "$SETS" | "$PY" -c "
import json, sys
for s in json.load(sys.stdin).get('data', []):
    if s['attributes']['screenshotDisplayType'] == '$DISPLAY_TYPE':
        print(s['id']); break
")

EXISTING_IDS=()
if [[ -n "$SET_ID" ]]; then
  EXISTING=$(asc_get "/appScreenshotSets/$SET_ID/appScreenshots?limit=50")
  while IFS= read -r line; do [[ -n "$line" ]] && EXISTING_IDS+=("$line"); done < <(
    printf '%s' "$EXISTING" | "$PY" -c "
import json, sys
for s in json.load(sys.stdin).get('data', []):
    a = s['attributes']
    print(s['id'] + '\t' + str(a.get('fileName')) + '\t' + str((a.get('assetDeliveryState') or {}).get('state')))
")
  ok "Set $SET_ID exists with ${#EXISTING_IDS[@]} screenshot(s)"
  for row in "${EXISTING_IDS[@]+"${EXISTING_IDS[@]}"}"; do printf '   %s\n' "$row"; done
  if (( ${#EXISTING_IDS[@]} > 0 && REPLACE == 0 )); then
    err "Set is not empty. Re-run with --replace to delete these first."
    exit 1
  fi
else
  log "No $DISPLAY_TYPE set yet; it will be created."
fi

if (( APPLY == 0 )); then
  echo
  (( ${#EXISTING_IDS[@]} > 0 )) && log "DRY-RUN would DELETE ${#EXISTING_IDS[@]} existing screenshot(s)"
  [[ -z "$SET_ID" ]] && log "DRY-RUN would POST /appScreenshotSets ($DISPLAY_TYPE)"
  log "DRY-RUN would upload ${#PNGS[@]} file(s). Re-run with --apply to write."
  exit 0
fi

# --- Apply ---
for row in "${EXISTING_IDS[@]+"${EXISTING_IDS[@]}"}"; do
  id=${row%%$'\t'*}
  asc_delete "/appScreenshots/$id" >/dev/null
  ok "Deleted $id"
done

if [[ -z "$SET_ID" ]]; then
  BODY=$("$PY" -c "
import json
print(json.dumps({'data': {'type': 'appScreenshotSets',
  'attributes': {'screenshotDisplayType': '$DISPLAY_TYPE'},
  'relationships': {'appStoreVersionLocalization': {'data': {'type': 'appStoreVersionLocalizations', 'id': '$SV_LOC_ID'}}}}}))
")
  SET_ID=$(asc_post "/appScreenshotSets" "$BODY" | "$PY" -c 'import json,sys; print(json.load(sys.stdin)["data"]["id"])')
  ok "Created set $SET_ID"
fi

for png in "${PNGS[@]}"; do
  fname=$(basename "$png")
  size=$(stat -f%z "$png")
  CREATE_BODY=$("$PY" -c "
import json
print(json.dumps({'data': {'type': 'appScreenshots',
  'attributes': {'fileSize': $size, 'fileName': '$fname'},
  'relationships': {'appScreenshotSet': {'data': {'type': 'appScreenshotSets', 'id': '$SET_ID'}}}}}))
")
  ASSET_ID=$(asc_upload_asset "/appScreenshots" "$CREATE_BODY" "$png")
  ok "Uploaded $fname → $ASSET_ID"
done

# --- Verify: wait for COMPLETE, then fetch Apple's copy and check its size ---
log "Verifying against Apple's copies..."
for attempt in 1 2 3 4 5 6 7 8 9 10; do
  STATE=$(asc_get "/appScreenshotSets/$SET_ID/appScreenshots?limit=50")
  if printf '%s' "$STATE" | "$PY" - "$WANT_W" "$WANT_H" "${#PNGS[@]}" <<'PY'
import json, sys, struct, urllib.request
want_w, want_h, want_n = int(sys.argv[1]), int(sys.argv[2]), int(sys.argv[3])
shots = json.load(sys.stdin)["data"]
pending = False
for s in shots:
    a = s["attributes"]
    st = a.get("assetDeliveryState") or {}
    img = a.get("imageAsset")  # null for a few seconds after commit: processing, not failure
    if st.get("state") != "COMPLETE" or not img:
        pending = True; continue
    if st.get("errors"):
        sys.exit(f"FAIL {a['fileName']}: {st['errors']}")
    url = (img["templateUrl"].replace("{w}", str(img["width"])).replace("{h}", str(img["height"]))
           .replace("{c}", "bb").replace("{f}", "png"))
    head = urllib.request.urlopen(url, timeout=60).read(24)
    w, h = struct.unpack(">II", head[16:24])
    if (w, h) != (want_w, want_h):
        sys.exit(f"FAIL {a['fileName']}: Apple serves {w}x{h}")
    print(f"   {a['fileName']:32s} {w}x{h}  COMPLETE", file=sys.stderr)
if len(shots) != want_n:
    sys.exit(f"FAIL set holds {len(shots)} shot(s), expected {want_n}")
sys.exit(3 if pending else 0)
PY
  then rc=0; else rc=$?; fi
  (( rc == 0 )) && break
  (( rc == 3 )) || exit 1
  (( attempt == 10 )) && { err "Still processing after 10 tries; re-check later."; exit 1; }
  sleep 6
done

ok "Set $SET_ID verified: ${#PNGS[@]} screenshot(s), all ${WANT_W}x${WANT_H}, COMPLETE."
echo "View: https://appstoreconnect.apple.com/apps/$(cat "$BUILD_DIR/app-resource-id.txt")/distribution/info"
