#!/usr/bin/env bash
# Step 11 — Upload PNGs from build/ios/screenshots/ to App Store Connect.
#
# Usage:
#   11-upload-screenshots.sh              # DRY-RUN: validate + show the plan
#   11-upload-screenshots.sh --apply      # upload (refuses if the set is non-empty)
#   11-upload-screenshots.sh --apply --replace   # upload, then delete the set's old shots
#   11-upload-screenshots.sh --verify-only       # check the live set matches these files
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
VERIFY_ONLY=0
for arg in "$@"; do
  case "$arg" in
    --apply)   APPLY=1 ;;
    --replace) REPLACE=1 ;;
    --verify-only) VERIFY_ONLY=1 ;;
    -h|--help) sed -n '2,12p' "$0"; exit 0 ;;
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

verify_set() {
  # Verify: the set holds exactly our uploads, COMPLETE, with our checksums,
  # and Apple's rendered copy is the right size.
  log "Verifying against Apple's copies..."
  for attempt in 1 2 3 4 5 6 7 8 9 10; do
    asc_get "/appScreenshotSets/$SET_ID/appScreenshots?limit=50" > "$STATE_FILE" || { sleep 6; continue; }
    # State and manifest go in as FILES: a heredoc already owns Python's stdin.
    if "$PY" - "$STATE_FILE" "$MANIFEST" "$WANT_W" "$WANT_H" <<'PY'
import json, sys, struct, urllib.request
shots = json.load(open(sys.argv[1]))["data"]
want = {}
for line in open(sys.argv[2]):
    i, name, md5 = line.rstrip("\n").split("\t")
    want[i] = (name, md5)
want_w, want_h = int(sys.argv[3]), int(sys.argv[4])
ids = [s["id"] for s in shots]
if sorted(ids) != sorted(want):
    sys.exit(f"FAIL set holds {ids}, expected exactly {list(want)}")
pending = False
for s in shots:
    a = s["attributes"]
    name, md5 = want[s["id"]]
    st = a.get("assetDeliveryState") or {}
    if st.get("errors"):
        sys.exit(f"FAIL {name}: {st['errors']}")
    img = a.get("imageAsset")
    # imageAsset and sourceFileChecksum are null for a few seconds after the
    # commit while Apple processes: that is "not yet", not a failure.
    if st.get("state") != "COMPLETE" or not img or not a.get("sourceFileChecksum"):
        pending = True; continue
    if a["sourceFileChecksum"] != md5:
        sys.exit(f"FAIL {name}: Apple has checksum {a['sourceFileChecksum']}, local is {md5}")
    url = (img["templateUrl"].replace("{w}", str(img["width"])).replace("{h}", str(img["height"]))
           .replace("{c}", "bb").replace("{f}", "png"))
    head = urllib.request.urlopen(url, timeout=60).read(24)
    w, h = struct.unpack(">II", head[16:24])
    if (w, h) != (want_w, want_h):
        sys.exit(f"FAIL {name}: Apple serves {w}x{h}")
    print(f"   {name:32s} {w}x{h}  COMPLETE  md5 ok", file=sys.stderr)
sys.exit(3 if pending else 0)
PY
    then rc=0; else rc=$?; fi
    (( rc == 0 )) && break
    (( rc == 3 )) || return 1
    (( attempt == 10 )) && { err "Still processing after 10 tries; re-check later."; return 1; }
    sleep 6
  done
}

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
  if (( VERIFY_ONLY )); then
    MANIFEST=$(mktemp "${TMPDIR:-/tmp}/asc-shots.XXXXXX")
    STATE_FILE=$(mktemp "${TMPDIR:-/tmp}/asc-state.XXXXXX")
    trap 'rm -f "$MANIFEST" "$STATE_FILE"' EXIT
    for row in "${EXISTING_IDS[@]+"${EXISTING_IDS[@]}"}"; do
      IFS=$'\t' read -r id fname _ <<< "$row"
      [[ -f "$SHOTS_DIR/$fname" ]] || { err "live shot $fname has no local file in $SHOTS_DIR"; exit 1; }
      printf '%s\t%s\t%s\n' "$id" "$fname" "$(md5 -q "$SHOTS_DIR/$fname")" >> "$MANIFEST"
    done
    (( ${#EXISTING_IDS[@]} == ${#PNGS[@]} )) || { err "live set has ${#EXISTING_IDS[@]} shot(s), $SHOTS_DIR has ${#PNGS[@]}"; exit 1; }
    verify_set || exit 1
    ok "Live set $SET_ID matches $SHOTS_DIR."
    exit 0
  fi
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
# Upload BEFORE deleting, so a failed run leaves the live set as it was. Only when
# old + new would pass the 10-per-set cap do we have to delete first.
DELETE_FIRST=0
if (( ${#EXISTING_IDS[@]} + ${#PNGS[@]} > MAX_PER_SET )); then
  DELETE_FIRST=1
  warn "Old + new exceeds $MAX_PER_SET per set: deleting the old shots first. A failed upload will leave the set short."
fi

delete_existing() {
  local row id
  for row in "${EXISTING_IDS[@]+"${EXISTING_IDS[@]}"}"; do
    id=${row%%$'\t'*}
    asc_delete "/appScreenshots/$id" >/dev/null || { err "failed to delete $id"; return 1; }
    ok "Deleted old $id"
  done
}

(( DELETE_FIRST )) && { delete_existing || exit 1; }

if [[ -z "$SET_ID" ]]; then
  BODY=$("$PY" -c "
import json
print(json.dumps({'data': {'type': 'appScreenshotSets',
  'attributes': {'screenshotDisplayType': '$DISPLAY_TYPE'},
  'relationships': {'appStoreVersionLocalization': {'data': {'type': 'appStoreVersionLocalizations', 'id': '$SV_LOC_ID'}}}}}))
")
  RESP=$(asc_post "/appScreenshotSets" "$BODY") || { err "could not create the screenshot set"; exit 1; }
  SET_ID=$(printf '%s' "$RESP" | "$PY" -c 'import json,sys; print(json.load(sys.stdin)["data"]["id"])')
  ok "Created set $SET_ID"
fi

MANIFEST=$(mktemp "${TMPDIR:-/tmp}/asc-shots.XXXXXX")
STATE_FILE=$(mktemp "${TMPDIR:-/tmp}/asc-state.XXXXXX")
trap 'rm -f "$MANIFEST" "$STATE_FILE"' EXIT
NEW_IDS=()

rollback_new() {
  local id
  for id in "${NEW_IDS[@]+"${NEW_IDS[@]}"}"; do
    asc_delete "/appScreenshots/$id" >/dev/null 2>&1 && warn "Removed partial upload $id"
  done
}

for png in "${PNGS[@]}"; do
  fname=$(basename "$png")
  size=$(stat -f%z "$png")
  CREATE_BODY=$("$PY" -c "
import json
print(json.dumps({'data': {'type': 'appScreenshots',
  'attributes': {'fileSize': $size, 'fileName': '$fname'},
  'relationships': {'appScreenshotSet': {'data': {'type': 'appScreenshotSets', 'id': '$SET_ID'}}}}}))
")
  if ! ASSET_ID=$(asc_upload_asset "/appScreenshots" "$CREATE_BODY" "$png") || [[ -z "$ASSET_ID" ]]; then
    err "Upload of $fname failed."
    rollback_new
    (( DELETE_FIRST )) || ok "The previous screenshots were left in place."
    exit 1
  fi
  NEW_IDS+=("$ASSET_ID")
  printf '%s\t%s\t%s\n' "$ASSET_ID" "$fname" "$(md5 -q "$png")" >> "$MANIFEST"
  ok "Uploaded $fname → $ASSET_ID"
done

(( DELETE_FIRST )) || delete_existing || { err "New shots are up but old ones remain; delete them by hand."; exit 1; }

verify_set || exit 1
ok "Set $SET_ID verified: ${#PNGS[@]} screenshot(s), all ${WANT_W}x${WANT_H}, COMPLETE."
echo "View: https://appstoreconnect.apple.com/apps/$(cat "$BUILD_DIR/app-resource-id.txt")/distribution/info"
