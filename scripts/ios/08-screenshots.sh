#!/usr/bin/env bash
# Step 08 — Capture the App Store screenshots, unattended, against a LOCAL stack.
#
# Usage:
#   08-screenshots.sh                 # full run: local stack, build, capture
#   08-screenshots.sh --skip-build    # reuse the last screenshot build in sim-derived
#
# Output: build/ios/screenshots/0{1..5}-*.png, 1290x2796 (APP_IPHONE_67), then
# upload with 11-upload-screenshots.sh.
#
# What it does:
#   1. Reads production's feature flags from https://covey.se/api/features and
#      runs the local backend with the same ones. The flags decide which tabs and
#      login UI exist, so a mismatch photographs an app nobody has.
#   2. Starts PGlite as a Postgres wire server (no Docker or Postgres on this Mac)
#      and the backend on it with AUTH_PROVIDER=stub.
#   3. Builds the app with VITE_SCREENSHOT_MODE=1: API_BASE → localhost, and the
#      app follows scenes served by screenshots/capture.mjs instead of taps.
#      Info.plist gets NSAllowsLocalNetworking for the duration.
#   4. Installs on an iPhone 16 Plus simulator (native 1290x2796), pins the status
#      bar, and runs capture.mjs, which seeds Swedish content and shoots 5 scenes.
#   5. On exit, ALWAYS: restores Info.plist, rebuilds the normal web bundle into
#      the native project, and checks no screenshot-mode code is left there.
#
# Nothing here talks to production except the one read of /api/features.

set -euo pipefail
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

SKIP_BUILD=0
for a in "$@"; do
  case "$a" in
    --skip-build) SKIP_BUILD=1 ;;
    -h|--help) sed -n '2,24p' "$0"; exit 0 ;;
    *) err "unknown argument: $a"; exit 2 ;;
  esac
done

# A simulator of our own: a shared one may have other apps in front, and iOS then
# draws a "◀ <app>" back link under the clock on every shot.
SIM_NAME="${SIM_NAME:-Covey Screenshots}"
SIM_TYPE="com.apple.CoreSimulator.SimDeviceType.iPhone-16-Plus"
BUNDLE_ID="se.covey.app"
OUT="$BUILD_DIR/screenshots"
DERIVED="$BUILD_DIR/sim-derived"
FRONTEND="$PROJECT_ROOT/frontend"
PLIST="$FRONTEND/ios/App/App/Info.plist"
PLIST_BACKUP="$BUILD_DIR/Info.plist.pre-screenshots"
PGLITE_SERVER="${PGLITE_SERVER:-$HOME/Projects/McpGallore/scripts/pglite-server.mjs}"
PG_PORT=5433
API_PORT=3000
DIRECTOR_PORT=3999
API="http://localhost:$API_PORT"
DATABASE_URL="postgres://postgres:postgres@127.0.0.1:$PG_PORT/postgres"
LOGS="$BUILD_DIR/screenshot-logs"
mkdir -p "$BUILD_DIR" "$LOGS"

PG_PID=""
API_PID=""
PLIST_TOUCHED=0
UDID=""
WE_BOOTED=0

cleanup() {
  local rc=$?
  set +e
  [[ -n "$API_PID" ]] && kill "$API_PID" 2>/dev/null
  [[ -n "$PG_PID" ]] && kill "$PG_PID" 2>/dev/null
  if (( PLIST_TOUCHED )); then
    cp "$PLIST_BACKUP" "$PLIST" && rm -f "$PLIST_BACKUP"
    log "Restored Info.plist"
  fi
  if [[ -n "$UDID" ]]; then
    xcrun simctl status_bar "$UDID" clear >/dev/null 2>&1
    # The installed app points at localhost; don't leave it looking like a real build.
    xcrun simctl uninstall "$UDID" "$BUNDLE_ID" >/dev/null 2>&1
    (( WE_BOOTED )) && xcrun simctl shutdown "$UDID" >/dev/null 2>&1
  fi
  if (( SKIP_BUILD == 0 )); then
    log "Restoring the normal web bundle in the native project..."
    ( cd "$FRONTEND" && npm run build >"$LOGS/restore-build.log" 2>&1 && npx cap copy ios >>"$LOGS/restore-build.log" 2>&1 ) \
      || { err "normal rebuild failed, see $LOGS/restore-build.log"; rc=1; }
    "$SCRIPT_DIR/lib/assert-no-screenshot-mode.sh" "$FRONTEND/dist" "$FRONTEND/ios/App/App/public" || rc=1
  fi
  exit "$rc"
}
trap cleanup EXIT

