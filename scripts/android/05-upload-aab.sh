#!/usr/bin/env bash
# Step 05 — Upload the signed AAB to a Play track and roll out.
#   open edit → upload bundle → assign versionCode to $TRACK → commit (sends for review).
#
# Requires PLAY_SA_JSON, the app to exist in Play Console, and (for the very
# first upload) Play App Signing to be enrolled — if Play rejects the bundle
# pending enrollment, do the first upload via the UI once, then rerun this.

set -euo pipefail
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"
# shellcheck source=lib/play-api.sh
source "$SCRIPT_DIR/lib/play-api.sh"

[[ -f "${PLAY_SA_JSON:-}" ]] || { err "PLAY_SA_JSON missing — set up API access first (README)."; exit 1; }
[[ -f "$AAB_PATH" ]] || { err "No AAB at $AAB_PATH. Run 03-build-aab.sh first."; exit 1; }

PKG="$PACKAGE_NAME"
TRACK="${TRACK:-alpha}"
STATUS="${RELEASE_STATUS:-completed}"

log "Opening edit..."
EDIT=$(play_post "/applications/$PKG/edits" '' | json_field "['id']")
ok "Edit $EDIT"

log "Uploading $AAB_PATH ($(du -h "$AAB_PATH" | cut -f1))..."
VC=$(play_upload_bundle "$EDIT" "$AAB_PATH")
ok "Uploaded as versionCode $VC"

# Build per-locale release notes from listing/<loc>/release-notes.txt, falling
# back to RELEASE_NOTES for the primary locale.
NOTES_JSON=$(python3 -c "
import json, os, glob
notes=[]
base=os.path.join('$SCRIPT_DIR','listing')
for d in sorted(glob.glob(os.path.join(base,'*'))):
    loc=os.path.basename(d)
    f=os.path.join(d,'release-notes.txt')
    if os.path.isfile(f):
        notes.append({'language':loc,'text':open(f).read().strip()})
if not notes:
    notes=[{'language':'$PRIMARY_LOCALE','text':'''${RELEASE_NOTES:-First release.}'''}]
print(json.dumps(notes))
")

TRACK_BODY=$(python3 -c "
import json,sys
print(json.dumps({'track':'$TRACK','releases':[{'versionCodes':['$VC'],'status':'$STATUS','releaseNotes':json.loads(sys.argv[1])}]}))
" "$NOTES_JSON")

log "Assigning versionCode $VC to track '$TRACK' (status: $STATUS)..."
play_put "/applications/$PKG/edits/$EDIT/tracks/$TRACK" "$TRACK_BODY" >/dev/null
ok "Track updated"

log "Committing edit (sends the release for review)..."
play_post "/applications/$PKG/edits/$EDIT:commit" '' >/dev/null
ok "Committed. Build $VC is on the '$TRACK' track — check Play Console for review status."
