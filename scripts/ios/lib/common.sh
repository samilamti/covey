#!/usr/bin/env bash
# Shared helpers sourced by all step scripts.
# - Loads .env.ios (or .env.ios.example for first-run defaults)
# - Provides project root path
# - Provides logging helpers

set -euo pipefail

# Path to scripts/ios/ regardless of where the caller runs from
SCRIPT_IOS_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_IOS_DIR/../.." && pwd )"
BUILD_DIR="$PROJECT_ROOT/build/ios"

# Load env (prefer .env.ios, fall back to .env.ios.example for hint values).
# `set -a` auto-exports every variable assigned during sourcing — needed so
# subprocesses (python, xcodebuild, altool) inherit them.
set -a
if [[ -f "$SCRIPT_IOS_DIR/.env.ios" ]]; then
  # shellcheck disable=SC1090,SC1091
  source "$SCRIPT_IOS_DIR/.env.ios"
elif [[ -f "$SCRIPT_IOS_DIR/.env.ios.example" ]]; then
  echo "ℹ️  .env.ios not found, using .env.ios.example values" >&2
  # shellcheck disable=SC1090,SC1091
  source "$SCRIPT_IOS_DIR/.env.ios.example"
else
  set +a
  echo "❌ scripts/ios/.env.ios not found and no example to fall back on" >&2
  exit 1
fi
set +a

# CocoaPods 1.16 + Ruby 4.0 crashes with "Unicode Normalization not appropriate
# for ASCII-8BIT" if LANG isn't UTF-8. Set defensively for every script.
export LANG="${LANG:-en_US.UTF-8}"
export LC_ALL="${LC_ALL:-en_US.UTF-8}"

log()   { printf '\033[1;36m▶ %s\033[0m\n' "$*"; }
ok()    { printf '\033[1;32m✓ %s\033[0m\n' "$*"; }
warn()  { printf '\033[1;33m⚠ %s\033[0m\n' "$*"; }
err()   { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; }
