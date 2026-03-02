---
name: vapid-setup
description: Generate VAPID keys for production push notifications and configure them across the stack. Use when setting up real push notifications.
---

Generate VAPID keys and wire them into the project for production push notifications.

### Step 1 — Generate VAPID key pair

```bash
cd backend && npx web-push generate-vapid-keys
```

This outputs a `publicKey` and `privateKey`. Save both — the private key cannot be regenerated.

### Step 2 — Add to environment variables

Add to `.env.local` (and production env):
```
VAPID_PUBLIC_KEY=<public key>
VAPID_PRIVATE_KEY=<private key>
VAPID_CONTACT=mailto:admin@covey.se
```

### Step 3 — Wire into Docker Compose

**`docker-compose.yml`** — add to backend environment:
```yaml
VAPID_PUBLIC_KEY: ${VAPID_PUBLIC_KEY}
VAPID_PRIVATE_KEY: ${VAPID_PRIVATE_KEY}
VAPID_CONTACT: ${VAPID_CONTACT:-mailto:admin@covey.se}
```

**`docker-compose.local.yml`** — add to backend environment (for local testing):
```yaml
VAPID_PUBLIC_KEY: ${VAPID_PUBLIC_KEY}
VAPID_PRIVATE_KEY: ${VAPID_PRIVATE_KEY}
VAPID_CONTACT: ${VAPID_CONTACT}
```

### Step 4 — Enable the feature flag

Use `/add-feature-flag PUSH_NOTIFICATIONS` if not already done, or set the existing flag to `true`:

In `docker-compose.local.yml`:
```yaml
FEATURE_PUSH_NOTIFICATIONS: "true"
```

### Step 5 — Verify

1. Restart the stack: `/stack reset` or `/stack up`
2. Check the feature flag: `curl -sk https://localhost/api/features` — should show `PUSH_NOTIFICATIONS: true`
3. In the browser, allow notification permissions when prompted
4. Subscribe via the notification bell icon
5. Create a request from another user — the first user should receive a push notification

### Step 6 — Update frontend service worker

The public VAPID key needs to be available to the frontend for the `pushManager.subscribe()` call. Check `frontend/public/sw.js` and the notification subscription code in `frontend/src/services/notifications.js` to ensure the public key is correctly passed as `applicationServerKey`.

## Notes
- VAPID keys are permanent — generate once, use forever. Don't regenerate unless compromised
- The private key must NEVER be committed to the repository
- `web-push` is already installed in the backend (`package.json`)
- The notification provider pattern is already implemented — mock provider for dev, real provider for production. Switching is controlled by the `FEATURE_PUSH_NOTIFICATIONS` flag
- Push notification bodies are hardcoded in all 11 languages in `services/notifications.js`
