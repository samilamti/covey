---
name: stack
description: Manage the local Docker Compose stack. Use when starting, stopping, restarting, or checking the dev environment.
argument-hint: "[up|down|reset|status|logs [service]]"
---

Manage the local Docker Compose stack. Parse `$ARGUMENTS` for the subcommand. Default to `status` if blank.

All commands must be run from the project root (`S:/Tillsammans`). The base compose command is:
```
docker compose --env-file .env.local -f docker-compose.yml -f docker-compose.local.yml
```

### Subcommands

**`up`** — Build and start the full stack:
```
docker compose --env-file .env.local -f docker-compose.yml -f docker-compose.local.yml up --build -d
```
After starting, wait a few seconds then run `docker compose ps` to confirm all 4 services are running (frontend, backend, db, traefik).

**`down`** — Stop the stack:
```
docker compose --env-file .env.local -f docker-compose.yml -f docker-compose.local.yml down
```

**`reset`** — Full teardown including DB volume, then rebuild. Warn the user this destroys all data:
```
docker compose --env-file .env.local -f docker-compose.yml -f docker-compose.local.yml down -v
docker compose --env-file .env.local -f docker-compose.yml -f docker-compose.local.yml up --build -d
```

**`status`** — Show container status:
```
docker compose --env-file .env.local -f docker-compose.yml -f docker-compose.local.yml ps
```

**`logs [service]`** — Tail logs. Service can be `backend`, `frontend`, `db`, or `traefik`. If no service specified, show all:
```
docker compose --env-file .env.local -f docker-compose.yml -f docker-compose.local.yml logs --tail=50 [service]
```

## Notes
- The stack uses self-signed TLS — browser SSL warnings are expected
- `.env.local` sets `DOMAIN=localhost`
- `docker-compose.local.yml` is the dev overlay (self-signed certs, Traefik dashboard on :8080, STUB_SAFETY_SCORES passthrough)
