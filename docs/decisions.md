# Technical Decisions

This document records key decisions made during the project's development, with rationale, so that future contributors understand the "why" behind each choice.

## Preact over React

**Decision**: Use Preact with `@preact/preset-vite`.

**Rationale**: The platform must work on old Android devices (Chrome 60+). Preact's 3KB footprint (vs React's ~40KB) significantly improves load times on slow connections and low-memory devices. The API is nearly identical to React, so migration is straightforward if ever needed.

## Tailwind CSS v3

**Decision**: Keep Tailwind v3 as the CSS framework.

**Rationale**: Utility-first approach keeps bundle size small (only used classes are included). v3 was chosen over v4 for stability and broader tooling support.

## Socket.io with polling-first transport

**Decision**: Configure Socket.io to start with long-polling, then upgrade to WebSocket.

**Rationale**: Old Android browsers may not support WebSocket or may have flaky implementations. Starting with polling ensures a connection is established immediately; the upgrade happens transparently once the WebSocket handshake succeeds.

## Express 5

**Decision**: Use Express v5.

**Rationale**: Express 5 has great async error handling and is the current recommended version.

## Traefik as reverse proxy

**Decision**: Use Traefik v3 with Docker provider for routing and TLS.

**Rationale**: Automatic Let's Encrypt certificate management, Docker-native service discovery via labels, and built-in support for WebSocket upgrades and sticky sessions (needed for Socket.io).

## PostgreSQL 16 Alpine

**Decision**: Use `postgres:16-alpine` as the database.

**Rationale**: Alpine keeps the image small. PostgreSQL 16 is the current stable release. Connection pool is capped at 10 connections to suit a low-resource VPS.

## PWA over native wrapper

**Decision**: Ship as a Progressive Web App, not a Capacitor/Cordova wrapper.

**Rationale**: Non-profit project with limited resources. PWA avoids app store fees and review processes, works across Android and iOS, and can be installed directly from the browser. The `manifest.json` enables add-to-homescreen with a standalone app appearance.

## Multi-stage frontend Dockerfile

**Decision**: Build with Node, serve with nginx.

**Rationale**: The Node image is ~180MB; nginx Alpine is ~7MB. Multi-stage builds keep the production image tiny and eliminate any Node.js runtime attack surface from the frontend container.

## Migrations in backend container startup

**Decision**: Run `migrate.js` before `index.js` in the Dockerfile CMD.

**Rationale**: Ensures the database schema is always up to date when the backend starts. The migration runner is idempotent (tracks executed migrations in a `migrations` table), so repeated runs are safe.

## Single initial migration (rewrite history)

**Decision**: All database tables are created in a single `001_initial` migration rather than incremental migrations per phase.

**Rationale**: There is no production data yet, so we can rewrite history freely. A single migration is simpler to reason about and avoids migration ordering issues during development. Future schema changes (post-launch) will use incremental migrations.

## Docker Compose overlay files for TLS

