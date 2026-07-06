#!/bin/bash
# prod-exec.sh — run a command or script as root on the production VPS.
#
# Usage:
#   bash scripts/deploy/prod-exec.sh 'free -m; docker ps'      # inline command
#   bash scripts/deploy/prod-exec.sh -f local-script.sh        # send a local script file
#
# Reads SSH/sudo config from scripts/deploy/.env.local (see .env.local.example).
# Auth: uses ssh-agent (load the key with `ssh-add --apple-use-keychain ~/.ssh/covey.se`);
# falls back to $PROD_KEY if the agent has no identity for the host.
#
# Implementation note: sudo's password is line 1 of the stdin stream and the
# script body is lines 2+ — `sudo -S` consumes the first line, `bash -s` reads
# the rest. This avoids the heredoc-as-sudo-password bug (see README.md).
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$DIR/.env.local"
[ -f "$ENV_FILE" ] || { echo "missing $ENV_FILE (copy .env.local.example)" >&2; exit 1; }
# shellcheck source=/dev/null
source "$ENV_FILE"

if [ "${1:-}" = "-f" ]; then
  [ -n "${2:-}" ] && [ -f "$2" ] || { echo "usage: prod-exec.sh -f <script-file>" >&2; exit 1; }
  BODY_CMD=(cat "$2")
else
  [ -n "${1:-}" ] || { echo "usage: prod-exec.sh '<command>' | prod-exec.sh -f <script-file>" >&2; exit 1; }
  BODY_CMD=(printf '%s\n' "$1")
fi

{ printf '%s\n' "$PROD_SUDO_PASS"; "${BODY_CMD[@]}"; } |
  ssh -o BatchMode=yes -o ConnectTimeout=15 "$PROD_USER@$PROD_HOST" \
    'sudo -S -k -p "" bash -s'
