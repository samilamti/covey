#!/usr/bin/env bash
# Step 00 — Verify Android build + publish prerequisites.

set -euo pipefail
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

log "Checking Java (JDK 17 required by AGP 8.13)..."
command -v java >/dev/null 2>&1 || { err "java not found. Install Temurin 17: brew install --cask temurin@17"; exit 1; }
JV=$(java -version 2>&1 | head -1 | grep -oE '[0-9]+' | head -1)
[[ "$JV" -ge 17 ]] || { err "Java $JV found; need 17+."; exit 1; }
ok "Java $(java -version 2>&1 | head -1 | sed 's/.*version //')"

log "Checking Android SDK..."
SDK="$(android_sdk)"
[[ -d "$SDK" ]] || { err "Android SDK not found at $SDK. Set ANDROID_HOME."; exit 1; }
ok "Android SDK at $SDK"

log "Checking Node.js..."
command -v node >/dev/null 2>&1 || { err "Node.js not found. brew install node"; exit 1; }
ok "Node.js $(node --version)"

log "Checking gcloud (for the Firebase config fetch in 01)..."
if command -v gcloud >/dev/null 2>&1; then
  ok "gcloud $(gcloud --version 2>/dev/null | head -1 | awk '{print $4}') as $(gcloud config get-value account 2>/dev/null)"
else
  warn "gcloud not found — 01-firebase-config.sh will fall back to manual download instructions."
fi

log "Checking Python venv + cryptography (for the Play API token in 04/05)..."
command -v python3 >/dev/null 2>&1 || { err "python3 not found"; exit 1; }
VENV="$SCRIPT_ANDROID_DIR/.venv"
if [[ ! -x "$VENV/bin/python3" ]]; then
  log "Creating Python venv at $VENV..."
  python3 -m venv "$VENV"
fi
if ! "$VENV/bin/python3" -c "import cryptography" 2>/dev/null; then
  log "Installing 'cryptography' in venv..."
  "$VENV/bin/pip" install --quiet --upgrade pip
  "$VENV/bin/pip" install --quiet cryptography
fi
ok "Python $("$VENV/bin/python3" --version | awk '{print $2}') + cryptography ready (venv)"

log "Checking bundletool (optional — only for building a universal APK)..."
if command -v bundletool >/dev/null 2>&1; then
  ok "bundletool present"
else
  warn "bundletool not installed (brew install bundletool). Needed only for 06's on-device APK."
fi

# Validate Play API auth only if a service-account JSON is configured.
if [[ -f "${PLAY_SA_JSON:-}" ]]; then
  log "Validating Google Play Developer API access..."
  # shellcheck source=lib/play-api.sh
  source "$SCRIPT_DIR/lib/play-api.sh"
  if play_get "/applications/$PACKAGE_NAME/edits" '' >/dev/null 2>&1 \
     || play_post "/applications/$PACKAGE_NAME/edits" '' >/dev/null 2>&1; then
    ok "Play API authentication works for $PACKAGE_NAME"
  else
    warn "Play API auth/access failed. Confirm the service account is granted access to"
    warn "  the Covey app in Play Console → Users and permissions, and the app exists."
  fi
else
  warn "PLAY_SA_JSON not present (${PLAY_SA_JSON:-<unset>}) — publish steps 04/05 will be skipped."
  warn "  Create it via Play Console → Setup → API access (see scripts/android/README.md)."
fi

ok "Prerequisite check complete."
