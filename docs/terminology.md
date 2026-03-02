# Tillsammans — Terminology

This document defines the key terms, concepts, and domain language used throughout the Tillsammans codebase. It serves as a glossary for developers, contributors, and future maintainers.

---

## Core concepts

### Assistance request
A time-limited, real-world safety coordination request — e.g., "I need someone to walk home with." Created by a **requester**, fulfilled by a **helper**. Can be **freestanding** (no community) or **community-scoped**. Has a lifecycle: `open` → `accepted` → `active` → `completed` → `safety_confirmed`. Can also be `cancelled` or `expired`.

### Requester
The person who creates an assistance request. They are seeking safety support (e.g., a walking companion). A requester cannot accept their own request.

### Helper (responder)
The person who accepts and fulfills an assistance request. Must pass eligibility checks before acceptance. During an active session, both parties share real-time location.

### Session
The active phase of an assistance request, from acceptance through completion. During a session, requester and helper can exchange messages and share live location. The term "session" is used informally — the database model is still `assistance_requests` with status transitions.

### Community
A group of users with a shared context (e.g., a neighbourhood, workplace, university). Communities use admin-approved joins and pseudonymous display names. Requests can be scoped to a community, limiting visibility to its members.

### Freestanding request
An assistance request created without a community (`community_id` is NULL). Visible to all authenticated users via the `requests:open` Socket.io room and the `GET /api/requests/open` endpoint. Contrasts with **community-scoped requests** which are only visible to community members.

---

## Authentication & identity

### NIN (National Identity Number)
NIN — Swedish personnummer / National Identity Number. Format: `YYYYMMDDXXXX` (12 digits) or `YYMMDDXXXX` (10 digits). Used for BankID authentication. **Never stored in raw form** — only the SHA-256 hash is persisted. Demographics (birth year, sex) are extracted during login and stored separately.

### BankID
Sweden's national electronic identification system. The production auth flow uses BankID's API (not yet connected — requires an RP agreement). In development, a **stub provider** simulates the BankID flow.

### Stub provider
A development-only auth provider that simulates BankID's time-based authentication flow. Accepts any 10–12 digit NIN. Special prefixes trigger error states: `000*` = user cancel, `111*` = expired session.

### Auth provider pattern
Backend auth uses a provider abstraction (`src/auth/providers/`). The active provider is selected at runtime based on `AUTH_PROVIDER` env var and the `FEATURE_BANKID_AUTH` feature flag. Both stub and real BankID implement `initAuth()`, `collect()`, and `cancel()`.

### JWT (JSON Web Token)
Stateless authentication token issued after successful BankID login. Contains `userId` (database UUID), `name`, `sub` (NIN hash), and `provider`. HS256 signed, 24h expiry. The `userId` **must be the real database UUID**, not the NIN hash.

---

## Eligibility & safety

### Eligibility tier
Controls who can see and accept a given assistance request. Set by the requester at creation time. Three tiers exist, from most restrictive to least:

| Tier | Rule | Description |
|------|------|-------------|
| `same_demographics` | Same sex AND birth year ±5 | Default. Matches people of similar age and sex. |
| `verified_guardians` | Demographics match OR safety score ≥ 5 | Opens eligibility to experienced helpers. |
| `any_member` | No restrictions | Any authenticated user can accept. |

### Safety score
A cumulative integer score derived from post-session ratings. New users start at 0. Each completed session may yield a rating (positive or negative) from the other party. A score ≥ 5 qualifies a user as a **verified guardian**, enabling them to accept `verified_guardians`-tier requests regardless of demographic match.

### Verified guardian
A user whose safety score meets the `GUARDIAN_SCORE_THRESHOLD` (currently 5). Can accept requests at the `verified_guardians` tier even without demographic matching. The term is informal — there is no explicit "guardian" role in the database.

### Demographic matching
Comparison of two users' `sex` (M/F) and `birth_year` (within ±5 years). Implemented in `services/demographics.js`. If either user lacks demographic data, matching fails (conservative default). Used by `same_demographics` and `verified_guardians` tiers.

### Stub safety score override
Development/testing feature. The `STUB_SAFETY_SCORES` environment variable maps NIN to pre-set safety scores (e.g., `199505051234:10`). Applied at login time when using the stub auth provider. Stored in an in-memory Map, checked before querying the database.

---

## Location & geography

### Pickup location
The requester's location when they create a request. Stored as `pickup_lat`/`pickup_lng` on the assistance request. Rounded to 3 decimal places (~111m precision) in open listings to protect privacy.

