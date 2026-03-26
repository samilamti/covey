# Project Structure

## Root

```
Tillsammans/
├── docker-compose.yml          # Orchestrates all 4 services
├── docker-compose.local.yml    # TLS overlay: self-signed (local dev)
├── docker-compose.prod.yml     # TLS overlay: Let's Encrypt (production)
├── .env                        # Secrets (never committed)
├── .env.local                  # Local dev overrides (DOMAIN=localhost)
├── .gitignore                  # Ignores node_modules, dist, .env, etc.
├── test-locally.ps1            # PowerShell helper: starts local stack
├── .woodpecker/                # Woodpecker CI pipeline configs
│   ├── test.yaml               # Test pipeline (backend + frontend)
│   └── build.yaml              # Docker build validation
├── docs/                       # This documentation
├── frontend/                   # Preact + Vite + Tailwind
└── backend/                    # Express + Socket.io + PostgreSQL
```

## Frontend (`frontend/`)

```
frontend/
├── Dockerfile              # Multi-stage: node builder → nginx production
├── .dockerignore           # Excludes node_modules, dist from build context
├── package.json            # Deps: preact, preact-router, socket.io-client,
│                           #   i18next, react-i18next, leaflet, lucide-preact
│                           # DevDeps: vite, @preact/preset-vite, tailwindcss,
│                           #   autoprefixer, postcss, vitest,
│                           #   @testing-library/preact, jsdom
├── vite.config.js          # Preact plugin, proxy /api + /socket.io in dev
├── vitest.config.js        # Vitest test configuration
├── tailwind.config.js      # Scans index.html + src/**/*.{js,jsx}
├── postcss.config.js       # Wires tailwindcss + autoprefixer
├── nginx.conf              # SPA fallback, gzip, security headers, asset caching
├── index.html              # Entry point with PWA meta tags (lang="sv")
├── public/
│   ├── manifest.json       # PWA manifest (installable on Android/iOS)
│   ├── icon.svg            # Placeholder favicon (replace with real branding)
│   └── sw.js               # Service worker (push, offline cache)
├── src/
│   ├── main.jsx            # Preact render entry + service worker registration
│   ├── App.jsx             # Root component: auth state, router, socket
│   ├── socket.js           # Singleton Socket.io client (auth token, autoConnect:false)
│   ├── i18n.js             # i18next config (11 languages, sv fallback, RTL)
│   ├── index.css           # Tailwind directives + mobile compatibility resets
│   ├── context/
│   │   └── FeatureFlagContext.jsx  # Feature flag Preact context + useFeatureFlag()
│   ├── components/
│   │   ├── LandingPage.jsx         # BankID login flow
│   │   ├── LanguageSelector.jsx    # 11-language dropdown with flags
│   │   ├── SamiFlag.jsx            # Custom Sami flag SVG component
│   │   ├── MainLayout.jsx          # Authenticated app shell
│   │   ├── BottomNav.jsx           # Mobile tab navigation
│   │   ├── MapView.jsx             # Leaflet + OpenStreetMap
│   │   ├── RequestList.jsx         # Assistance request list
│   │   ├── RequestCard.jsx         # Individual request card
│   │   ├── CreateRequest.jsx       # Create request form
│   │   ├── ActiveSession.jsx       # Active session with live location
│   │   ├── CommunityList.jsx       # Community list
│   │   ├── CommunityDetail.jsx     # Community detail + members
│   │   ├── NearbyDiscovery.jsx     # Discover nearby communities
│   │   ├── AdminPanel.jsx          # Community admin (approve/reject)
│   │   ├── ProfileView.jsx         # User profile + GDPR actions
│   │   └── ProgressDashboard.jsx   # Personal points & badges (feature-flagged)
│   ├── services/
│   │   ├── auth.js                 # Auth API client
│   │   ├── features.js             # Feature flag client
│   │   ├── communities.js          # Community API client
│   │   ├── profile.js              # Profile API client
│   │   ├── requests.js             # Request API client
│   │   ├── points.js               # Points & progress API client
│   │   ├── geolocation.js          # Geolocation API wrapper
│   │   └── notifications.js        # Push subscription client
│   └── locales/
│       ├── sv.json                 # Swedish (canonical source)
│       ├── nb.json                 # Norwegian Bokmal
│       ├── da.json                 # Danish
│       ├── fi.json                 # Finnish
│       ├── ar.json                 # Arabic (RTL)
│       ├── is.json                 # Icelandic
│       ├── pl.json                 # Polish
│       ├── fo.json                 # Faroese
│       ├── kl.json                 # Greenlandic
│       ├── se.json                 # Northern Sami
│       └── en.json                 # English
└── test/
    ├── setup.js                    # jsdom test setup
    ├── i18n.test.js                # i18n fallback + key coverage tests
    └── LanguageSelector.test.jsx   # Language selector tests
```

