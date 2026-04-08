# Roadmap

## ✅ Completed

### Project scaffold (Feb 2026)
- Split flat monorepo into `frontend/` and `backend/` with separate `package.json` and `Dockerfile`
- Fixed missing Tailwind config (`tailwind.config.js`, `postcss.config.js`)
- Created backend Dockerfile (was missing entirely)
- Added PWA manifest and meta tags for home-screen installation
- Stubbed auth module with BankID swap-in path (`AUTH_PROVIDER` env var)
- Fixed `.gitignore` (was only ignoring `.env`)
- Verified: both services install and build cleanly (0 vulnerabilities)

### Phase 0 — Foundation: Feature Flags & Testing ✅
- [x] Feature flag system (`FEATURE_*` env vars) — backend registry + frontend context
- [x] Rewrite `001_initial` migration with full database schema (users, communities, requests, etc.)
- [x] Backend test framework (`node:test`, built into Node 22) — 18 tests
- [x] Frontend test framework (`vitest` + `@testing-library/preact`) — 41 tests

### Phase 1 — Localization Overhaul ✅
- [x] Switch base language from English to **Swedish** (`fallbackLng: 'sv'`)
- [x] Add 11 languages (sv, nb, da, fi, ar, is, pl, fo, kl, se, en) with colloquial tone
- [x] All translations produced from the Swedish canonical source
- [x] Custom Sami flag SVG component (no Unicode emoji available)
- [x] Scrollable language selector with national flags
- [x] Locale key parity tests (ensure all files have same keys)

### Phase 2 — Authentication: JWT + Feature-Flagged BankID ✅
- [x] Restructure monolithic `auth.js` into `auth/` directory with provider pattern
- [x] Replace base64url tokens with proper JWTs using `jose` library (HS256)
- [x] Comprehensive stub provider simulating full BankID flow (time-based states, error simulation)
- [x] Real BankID provider placeholder (guarded by `FEATURE_BANKID_AUTH` flag)
- [x] Provider selection: `AUTH_PROVIDER` env var + `FEATURE_BANKID_AUTH` feature flag
- [x] Users repository with SHA-256 hashed NIN (raw PNO never stored)
- [x] Socket.io JWT authentication middleware

### Phase 3 — User Profiles & Safety Communities ✅
- [x] Community data model with admin-approved join workflow
- [x] Security hardening: no exposed coordinates, pseudonymous display names, member lists only visible to fellow members
- [x] Nearby community discovery via Haversine formula (no PostGIS)
- [x] Community admin panel (approve/reject join requests)
- [x] User profiles with user-chosen display names (not auto-populated from BankID)
- [x] Client-side state-based routing in `MainLayout`

### Phase 4 — Assistance Requests (Core Feature) ✅
- [x] Assistance request lifecycle: open → accepted → active → completed → safety_confirmed
- [x] Request types: walk, escort, check_in
- [x] Real-time request broadcasting via Socket.io to community rooms
- [x] Geolocation sharing during active sessions (ephemeral, purged on completion)
- [x] Safety check-in: requester confirms safe arrival after session
- [x] Request expiration worker (60s interval, 30-minute timeout)
- [x] Leaflet + OpenStreetMap map view (dynamic import)
- [x] Active session view with dual location markers

### Phase 5 — Push Notifications & Service Worker ✅
- [x] Feature-flagged push notifications (`FEATURE_PUSH_NOTIFICATIONS`)
- [x] Mock notification provider that records sent notifications for test assertions
- [x] `GET /api/notifications/sent` endpoint for verifying mock notifications in tests
- [x] Service worker: push reception, offline caching, notification click handling
- [x] VAPID key configuration (via `web-push` package)
- [x] Push notifications sent to eligible responders on new request creation (eligibility-filtered, localized in all 11 languages)

### Phase 6 — Rate Limiting, GDPR & Hardening ✅
- [x] In-memory sliding window rate limiter (auth: 10/min, API: 100/min, nearby: 5/min)
- [x] Lightweight input validation middleware
- [x] GDPR data export (`GET /api/gdpr/export`)
- [x] GDPR account deletion with 30-day cooling period + hard-delete worker
- [x] Request history anonymization on hard delete

