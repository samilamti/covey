---
name: add-feature-flag
description: Add a new FEATURE_* flag across all required files. Use when gating a new capability behind a feature flag.
argument-hint: "<FLAG_NAME>"
---

Add a new feature flag. Parse `$ARGUMENTS` for the flag name (e.g. `REAL_TIME_CHAT`). The name should be UPPER_SNAKE_CASE without the `FEATURE_` prefix.

### 4 files must be edited — missing any one breaks the flag

#### 1. `backend/src/features.js` — Add to DEFAULTS
```js
const DEFAULTS = {
  BANKID_AUTH: false,
  PUSH_NOTIFICATIONS: false,
  GEOLOCATION: false,
  COMMUNITIES: false,
  <FLAG_NAME>: false,        // ← add here
}
```

#### 2. `docker-compose.yml` — Add to backend environment
```yaml
backend:
  environment:
    FEATURE_<FLAG_NAME>: ${FEATURE_<FLAG_NAME>:-false}
```
Add after the existing `FEATURE_*` lines (around line 30-34).

#### 3. `.woodpecker/test.yaml` — Add to backend-test environment
```yaml
- name: backend-test
  environment:
    FEATURE_<FLAG_NAME>: "false"
```
Add after the existing `FEATURE_*` lines.

#### 4. `docker-compose.local.yml` (optional) — Only if the flag should be `true` in local dev
```yaml
backend:
  environment:
    FEATURE_<FLAG_NAME>: "true"
```

### Usage in code

**Backend**:
```js
import { isEnabled } from './features.js'
if (isEnabled('<FLAG_NAME>')) { ... }
```

**Frontend** — automatically available via `GET /api/features`, consumed by `FeatureFlagContext`:
```jsx
import { useFeatureFlag } from '../context/FeatureFlagContext'
const isEnabled = useFeatureFlag('<FLAG_NAME>')
```

## Checklist
- [ ] Added to `DEFAULTS` in `backend/src/features.js`
- [ ] Added to `docker-compose.yml` backend environment
- [ ] Added to `.woodpecker/test.yaml` backend-test environment
- [ ] Optionally added to `docker-compose.local.yml` if needed in local dev
- [ ] Verified: `curl -sk https://localhost/api/features` shows the new flag after stack restart
