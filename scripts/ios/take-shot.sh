#!/usr/bin/env bash
# Take a single screenshot of the booted iOS simulator.
#
# Usage: ./scripts/ios/take-shot.sh <name>
#   e.g. ./scripts/ios/take-shot.sh login-pending
#
# Saves to build/ios/screenshots/<NN>-<name>.png with auto-incrementing prefix.

set -euo pipefail
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

NAME="${1:-}"
[[ -n "$NAME" ]] || { err "Usage: $0 <name>"; exit 1; }

SHOTS_DIR="$BUILD_DIR/screenshots"
mkdir -p "$SHOTS_DIR"

# Auto-numbering: find highest existing prefix and increment
HIGHEST=0
for f in "$SHOTS_DIR"/*.png; do
  [[ -e "$f" ]] || continue
  base=$(basename "$f")
  if [[ "$base" =~ ^([0-9]+)- ]]; then
    n=$((10#${BASH_REMATCH[1]}))
    (( n > HIGHEST )) && HIGHEST=$n
  fi
done
NEXT=$(printf '%02d' $((HIGHEST + 1)))
DEST="$SHOTS_DIR/$NEXT-$NAME.png"

xcrun simctl io booted screenshot "$DEST" 2>&1 | grep -v "Detected\|Defaulting" || true
ok "Saved $DEST ($(sips -g pixelWidth -g pixelHeight "$DEST" 2>/dev/null | tail -2 | tr -d '\n'))"
