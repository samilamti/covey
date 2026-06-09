#!/usr/bin/env bash
# Step 05 — Build the .xcarchive with automatic signing via App Store Connect API key.

set -euo pipefail
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

mkdir -p "$BUILD_DIR"
ARCHIVE_PATH="$BUILD_DIR/App.xcarchive"

# Clean any previous archive (xcodebuild errors if archive path exists)
if [[ -d "$ARCHIVE_PATH" ]]; then
  log "Removing previous archive..."
  rm -rf "$ARCHIVE_PATH"
fi

log "Archiving (this can take 5–15 min on first run)..."
log "  workspace: frontend/ios/App/App.xcworkspace"
log "  scheme:    App"
log "  archive:   $ARCHIVE_PATH"

xcodebuild \
  -workspace "$PROJECT_ROOT/frontend/ios/App/App.xcworkspace" \
  -scheme App \
  -configuration Release \
  -sdk iphoneos \
  -destination 'generic/platform=iOS' \
  -archivePath "$ARCHIVE_PATH" \
  -allowProvisioningUpdates \
  -authenticationKeyPath "$ASC_KEY_PATH" \
  -authenticationKeyID "$ASC_KEY_ID" \
  -authenticationKeyIssuerID "$ASC_ISSUER_ID" \
  CODE_SIGN_STYLE=Automatic \
  DEVELOPMENT_TEAM="$ASC_TEAM_ID" \
  archive

ok "Archive complete: $ARCHIVE_PATH ($(du -sh "$ARCHIVE_PATH" | awk '{print $1}'))"
