#!/usr/bin/env bash
# Generate an ES256 JWT for the App Store Connect API.
#
# Usage:
#   source scripts/ios/lib/asc-jwt.sh
#   JWT=$(asc_jwt)
#
# Requires (sourced from .env.ios):
#   ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH
#
# Implementation: delegates to asc-jwt.py for reliable ECDSA signature handling.
# JWT is cached for 15 minutes to avoid regenerating on every API call.

set -euo pipefail

asc_jwt() {
  : "${ASC_KEY_ID:?ASC_KEY_ID not set}"
  : "${ASC_ISSUER_ID:?ASC_ISSUER_ID not set}"
  : "${ASC_KEY_PATH:?ASC_KEY_PATH not set}"

  local cache_file="/tmp/asc-jwt-${ASC_KEY_ID}"
  if [[ -f "$cache_file" ]]; then
    local mtime age
    mtime=$(stat -f %m "$cache_file" 2>/dev/null || stat -c %Y "$cache_file" 2>/dev/null || echo 0)
    age=$(( $(date +%s) - mtime ))
    if (( age < 900 )); then
      cat "$cache_file"
      return 0
    fi
  fi

  local script_dir
  script_dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

  # Prefer the venv python created by 00-prereqs.sh
  local py="$script_dir/../.venv/bin/python3"
  [[ -x "$py" ]] || py="python3"

  local jwt
  jwt=$("$py" "$script_dir/asc-jwt.py")
  printf '%s' "$jwt" > "$cache_file"
  printf '%s' "$jwt"
}
