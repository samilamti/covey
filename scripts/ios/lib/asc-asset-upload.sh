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
#   ASSET_ID=$(asc_upload_asset "/appScreenshots" "$create_body_json" "/path/to/file.png") || exit 1
#   echo "$ASSET_ID"
#
# Returns non-zero, and prints no id, if ANY step fails. Callers must check it:
# the function runs inside $(...), where bash does not apply set -e.
#
# Two traps this is written around:
#   * The chunk URLs point at Apple's asset store, not the ASC API. They must get
#     ONLY the headers the operation lists; the ASC bearer token earns a bare 400.
#   * The reservation JSON goes to Python through a FILE. An earlier version piped
#     it in while also feeding the Python script through a heredoc on the same
#     stdin. The heredoc wins, the JSON never arrives, no bytes are uploaded, the
#     commit PATCH fails, and the error was swallowed. Every "uploaded" asset was
#     left AWAITING_UPLOAD (found 2026-09-24).

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

  local resp_file
  resp_file=$(mktemp "${TMPDIR:-/tmp}/asc-reserve.XXXXXX")

  # 1. Reserve
  if ! asc_post "$create_path" "$create_body" > "$resp_file"; then
    rm -f "$resp_file"; return 1
  fi
  local asset_id asset_type
  asset_id=$("$PY" -c 'import json,sys; print(json.load(open(sys.argv[1]))["data"]["id"])' "$resp_file") \
    || { rm -f "$resp_file"; return 1; }
  asset_type=$("$PY" -c 'import json,sys; print(json.load(open(sys.argv[1]))["data"]["type"])' "$resp_file") \
    || { rm -f "$resp_file"; return 1; }

  # 2. PUT each chunk, checking the HTTP status (curl exits 0 on a 4xx/5xx)
  if ! "$PY" - "$resp_file" "$file_path" <<'PY'
import json, subprocess, sys
data = json.load(open(sys.argv[1]))
blob = open(sys.argv[2], "rb").read()
ops = data["data"]["attributes"]["uploadOperations"] or []
if not ops:
    sys.exit("asc_upload_asset: reservation returned no uploadOperations")
for op in ops:
    chunk = blob[op["offset"]:op["offset"] + op["length"]]
    headers = []
    for h in op.get("requestHeaders") or []:
        headers += ["-H", f'{h["name"]}: {h["value"]}']
    cmd = ["curl", "-sS", "--globoff", "-o", "/dev/null", "-w", "%{http_code}",
           "-X", op["method"], op["url"], *headers, "--data-binary", "@-"]
    r = subprocess.run(cmd, input=chunk, capture_output=True)
    code = r.stdout.decode().strip()
    if r.returncode != 0 or not code.startswith("2"):
        sys.exit(f"asc_upload_asset: chunk at offset {op['offset']} → HTTP {code} {r.stderr.decode().strip()}")
PY
  then
    rm -f "$resp_file"; return 1
  fi
  rm -f "$resp_file"

  # 3. Commit with the MD5 checksum
  local md5_hex commit_body
  md5_hex=$(md5 -q "$file_path")
  commit_body=$("$PY" -c '
import json, sys
print(json.dumps({"data": {"type": sys.argv[1], "id": sys.argv[2],
  "attributes": {"uploaded": True, "sourceFileChecksum": sys.argv[3]}}}))
' "$asset_type" "$asset_id" "$md5_hex")
  asc_patch "/${asset_type}/${asset_id}" "$commit_body" >/dev/null || return 1

  printf '%s' "$asset_id"
}
