#!/usr/bin/env bash
# Fail if a web bundle was built in screenshot mode.
#
# Usage:
#   scripts/ios/lib/assert-no-screenshot-mode.sh <dir-or-.ipa> [...]
#
# Pass a web bundle directory (frontend/dist, frontend/ios/App/App/public,
# the Android assets/public dir) or an .ipa. Exits 1 if any of them holds a
# screenshot build.
#
# Why: 08-screenshots.sh builds with VITE_SCREENSHOT_MODE=1, which points the
# app at a localhost backend and lets a local script drive it. It restores a
# normal build when it finishes, but a killed run can leave the screenshot
# bundle sitting in the native projects, where the next archive would ship it.
# This check runs in the release path (01 build, 06 export) so that cannot
# happen quietly. The markers are:
#   covey-screenshot-mode  the module's own marker string (screenshot-mode.js)
#   http://localhost       a release bundle points at https://covey.se only

set -euo pipefail

[[ $# -gt 0 ]] || { echo "usage: $0 <dir-or-.ipa> [...]" >&2; exit 2; }

MARKERS=("covey-screenshot-mode" "http://localhost")
found=0
scratch=""
trap '[[ -n "$scratch" ]] && rm -rf "$scratch"' EXIT

for target in "$@"; do
  dir="$target"
  if [[ -f "$target" && "$target" == *.ipa ]]; then
    [[ -n "$scratch" ]] && rm -rf "$scratch"
    scratch=$(mktemp -d "${TMPDIR:-/tmp}/ipa-check.XXXXXX")
    unzip -q "$target" 'Payload/*.app/public/*' -d "$scratch"
    dir="$scratch"
  fi
  [[ -d "$dir" ]] || { echo "assert-no-screenshot-mode: not found: $target" >&2; exit 2; }

  js_count=$(find "$dir" -name '*.js' | wc -l | tr -d ' ')
  (( js_count > 0 )) || { echo "assert-no-screenshot-mode: no .js files under $target" >&2; exit 2; }

  for m in "${MARKERS[@]}"; do
    hits=$(grep -rlF --include='*.js' -- "$m" "$dir" || true)
    if [[ -n "$hits" ]]; then
      echo "✗ screenshot-mode build detected in $target (marker '$m'):" >&2
      echo "$hits" | sed 's/^/    /' >&2
      found=1
    fi
  done
done

if (( found )); then
  echo "  Rebuild normally: (cd frontend && npm run build && npx cap copy ios)" >&2
  exit 1
fi
echo "✓ no screenshot-mode code in: $*"