### Phase 7 — CI/CD (Codeberg / Woodpecker CI) ✅
- [x] Woodpecker CI test pipeline (`.woodpecker/test.yaml`)
- [x] Woodpecker CI build validation pipeline (`.woodpecker/build.yaml`)
- [x] Request Woodpecker CI onboarding at `ci.codeberg.org` (manual step)

### Beta Deployment Preparation ✅
- [x] Production hardening: Express trust proxy for Traefik, Helmet CSP for Leaflet/Socket.io
- [x] Real web-push provider (`webPush.sendNotification()` with VAPID credentials, falls back to mock)
- [x] VAPID keys wired through `docker-compose.yml` backend env + `frontend/Dockerfile` build arg
- [x] PWA icons generated: `icon-192.png` + `icon-512.png` (from `icon.svg`)
- [x] GDPR cleanup bug fixed: `requester_id` made nullable (migration `005_nullable_requester`)
- [x] Beta notice banner added to `MainLayout.jsx` (11 languages, sessionStorage-dismissible)
- [x] `.env.example` production env template created
- [x] `docs/deployment.md` — GleSYS VPS setup + deploy guide
- [x] Hosting provider chosen: GleSYS (Stockholm, ~€20/mo)

### Capacitor Native Apps ✅
- [x] Capacitor 7 project setup (iOS + Android platform projects)
- [x] API base URL abstraction (`frontend/src/config.js`) for native → production server
- [x] CORS for Capacitor origins (`capacitor://localhost`, `http://localhost`)
- [x] Native push registration via `@capacitor/push-notifications` + FCM/APNs backend
- [x] Native push token storage (`native_push_tokens` table, migration 009)
- [x] Firebase Admin SDK integration for native push delivery
- [x] Service worker skip on native (WKWebView unreliable SW support)
- [x] Splash screen, status bar, keyboard plugin configuration
- [x] GDPR export includes native push tokens
- [x] iOS keyboard fix: collapsible landing page content on input focus
- [x] Build scripts: `npm run ios`, `npm run android`

## 🔲 Future (post-launch)
- [ ] Obtain BankID Relying Party agreement and certificate
- [x] ~~Generate VAPID keys for production push notifications~~ (wired, generate on VPS)
- [ ] Emergency contact notification (when safety check-in not confirmed)
- [x] ~~Replace placeholder icon~~ (PNGs generated; real branding still needed)
- [ ] Replace placeholder PNGs with professional branding
- [ ] WCAG 2.1 AA accessibility audit
- [ ] Staging environment
- [ ] Monitoring and logging (structured logging, error tracking)
- [ ] Register non-profit organization
- [ ] Privacy policy and terms of service
- [x] Open-source license selection and publication
- [ ] Bundle Leaflet CSS locally (currently from unpkg CDN)
- [ ] Code-split large frontend chunk (258KB → manual chunks)
- [ ] Integration tests with running database
- [ ] End-to-end tests (Playwright)
- [ ] Create `frontend/src/services/auth.js` API client (currently inline in components)

## Phase Dependency Graph

```
Phase 0 (Foundation) ───┬──→ Phase 1 (i18n)          ✅
                        ├──→ Phase 2 (Auth + JWT)     ✅
                        │        │
                        │        ├──→ Phase 3 (Profiles + Communities)  ✅
                        │        │        │
                        │        │        └──→ Phase 4 (Assistance Requests)  ✅
                        │        │                 │
                        │        │                 └──→ Phase 5 (Notifications + SW)  ✅
                        │        │
                        │        └──→ Phase 6 (Rate Limiting + GDPR)  ✅
                        │
                        └──→ Phase 7 (CI/CD)          ✅
```

## Context

### What this project is
Tillsammans ("Together") is a **non-profit digital safety platform** where verified Swedish citizens can temporarily connect for real-world safety coordination — such as walking home at night. It is **not** a social network: no chat, no likes, no feeds. Users authenticate via BankID (Swedish national e-ID). The initiative operates as a non-profit; no ads, no data monetization.

### Technical constraints
- Must work on **old Android devices** (Chrome 60+, Android 5+) and all iPhones (iOS 10+)
- Deployed on a **low-resource VPS** (small PostgreSQL pool, lightweight containers)
- **Open-source** codebase for transparency and public trust
- PWA delivery (no app store)

### Owner
Sami Lamti — sami.lamti@gmail.com

### Repository
https://codeberg.org/Sami-X-Lamti/Tillsammans

### Domain
covey.se (configured in `.env`)
