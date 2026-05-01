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
# Required env vars (set in scripts/deploy/.env.local):
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

SSH_OPTS=(-i "$PROD_KEY" -o BatchMode=yes -o ConnectTimeout=15)
SSH_TARGET="$PROD_USER@$PROD_HOST"

# run_remote_sudo CMD…
# Pipes the sudo password as the first line of remote stdin; remaining lines
# (the actual commands fed via `bash -s`) are read by bash AFTER sudo has
# consumed the password. The remote shell expands $REMOTE_VAR refs from the
# heredoc literally — only $LOCAL escapes via the calling environment.
run_remote_sudo() {
  local user_flag=""
  if [[ "${1:-}" == "--as" ]]; then
    user_flag="-u $2"; shift 2
  fi
  ssh "${SSH_OPTS[@]}" "$SSH_TARGET" \
    "sudo -S -k -p '' $user_flag bash -s"
}

REMOTE_TMP="/tmp/.${VAR_NAME}.$$"

log "Uploading line file to ${PROD_HOST}:${REMOTE_TMP}"
scp "${SSH_OPTS[@]}" "$LINE_FILE" "$SSH_TARGET:$REMOTE_TMP" >/dev/null
ok "Uploaded ($(wc -c < "$LINE_FILE") bytes)"

log "Injecting $VAR_NAME into $PROD_APP_DIR/.env.prod (sudo)"
{
  printf '%s\n' "$PROD_SUDO_PASS"
  cat <<REMOTE
set -e
APP="$PROD_APP_DIR"
ENV="\$APP/.env.prod"
[[ -f "\$ENV" ]] || { echo "\$ENV not found" >&2; exit 1; }

cp "\$ENV" "\$ENV.bak.\$(date +%s)"
grep -v '^${VAR_NAME}=' "\$ENV" > "\$ENV.new" || true
cat "$REMOTE_TMP" >> "\$ENV.new"
# Ensure trailing newline
[[ "\$(tail -c1 "\$ENV.new" | xxd -p)" == "0a" ]] || echo "" >> "\$ENV.new"

chown $PROD_DEPLOY_USER:$PROD_DEPLOY_USER "\$ENV.new"
chmod 600 "\$ENV.new"
mv "\$ENV.new" "\$ENV"
shred -u "$REMOTE_TMP" 2>/dev/null || rm -f "$REMOTE_TMP"

LINES=\$(wc -l < "\$ENV")
MODE=\$(stat -c %a "\$ENV")
COUNT=\$(grep -c '^${VAR_NAME}=' "\$ENV")
echo "OK: \$ENV → \$LINES lines, mode \$MODE, ${VAR_NAME} occurrences: \$COUNT"
REMOTE
} | run_remote_sudo
ok "$VAR_NAME persisted"

log "Pulling latest from git as $PROD_DEPLOY_USER"
{
  printf '%s\n' "$PROD_SUDO_PASS"
  cat <<REMOTE
cd "$PROD_APP_DIR"
git fetch --quiet
BEFORE=\$(git rev-parse HEAD)
git pull --ff-only 2>&1 | tail -5
AFTER=\$(git rev-parse HEAD)
if [[ "\$BEFORE" == "\$AFTER" ]]; then
  echo "Already up-to-date at \$BEFORE"
else
  echo "Updated \$BEFORE → \$AFTER"
fi
REMOTE
} | run_remote_sudo --as "$PROD_DEPLOY_USER"

log "Restarting backend (this picks up the new env)"
{
  printf '%s\n' "$PROD_SUDO_PASS"
  cat <<REMOTE
cd "$PROD_APP_DIR"
docker compose --env-file .env.prod -f docker-compose.yml -f docker-compose.prod.yml up -d backend 2>&1 | tail -15
REMOTE
} | run_remote_sudo --as "$PROD_DEPLOY_USER"
ok "Backend restart issued"

log "Waiting 4s for backend to come up"
sleep 4

log "Verifying $VAR_NAME inside container (length only — never the value)"
{
  printf '%s\n' "$PROD_SUDO_PASS"
  cat <<REMOTE
cd "$PROD_APP_DIR"
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T backend sh -c '
  if [ -n "\$$VAR_NAME" ]; then
    echo "${VAR_NAME} length: \${#$VAR_NAME}"
  else
    echo MISSING
  fi
'
REMOTE
} | run_remote_sudo --as "$PROD_DEPLOY_USER"

log "Recent backend logs"
{
  printf '%s\n' "$PROD_SUDO_PASS"
  cat <<REMOTE
cd "$PROD_APP_DIR"
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs --tail=20 backend
REMOTE
} | run_remote_sudo --as "$PROD_DEPLOY_USER"

ok "Done."
