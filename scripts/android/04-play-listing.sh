#!/usr/bin/env bash
# Step 04 — Push the Play Store listing (text + graphics) via the Play API.
# Reads copy from scripts/android/listing/<locale>/{title,short,full}.txt and
# graphics from scripts/android/listing/{icon.png,feature-graphic.png} +
# scripts/android/listing/phoneScreenshots/*.png (attached to the primary locale).
#
# Requires PLAY_SA_JSON and the app to exist in Play Console.

set -euo pipefail
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"
# shellcheck source=lib/play-api.sh
source "$SCRIPT_DIR/lib/play-api.sh"

LISTING="$SCRIPT_DIR/listing"
[[ -d "$LISTING" ]] || { err "No listing dir at $LISTING"; exit 1; }
[[ -f "${PLAY_SA_JSON:-}" ]] || { err "PLAY_SA_JSON missing — set up API access first (README)."; exit 1; }

PKG="$PACKAGE_NAME"
log "Opening edit..."
EDIT=$(play_post "/applications/$PKG/edits" '' | json_field "['id']")
ok "Edit $EDIT"

# --- Listing text, per locale ---
for dir in "$LISTING"/*/; do
  loc=$(basename "$dir")
  [[ -f "$dir/title.txt" ]] || continue
  title=$(cat "$dir/title.txt")
  short=$(cat "$dir/short.txt" 2>/dev/null || echo "")
  full=$(cat "$dir/full.txt" 2>/dev/null || echo "")
  body=$(python3 -c "
import json,sys
print(json.dumps({'language':'$loc','title':sys.argv[1],'shortDescription':sys.argv[2],'fullDescription':sys.argv[3]}))
" "$title" "$short" "$full")
  log "Setting listing text for $loc..."
  play_put "/applications/$PKG/edits/$EDIT/listings/$loc" "$body" >/dev/null
  ok "  $loc: \"$title\""
done

# --- Graphics + screenshots (attached to PRIMARY_LOCALE; other locales fall back) ---
upload_image() {  # <imageType> <file>
  local itype=$1 file=$2
  [[ -f "$file" ]] || return 0
  local ct="image/png"; [[ "$file" == *.jpg || "$file" == *.jpeg ]] && ct="image/jpeg"
  play_delete "/applications/$PKG/edits/$EDIT/listings/$PRIMARY_LOCALE/$itype" >/dev/null 2>&1 || true
  play_upload POST "/applications/$PKG/edits/$EDIT/listings/$PRIMARY_LOCALE/$itype" "$file" "$ct" >/dev/null
  ok "  uploaded $itype ($(basename "$file"))"
}

log "Uploading graphics to $PRIMARY_LOCALE..."
upload_image icon            "$LISTING/icon.png"
upload_image featureGraphic  "$LISTING/feature-graphic.png"
if [[ -d "$LISTING/phoneScreenshots" ]]; then
  play_delete "/applications/$PKG/edits/$EDIT/listings/$PRIMARY_LOCALE/phoneScreenshots" >/dev/null 2>&1 || true
  for shot in "$LISTING"/phoneScreenshots/*.png; do
    [[ -f "$shot" ]] || continue
    play_upload POST "/applications/$PKG/edits/$EDIT/listings/$PRIMARY_LOCALE/phoneScreenshots" "$shot" "image/png" >/dev/null
    ok "  screenshot $(basename "$shot")"
  done
fi

log "Committing edit..."
play_post "/applications/$PKG/edits/$EDIT:commit" '' >/dev/null
ok "Listing committed."
