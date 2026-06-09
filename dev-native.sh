#!/usr/bin/env bash
set -euo pipefail

# ── Usage ────────────────────────────────────────────────────────
# ./dev-native.sh ios      Start backend + Vite, then run iOS simulator
# ./dev-native.sh android  Start backend + Vite, then run Android emulator
# ─────────────────────────────────────────────────────────────────

PLATFORM="${1:-}"
if [[ "$PLATFORM" != "ios" && "$PLATFORM" != "android" ]]; then
  echo "Usage: $0 <ios|android>"
  exit 1
fi

ROOT="$(cd "$(dirname "$0")" && pwd)"
CAP_CONFIG="$ROOT/frontend/capacitor.config.ts"
PIDS=()

# ── Find local IP (macOS) ───────────────────────────────────────
LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)
if [[ -z "$LOCAL_IP" ]]; then
  echo "ERROR: Could not determine local IP address."
  echo "Make sure you are connected to a network."
  exit 1
fi
echo "Local IP: $LOCAL_IP"

# ── Back up and patch capacitor.config.ts ────────────────────────
cp "$CAP_CONFIG" "$CAP_CONFIG.bak"

cleanup() {
  echo ""
  echo "Restoring capacitor.config.ts..."
  mv "$CAP_CONFIG.bak" "$CAP_CONFIG"
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  echo "Done."
}
trap cleanup EXIT

sed -i '' \
  -e "s|// url: 'http://<your-local-ip>:5173',|url: 'http://$LOCAL_IP:5173',|" \
  -e "s|// cleartext: true,|cleartext: true,|" \
  "$CAP_CONFIG"
echo "Patched capacitor.config.ts → http://$LOCAL_IP:5173"

# ── Start backend ───────────────────────────────────────────────
echo "Starting backend..."
cd "$ROOT/backend" && npm run dev &
PIDS+=($!)

# ── Start Vite (needs --host so the simulator can reach it) ─────
echo "Starting Vite dev server..."
cd "$ROOT/frontend" && npx vite --host &
PIDS+=($!)

# ── Wait for backend to be ready ────────────────────────────────
echo "Waiting for backend on http://localhost:3000..."
until curl -s -o /dev/null "http://localhost:3000/api/features" 2>/dev/null; do
  sleep 1
done
echo "Backend is ready."

# ── Wait for Vite to be ready ───────────────────────────────────
echo "Waiting for Vite on http://$LOCAL_IP:5173..."
until curl -s -o /dev/null "http://$LOCAL_IP:5173" 2>/dev/null; do
  sleep 1
done
echo "Vite is ready."

# ── Sync and run the simulator ──────────────────────────────────
cd "$ROOT/frontend"
npx cap sync "$PLATFORM"
npx cap run "$PLATFORM"
