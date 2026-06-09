#!/usr/bin/env bash
# Step 08 — Build for iOS Simulator and capture App Store screenshots
# using the demo-user easter egg in LandingPage.jsx:
#   1. Double-tap the Covey logo (arms demo mode + flips theme to mint)
#   2. Tap the BankID button (signs in as DEMO_NIN — pre-computed user)
#
# This bypasses the real BankID polling, gives us a stable demo persona,
# and produces visually-distinct mint-green screenshots that double as
# both App Store assets and a recognizable demo mode for press / partners.
#
# Output: build/ios/screenshots/01-…06-….png at 1320×2868 (iPhone 6.9").

set -euo pipefail
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

SIM_NAME="iPhone 17 Pro Max"
SIM_OUT="$BUILD_DIR/screenshots"
SIM_DERIVED="$BUILD_DIR/sim-derived"
APP_BUNDLE_ID_NATIVE="se.covey.app"
PY="$SCRIPT_IOS_DIR/.venv/bin/python3"

mkdir -p "$SIM_OUT"

# Ensure cliclick
if ! command -v cliclick >/dev/null 2>&1; then
  log "Installing cliclick..."
  brew install cliclick
fi

# --- Boot the simulator ---
log "Booting $SIM_NAME..."
SIM_UDID=$(xcrun simctl list devices "$SIM_NAME" available -j 2>/dev/null \
  | "$PY" -c "
import json, sys
d = json.load(sys.stdin)
for runtime, devs in d.get('devices', {}).items():
    for dev in devs:
        if dev.get('name') == '$SIM_NAME' and dev.get('isAvailable'):
            print(dev['udid']); sys.exit(0)
")
[[ -n "$SIM_UDID" ]] || { err "No simulator named $SIM_NAME"; exit 1; }
STATE=$(xcrun simctl list devices -j | "$PY" -c "
import json, sys
d = json.load(sys.stdin)
for r, devs in d.get('devices', {}).items():
    for dev in devs:
        if dev.get('udid') == '$SIM_UDID':
            print(dev.get('state','')); sys.exit(0)
")
[[ "$STATE" == "Booted" ]] || xcrun simctl boot "$SIM_UDID"
sleep 2
ok "Simulator $SIM_UDID"

open -a Simulator
sleep 3

# --- Rebuild the app (the LandingPage source changed for the easter egg) ---
log "Rebuilding web bundle (frontend)..."
( cd "$PROJECT_ROOT/frontend" && npm run build >/dev/null )
log "Syncing into iOS project..."
( cd "$PROJECT_ROOT/frontend" && npx cap sync ios >/dev/null )

log "Building app for iphonesimulator..."
xcodebuild \
  -workspace "$PROJECT_ROOT/frontend/ios/App/App.xcworkspace" \
  -scheme App \
  -configuration Release \
  -sdk iphonesimulator \
  -destination "platform=iOS Simulator,id=$SIM_UDID" \
  -derivedDataPath "$SIM_DERIVED" \
  CODE_SIGN_IDENTITY="" \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGNING_ALLOWED=NO \
  build 2>&1 | tail -3

APP_PATH=$(find "$SIM_DERIVED/Build/Products" -name 'App.app' -path '*Release-iphonesimulator*' | head -1)
[[ -d "$APP_PATH" ]] || { err "App.app not built"; exit 1; }
ok "Built: $APP_PATH"

# --- Install + launch ---
log "Installing app..."
xcrun simctl uninstall "$SIM_UDID" "$APP_BUNDLE_ID_NATIVE" >/dev/null 2>&1 || true
xcrun simctl install "$SIM_UDID" "$APP_PATH"

xcrun simctl privacy "$SIM_UDID" grant location-always "$APP_BUNDLE_ID_NATIVE" 2>/dev/null || true
xcrun simctl location "$SIM_UDID" set 59.3293,18.0686 || true

log "Launching app..."
xcrun simctl launch "$SIM_UDID" "$APP_BUNDLE_ID_NATIVE" >/dev/null
sleep 5

# --- Get window geometry ---
osascript -e 'tell application "Simulator" to activate' >/dev/null 2>&1 || true
sleep 1
WIN_POS=$(osascript -e 'tell application "System Events" to tell process "Simulator" to get position of window 1' 2>/dev/null || echo "0, 0")
WIN_X=$(echo "$WIN_POS" | awk -F',' '{gsub(/ /,""); print $1}')
WIN_Y=$(echo "$WIN_POS" | awk -F',' '{gsub(/ /,""); print $2}')
WIN_SIZE=$(osascript -e 'tell application "System Events" to tell process "Simulator" to get size of window 1' 2>/dev/null || echo "0, 0")
WIN_W=$(echo "$WIN_SIZE" | awk -F',' '{gsub(/ /,""); print $1}')
WIN_H=$(echo "$WIN_SIZE" | awk -F',' '{gsub(/ /,""); print $2}')
SCREEN_TOP=$(( WIN_Y + 18 ))
CENTER_X=$(( WIN_X + WIN_W / 2 ))
log "Sim window: ${WIN_X},${WIN_Y} ${WIN_W}x${WIN_H}  center_x=$CENTER_X"

# --- Screenshot 1: clean Swedish landing page ---
xcrun simctl io "$SIM_UDID" screenshot "$SIM_OUT/01-landing.png"
ok "01-landing.png"

# --- Trigger demo via the NIN-typing path (more reliable than coordinate clicks) ---
# Tap the input field
INPUT_Y=$(( SCREEN_TOP + 515 ))
BUTTON_Y=$(( SCREEN_TOP + 592 ))
log "Focusing NIN input at ($CENTER_X, $INPUT_Y)..."
cliclick "c:$CENTER_X,$INPUT_Y" || true
sleep 1

# Type the magic demo NIN — handleLogin in LandingPage.jsx checks for this
# value and triggers the easter egg (mint theme + DEMO_NIN auto-login).
log "Typing demo trigger NIN 999999999999..."
cliclick -w 50 t:999999999999 || true
sleep 1

# Tap the BankID button — handleLogin sees the trigger and switches paths
log "Tapping BankID button at ($CENTER_X, $BUTTON_Y)..."
cliclick "c:$CENTER_X,$BUTTON_Y" || true
sleep 2

xcrun simctl io "$SIM_UDID" screenshot "$SIM_OUT/02-bankid-pending.png"
ok "02-bankid-pending.png"

# Wait for stub auth to complete (~4 polls)
sleep 6
xcrun simctl io "$SIM_UDID" screenshot "$SIM_OUT/03-logged-in.png"
ok "03-logged-in.png"

# --- Navigate the bottom nav (5 tabs) ---
NAV_Y=$(( SCREEN_TOP + 900 ))
NAV_TABS=( "16:requests" "33:communities" "50:nearby" "66:progress" "85:profile" )
i=4
for entry in "${NAV_TABS[@]}"; do
  pct=${entry%%:*}
  name=${entry##*:}
  TAB_X=$(( WIN_X + WIN_W * pct / 100 ))
  log "Tapping '$name' tab at ($TAB_X, $NAV_Y)..."
  cliclick "c:$TAB_X,$NAV_Y" || true
  sleep 2
  printf -v num "%02d" "$i"
  xcrun simctl io "$SIM_UDID" screenshot "$SIM_OUT/$num-$name.png"
  ok "  $num-$name.png"
  i=$((i+1))
done

ls -la "$SIM_OUT/"
ok "Screenshots ready in $SIM_OUT/"