### Key details

- **Preact** (not React) — chosen for smaller bundle size on old Android devices
- **Tailwind v3** — utility-first CSS via PostCSS pipeline
- **Vite** build target is `baseline-widely-available` (Chrome 60+, iOS 10+)
- **Dev proxy**: `/api` and `/socket.io` are proxied to `http://localhost:3000`
- **Production**: nginx serves static files with SPA fallback (`try_files`)
- **Routing**: `preact-router` for client-side hash-based routing
- **Maps**: Leaflet + OpenStreetMap tiles (free, no API key)

## Backend (`backend/`)

```
backend/
├── Dockerfile              # node:22-alpine, runs migrations then starts server
├── .dockerignore           # Excludes node_modules from build context
├── package.json            # Deps: express, cors, helmet, pg, socket.io, jose, web-push
│                           # Scripts: start, migrate, dev (--watch), test
└── src/
    ├── index.js            # Express + HTTP server + Socket.io + worker startup
    ├── api.js              # Express router aggregator for /api/*
    ├── pool.js             # PostgreSQL connection pool (pg, max 10)
    ├── migrate.js          # Migration runner (single 001_initial with all tables)
    ├── features.js         # Feature flag registry (reads FEATURE_* env vars)
    ├── handlers.js         # Socket.io event handlers (auth, communities, requests, location)
    ├── auth/
    │   ├── index.js        # Re-exports authRouter, authenticate
    │   ├── router.js       # Auth Express router
    │   ├── middleware.js    # JWT authenticate middleware
    │   ├── jwt.js          # JWT sign/verify (jose, HS256)
    │   └── providers/
    │       ├── stub.js     # Comprehensive BankID stub (time-based, error simulation)
    │       └── bankid.js   # Real BankID provider (feature-flagged)
    ├── routes/
    │   ├── communities.js  # Community CRUD + join workflow
    │   ├── profile.js      # User profile endpoints
    │   ├── requests.js     # Assistance request lifecycle
    │   ├── notifications.js # Push subscription + test endpoints
    │   ├── points.js       # Points & badges API (feature-flagged)
    │   └── gdpr.js         # GDPR data export + deletion
    ├── repositories/
    │   ├── users.js        # User DB operations
    │   ├── communities.js  # Community DB operations
    │   ├── requests.js     # Request DB operations
    │   ├── points.js       # Points ledger, badges, pair cooldowns
    │   └── push-subscriptions.js  # Push subscription DB ops
    ├── services/
    │   ├── geolocation.js  # Rate-limited location relay
    │   └── notifications.js # Push notification provider (real + mock)
    ├── workers/
    │   ├── expiration.js   # Request expiration (setInterval, 60s)
    │   └── gdpr-cleanup.js # Hard-delete after 30-day cooling (daily)
    └── middleware/
        ├── rateLimit.js    # In-memory sliding window rate limiter
        └── validate.js     # Lightweight input validation
```

### Key details

- **Express 5** — latest major version with async error handling
- **Socket.io** transports: polling first, then WebSocket upgrade (old Android compatibility)
- **Auth**: Provider pattern controlled by `AUTH_PROVIDER` + `FEATURE_BANKID_AUTH` — see [auth.md](./auth.md)
- **Database**: Single `Pool` instance, max 10 connections (low-resource VPS)
- **Migrations**: Single `001_initial` creates all tables. Run automatically on container start.
- **Health check**: `GET /api/health` returns `{ ok: true }`
- **Feature flags**: `GET /api/features` returns current flag state
- **Workers**: Expiration + GDPR cleanup run in-process via `setInterval`
