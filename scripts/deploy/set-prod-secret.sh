#!/usr/bin/env bash
# Idempotently set (or replace) a single env var line in production .env.prod
# and restart the backend service so it picks up the new value.
#
# Usage:
#   scripts/deploy/set-prod-secret.sh <var-line-file>
#
# Where <var-line-file> contains exactly ONE line of the form:
#     KEY='value'
#   or:
#     KEY=value
#
# The line MUST be safe for Docker Compose env-file parsing — single-quoted
# values preserve backslashes (so JSON strings with literal "\n" survive
# intact for Node JSON.parse), double-quoted values process escapes.
#
# Required env vars (export before calling, or set in scripts/deploy/.env.local):
#   PROD_HOST       e.g. 46.246.48.39
#   PROD_USER       SSH user (typically `tillsammans` — original GleSYS user)
#   PROD_KEY        path to passphrase-free SSH private key
#   PROD_SUDO_PASS  sudo password for PROD_USER
#   PROD_DEPLOY_USER user the docker stack runs as (typically `deploy`)
#   PROD_APP_DIR    e.g. /home/deploy/apps/tillsammans
#
# Idempotent: re-running with the same input produces the same end state.

set -euo pipefail

LINE_FILE="${1:?usage: $0 <var-line-file>}"
[[ -f "$LINE_FILE" ]] || { echo "✗ $LINE_FILE not found" >&2; exit 1; }

# Load deployment config (this file is gitignored)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ENV_LOCAL="$SCRIPT_DIR/.env.local"
[[ -f "$ENV_LOCAL" ]] || {
  echo "✗ $ENV_LOCAL not found — copy .env.local.example and fill in values" >&2
  exit 1
}
# shellcheck disable=SC1090
set -a; source "$ENV_LOCAL"; set +a

: "${PROD_HOST:?}"; : "${PROD_USER:?}"; : "${PROD_KEY:?}"
: "${PROD_SUDO_PASS:?}"; : "${PROD_DEPLOY_USER:?}"; : "${PROD_APP_DIR:?}"

[[ -f "$PROD_KEY" ]] || { echo "✗ SSH key not found at $PROD_KEY" >&2; exit 1; }

# Extract the variable name (everything before the first =)
VAR_NAME=$(head -1 "$LINE_FILE" | cut -d= -f1)
[[ -n "$VAR_NAME" ]] || { echo "✗ Could not parse var name from $LINE_FILE" >&2; exit 1; }

log()  { printf '\033[1;36m▶ %s\033[0m\n' "$*"; }
ok()   { printf '\033[1;32m✓ %s\033[0m\n' "$*"; }
err()  { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; }

SSH=(ssh -i "$PROD_KEY" -o BatchMode=yes -o ConnectTimeout=15 "$PROD_USER@$PROD_HOST")
SCP=(scp -i "$PROD_KEY" -o BatchMode=yes -o ConnectTimeout=15)

REMOTE_TMP="/tmp/.${VAR_NAME}.$$"

log "Uploading line file to ${PROD_HOST}:${REMOTE_TMP}"
"${SCP[@]}" "$LINE_FILE" "$PROD_USER@$PROD_HOST:$REMOTE_TMP"
ok "Uploaded ($(wc -c < "$LINE_FILE") bytes)"

log "Injecting $VAR_NAME into $PROD_APP_DIR/.env.prod (sudo as $PROD_DEPLOY_USER)"
# Pipe the sudo password on stdin to `sudo -S`. The password is read once
# at the start; the remaining stdin is consumed by the sudo'd shell.
"${SSH[@]}" "
  set -e
  PASS=\$(head -1)
  echo \"\$PASS\" | sudo -S -k -p '' bash -se <<'REMOTE'
    set -e
    APP=\"$PROD_APP_DIR\"
    ENV=\"\$APP/.env.prod\"
    NEW_LINE=\$(cat \"$REMOTE_TMP\")

    [[ -f \"\$ENV\" ]] || { echo \"\$ENV not found\" >&2; exit 1; }

    # Strip any existing line for this variable, append the new one.
    cp \"\$ENV\" \"\$ENV.bak.\$(date +%s)\"
    grep -v \"^${VAR_NAME}=\" \"\$ENV\" > \"\$ENV.new\"
    cat \"$REMOTE_TMP\" >> \"\$ENV.new\"
    grep -q '\$' \"\$ENV.new\" && [[ \"\$(tail -c1 \"\$ENV.new\" | xxd -p)\" != '0a' ]] && echo \"\" >> \"\$ENV.new\"

    chown $PROD_DEPLOY_USER:$PROD_DEPLOY_USER \"\$ENV.new\"
    chmod 600 \"\$ENV.new\"
    mv \"\$ENV.new\" \"\$ENV\"
    rm -f \"$REMOTE_TMP\"

    echo \"OK: \$ENV updated (\$(wc -l < \"\$ENV\") lines, \$(stat -c %a \"\$ENV\"))\"
    echo \"VAR_LEN: \$(grep -c \"^${VAR_NAME}=\" \"\$ENV\") line(s) starting with ${VAR_NAME}=\"
REMOTE
" <<< "$PROD_SUDO_PASS"
ok "$VAR_NAME persisted in .env.prod"

log "Pulling latest from git as $PROD_DEPLOY_USER"
"${SSH[@]}" "
  PASS=\$(head -1)
  echo \"\$PASS\" | sudo -S -k -p '' -u $PROD_DEPLOY_USER bash -c 'cd $PROD_APP_DIR && git pull --ff-only 2>&1 | tail -10'
" <<< "$PROD_SUDO_PASS"

log "Restarting backend service (this picks up the new env)"
"${SSH[@]}" "
  PASS=\$(head -1)
  echo \"\$PASS\" | sudo -S -k -p '' -u $PROD_DEPLOY_USER bash -c '
    cd $PROD_APP_DIR
    docker compose --env-file .env.prod -f docker-compose.yml -f docker-compose.prod.yml up -d backend 2>&1 | tail -15
  '
" <<< "$PROD_SUDO_PASS"
ok "Backend restarted"

log "Verifying $VAR_NAME inside container (length only, never the value)"
sleep 4
"${SSH[@]}" "
  PASS=\$(head -1)
  echo \"\$PASS\" | sudo -S -k -p '' -u $PROD_DEPLOY_USER bash -c '
    cd $PROD_APP_DIR
    docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T backend sh -c \"
      if [ -n \\\"\\\$$VAR_NAME\\\" ]; then
        echo \\\"$VAR_NAME length: \\\${#$VAR_NAME}\\\"
      else
        echo MISSING
      fi
    \"
  '
" <<< "$PROD_SUDO_PASS"

log "Recent backend logs"
"${SSH[@]}" "
  PASS=\$(head -1)
  echo \"\$PASS\" | sudo -S -k -p '' -u $PROD_DEPLOY_USER bash -c '
    cd $PROD_APP_DIR
    docker compose -f docker-compose.yml -f docker-compose.prod.yml logs --tail=30 backend
  '
" <<< "$PROD_SUDO_PASS"

ok "Done."
