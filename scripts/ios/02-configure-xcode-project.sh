#!/usr/bin/env bash
# Step 02 — Patch the Xcode project for App Store submission:
#   - DEVELOPMENT_TEAM = $ASC_TEAM_ID (required for automatic signing)
#   - MARKETING_VERSION + CURRENT_PROJECT_VERSION
#   - CODE_SIGN_ENTITLEMENTS = App/App.entitlements
#   - Create App.entitlements with aps-environment (push notifications)
#   - Add NSLocation*UsageDescription to Info.plist (required for geolocation)

set -euo pipefail
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

PBXPROJ="$PROJECT_ROOT/frontend/ios/App/App.xcodeproj/project.pbxproj"
INFO_PLIST="$PROJECT_ROOT/frontend/ios/App/App/Info.plist"
ENT_FILE="$PROJECT_ROOT/frontend/ios/App/App/App.entitlements"

[[ -f "$PBXPROJ" ]] || { err "$PBXPROJ not found. Run 01-install-and-build.sh first."; exit 1; }
[[ -f "$INFO_PLIST" ]] || { err "$INFO_PLIST not found"; exit 1; }

# --- 1. Inject DEVELOPMENT_TEAM into project.pbxproj (idempotent) ---
log "Setting DEVELOPMENT_TEAM = $ASC_TEAM_ID..."
if grep -q "DEVELOPMENT_TEAM = $ASC_TEAM_ID;" "$PBXPROJ"; then
  ok "DEVELOPMENT_TEAM already set"
else
  # Remove any existing DEVELOPMENT_TEAM lines first (avoid duplicates with wrong value)
  /usr/bin/sed -i '' '/^[[:space:]]*DEVELOPMENT_TEAM = .*;$/d' "$PBXPROJ"
  # Insert DEVELOPMENT_TEAM after each PRODUCT_BUNDLE_IDENTIFIER line in the App target.
  # The pbxproj file uses tabs+spaces; awk lets us insert with matching indent.
  /usr/bin/awk -v team="$ASC_TEAM_ID" '
    /PRODUCT_BUNDLE_IDENTIFIER = se\.covey\.app;/ {
      print
      # Match the leading whitespace of this line for the inserted line
      match($0, /^[[:space:]]+/)
      indent = substr($0, RSTART, RLENGTH)
      print indent "DEVELOPMENT_TEAM = " team ";"
      next
    }
    { print }
  ' "$PBXPROJ" > "$PBXPROJ.tmp" && mv "$PBXPROJ.tmp" "$PBXPROJ"
  ok "DEVELOPMENT_TEAM injected"
fi

# --- 2. Update version numbers (idempotent — sed replaces in place) ---
log "Setting MARKETING_VERSION=$MARKETING_VERSION, BUILD_NUMBER=$BUILD_NUMBER..."
/usr/bin/sed -i '' -E "s/MARKETING_VERSION = [^;]+;/MARKETING_VERSION = $MARKETING_VERSION;/g" "$PBXPROJ"
/usr/bin/sed -i '' -E "s/CURRENT_PROJECT_VERSION = [^;]+;/CURRENT_PROJECT_VERSION = $BUILD_NUMBER;/g" "$PBXPROJ"
ok "Versions updated"

# --- 3. Create entitlements file ---
log "Creating App.entitlements..."
cat > "$ENT_FILE" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>aps-environment</key>
	<string>production</string>
</dict>
</plist>
PLIST
ok "App.entitlements written"

# --- 4. Reference entitlements in pbxproj (idempotent) ---
log "Linking entitlements file into Xcode project..."
if grep -q 'CODE_SIGN_ENTITLEMENTS = App/App.entitlements;' "$PBXPROJ"; then
  ok "Entitlements already linked"
else
  /usr/bin/sed -i '' '/^[[:space:]]*CODE_SIGN_ENTITLEMENTS = .*;$/d' "$PBXPROJ"
  /usr/bin/awk '
    /PRODUCT_BUNDLE_IDENTIFIER = se\.covey\.app;/ {
      print
      match($0, /^[[:space:]]+/)
      indent = substr($0, RSTART, RLENGTH)
      print indent "CODE_SIGN_ENTITLEMENTS = App/App.entitlements;"
      next
    }
    { print }
  ' "$PBXPROJ" > "$PBXPROJ.tmp" && mv "$PBXPROJ.tmp" "$PBXPROJ"
  ok "Entitlements linked"
fi

# --- 5. Add Info.plist usage descriptions (Swedish, idempotent via PlistBuddy) ---
log "Adding NSLocation*UsageDescription to Info.plist..."
PB=/usr/libexec/PlistBuddy
LOC_DESC="Covey använder din plats för att matcha dig med någon i närheten som vill gå tillsammans."

for key in "NSLocationWhenInUseUsageDescription" "NSLocationAlwaysAndWhenInUseUsageDescription"; do
  # Set if missing, otherwise overwrite the existing value
  if $PB -c "Print :$key" "$INFO_PLIST" >/dev/null 2>&1; then
    $PB -c "Set :$key $LOC_DESC" "$INFO_PLIST"
  else
    $PB -c "Add :$key string $LOC_DESC" "$INFO_PLIST"
  fi
done
ok "Location usage descriptions set"

# Add export compliance — declares the app does not use non-exempt encryption.
# Avoids App Review prompt every TestFlight upload.
log "Adding ITSAppUsesNonExemptEncryption = NO..."
if $PB -c "Print :ITSAppUsesNonExemptEncryption" "$INFO_PLIST" >/dev/null 2>&1; then
  $PB -c "Set :ITSAppUsesNonExemptEncryption false" "$INFO_PLIST"
else
  $PB -c "Add :ITSAppUsesNonExemptEncryption bool false" "$INFO_PLIST"
fi
ok "Export compliance declared"

ok "Xcode project configured for App Store submission."
