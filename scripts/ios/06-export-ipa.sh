#!/usr/bin/env bash
# Step 06 — Export a signed .ipa from the .xcarchive for App Store upload.

set -euo pipefail
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

ARCHIVE_PATH="$BUILD_DIR/App.xcarchive"
EXPORT_DIR="$BUILD_DIR/ipa"
EXPORT_OPTS="$BUILD_DIR/ExportOptions.plist"

[[ -d "$ARCHIVE_PATH" ]] || { err "Archive not found at $ARCHIVE_PATH. Run 05-archive.sh first."; exit 1; }

# Clear previous export so xcodebuild doesn't refuse to overwrite
rm -rf "$EXPORT_DIR"
mkdir -p "$EXPORT_DIR"

log "Writing ExportOptions.plist..."
cat > "$EXPORT_OPTS" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>method</key>
	<string>app-store-connect</string>
	<key>destination</key>
	<string>export</string>
	<key>teamID</key>
	<string>$ASC_TEAM_ID</string>
	<key>signingStyle</key>
	<string>automatic</string>
	<key>uploadSymbols</key>
	<true/>
	<key>stripSwiftSymbols</key>
	<true/>
</dict>
</plist>
PLIST

log "Exporting IPA..."
xcodebuild -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportPath "$EXPORT_DIR" \
  -exportOptionsPlist "$EXPORT_OPTS" \
  -allowProvisioningUpdates \
  -authenticationKeyPath "$ASC_KEY_PATH" \
  -authenticationKeyID "$ASC_KEY_ID" \
  -authenticationKeyIssuerID "$ASC_ISSUER_ID"

IPA_PATH=$(find "$EXPORT_DIR" -maxdepth 1 -name '*.ipa' | head -1)
if [[ -z "$IPA_PATH" ]]; then
  err "No .ipa produced in $EXPORT_DIR"
  exit 1
fi

ok "IPA exported: $IPA_PATH ($(du -sh "$IPA_PATH" | awk '{print $1}'))"
