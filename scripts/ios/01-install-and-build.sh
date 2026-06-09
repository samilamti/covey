#!/usr/bin/env bash
# Step 01 — Install dependencies and build the web bundle, then sync to iOS.

set -euo pipefail
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

cd "$PROJECT_ROOT/frontend"

log "Installing frontend dependencies..."
npm install --no-audit --no-fund
ok "Frontend deps installed"

log "Building frontend (Vite production build)..."
npm run build
ok "Built dist/ ($(du -sh dist | awk '{print $1}'))"

log "Syncing web bundle into iOS project (npx cap sync ios)..."
npx cap sync ios
ok "Capacitor sync complete"

log "Installing CocoaPods for iOS..."
cd "$PROJECT_ROOT/frontend/ios/App"
pod install --repo-update
ok "Pods installed"
