#!/usr/bin/env bash
# Step 03 — Build the signed release AAB.
#   vite build → cap sync android → gradlew bundleRelease
# Signing passwords are pulled from the Keychain into env vars that
# frontend/android/app/build.gradle reads.

set -euo pipefail
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

PWSVC="${KEYCHAIN_PASSWORD_SERVICE:-covey-upload-keystore-password}"
PW="$(keychain_get "$PWSVC")"
[[ -n "$PW" ]] || { err "No signing password in Keychain ($PWSVC). Run 02-keystore.sh first."; exit 1; }

export COVEY_UPLOAD_STORE_PASSWORD="$PW"
export COVEY_UPLOAD_KEY_PASSWORD="$PW"
export COVEY_UPLOAD_KEY_ALIAS="${KEY_ALIAS:-covey-upload}"
[[ -n "${KEYSTORE_PATH:-}" ]] && export COVEY_UPLOAD_KEYSTORE="$KEYSTORE_PATH"

log "Building web bundle (vite)..."
( cd "$FRONTEND_DIR" && npm run build >/dev/null )
ok "Web bundle built"

log "Syncing into the Android project (cap sync)..."
( cd "$FRONTEND_DIR" && npx cap sync android >/dev/null )
ok "Capacitor sync done"

log "Building signed release AAB (gradlew bundleRelease)..."
( cd "$ANDROID_PROJECT" && ./gradlew bundleRelease --console=plain )

[[ -f "$AAB_PATH" ]] || { err "AAB not produced at $AAB_PATH"; exit 1; }

log "Verifying signature..."
if jarsigner -verify "$AAB_PATH" >/dev/null 2>&1; then
  ok "AAB is signed: $AAB_PATH ($(du -h "$AAB_PATH" | cut -f1))"
else
  err "AAB signature verification failed"; exit 1
fi

VC=$(cd "$ANDROID_PROJECT" && ./gradlew -q :app:properties 2>/dev/null | grep -E '^versionCode|^versionName' || true)
log "Version info from Gradle:"; echo "$VC"
