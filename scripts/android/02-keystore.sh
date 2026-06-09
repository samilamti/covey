#!/usr/bin/env bash
# Step 02 — Ensure an upload keystore exists and its password is in the Keychain.
# Idempotent: if the keystore already exists it is left untouched.

set -euo pipefail
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

KS="${KEYSTORE_PATH:-$ANDROID_PROJECT/covey-upload.jks}"
ALIAS="${KEY_ALIAS:-covey-upload}"
PWSVC="${KEYCHAIN_PASSWORD_SERVICE:-covey-upload-keystore-password}"

if [[ -f "$KS" ]]; then
  ok "Keystore already exists at $KS"
  if [[ -z "$(keychain_get "$PWSVC")" ]]; then
    err "Keystore exists but its password is NOT in the Keychain — cannot rebuild it."
    err "  Restore the password: security add-generic-password -U -a $KEYCHAIN_ACCOUNT -s $PWSVC -w '<pw>'"
    exit 1
  fi
  ok "Password present in Keychain ($KEYCHAIN_ACCOUNT / $PWSVC)"
  exit 0
fi

log "Generating upload keystore at $KS..."
export COVEY_KS_PASS="$(python3 -c 'import secrets; print(secrets.token_urlsafe(24))')"
security add-generic-password -U -a "$KEYCHAIN_ACCOUNT" -s "$PWSVC" -w "$COVEY_KS_PASS"
ok "Password stored in Keychain"

keytool -genkeypair \
  -keystore "$KS" \
  -alias "$ALIAS" \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass:env COVEY_KS_PASS \
  -keypass:env COVEY_KS_PASS \
  -dname "CN=$APP_NAME, O=$APP_NAME, L=Stockholm, ST=Stockholm, C=SE"
ok "Keystore generated"

# Back up the (binary) keystore as single-line base64 into the Keychain.
security add-generic-password -U -a "$KEYCHAIN_ACCOUNT" -s covey-upload-keystore-b64 \
  -w "$(base64 -i "$KS" | tr -d '\n')"
ok "Keystore base64 backed up to Keychain (service: covey-upload-keystore-b64)"

log "Upload-key SHA-256 (matches what Play App Signing will show):"
keytool -list -v -keystore "$KS" -storepass:env COVEY_KS_PASS 2>/dev/null | grep "SHA256:" | head -1
