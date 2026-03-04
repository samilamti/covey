# Tillsammans — Project Context for Claude

## Permissions

Claude has full access to the project folder, including running any commands and performing deletions.

## What this project is

Tillsammans ("Together") is a non-profit digital safety platform for Swedish citizens. Users authenticate via BankID and can temporarily coordinate real-world safety — such as walking home at night. It is NOT a social network. Domain: covey.se. Owner: Sami Lamti.

## Repository

Hosted on Codeberg: https://codeberg.org/Sami-X-Lamti/Tillsammans

CI/CD: Woodpecker CI at ci.codeberg.org (requires manual onboarding). Pipeline files at `.woodpecker/test.yaml` and `.woodpecker/build.yaml`.

## Tech stack

- **Frontend**: Preact 10 + Vite 7 + Tailwind CSS 3 + i18next + Socket.io client + Leaflet
- **Backend**: Node 22 + Express 5 + Socket.io v4 + PostgreSQL 16 + jose (JWT) + web-push
- **Infrastructure**: Docker Compose + Traefik v3.6 + nginx (frontend serving)
- **Testing**: node:test (backend, 77 tests), vitest + @testing-library/preact (frontend, 150 tests)

## Key constraints

- Must work on Chrome 60+ / iOS 10+ (old Android devices)
- Low-resource VPS (PostgreSQL pool max 10 connections)
- PWA delivery (no app stores)
- Preact, not React (3KB vs 40KB)
- Socket.io polling-first transport (old browser compatibility)

## Current state (Mar 2026)

All 7 implementation phases are complete. The application is feature-complete for its initial scope:

- **Phase 0**: Feature flags, testing infrastructure, full DB schema ✅
- **Phase 1**: 12 languages with Swedish as canonical source ✅
- **Phase 2**: JWT auth with BankID stub provider ✅
- **Phase 3**: Communities + profiles + admin panel ✅
- **Phase 4**: Assistance request lifecycle + real-time + geolocation ✅
- **Phase 5**: Push notifications (mock + real) + service worker ✅
- **Phase 6**: Rate limiting + GDPR export/delete + input validation ✅
- **Phase 7**: Woodpecker CI pipelines ✅

- **Beta prep**: Production hardening, real web-push, VAPID wiring, deployment guide ✅

- **Production**: Live at covey.se on GleSYS VPS with Let's Encrypt TLS ✅

**Not yet done**: Real BankID RP agreement, branding, accessibility audit. See `docs/roadmap.md` "Future" section.

### Claude Code skills

21 reusable skills in `.claude/skills/`. Each skill is a directory containing a `SKILL.md` file with YAML frontmatter (`name`, `description`, optional `argument-hint`) followed by Markdown instructions. The `description` field drives auto-invocation — Claude uses skills contextually without needing `/skill-name`. Skill bodies contain step-by-step procedures, code templates, and gotcha warnings. Arguments are available via `$ARGUMENTS` in the body.

```
.claude/skills/
├── add-component/SKILL.md     # Scaffold Preact component (includes useGeolocation hook pattern)
├── add-feature-flag/SKILL.md  # 4-file lockstep flag registration
├── add-hook/SKILL.md          # Scaffold Preact hook (mountedRef, cleanup, retry pattern)
├── add-language/SKILL.md      # 6-step new language addition
├── add-locale-key/SKILL.md    # Add key to all 12 locale files
├── add-migration/SKILL.md     # Append idempotent DDL to migrate.js
├── add-repository/SKILL.md    # Backend repository (SQL queries, pool.js, RETURNING *)
├── add-route/SKILL.md         # Express route + api.js registration
├── add-service/SKILL.md       # Frontend fetch wrapper service
├── add-socket-event/SKILL.md  # Socket.io event handler (guards, emit targets, rate limiting)
├── add-test/SKILL.md          # Test scaffold (backend node:test / frontend vitest)
├── check-exports/SKILL.md     # Verify cross-module import/export matches
├── db/SKILL.md                # Quick DB queries via docker exec
├── deploy-check/SKILL.md      # Pre-deployment validation checklist
├── health/SKILL.md            # Docker stack health check
├── locale-check/SKILL.md      # i18n key parity across 12 locale files
├── login/SKILL.md             # Stub BankID login → JWT token
├── stack/SKILL.md             # Docker Compose up/down/reset/logs
├── test/SKILL.md              # Run backend/frontend/all tests
├── test-pair/SKILL.md         # Two compatible test users by tier
└── vapid-setup/SKILL.md       # VAPID key generation + wiring
```

