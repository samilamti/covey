#!/bin/bash
# Auto-deploy, run by the webhook container when Woodpecker posts a signed request.
#
# The container mounts the repo at the SAME absolute path it has on the host
# (REPO), because docker compose resolves bind-mount sources to absolute paths
# and the host's docker daemon then reads them as host paths. A different
# in-container path silently points every mount at a directory that doesn't
# exist on the host.
set -euo pipefail

REPO="${REPO:-/home/deploy/apps/tillsammans}"
LOCK="/tmp/deploy.lock"
# Pinned so the project name never derives from the directory name, which
# would bring up a second, empty copy of the stack (database included).
PROJECT="tillsammans"
# Services this script rebuilds. Never the webhook itself (recreating it kills
# this script mid-run), and never db or traefik (images, not builds).
SERVICES=(backend frontend docs)

log() { echo "[$(date -Iseconds)] $*"; }

exec 200>"$LOCK"
if ! flock -n 200; then
    log "SKIP: another deploy is already running"
    exit 1
fi

log "=== Deploy started ==="
cd "$REPO"

# reset, not pull: main's history has been rewritten before (2026-09-24), and
# a pull then diverges and stops every later deploy. The box keeps no tracked
# edits of its own, so origin/main is always the intended state.
log "Fetching origin/main..."
git fetch --quiet origin main
before=$(git rev-parse --short HEAD)
git reset --hard --quiet origin/main
log "HEAD: $before -> $(git rev-parse --short HEAD)"

log "Rebuilding: ${SERVICES[*]}"
docker compose -p "$PROJECT" --env-file .env.prod \
  -f docker-compose.yml -f docker-compose.prod.yml \
  up --build -d --no-deps "${SERVICES[@]}"

# Compare the body, not the status: while the backend is down Traefik falls
# through to the frontend, which answers /api/health with index.html and a 200.
# --connect-to sends the request to the traefik container: from inside this
# container the box's own public IP is unreachable, but going through Traefik
# with the real hostname still tests routing and the certificate.
log "Waiting for the API..."
for i in $(seq 1 30); do
    if [ "$(curl -s --max-time 5 --connect-to covey.se:443:traefik:443 https://covey.se/api/health)" = '{"ok":true}' ]; then
        log "=== Deploy finished: healthy after $((i * 2))s ==="
        exit 0
    fi
    sleep 2
done
log "=== Deploy FAILED: API not healthy after 60s ==="
exit 1
