# Development Guide

## Prerequisites

- **Node.js 22+** (matches the Dockerfile base image)
- **Docker Desktop** (for containerized runs)
- **npm** (comes with Node.js)

## Repository

Hosted on Codeberg: https://codeberg.org/Sami-X-Lamti/Tillsammans

CI/CD via Woodpecker CI at `ci.codeberg.org` (requires manual onboarding).

## Local development (without Docker)

### Frontend

```bash
cd frontend
npm install
npm run dev        # Starts Vite dev server on http://localhost:5173
```

The dev server proxies `/api` and `/socket.io` to `http://localhost:3000`, so the backend must also be running.

### Backend

```bash
cd backend
npm install

# Set environment variables (or create a backend/.env and use dotenv)
export DATABASE_URL="postgres://ZP3ze3:Sockerkakor%20%C3%A4r%20goda@localhost:5432/zdb"
export JWT_SECRET="dev-secret"
export AUTH_PROVIDER="stub"

npm run dev        # Starts with --watch (auto-restart on file changes)
```

> **Note**: The backend requires a running PostgreSQL instance. You can run just the DB service: `docker compose up db -d`

### Running only the database

```bash
# From project root
docker compose up db -d

# Verify
docker compose exec db pg_isready -U ZP3ze3 -d zdb
```

## Feature flags

Control feature availability via environment variables. All default to `false`:

```bash
export FEATURE_BANKID_AUTH=false          # Use real BankID vs stub
export FEATURE_PUSH_NOTIFICATIONS=false   # Web Push API vs mock
export FEATURE_GEOLOCATION=false          # Location sharing
export FEATURE_COMMUNITIES=false          # Safety communities
```

The frontend fetches flags from `GET /api/features` on load.

## Containerized development (full stack)

The Docker Compose setup uses **overlay files** to separate TLS configuration from routing. You always start with the base `docker-compose.yml` and layer on an environment-specific overlay.

### Local testing (self-signed TLS)

The quickest way is the helper script:

```powershell
# Sets DOMAIN=localhost in .env and starts the local stack
.\test-locally.ps1
```

Or manually:

```bash
# 1. Set DOMAIN=localhost in .env
# 2. Start the stack
docker compose -f docker-compose.yml -f docker-compose.local.yml up --build
```

Open https://localhost and accept the self-signed certificate warning. The Traefik dashboard is available at http://localhost:8080.

### Production (Let's Encrypt)

```bash
# Requires DOMAIN pointing to the server and ports 80/443 open
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

### Verify

```bash
docker compose ps
curl -k https://localhost/api/health   # -k accepts self-signed cert
curl -k https://localhost/api/ping     # DB connectivity check
curl -k https://localhost/api/features # Feature flag status
```

## Running tests

### Backend (node:test)

```bash
cd backend
npm test           # Runs: node --test test/**/*.test.js
```

### Frontend (vitest)

```bash
cd frontend
npm test           # Runs: vitest run
```

## Building for production

### Frontend

```bash
cd frontend
npm run build      # Output in frontend/dist/
npm run preview    # Preview the production build locally
```

### Backend

The backend has no build step — it runs directly with Node.js.

## Useful commands

| Command | Location | Purpose |
|---------|----------|---------|
| `npm run dev` | `frontend/` | Vite dev server with HMR |
| `npm run build` | `frontend/` | Production build |
| `npm test` | `frontend/` | Run frontend tests (vitest) |
| `npm run dev` | `backend/` | Node with `--watch` |
| `npm start` | `backend/` | Production start |
| `npm test` | `backend/` | Run backend tests (node:test) |
| `npm run migrate` | `backend/` | Run database migrations |
| `.\test-locally.ps1` | root | Set DOMAIN=localhost + start local stack |
| `docker compose -f docker-compose.yml -f docker-compose.local.yml up --build` | root | Local stack (manual) |
| `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build` | root | Production stack |
| `docker compose up db -d` | root | Database only |
| `docker compose down -v` | root | Tear down + delete volumes |

## Internationalization (i18n)

The frontend uses `i18next` for localization with **Swedish as the base language**.

### Supported languages (priority order)

sv (Svenska), nb (Norsk), da (Dansk), fi (Suomi), ar (العربية), is (Islenska), pl (Polski), fo (Foroyskt), kl (Kalaallisut), se (Davvisamegiella), en (English)

### Adding a new language

1. Create a new JSON file in `frontend/src/locales/` (e.g., `de.json`).
2. Translate all keys **from the Swedish source** (`sv.json`). Use warm, colloquial tone.
3. Import the file in `frontend/src/i18n.js`.
4. Add it to the `resources` object in `i18n.init()`.
5. Add the language option to the `languages` array in `frontend/src/components/LanguageSelector.jsx` (including the flag).

### Adding translations

Add new keys to `frontend/src/locales/sv.json` first (canonical source), then translate to all other locale files.

```json
{
  "landing": {
    "title": "Ny Rubrik"
  }
}
```

Usage in components:

```jsx
import { useTranslation } from 'react-i18next';

export function MyComponent() {
  const { t } = useTranslation();
  return <h1>{t('landing.title')}</h1>;
}
```

## Testing mock services

### Auth stub

The stub provider simulates BankID. Test error scenarios via NIN prefix:
- `000*` → user cancellation
- `111*` → expired transaction
- Any other → successful authentication (3-second delay)

### Notification mock

When `FEATURE_PUSH_NOTIFICATIONS=false`, notifications are recorded in memory:

```bash
# Check what notifications were "sent"
curl http://localhost:3000/api/notifications/sent

# Trigger a test notification
curl -X POST http://localhost:3000/api/notifications/test \
  -H "Authorization: Bearer $TOKEN"
```
