#!/usr/bin/env bash
# Google Play Developer API (androidpublisher v3) curl wrapper.
#
# Usage (after sourcing common.sh, with PLAY_SA_JSON pointing at the
# service-account JSON downloaded from Play Console → Setup → API access):
#   source scripts/android/lib/play-api.sh
#   play_get  "/applications/$PACKAGE_NAME/edits/$EDIT/tracks"
#   play_post "/applications/$PACKAGE_NAME/edits" ''
#   play_upload_bundle "$EDIT" "$AAB_PATH"
#
# Each json function prints the response body to stdout and returns non-zero
# (printing the error JSON to stderr) on a non-2xx response.

set -euo pipefail

PLAY_API_BASE="${PLAY_API_BASE:-https://androidpublisher.googleapis.com/androidpublisher/v3}"
PLAY_UPLOAD_BASE="${PLAY_UPLOAD_BASE:-https://androidpublisher.googleapis.com/upload/androidpublisher/v3}"
_PLAY_TOKEN=""

# Mint (and cache for this process) an androidpublisher access token.
play_token() {
  if [[ -z "$_PLAY_TOKEN" ]]; then
    [[ -f "${PLAY_SA_JSON:-}" ]] || { echo "play-api: PLAY_SA_JSON not set or file missing: ${PLAY_SA_JSON:-<unset>}" >&2; return 1; }
    local py="$SCRIPT_ANDROID_DIR/.venv/bin/python3"
    [[ -x "$py" ]] || py="python3"
    _PLAY_TOKEN="$("$py" "$SCRIPT_ANDROID_DIR/lib/play-token.py" "$PLAY_SA_JSON")" || return 1
  fi
  echo "$_PLAY_TOKEN"
}

_play_request() {
  local method=$1; shift
  local path=$1; shift
  local body="${1-}"

  local token; token=$(play_token) || return 1
  local tmp_body tmp_status
  tmp_body=$(mktemp); tmp_status=$(mktemp)

  local args=(
    -sS --globoff
    -X "$method"
    -H "Authorization: Bearer $token"
    -H "Content-Type: application/json"
    -o "$tmp_body" -w "%{http_code}"
  )
  [[ -n "$body" ]] && args+=(--data "$body")

  curl "${args[@]}" "${PLAY_API_BASE}${path}" > "$tmp_status"
  local status; status=$(cat "$tmp_status"); rm -f "$tmp_status"

  local rc=0
  if [[ "$status" -lt 200 || "$status" -ge 300 ]]; then
    echo "play-api: $method $path → HTTP $status" >&2
    cat "$tmp_body" >&2; echo "" >&2
    rc=1
  else
    cat "$tmp_body"
  fi
  rm -f "$tmp_body"
  return $rc
}

play_get()    { _play_request GET    "$1"; }
play_post()   { _play_request POST   "$1" "${2-}"; }
play_put()    { _play_request PUT    "$1" "${2-}"; }
play_patch()  { _play_request PATCH  "$1" "${2-}"; }
play_delete() { _play_request DELETE "$1"; }

# Upload a binary (AAB or image) to an upload endpoint.
# Args: <method> <upload-path> <file> <content-type>
play_upload() {
  local method=$1 path=$2 file=$3 ctype=$4
  local token; token=$(play_token) || return 1
  local tmp_body tmp_status
  tmp_body=$(mktemp); tmp_status=$(mktemp)

  curl -sS --globoff \
    -X "$method" \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: $ctype" \
    --data-binary @"$file" \
    -o "$tmp_body" -w "%{http_code}" \
    "${PLAY_UPLOAD_BASE}${path}?uploadType=media" > "$tmp_status"

  local status; status=$(cat "$tmp_status"); rm -f "$tmp_status"
  local rc=0
  if [[ "$status" -lt 200 || "$status" -ge 300 ]]; then
    echo "play-api upload: $method $path → HTTP $status" >&2
    cat "$tmp_body" >&2; echo "" >&2
    rc=1
  else
    cat "$tmp_body"
  fi
  rm -f "$tmp_body"
  return $rc
}

# Convenience: upload an AAB to an open edit. Echoes the assigned versionCode.
play_upload_bundle() {
  local edit=$1 aab=$2
  play_upload POST "/applications/$PACKAGE_NAME/edits/$edit/bundles" "$aab" "application/octet-stream" \
    | python3 -c "import sys,json; print(json.load(sys.stdin)['versionCode'])"
}

# tiny JSON field reader for stdin
json_field() { python3 -c "import sys,json; d=json.load(sys.stdin); print(d$1)"; }
