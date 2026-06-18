# BankID — free test-environment integration

The real BankID provider (`backend/src/auth/providers/bankid.js`) implements the
**BankID REST API v6.0 (Secure Start)** and is wired to run against BankID's **free
test environment** — no Relying Party agreement and no cost. This lets us validate
the whole login flow before choosing a production path (broker vs direct-via-bank —
see `../../ops/tech/bankid-connection-options.md` in the private ops repo).

## What it does

- `initAuth({ endUserIp })` → `POST /auth` → `{ orderRef, autoStartToken, qrStartToken, qrStartSecret }`
- `collect(orderRef)` → `POST /collect` → `{ status, hintCode?, user? }`; on `complete`,
  builds the user from `completionData` (personal number → SHA-256 hash, never stored raw)
- `cancel(orderRef)` → `POST /cancel`
- `qr(orderRef)` → the current animated-QR payload (`bankid.<token>.<sec>.<hmac>`)

v6 is **Secure Start only** — there is no "type your personnummer" flow. The user
starts BankID via the autostart token (same device) or by scanning the animated QR
(other device); the verified identity comes back in `collect`.

Transport is mutual TLS with the RP certificate, configured via env (test defaults):

| Env | Default | Notes |
|---|---|---|
| `BANKID_API_URL` | `https://appapi2.test.bankid.com/rp/v6.0` | prod: `https://appapi2.bankid.com/rp/v6.0` |
| `BANKID_CERT_PATH` | `backend/certs/test-client-cert.pem` | RP client cert |
| `BANKID_KEY_PATH` | `backend/certs/test-client-key.pem` | RP private key |
| `BANKID_CA_PATH` | `backend/certs/ca_test.crt` | BankID test root CA (TLS trust anchor) |
| `BANKID_CERT_PASSPHRASE` | _(unset)_ | only if the key is encrypted (prod) |

## Run it

### 1. Fetch the test certificate (once)

```bash
scripts/bankid/setup-test-cert.sh
```

Populates `backend/certs/` with the public BankID test cert + CA (see
`backend/certs/README.md`). Gitignored.

### 2. Point the backend at BankID

In `.env.local` (or the backend's env):

```
AUTH_PROVIDER=bankid
FEATURE_BANKID_AUTH=true
```

Start the stack as usual (`/stack` skill or docker compose). With
`FEATURE_BANKID_AUTH=false`, the router falls back to the stub — so existing
stub-based tests and the current login screen are unaffected.

### 3. Validate with a real test BankID

The production login screen still uses the NIN/stub flow, so a **dev-only page**
drives the real Secure Start flow without rebuilding that UX:

```
http://localhost:3000/api/auth/bankid/dev      (disabled when NODE_ENV=production)
```

It starts an order, shows the animated QR + an "open BankID on this device" button,
polls `/collect`, and prints the verified name + the issued JWT on success.

Get a test BankID at <https://developers.bankid.com/test-portal/bankid-for-test>
("BankID for test" — issue a test user at `demo.bankid.com` with a Skatteverket test
personnummer, install the BankID app in test mode). Then scan the QR or tap autostart.

## Validation status (2026-06-18)

Proven against the **live** `appapi2.test.bankid.com`:

- ✅ Wire-level mTLS round-trip via curl: `/auth` → `/collect` (pending) → `/cancel`
- ✅ The Node provider (`bankid.js`) end-to-end: `initAuth` / `qr` / `collect` / `cancel`
- ✅ The Express routes (`/login`, `/qr`, `/cancel`) via the real router
- ✅ QR algorithm matches BankID's documented vectors; mappers unit-tested (`backend/test/auth-bankid.test.js`)

**Still needs a physical test BankID** to exercise the `complete` path (the user
scanning + signing) and the subsequent DB user-upsert — that's the manual step in §3.

## Going to production

1. Pick a path (broker OIDC vs direct-via-bank) — see the ops brief.
2. Obtain the real RP certificate; set `BANKID_API_URL` to the prod host and the
   cert/key/ca/passphrase env to the real material (keep it out of git; load from a
   secret store on the VPS via `scripts/deploy/set-prod-secret.sh`).
3. Build the production Secure Start UI in the frontend (QR + autostart + polling),
   replacing the NIN entry screen. The backend provider + `/login` `/collect` `/qr`
   `/cancel` `/bankid/dev` endpoints are already in place to support it.

## Troubleshooting

- **"BankID RP certificate not configured"** — run the setup script, or set the
  `BANKID_*_PATH` env vars. The error names the exact paths it tried.
- **TLS "unable to get local issuer"** — `BANKID_CA_PATH` is wrong/missing; it must be
  the BankID **test** root CA (`ca_test.crt`), which is what validates the test server.
- **`/auth` "invalidParameters" on endUserIp** — the router normalizes `req.ip`
  (`::1` → `127.0.0.1`, strips `::ffff:`); behind a proxy ensure `trust proxy` is set
  (it is, in `index.js`).
- **429 while polling** — `/collect` and `/qr` use the looser `apiRateLimit` (100/min);
  only `/login` and `/verify` use the strict `authRateLimit` (10/min).