**Decision**: Split TLS configuration into overlay files (`docker-compose.prod.yml` for Let's Encrypt, `docker-compose.local.yml` for self-signed) rather than keeping everything in the base `docker-compose.yml`.

**Rationale**: The original single-file setup hard-coded Let's Encrypt ACME settings, which caused errors during local development (cannot obtain certificates without a real domain and DNS). The overlay pattern keeps the base file environment-agnostic — routing and service definitions only — while environment-specific overlays add TLS, HTTPS redirects, and CORS overrides. This also resolved a Traefik v3 breaking change: `PathPrefix` only accepts a single argument (v2 allowed multiple), so multi-prefix rules now use `||` syntax.

## Swedish as base language

**Decision**: Use Swedish (`sv`) as the default/fallback language, not English.

**Rationale**: Tillsammans is a Swedish platform for Swedish citizens. The canonical translation source is Swedish, and all other languages are translated from it. The detection order still prioritizes the user's browser culture, but when no match is found, Swedish is shown — not English.

## 11 languages with colloquial tone

**Decision**: Support sv, nb, da, fi, ar, is, pl, fo, kl, se, en — in that priority order. Use warm, colloquial language throughout.

**Rationale**: These languages represent the major immigrant and minority language groups in Sweden, plus the Nordic neighbors. Colloquial tone makes the safety platform feel approachable and human, not bureaucratic. The priority order reflects the user base demographics.

## Custom Sami flag SVG

**Decision**: Render the Northern Sami (Davvisamegiella) flag as a custom inline SVG component instead of using a Unicode emoji.

**Rationale**: There is no Unicode emoji for the Sami flag. All other languages use emoji flags of the closest national flag (e.g., 🇬🇧 for English). Sami is a transnational language (Norway, Sweden, Finland, Russia), so no single national flag represents it. The Sami flag (red/blue/green/yellow circle design) is well-recognized and culturally appropriate.

## Feature flags via environment variables

**Decision**: Use `FEATURE_*` environment variables for feature toggling, not a database or external service.

**Rationale**: Simple, zero-dependency, appropriate for a small non-profit on a low-resource VPS. Flags change between deployments (not runtime). The backend reads from `process.env`, the frontend fetches via `GET /api/features`.

## Feature-flagged BankID with comprehensive stub

**Decision**: The BankID integration is behind `FEATURE_BANKID_AUTH`. The stub provider simulates the full BankID flow (time-based states, error simulation by NIN prefix).

**Rationale**: The BankID RP agreement is not yet in place. The stub must be comprehensive enough to test the complete authentication flow end-to-end: pending states, user cancellation, expiration. Error simulation via NIN prefix (`000*` = userCancel, `111*` = expiredTransaction) enables deterministic testing.

## Feature-flagged notifications with mock provider

**Decision**: Push notifications are behind `FEATURE_PUSH_NOTIFICATIONS`. The mock provider records all "sent" notifications in memory, exposed via `GET /api/notifications/sent`.

**Rationale**: Tests must be able to verify that notifications are sent with correct content and recipients without requiring real Web Push infrastructure. The mock provider's `getSentNotifications()` method enables programmatic test assertions.

## JWT via jose library (HS256)

**Decision**: Use the `jose` library for JWT signing/verification with HS256.

**Rationale**: `jose` is the recommended library for JWT in Node.js (actively maintained, standards-compliant, no native dependencies). HS256 is sufficient for a single-server deployment. The `JWT_SECRET` env var controls the signing key. Tokens have a 24-hour expiry.

## Admin-approved community joins

**Decision**: Joining a community requires approval from a community admin, not instant access.

**Rationale**: An adversary could join communities to surveil members and assistance requests. Admin approval creates a human gatekeeping layer. Combined with BankID verification, this significantly raises the bar for malicious actors. Community creators are automatically admins and can promote other members.

## Pseudonymous display names

**Decision**: User display names are user-chosen, not auto-populated from BankID real names.

**Rationale**: Exposing BankID-verified real names in community member lists would make it trivial to identify where specific people live. User-chosen pseudonyms provide a layer of privacy while BankID verification still ensures accountability behind the scenes.

## Area names instead of coordinates

**Decision**: The communities API returns a human-readable `area_name` (e.g., "Sodermalm") to non-members, not the exact lat/lng coordinates.

**Rationale**: Exposing exact community center coordinates would allow an adversary to map all communities geographically. The `area_name` field gives users enough information to identify their neighborhood without enabling precise geographic targeting.

## Haversine over PostGIS

**Decision**: Use the Haversine formula in raw SQL for nearby community discovery, not PostGIS.

**Rationale**: PostGIS adds ~50MB to the Docker image and complexity to the build. For city-level scale (not global), Haversine with indexed latitude/longitude columns is sufficient. This keeps the PostgreSQL image small (`postgres:16-alpine`).

## In-process workers (no job queue)

**Decision**: The expiration worker and GDPR cleanup worker run as `setInterval` inside the main Node process.

**Rationale**: Avoids the need for a job queue (Bull, Redis, Agenda) and keeps VPS resource usage minimal. The expiration worker runs every 60 seconds; the GDPR cleanup worker runs daily. Both are lightweight SQL queries.

## Leaflet with OpenStreetMap

**Decision**: Use Leaflet for map rendering with OpenStreetMap tiles.

**Rationale**: Zero cost, no API key required, open-source. Google Maps and Mapbox require API keys and can incur costs. Leaflet works on Chrome 60+ and is lightweight (~40KB gzipped).

## Safety check-in after assistance sessions

**Decision**: After a session is marked `completed`, the requester is prompted to confirm safe arrival (`safety_confirmed` status).

**Rationale**: This creates an accountability trail. If anything goes wrong, there's a verifiable record that the requester did NOT confirm safety after being with a specific BankID-verified helper. Future enhancement: notify emergency contacts if no check-in within 30 minutes.

## Codeberg + Woodpecker CI

**Decision**: Host the repository on Codeberg (not GitHub) and use Woodpecker CI for CI/CD.

**Rationale**: Codeberg is a non-profit, open-source-aligned Git hosting platform — a natural fit for this non-profit project. Woodpecker CI is Codeberg's integrated CI solution. Pipeline configs live in `.woodpecker/*.yaml`.

## Frontend Localization Stack

**Decision**: Use `i18next` with `react-i18next` and `i18next-browser-languagedetector`.

**Rationale**: `i18next` is the industry standard for JavaScript localization with a rich ecosystem. It supports splitting translations into multiple files (namespaces), pluralization, and context. `react-i18next` provides efficient hooks (`useTranslation`) that only trigger re-renders when active translations change.

## Culture-based Language Detection

**Decision**: Prioritize browser culture/formatting settings (via `Intl.DateTimeFormat().resolvedOptions().locale`) over the UI language.

**Rationale**: Many users in specific regions (e.g., Sweden) might have their browser UI in English (for tech/dev reasons) but prefer local formatting and content in their native language. Relying solely on `navigator.language` often defaults to English for these users. By checking the formatting locale first, we serve the most relevant content context.

## State-based Language Selector

**Decision**: Use `click` to toggle the language menu instead of `hover`, and close it automatically on selection.

**Rationale**: Hover interaction is problematic on touch devices and can be finicky on desktop (menu disappearing if the mouse strays). A click-based toggle ensures consistent behavior across all devices. Auto-closing on selection improves the user experience by removing the need for an extra click to dismiss the menu.

## node:test for backend, vitest for frontend

**Decision**: Use `node:test` (built into Node 22) for backend tests and `vitest` for frontend tests.

**Rationale**: Zero additional dependencies for backend testing — `node:test` is built into the runtime. For the frontend, `vitest` aligns perfectly with the existing Vite toolchain and provides fast HMR-aware test execution. `@testing-library/preact` enables component testing.

## In-memory rate limiting (no Redis)

**Decision**: Use an in-memory sliding window counter for rate limiting.

**Rationale**: Avoids adding Redis as a dependency (extra service, memory, complexity) for a single-server deployment. The sliding window pattern provides accurate per-IP and per-user rate limiting. If the server restarts, the rate limit windows reset — acceptable for this use case.

## GDPR: NIN stored as SHA-256 hash only

**Decision**: The raw NIN (Swedish personnummer) is never stored in the database. Only a SHA-256 hash is kept for lookup purposes.

**Rationale**: The Swedish NIN is highly sensitive PII. Storing only the hash means a database breach doesn't directly expose NINs. The JWT carries the NIN transiently for the session duration. The 30-day soft-delete cooling period + hard-delete worker ensures right to erasure compliance.
