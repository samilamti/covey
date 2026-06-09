#!/usr/bin/env bash
# Step 07 — Upload the .ipa to App Store Connect / TestFlight via altool.

set -euo pipefail
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

EXPORT_DIR="$BUILD_DIR/ipa"
IPA_PATH=$(find "$EXPORT_DIR" -maxdepth 1 -name '*.ipa' 2>/dev/null | head -1)

[[ -n "$IPA_PATH" && -f "$IPA_PATH" ]] || {
  err "No .ipa found in $EXPORT_DIR. Run 06-export-ipa.sh first."
  exit 1
}

log "Uploading to App Store Connect..."
log "  IPA: $IPA_PATH"
log "  Key: $ASC_KEY_ID (issuer $ASC_ISSUER_ID)"

# altool auto-discovers the .p8 at ~/.appstoreconnect/private_keys/AuthKey_<KEY_ID>.p8
xcrun altool --upload-app \
  --type ios \
  --file "$IPA_PATH" \
  --apiKey "$ASC_KEY_ID" \
  --apiIssuer "$ASC_ISSUER_ID"

ok "Upload complete!"
echo
echo "Next steps:"
echo "  • Apple processes the build (~5-15 min) — watch:"
echo "    https://appstoreconnect.apple.com/apps/$(cat "$BUILD_DIR/app-resource-id.txt" 2>/dev/null || echo '<APP_ID>')/testflight/ios"
echo "  • Once status flips to 'Ready to Submit', add internal testers and start TestFlight."
echo "  • For App Store release: complete metadata + screenshots + privacy in App Store Connect, then 'Submit for Review'."