### Destination
Where the requester wants to go. Stored as `destination_lat`/`destination_lng`. **Suppressed entirely** (returned as NULL) in open listings — only revealed to the helper after acceptance.

### Location relay
Real-time location sharing between requester and helper during an active session. Uses Socket.io (`location:update` event). Rate limited to one update per 5 seconds per user. Location data is ephemeral — a DB trigger purges it when the session ends.

### ETA (Estimated Time of Arrival)
Client-side calculation using Haversine straight-line distance between requester and helper positions, divided by assumed walking speed (5 km/h). Displayed during active sessions. This is an approximation — no routing API is used.

### Haversine formula
Great-circle distance calculation between two lat/lng coordinates. Implemented in `frontend/src/utils/geo.js`. Used for distance display on request cards and ETA computation in active sessions.

---

## Real-time communication

### Socket.io rooms
Server-side groupings for targeted event broadcasting:

| Room | Purpose |
|------|---------|
| `user:${userId}` | Personal room — targeted events (accept notifications, location updates, messages) |
| `requests:open` | All authenticated users — freestanding request broadcasts |
| `community:${id}` | Community members — community-scoped request broadcasts |

### Session messaging
In-session chat between requester and helper. Messages are persisted to the `session_messages` table. Only available in `accepted` or `active` sessions. Rate limited (1 message per 2 seconds per user per request). Includes 6 pre-filled **quick messages** for common situations.

### Quick messages
Pre-defined message templates that users can send with one tap during an active session. Examples: "I'm on my way", "I'm slightly delayed, but still on my way", "I can see you". Stored with `is_quick = true` in the database. Localised in all 11 languages.

---

## Request lifecycle

```
open → accepted → active → completed → safety_confirmed
  ↓        ↓         ↓
cancelled cancelled cancelled
  ↓
expired (by worker, after expiry time)
```

| Status | Meaning |
|--------|---------|
| `open` | Awaiting a helper. Visible in listings (filtered by eligibility). |
| `accepted` | Helper assigned. Messaging enabled. Not yet physically meeting. |
| `active` | Session in progress. Real-time location sharing active. |
| `completed` | Session finished. Awaiting safety confirmation from requester. |
| `safety_confirmed` | Requester confirmed safe arrival. Ratings can now be submitted. |
| `cancelled` | Cancelled by either party at any pre-completion stage. |
| `expired` | Auto-expired by the expiration worker (60s check interval). |

---

## Infrastructure

### Traefik
Reverse proxy handling TLS termination and routing. Routes `frontend` and `backend` services by hostname/path. In local dev, uses self-signed certificates with HTTP→HTTPS redirect. Dashboard available on port 8080.

### Feature flag
Boolean configuration (`FEATURE_*` env vars) controlling runtime behaviour. Backend registry in `src/features.js`, frontend context in `FeatureFlagContext.jsx`. Example: `FEATURE_BANKID_AUTH` gates real BankID vs stub provider.

### Migration
Database schema setup via `src/migrate.js`. Runs inline before server start (`await migrate()` in `index.js`). Uses `IF NOT EXISTS` DDL for idempotency. No incremental migration system — the full schema can be rewritten since there is no production data.

---

## GDPR & privacy

### Soft delete
User account deletion uses a two-phase approach: `POST /api/gdpr/delete` marks the account as deleted (soft delete). A daily worker hard-deletes accounts that have been soft-deleted for >30 days. This provides a cooling-off period for accidental deletions.

### Data export
`GET /api/gdpr/export` returns all user data: profile, community memberships, assistance requests, session messages, ratings, and push subscriptions. Required by GDPR Article 20 (right to data portability).

### Coordinate rounding
Open request listings round `pickup_lat`/`pickup_lng` to 3 decimal places (~111 metres). Destination coordinates are suppressed entirely (returned as NULL). Full precision coordinates are only available to session participants.

---

## Localisation

### Canonical language
Swedish (`sv`) is the source language. All 11 locale files derive from `sv.json`. The i18n fallback language is Swedish, not English.

### Locale key parity
A test ensures all 11 locale files contain exactly the same keys as `sv.json`. Adding a new i18n key requires updating all 11 files.

### Supported languages
sv (Swedish), nb (Norwegian Bokmal), da (Danish), fi (Finnish), ar (Arabic), is (Icelandic), pl (Polish), fo (Faroese), kl (Greenlandic), se (Northern Sami), en (English).