port_free() { ! lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1; }
for p in $PG_PORT $API_PORT $DIRECTOR_PORT; do
  port_free "$p" || { err "port $p is in use; stop whatever holds it (lsof -nP -iTCP:$p)"; exit 1; }
done
[[ -f "$PGLITE_SERVER" ]] || { err "PGlite server not found at $PGLITE_SERVER (set PGLITE_SERVER)"; exit 1; }

# --- 1. Production feature flags --------------------------------------------
log "Reading production feature flags..."
FLAGS_JSON=$(curl -fsS --max-time 15 https://covey.se/api/features) \
  || { err "could not read https://covey.se/api/features; refusing to guess the flags"; exit 1; }
FLAG_ENV=()
while IFS= read -r line; do FLAG_ENV+=("$line"); done < <(printf '%s' "$FLAGS_JSON" | node -e '
  const f = JSON.parse(require("fs").readFileSync(0, "utf8")).flags
  if (!f || !Object.keys(f).length) process.exit(1)
  for (const [k, v] of Object.entries(f)) console.log(`FEATURE_${k}=${v === true}`)
') || { err "unexpected /api/features response: $FLAGS_JSON"; exit 1; }
ok "Flags: ${FLAG_ENV[*]}"
case " ${FLAG_ENV[*]} " in
  *" FEATURE_BANKID_AUTH=true "*) warn "Production has BANKID_AUTH on: the landing shot will show the QR login." ;;
esac

# --- 2. Local database + backend --------------------------------------------
log "Starting PGlite on :$PG_PORT..."
node "$PGLITE_SERVER" --port "$PG_PORT" --memory --max 25 >"$LOGS/pglite.log" 2>&1 &
PG_PID=$!
for _ in $(seq 1 50); do port_free "$PG_PORT" || break; sleep 0.2; done
port_free "$PG_PORT" && { err "PGlite did not start, see $LOGS/pglite.log"; exit 1; }

log "Starting backend on :$API_PORT (stub auth)..."
(
  cd "$PROJECT_ROOT/backend"
  exec env "${FLAG_ENV[@]}" \
    DATABASE_URL="$DATABASE_URL" AUTH_PROVIDER=stub PORT="$API_PORT" NODE_ENV=development \
    JWT_SECRET="screenshots-$(openssl rand -hex 16)" \
    STUB_SAFETY_SCORES="199001011234:7" \
    node src/index.js
) >"$LOGS/backend.log" 2>&1 &
API_PID=$!
LOCAL_FLAGS=""
for _ in $(seq 1 60); do
  LOCAL_FLAGS=$(curl -fsS --max-time 2 "$API/api/features" 2>/dev/null) && break
  kill -0 "$API_PID" 2>/dev/null || { err "backend exited, see $LOGS/backend.log"; tail -20 "$LOGS/backend.log" >&2; exit 1; }
  sleep 0.5
done
[[ -n "$LOCAL_FLAGS" ]] || { err "backend never answered, see $LOGS/backend.log"; exit 1; }
node -e 'const [a,b]=process.argv.slice(1).map(s=>JSON.stringify(JSON.parse(s).flags)); if(a!==b){console.error(`local ${b} != production ${a}`); process.exit(1)}' \
  "$FLAGS_JSON" "$LOCAL_FLAGS" || { err "local flags do not match production"; exit 1; }
ok "Backend up, flags match production"

# --- 3. Simulator ------------------------------------------------------------
sim_field() {  # sim_field <field>: one field (udid, state) of the device named $SIM_NAME
  xcrun simctl list devices available -j | node -e '
    const d = JSON.parse(require("fs").readFileSync(0, "utf8")).devices
    const dev = Object.values(d).flat().find((x) => x.name === process.argv[1])
    if (dev) console.log(dev[process.argv[2]])
  ' "$SIM_NAME" "$1"
}
UDID=$(sim_field udid)
if [[ -z "$UDID" ]]; then
  RUNTIME=$(xcrun simctl list runtimes available -j | node -e '
    const r = JSON.parse(require("fs").readFileSync(0, "utf8")).runtimes.filter((x) => x.platform === "iOS")
    r.sort((a, b) => a.version.localeCompare(b.version, undefined, { numeric: true }))
    if (r.length) console.log(r[r.length - 1].identifier)
  ')
  [[ -n "$RUNTIME" ]] || { err "no iOS simulator runtime installed"; exit 1; }
  log "Creating simulator '$SIM_NAME' (iPhone 16 Plus, $RUNTIME)..."
  UDID=$(xcrun simctl create "$SIM_NAME" "$SIM_TYPE" "$RUNTIME")
fi
if [[ "$(sim_field state)" != "Booted" ]]; then
  xcrun simctl boot "$UDID"
  WE_BOOTED=1
fi
xcrun simctl bootstatus "$UDID" >/dev/null
ok "Simulator $SIM_NAME $UDID"

# --- 4. Screenshot build -----------------------------------------------------
if (( SKIP_BUILD == 0 )); then
  cp "$PLIST" "$PLIST_BACKUP"
  PLIST_TOUCHED=1
  /usr/libexec/PlistBuddy -c "Add :NSAppTransportSecurity dict" "$PLIST" 2>/dev/null || true
  /usr/libexec/PlistBuddy -c "Delete :NSAppTransportSecurity:NSAllowsLocalNetworking" "$PLIST" 2>/dev/null || true
  /usr/libexec/PlistBuddy -c "Add :NSAppTransportSecurity:NSAllowsLocalNetworking bool true" "$PLIST"

  log "Building the web bundle in screenshot mode..."
  ( cd "$FRONTEND" && VITE_SCREENSHOT_MODE=1 VITE_SCREENSHOT_API_BASE="$API" \
      VITE_SCREENSHOT_DIRECTOR="http://localhost:$DIRECTOR_PORT" npm run build >"$LOGS/web-build.log" 2>&1 \
    && npx cap copy ios >>"$LOGS/web-build.log" 2>&1 ) || { err "web build failed, see $LOGS/web-build.log"; exit 1; }

  log "Building the app for the simulator (Release)..."
  xcodebuild \
    -workspace "$FRONTEND/ios/App/App.xcworkspace" -scheme App -configuration Release \
    -sdk iphonesimulator -destination "platform=iOS Simulator,id=$UDID" \
    -derivedDataPath "$DERIVED" \
    CODE_SIGN_IDENTITY="" CODE_SIGNING_REQUIRED=NO CODE_SIGNING_ALLOWED=NO \
    build >"$LOGS/xcodebuild.log" 2>&1 || { err "xcodebuild failed, see $LOGS/xcodebuild.log"; tail -20 "$LOGS/xcodebuild.log" >&2; exit 1; }
fi
APP_PATH="$DERIVED/Build/Products/Release-iphonesimulator/App.app"
[[ -d "$APP_PATH" ]] || { err "no build at $APP_PATH; run without --skip-build"; exit 1; }
grep -rqF --include='*.js' 'covey-screenshot-mode' "$APP_PATH/public" \
  || { err "$APP_PATH is not a screenshot-mode build"; exit 1; }

# --- 5. Install, pin the status bar, capture -------------------------------
# A fresh install also clears any demoMode left in localStorage by the easter egg.
xcrun simctl terminate "$UDID" "$BUNDLE_ID" >/dev/null 2>&1 || true
xcrun simctl uninstall "$UDID" "$BUNDLE_ID" >/dev/null 2>&1 || true
xcrun simctl install "$UDID" "$APP_PATH"
# "discharging" at 100%: on iOS 26 "charged" draws a green battery with a bolt.
xcrun simctl status_bar "$UDID" override --time 09:41 --dataNetwork wifi --wifiMode active \
  --wifiBars 3 --cellularMode active --cellularBars 4 --batteryState discharging --batteryLevel 100

rm -rf "$OUT" && mkdir -p "$OUT"
xcrun simctl launch "$UDID" "$BUNDLE_ID" >/dev/null
log "Capturing..."
node "$SCRIPT_DIR/screenshots/capture.mjs" \
  --api "$API" --db "$DATABASE_URL" --director-port "$DIRECTOR_PORT" --udid "$UDID" --out "$OUT"

ls -1 "$OUT"
ok "Screenshots in $OUT. Upload with: $SCRIPT_DIR/11-upload-screenshots.sh (dry-run first)"
