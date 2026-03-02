---
name: add-route
description: Scaffold a new Express route file and register it in api.js. Use when adding a new backend API endpoint or resource.
argument-hint: "<resource-name>"
---

Scaffold a new Express route file following the project's established patterns. Parse `$ARGUMENTS` for the resource name (e.g. `contacts`, `reports`).

### Step 1 — Create the route file

Create `backend/src/routes/<name>.js` following this exact pattern:

```js
/**
 * <Name> routes.
 */

import { Router } from 'express'
import { authenticate } from '../auth/index.js'
// import * as xxxRepo from '../repositories/xxx.js'  (if repo exists)

export const <name>Router = Router()

<name>Router.use(authenticate)

// Routes go here — follow ordering rules below
```

### Step 2 — Register in api.js

Add to `backend/src/api.js`:
1. Import: `import { <name>Router } from './routes/<name>.js'`
2. Mount: `apiRouter.use('/<name>', <name>Router)` — add BEFORE the `/ping` health check

### Step 3 — Add route handlers

Each handler follows this pattern:
```js
<name>Router.get('/', async (req, res) => {
  try {
    // logic using req.user.userId for the authenticated user
    res.json({ data })
  } catch (err) {
    console.error('<Name> error:', err.message)
    res.status(500).json({ error: 'Failed to <action>' })
  }
})
```

Status codes: `201` for creates, `200` for reads/updates, `409` for state conflicts, `403` for auth failures, `404` for not found.

Error shape is always `{ error: 'message' }`.

### Route ordering rules (CRITICAL)

Register routes in this order — Express matches top-to-bottom:
1. **Static paths** first: `/open`, `/pending`
2. **Parameterized with suffix** next: `/:id/messages`, `/:id/accept`
3. **Bare parameterized** last: `/:id`

If `/:id` comes before `/:id/messages`, Express will match `/messages` as an ID value.

### Optional: Socket.io broadcast

If the route needs real-time updates, access the io instance:
```js
const io = req.app.get('io')
io.to('room-name').emit('event:name', data)
```

### Optional: Fire-and-forget side effects

For non-critical side effects like push notifications:
```js
notifyNewRequest(request, io).catch(() => {})
```
Never let side-effect failures block the main response.

## Checklist
- [ ] Route file created with correct export name
- [ ] Import and mount added to `api.js`
- [ ] Routes ordered correctly (static → parameterized-with-suffix → bare `:id`)
- [ ] All handlers have try/catch with console.error
- [ ] `authenticate` middleware applied
