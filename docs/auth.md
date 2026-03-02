# Authentication

## Architecture

The auth layer uses a **provider pattern** with two implementations behind a common interface. The module lives in `backend/src/auth/` (replacing the monolithic `auth.js`).

```
backend/src/auth/
  index.js              # Re-exports authRouter, authenticate
  router.js             # Express router: /login, /collect, /cancel, /verify, /logout
  middleware.js          # authenticate middleware (JWT verification)
  jwt.js                # signToken(), verifyToken() using jose (HS256)
  providers/
    stub.js             # Comprehensive mock BankID provider
    bankid.js           # Real BankID provider (feature-flagged)
```

## Provider Selection

The active provider is determined by two settings:

| `AUTH_PROVIDER` | `FEATURE_BANKID_AUTH` | Result |
|-----------------|-----------------------|--------|
| `stub` | (ignored) | Stub provider |
| `bankid` | `true` | Real BankID provider |
| `bankid` | `false` | Stub provider (with warning log) |

This dual-gate design means you can set `AUTH_PROVIDER=bankid` in your env but still safely test against the stub by keeping the feature flag off.

## Provider Interface

Both providers implement:

```js
{
  initAuth(nin)            → { orderRef, autoStartToken }
  collect(orderRef)        → { status, hintCode?, user? }
  cancel(orderRef)         → void
}
```

## API Endpoints

| Endpoint | Method | Body | Response |
|----------|--------|------|----------|
| `/api/auth/login` | POST | `{ "nin": "198501011234" }` | `{ "orderRef": "...", "autoStartToken": "..." }` |
| `/api/auth/collect` | POST | `{ "orderRef": "..." }` | `{ "status": "pending"\|"complete"\|"failed", ... }` |
| `/api/auth/cancel` | POST | `{ "orderRef": "..." }` | `{ "ok": true }` |
| `/api/auth/verify` | POST | — (Bearer token) | `{ "valid": true, "user": {...} }` |
| `/api/auth/logout` | POST | — (Bearer token) | `{ "ok": true }` |
| `/api/me` | GET | — (Bearer token) | `{ "user": {...} }` |

## JWT Tokens

Tokens are proper JWTs signed with `jose` (HS256), replacing the old base64url stub tokens.

```js
// jwt.js
import { SignJWT, jwtVerify } from 'jose'

export async function signToken(payload)   // → signed JWT (24h expiry)
export async function verifyToken(token)   // → decoded payload or throws
```

Token payload includes: `sub` (NIN hash), `name`, `userId`, `provider`, `iat`, `exp`.

## Stub Provider — Detailed Behavior

The stub simulates realistic BankID behavior for end-to-end testing:

### Time-based state progression

| Elapsed time | Status | Hint code |
|-------------|--------|-----------|
| 0–1.5s | `pending` | `outstandingTransaction` |
| 1.5–3s | `pending` | `userSign` |
| >3s | `complete` | — (returns user data + JWT) |

### Error simulation

Deterministic error simulation via NIN prefix:

| Prefix | Simulated error |
|--------|----------------|
| `000*` | `userCancel` — user cancelled in BankID app |
| `111*` | `expiredTransaction` — order timed out |
| (other) | Normal flow → complete |

### In-memory order tracking

Orders are stored in a `Map` (not the database). Each order tracks: `nin`, `createdAt`, `status`. Orders are cleaned up on `collect` (complete/failed) or `cancel`.

## Usage

```bash
# Login (initiate auth)
curl -s -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"nin":"198501011234"}'
# → { "orderRef": "stub-...", "autoStartToken": "stub-ast-..." }

# Poll for completion
curl -s -X POST http://localhost:3000/api/auth/collect \
  -H 'Content-Type: application/json' \
  -d '{"orderRef":"stub-..."}'
# → { "status": "pending", "hintCode": "userSign" }
# → { "status": "complete", "completionData": { "user": {...}, "token": "eyJ..." } }

# Use the JWT on protected routes
curl -H "Authorization: Bearer eyJ..." http://localhost:3000/api/me
```

## Protecting routes

```js
import { authenticate } from './auth/index.js'

router.get('/protected', authenticate, (req, res) => {
  // req.user is set by the middleware
  res.json({ user: req.user })
})
```

## Socket.io Authentication

Socket.io connections are authenticated via JWT middleware:

```js
io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token
  const payload = await verifyToken(token)  // throws → connection rejected
  socket.user = payload
  next()
})
```

The frontend passes the token when connecting:

```js
const socket = io({ auth: { token: localStorage.getItem('token') }, autoConnect: false })
```

## Users Table

The NIN (Swedish personnummer) is **never stored raw** in the database. Only the SHA-256 hash is kept for lookups:

```sql
CREATE TABLE users (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nin_hash             TEXT UNIQUE NOT NULL,  -- SHA-256
  display_name         TEXT NOT NULL DEFAULT '',
  given_name           TEXT NOT NULL DEFAULT '',
  surname              TEXT NOT NULL DEFAULT '',
  verified             BOOLEAN NOT NULL DEFAULT FALSE,
  preferred_lang       TEXT NOT NULL DEFAULT 'sv',
  ...
);
```

Display names are **user-chosen pseudonyms** — the BankID real name (`givenName`, `surname`) is stored for admin/audit purposes but NOT auto-populated into `display_name`.

## Swapping in Real BankID

### Prerequisites

1. A **Relying Party agreement** with BankID (requires a Swedish organization number)
2. An RP certificate (`.p12` file) from BankID
3. Set `FEATURE_BANKID_AUTH=true` in `.env`

### Steps

1. Set `AUTH_PROVIDER=bankid` and `FEATURE_BANKID_AUTH=true` in `.env`
2. Configure BankID certificates in `backend/src/auth/providers/bankid.js`
3. The route interfaces (`authRouter`, `authenticate` middleware) stay identical — no frontend changes needed
