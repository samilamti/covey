---
name: health
description: Check that the local Docker stack is running and all services are healthy. Use after starting the stack or when something seems broken.
---

Check that the local Docker stack is running and healthy. Run these checks in sequence and report results:

### 1. Container status
```bash
docker compose --env-file .env.local -f docker-compose.yml -f docker-compose.local.yml ps
```
Verify all 4 services are running: frontend, backend, db, traefik.

### 2. Backend health
```bash
curl -sk https://localhost/api/auth/verify -X POST -H 'Content-Type: application/json' -d '{}' -w '\nHTTP %{http_code}\n'
```
Expect a 401 (no token) — this confirms the backend is responding. A connection refused or timeout means it's down.

### 3. Feature flags
```bash
curl -sk https://localhost/api/features
```
Show which features are enabled/disabled. Default local dev should have all features disabled unless explicitly set.

### 4. Database connectivity
```bash
MSYS_NO_PATHCONV=1 docker exec tillsammans-db-1 bash -c 'pg_isready -U $POSTGRES_USER -d $POSTGRES_DB'
```

### 5. Summary
Report:
- All services running? (yes/no, list any down)
- Backend responding? (yes/no)
- Database ready? (yes/no)
- Feature flags state
- Any issues found

## Notes
- Self-signed TLS: `-k` flag on curl is required (suppresses cert warnings)
- Traefik dashboard is at http://localhost:8080 in local dev
- If backend is not responding, check `docker compose logs backend` for errors
