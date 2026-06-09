#!/usr/bin/env bash
# App Store Connect API curl wrapper.
#
# Usage (after sourcing .env.ios and asc-jwt.sh):
#   source scripts/ios/lib/asc-curl.sh
#   asc_get '/bundleIds?filter[identifier]=se.covey.app'
#   asc_post '/bundleIds' '{"data":{...}}'
#
# Each function:
#   - prints the response body to stdout
#   - returns non-zero and prints the error JSON to stderr on non-2xx
#
# Requires asc_jwt() from asc-jwt.sh to be in scope.

set -euo pipefail

ASC_API_BASE="${ASC_API_BASE:-https://api.appstoreconnect.apple.com/v1}"

_asc_request() {
  local method=$1; shift
  local path=$1; shift
  local body="${1-}"

  local jwt
  jwt=$(asc_jwt)

  local tmp_body tmp_status
  tmp_body=$(mktemp)
  tmp_status=$(mktemp)

  local args=(
    -sS
    --globoff           # ASC URLs use [brackets] for filter params; don't treat as glob
    -X "$method"
    -H "Authorization: Bearer $jwt"
    -H "Content-Type: application/json"
    -o "$tmp_body"
    -w "%{http_code}"
  )
  if [[ -n "$body" ]]; then
    args+=(--data "$body")
  fi

  curl "${args[@]}" "${ASC_API_BASE}${path}" > "$tmp_status"

  local status
  status=$(cat "$tmp_status")
  rm -f "$tmp_status"

  local rc=0
  if [[ "$status" -lt 200 || "$status" -ge 300 ]]; then
    echo "asc-curl: $method $path → HTTP $status" >&2
    cat "$tmp_body" >&2
    echo "" >&2
    rc=1
  else
    cat "$tmp_body"
  fi
  rm -f "$tmp_body"
  return $rc
}

asc_get()    { _asc_request GET    "$1"; }
asc_post()   { _asc_request POST   "$1" "$2"; }
asc_patch()  { _asc_request PATCH  "$1" "$2"; }
asc_delete() { _asc_request DELETE "$1"; }