**Categories**:
- **Operations**: `/test`, `/stack`, `/login`, `/db`, `/health`, `/locale-check`, `/deploy-check`, `/check-exports`, `/test-pair`, `/add-locale-key`
- **Scaffolding**: `/add-route`, `/add-repository`, `/add-feature-flag`, `/add-migration`, `/add-component`, `/add-hook`, `/add-service`, `/add-socket-event`, `/add-test`, `/add-language`, `/vapid-setup`

Scaffolding skills encode project conventions (route ordering, 4-file feature flag lockstep, migration DDL patterns, component boilerplate, `useGeolocation` hook usage, repository SQL patterns, Socket.io handler guards, `consoleErrorSpy` test pattern) to prevent documented gotchas.

## Architecture patterns

- **Feature flags**: `FEATURE_*` env vars, backend registry in `src/features.js`, frontend context in `src/context/FeatureFlagContext.jsx`
- **Auth**: Provider pattern in `src/auth/` — stub provider simulates BankID with time-based states and error simulation via NIN prefix (`000*` = cancel, `111*` = expired). JWT via jose (HS256, 24h expiry). The `collect` endpoint upserts the user into the DB and puts the real UUID (not the hash) in the JWT as `userId`. The `verify` endpoint validates the token AND checks the user exists in the DB. The `authenticate` middleware rejects tokens where `userId` is not a valid UUID format. **API field name**: The login endpoint expects `nin` as the API field name.
- **Notifications**: Provider pattern — mock provider records sent notifications for test assertions. Real provider uses `web-push` library with VAPID keys (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_CONTACT` env vars). Falls back to mock if VAPID keys not configured. `notifyNewRequest()` sends push notifications to all eligible responders when a request is created (both HTTP and Socket paths). Uses `findEligibleForRequest()` in push-subscriptions repo — a single SQL query that applies eligibility tier filtering, community membership checks, and excludes the requester. Notification bodies are hardcoded in all 12 languages (push runs outside browser context, no i18next). Fire-and-forget: errors are logged but never block request creation. Frontend `VITE_VAPID_PUBLIC_KEY` is a build-time arg in `frontend/Dockerfile`.
- **Database**: Single `001_initial` migration creates all tables, plus `003_session_messages` for in-session messaging, `004_done_pending` for mutual completion flow, and `005_nullable_requester` for GDPR cleanup (makes `requester_id` nullable). No production data yet. `community_id` on `assistance_requests` is nullable (freestanding requests). **DB credentials are dynamic** — they come from `.env.local` via Docker Compose env vars (`$POSTGRES_USER`, `$POSTGRES_DB`), NOT hardcoded as `postgres`/`tillsammans`. Always read from the container environment.
- **Workers**: In-process `setInterval` (no job queue) — request expiration (60s) + GDPR cleanup (daily hard-delete of accounts soft-deleted >30 days)
- **Rate limiting**: In-memory sliding window rate limiter — auth (10 req/min), API (100 req/min), nearby discovery (5 req/min)
- **Socket.io events**: Community room subscriptions + `requests:open` room for freestanding requests, request lifecycle (create/accept/done/done-accept/done-reject/cancel), location relay between requester and helper, session messaging (`message:send` → `message:received`/`message:sent`)
- **Freestanding requests**: Assistance requests can exist without a community (`community_id` is nullable). Freestanding requests broadcast to the `requests:open` room which all authenticated users auto-join. Community-scoped requests still broadcast to `community:${id}` rooms.
- **Eligibility tiers**: Three levels control who can accept requests — `same_demographics` (same sex, birth year ±5), `verified_guardians` (demographics OR safety score ≥ 5), `any_member` (no filtering). Default is `same_demographics`. Pre-filtering in SQL prevents users from seeing requests they can't accept. Accept-time guard provides defense-in-depth.
- **Stub safety scores**: `STUB_SAFETY_SCORES` env var (`nin:score,nin:score`) sets in-memory overrides applied at stub login. Stored in `Map<userId, score>` in `ratings.js`, checked before DB query. Enables testing `verified_guardians` tier without real rating history.
- **Session messaging**: In-session chat between requester and helper via Socket.io. Messages persisted to `session_messages` table. Rate limited (2s per user per request). Six pre-filled quick messages provided. Included in GDPR export.
- **Geolocation**: Centralized `useGeolocation` hook in `frontend/src/hooks/useGeolocation.js` — replaces all inline `navigator.geolocation` calls. Returns `{ position, error, loading, retry, supported }`. Error codes mapped: 1→`denied`, 2→`unavailable`, 3→`timeout`. `LocationBanner` component shows user-facing feedback with retry button. Used by `RequestList` (info severity), `CreateRequest` (info), and `ActiveSession` (warning — safety-critical). Never call `navigator.geolocation` directly from components.
- **Mutual done flow**: Either party can initiate "done" (`active` → `done_pending`). The other party accepts (`→ completed`) or rejects (`→ active`). Simultaneous done clicks auto-complete. Tracked via `done_initiated_by`/`done_initiated_at` columns. Routes: `/:id/done`, `/:id/done/accept`, `/:id/done/reject`. Socket events: `request:done-initiated`, `request:done-rejected`. Location relay + messaging remain active during `done_pending`.

## Localization

- **Base language**: Swedish (`sv`), NOT English — `fallbackLng: 'sv'`
- **Languages** (all 12): sv, nb, da, fi, ar, is, pl, fo, kl, se, uk, en
- **Tone**: Warm, colloquial. All translations derived from Swedish source.
- **Flags**: SVG flag components in `frontend/src/components/flags/` — each accepts `{ size }` prop
- **RTL**: Arabic only (handled by i18next culture detector)
- **Test coverage**: Locale key parity test ensures all 12 files have the same keys as `sv.json`

## Security model for communities

Communities use admin-approved joins, pseudonymous display names, no exposed coordinates (area_name instead), member lists visible to members only. See `docs/architecture.md` for the full threat model.

## GDPR considerations

- NIN stored as SHA-256 hash only (raw never persisted)
- Location data is ephemeral (DB trigger purges on session end)
- Soft delete with 30-day cooling period, then hard delete (daily worker)
- Data export endpoint: `GET /api/gdpr/export`
- Account deletion: `POST /api/gdpr/delete`

## Common commands

```bash
# Local dev
cd frontend && npm run dev    # Vite on :5173
cd backend && npm run dev     # Node --watch on :3000
docker compose up db -d       # Database only

# Full stack (or use /stack skill)
docker compose --env-file .env.local -f docker-compose.yml -f docker-compose.local.yml up --build -d

# Tests (or use /test skill)
cd backend && npm test        # node:test (77 tests)
cd frontend && npm test       # vitest (150 tests)

# Build
cd frontend && npm run build  # Vite production build

# DB access (or use /db skill) — credentials from container env, not hardcoded
MSYS_NO_PATHCONV=1 docker exec tillsammans-db-1 bash -c 'psql -U $POSTGRES_USER -d $POSTGRES_DB -c "SELECT 1"'
```

## Important files

### Backend
- `backend/src/auth/router.js` — Auth routes (login, collect, cancel, verify, logout)
- `backend/src/auth/providers/stub.js` — BankID stub (time-based flow, error simulation)
- `backend/src/auth/providers/bankid.js` — Real BankID placeholder
- `backend/src/auth/jwt.js` — JWT sign/verify using jose
- `backend/src/auth/middleware.js` — Express `authenticate` middleware
- `backend/src/features.js` — Feature flag registry
- `backend/src/migrate.js` — Full schema migration (users, communities, requests, etc.)
- `backend/src/handlers.js` — Socket.io handlers (community rooms, request events, location relay)
- `backend/src/api.js` — Express API router mounting all routes with rate limiters
- `backend/src/index.js` — App entry point (Express + Socket.io + workers)
- `backend/src/routes/communities.js` — Community CRUD + security
- `backend/src/routes/requests.js` — Assistance request lifecycle
- `backend/src/routes/profile.js` — User profile CRUD
- `backend/src/routes/notifications.js` — Push subscription management
- `backend/src/routes/gdpr.js` — Data export + account deletion
- `backend/src/repositories/` — Database access (users, communities, requests, push-subscriptions, ratings, messages)
- `backend/src/repositories/messages.js` — Session message CRUD (create, findByRequest, findByUser)
- `backend/src/repositories/ratings.js` — Safety ratings + stub score overrides
- `backend/src/repositories/push-subscriptions.js` — Push subscription CRUD + `findEligibleForRequest()` for notification targeting
- `backend/src/services/notifications.js` — Mock + real notification providers + `notifyNewRequest()` orchestration
- `backend/src/services/geolocation.js` — Rate-limited location relay
- `backend/src/services/eligibility.js` — Eligibility check (delegates to demographics.js)
- `backend/src/services/demographics.js` — Pure demographic matching function
- `backend/src/auth/nin.js` — Birth year and sex extraction from Swedish NIN
- `backend/src/workers/expiration.js` — Request expiration (60s interval)
- `backend/src/workers/gdpr-cleanup.js` — Daily hard-delete worker
- `backend/src/middleware/rateLimit.js` — Sliding window rate limiter
- `backend/src/middleware/validate.js` — Input validation

### Frontend
- `frontend/src/App.jsx` — Root with FeatureFlagProvider, session restore, socket connect
- `frontend/src/main.jsx` — Entry point + service worker registration
- `frontend/src/i18n.js` — i18next config (12 languages, Swedish fallback)
- `frontend/src/socket.js` — Socket.io client (autoConnect: false, polling-first)
- `frontend/src/context/FeatureFlagContext.jsx` — Feature flag context + hooks
- `frontend/src/components/LandingPage.jsx` — Login with BankID flow
- `frontend/src/components/MainLayout.jsx` — Authenticated app shell (default page: /requests)
- `frontend/src/components/MapView.jsx` — Leaflet map (dynamic import)
- `frontend/src/components/RequestList.jsx` — Request list with real-time updates
- `frontend/src/components/RequestCard.jsx` — Individual request card
- `frontend/src/components/CreateRequest.jsx` — New request form (community optional)
- `frontend/src/components/ActiveSession.jsx` — Live map with location relay, ETA, messaging UI
- `frontend/src/components/LocationBanner.jsx` — Geolocation error feedback banner (info/warning severity)
- `frontend/src/hooks/useGeolocation.js` — Centralized geolocation hook (getCurrentPosition/watchPosition, error mapping, retry)
- `frontend/src/utils/geo.js` — Haversine distance + formatting utilities
- `frontend/src/components/CommunityList.jsx` — Community browser + create community form
- `frontend/src/components/CommunityDetail.jsx` — Community info + member list
- `frontend/src/components/NearbyDiscovery.jsx` — Geolocation-based discovery
- `frontend/src/components/AdminPanel.jsx` — Approve/reject join requests
- `frontend/src/components/ProfileView.jsx` — Profile + GDPR
- `frontend/src/components/LanguageSelector.jsx` — 12 languages, Sami SVG flag
- `frontend/src/components/SamiFlag.jsx` — Custom SVG of the Sami flag
- `frontend/src/components/BottomNav.jsx` — Mobile tab navigation
- `frontend/src/services/` — API clients (auth, features, notifications, profile, ratings, requests)
- `frontend/src/locales/*.json` — 12 locale files (sv.json is canonical)
- `frontend/public/sw.js` — Service worker (push, offline cache)
- `frontend/vitest.config.js` — Test config (jsdom, preact aliases)

### CI/CD
- `.woodpecker/test.yaml` — Backend + frontend tests + build (Postgres service)
- `.woodpecker/build.yaml` — Docker Compose build on push to main

### Documentation
- `docs/roadmap.md` — 7-phase plan + future items
- `docs/architecture.md` — Full system architecture + security model
- `docs/deployment.md` — GleSYS VPS setup + production deploy guide
- `.env.example` — Production environment variable template

## Known issues / technical debt

- Leaflet is loaded via dynamic import but its CSS comes from unpkg CDN (should be bundled)
- Frontend build produces a ~251KB chunk (Vite warns at 200KB) — consider manual chunking
- `authService` is imported in `App.jsx` but the module at `frontend/src/services/auth.js` needs to exist (was part of LandingPage flow)
- No integration tests that require a running database — all current tests are unit/component level
- Real web-push provider implemented; VAPID keys wired through `docker-compose.yml` + `frontend/Dockerfile` build arg (generate keys with `npx web-push generate-vapid-keys`)
- Socket broadcasts (`request:new`) go to all room members without eligibility pre-filtering — ineligible requests may briefly flash before the next API refresh filters them out. Push notifications, however, ARE eligibility-filtered (SQL query in `findEligibleForRequest()`)
- Stub safety score overrides are in-memory only — lost on container restart (re-populated on next login)
- Traefik v3.6 required for Docker Engine 29+ compatibility (v3.2 hardcodes Docker API v1.24, Engine 29 requires v1.44+). Production uses HTTP-01 ACME challenge (more reliable than TLS-ALPN-01)

## Development notes

### Module system

The backend uses **ES modules** (`import`/`export`), NOT CommonJS (`require`/`module.exports`). This is set via `"type": "module"` in `backend/package.json`. When scanning imports, look for `import { x } from` and `export function`/`export const` patterns.

### Cross-module import discipline

When creating or modifying files that import from other modules, **always verify the actual export names** in the source file. The `/check-exports` skill automates this. Common pitfalls:

- **Function name mismatches**: e.g. service exports `processLocationUpdate()` but consumer imports `relayLocation()`. The app starts fine in simple cases but crashes at runtime when the import is first resolved.
- **SQL column aliases**: When SQL returns `u.id`, the JS property is `id`, not `user_id`. Use `AS user_id` aliases in SQL if the frontend expects `user_id`.
- **Parameter name mismatches**: A function may accept `{ latitude, longitude, accuracyM }` but the caller passes `{ lat, lng, accuracy }`. These won't error at import time — they'll produce `undefined` values silently.

### Testing vs runtime

Unit tests may pass even when cross-module imports are broken if those imports aren't exercised in tests (e.g. `handlers.js` imports from `geolocation.js` but no test loads `handlers.js` since it requires a running Socket.io server). Always verify the app actually starts after wiring changes.

### Inline migrations

`index.js` calls `await migrate()` before `httpServer.listen()`. This guarantees all tables exist before the server accepts traffic or workers run. The Dockerfile CMD is simply `node src/index.js` — no separate migration step. The `migrate.js` also works standalone (`node src/migrate.js`) for manual use.

### Worker startup timing

Background workers are started inside the `listen()` callback, after `migrate()` has completed. The GDPR cleanup worker uses a short `setTimeout` (5s) before its first run as a safety margin for pool warm-up. The expiration worker uses `setInterval` only (first run at 60s). Neither worker should call the database immediately on startup.

### JWT must carry real database UUID

The JWT `userId` claim **must be the real UUID from the `users` table**, not the NIN hash. The auth `collect` endpoint calls `userRepo.upsertFromAuth()` to get/create the user row and uses `dbUser.id` in the JWT. Every authenticated endpoint (`req.user.userId`) depends on this being a valid UUID for database lookups. If the hash is used instead, all DB queries will fail with invalid UUID errors (the `id` column is `UUID` type).

Two defense layers prevent bad `userId` values from reaching the database:
1. **`authenticate` middleware** (`src/auth/middleware.js`) — rejects tokens where `userId` is not a valid UUID format (returns 401 with "re-login required")
2. **`verify` endpoint** (`POST /api/auth/verify`) — validates UUID format AND checks the user exists in the DB via `userRepo.findById()`. Stale tokens from previous sessions (e.g., after a DB recreate) are rejected here, forcing re-login.

### Language detection

The i18n detection order is `['querystring', 'localStorage', 'cookie']` — deliberately excluding `navigator` and `culture` detectors. This ensures Swedish is the default for fresh visitors (via `fallbackLng: 'sv'`). If browser auto-detection were included, English browsers would get English because `en` is in the resources and would match before the fallback kicks in.

### Express route ordering

Routes with path parameters (e.g., `/:id`) must be registered AFTER static-path routes (e.g., `/open`, `/community/:cid`). Otherwise Express matches the static segment as a parameter value. Example: `GET /api/requests/open` must be defined before `GET /api/requests/:id`.

Extended routes like `/:id/messages` must also be registered before bare `/:id` — Express evaluates routes in registration order and `/:id` would match first, consuming the `/messages` suffix. Current order in `requests.js`: `/open` → `/community/:cid` → `/:id/messages` → `/:id/done/accept` → `/:id/done/reject` → `/:id/done` → `/:id` → `/:id/accept` etc.

### Production middleware

- **Trust proxy**: `app.set('trust proxy', 1)` in `index.js` — required behind Traefik so `req.ip` returns the real client IP (not Traefik's internal IP). Without this, rate limiting keys on a single IP for all users.
- **Helmet CSP**: Configured explicitly in `index.js` — `img-src` allows `*.tile.openstreetmap.org` (Leaflet tiles), `connect-src` allows `wss:/ws:` (Socket.io), `style-src` allows `'unsafe-inline'` (Tailwind + Leaflet inline styles). Default helmet CSP blocks all of these.

### Eligibility pre-filtering in SQL

Request listing queries (`findOpenFreestanding`, `findByCommunity`) use JOINs with the `users` table to filter by eligibility tier in a single query — no N+1 problem. The helper's `sex`, `birth_year`, and `safetyScore` are passed as query parameters. The SQL WHERE clause handles all three tiers with OR conditions. This is more efficient than loading all open requests and filtering in JS, and prevents users from seeing requests they can't accept.

### Schema changes with no production data

Since there is no production data yet, the `001_initial` migration can be rewritten freely. After changing the migration SQL, existing dev databases need either `ALTER TABLE` manually or a full DB recreate (drop the Docker volume). The migration runner re-executes SQL even for "recorded" migrations (all DDL uses `IF NOT EXISTS`), but `ALTER TABLE` changes like dropping `NOT NULL` require manual intervention on existing databases.

### Adding a new request status

When adding a non-terminal status (like `done_pending`), update ALL these locations:
1. `migrate.js` — CHECK constraint (both in `001_initial` and a new migration for existing DBs)
2. `repositories/requests.js` — `cancel()` allowed-status list
3. `handlers.js` — location relay status check + messaging status check
4. `RequestList.jsx` — active session detection array
5. `ActiveSession.jsx` — `isTerminal` check (ensure new status is NOT included)
6. `RequestCard.jsx` — `statusColors` map
7. All 12 locale files — `requests.status.<new_status>` key
