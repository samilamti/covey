#!/usr/bin/env bash
# Step 00 — Verify prerequisites and install the App Store Connect API key
# at the canonical location where altool/xcodebuild auto-discover it.

set -euo pipefail
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

log "Checking Xcode..."
if ! xcode-select -p >/dev/null 2>&1; then
  err "Xcode command-line tools not installed. Run: xcode-select --install"
  exit 1
fi
ok "Xcode at $(xcode-select -p)"

log "Checking CocoaPods..."
if ! command -v pod >/dev/null 2>&1; then
  err "CocoaPods not installed. Run: brew install cocoapods"
  exit 1
fi
ok "CocoaPods $(pod --version)"

log "Checking Node.js..."
if ! command -v node >/dev/null 2>&1; then
  warn "Node.js not installed."
  echo "    Install with: brew install node"
  echo "    Or use nvm:   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash"
  echo "                  nvm install 22"
  exit 1
fi
ok "Node.js $(node --version)"

log "Checking Python 3 + cryptography (needed for JWT signing)..."
if ! command -v python3 >/dev/null 2>&1; then
  err "python3 not found"
  exit 1
fi

# macOS Homebrew Python is PEP 668 "externally managed" — use a venv at scripts/ios/.venv
VENV="$SCRIPT_IOS_DIR/.venv"
if [[ ! -f "$VENV/bin/python3" ]]; then
  log "Creating Python venv at $VENV..."
  python3 -m venv "$VENV"
fi
if ! "$VENV/bin/python3" -c "import cryptography" 2>/dev/null; then
  log "Installing 'cryptography' in venv..."
  "$VENV/bin/pip" install --quiet --upgrade pip
  "$VENV/bin/pip" install --quiet cryptography
fi
ok "Python $("$VENV/bin/python3" --version | awk '{print $2}') + cryptography ready (venv)"

log "Installing App Store Connect API key..."
KEYS_DIR="$HOME/.appstoreconnect/private_keys"
mkdir -p "$KEYS_DIR"
chmod 700 "$HOME/.appstoreconnect" "$KEYS_DIR"

DEST_KEY="$KEYS_DIR/AuthKey_${ASC_KEY_ID}.p8"
# Apple's download names vary: "AuthKey_<id>.p8" (current) or "ApiKey_<id>.p8" (older)
SRC_KEY=""
for candidate in \
  "$HOME/Downloads/AuthKey_${ASC_KEY_ID}.p8" \
  "$HOME/Downloads/ApiKey_${ASC_KEY_ID}.p8"; do
  [[ -f "$candidate" ]] && { SRC_KEY="$candidate"; break; }
done

if [[ -f "$DEST_KEY" ]]; then
  ok "API key already installed at $DEST_KEY"
elif [[ -n "$SRC_KEY" ]]; then
  cp "$SRC_KEY" "$DEST_KEY"
  chmod 600 "$DEST_KEY"
  ok "Installed API key from $SRC_KEY → $DEST_KEY"
else
  err "API key not found. Place AuthKey_${ASC_KEY_ID}.p8 at $DEST_KEY"
  err "  or place AuthKey_${ASC_KEY_ID}.p8 / ApiKey_${ASC_KEY_ID}.p8 in ~/Downloads/ and rerun."
  exit 1
fi

# Verify ASC_KEY_PATH points to the installed key
if [[ "$ASC_KEY_PATH" != "$DEST_KEY" ]]; then
  warn ".env.ios ASC_KEY_PATH ($ASC_KEY_PATH) doesn't match canonical path ($DEST_KEY)"
  warn "altool may not find the key automatically — using --apiKeyPath would be needed."
fi

log "Validating App Store Connect credentials..."
# shellcheck source=lib/asc-jwt.sh
source "$SCRIPT_DIR/lib/asc-jwt.sh"
# shellcheck source=lib/asc-curl.sh
source "$SCRIPT_DIR/lib/asc-curl.sh"

# A simple authenticated GET — list users (paginated to 1) to verify auth works
if asc_get "/users?limit=1" >/dev/null 2>&1; then
  ok "App Store Connect API authentication works"
else
  err "App Store Connect API auth failed. Check ASC_KEY_ID, ASC_ISSUER_ID, and the .p8 key."
  exit 1
fi

ok "All prerequisites satisfied."
