#!/usr/bin/env bash
# App Store Connect asset upload — 3-step protocol.
#
# Apple's "reservation" upload pattern:
#   1. POST a "create" request (e.g. /v1/appScreenshots) with file metadata.
#      Response includes attributes.uploadOperations[] with a method, URL,
#      headers, offset, and length for each chunk to upload.
#   2. For each operation, PUT raw bytes to its url with the prescribed
#      headers, slicing the local file at [offset, offset+length).
#   3. PATCH the asset resource with sourceFileChecksum (MD5 hex) and
#      uploaded=true to commit.
#
# Usage:
#   source scripts/ios/lib/asc-asset-upload.sh
#   ASSET_ID=$(asc_upload_asset "/appScreenshots" "$create_body_json" "/path/to/file.png")
#   echo "$ASSET_ID"

set -euo pipefail

asc_upload_asset() {
  local create_path=$1
  local create_body=$2
  local file_path=$3

  [[ -f "$file_path" ]] || { echo "asc_upload_asset: file not found: $file_path" >&2; return 1; }

  local SCRIPT_DIR_LOCAL
  SCRIPT_DIR_LOCAL="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
  local PY="$SCRIPT_DIR_LOCAL/../.venv/bin/python3"
  [[ -x "$PY" ]] || PY="python3"

  # 1. Create the asset
  local create_response asset_id
  create_response=$(asc_post "$create_path" "$create_body")
  asset_id=$(printf '%s' "$create_response" | "$PY" -c 'import json,sys; print(json.load(sys.stdin)["data"]["id"])')

  # 2. Upload each chunk
  printf '%s' "$create_response" | "$PY" - "$file_path" <<'PY' >/dev/null
import json, sys, subprocess, os
data = json.load(sys.stdin)
file_path = sys.argv[1]
ops = data["data"]["attributes"]["uploadOperations"]
with open(file_path, "rb") as f:
    blob = f.read()
for op in ops:
    chunk = blob[op["offset"]:op["offset"]+op["length"]]
    headers = []
    for h in op.get("requestHeaders", []):
        headers.append("-H")
        headers.append(f'{h["name"]}: {h["value"]}')
    cmd = ["curl", "-sS", "--globoff", "-X", op["method"], op["url"], *headers, "--data-binary", "@-"]
    r = subprocess.run(cmd, input=chunk, capture_output=True)
    if r.returncode != 0:
        sys.stderr.write(f"chunk upload failed: {r.stderr.decode()}\n")
        sys.exit(1)
PY

  # 3. Compute MD5 + commit
  local md5_hex
  md5_hex=$(md5 -q "$file_path")

  local commit_body
  commit_body=$("$PY" -c "
import json
print(json.dumps({
  'data': {
    'type': '$(printf '%s' "$create_response" | "$PY" -c 'import json,sys; print(json.load(sys.stdin)["data"]["type"])')',
    'id': '$asset_id',
    'attributes': { 'uploaded': True, 'sourceFileChecksum': '$md5_hex' }
  }
}))
")

  local resource_path
  resource_path=$(printf '%s' "$create_response" | "$PY" -c 'import json,sys; t=json.load(sys.stdin)["data"]["type"]; print(f"/{t}")')
  asc_patch "${resource_path}/${asset_id}" "$commit_body" >/dev/null

  printf '%s' "$asset_id"
}
