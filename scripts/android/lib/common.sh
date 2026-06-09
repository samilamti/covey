#!/usr/bin/env bash
# Shared helpers sourced by all Android step scripts.
# Mirrors scripts/ios/lib/common.sh:
#   - Loads .env.android (or .env.android.example for first-run defaults)
#   - Provides project + build paths
#   - Provides logging helpers and a Keychain reader

set -euo pipefail

# Path to scripts/android/ regardless of where the caller runs from
SCRIPT_ANDROID_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_ANDROID_DIR/../.." && pwd )"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
ANDROID_PROJECT="$FRONTEND_DIR/android"
BUILD_DIR="$PROJECT_ROOT/build/android"
AAB_PATH="$ANDROID_PROJECT/app/build/outputs/bundle/release/app-release.aab"

# Load env (prefer .env.android, fall back to the example for hint values).
# `set -a` auto-exports every variable assigned during sourcing so subprocesses
# (python, gradlew, curl) inherit them.
set -a
if [[ -f "$SCRIPT_ANDROID_DIR/.env.android" ]]; then
  # shellcheck disable=SC1090,SC1091
  source "$SCRIPT_ANDROID_DIR/.env.android"
elif [[ -f "$SCRIPT_ANDROID_DIR/.env.android.example" ]]; then
  echo "ℹ️  .env.android not found, using .env.android.example values" >&2
  # shellcheck disable=SC1090,SC1091
  source "$SCRIPT_ANDROID_DIR/.env.android.example"
else
  set +a
  echo "❌ scripts/android/.env.android not found and no example to fall back on" >&2
  exit 1
fi
set +a

# Defensive locale (some Apple/Ruby tooling shares this machine; harmless here).
export LANG="${LANG:-en_US.UTF-8}"
export LC_ALL="${LC_ALL:-en_US.UTF-8}"

log()   { printf '\033[1;36m▶ %s\033[0m\n' "$*"; }
ok()    { printf '\033[1;32m✓ %s\033[0m\n' "$*"; }
warn()  { printf '\033[1;33m⚠ %s\033[0m\n' "$*"; }
err()   { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; }

# Read a secret from the macOS Keychain. Args: <service> [account]
keychain_get() {
  local service="$1"
  local account="${2:-${KEYCHAIN_ACCOUNT:-covey-android}}"
  security find-generic-password -a "$account" -s "$service" -w 2>/dev/null
}

# Resolve the Android SDK location for adb/emulator helpers.
android_sdk() {
  echo "${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}}"
}
