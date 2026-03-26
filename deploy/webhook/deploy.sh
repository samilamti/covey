#!/bin/bash
set -euo pipefail

LOCK="/tmp/deploy.lock"
REPO="/repo"

log() { echo "[$(date -Iseconds)] $*"; }

# Acquire exclusive lock — fail immediately if another deploy is running
exec 200>"$LOCK"
if ! flock -n 200; then
    log "SKIP: Another deploy is already running"
    exit 1
fi

log "=== Deploy started ==="

cd "$REPO"

log "Pulling latest..."
git pull origin main

log "Rebuilding containers..."
docker compose --env-file .env.prod \
  -f docker-compose.yml -f docker-compose.prod.yml \
  up --build -d

log "=== Deploy finished ==="
