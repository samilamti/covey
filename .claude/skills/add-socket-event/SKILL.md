---
name: add-socket-event
description: Scaffold a Socket.io event handler in handlers.js. Use when adding a new real-time event (request lifecycle, messaging, location, etc.).
argument-hint: "<event:name>"
---

Add a new Socket.io event handler to `backend/src/handlers.js`. Parse `$ARGUMENTS` for the event name (e.g. `request:report`, `session:typing`).

### Handler pattern

All Socket.io event handlers in this project follow a consistent structure. Add the new handler inside the `io.on('connection', (socket) => { ... })` block:

```js
/**
 * <event:name> — <one-line description>
 */
socket.on('<event:name>', async ({ requestId, /* other fields */ }) => {
  // 1. Input validation — early return on missing required fields
  if (!requestId) return

  try {
    // 2. Load request from DB
    const request = await reqRepo.findById(requestId)
    if (!request) return

    // 3. Status guard — only allow during specific statuses
    if (!['accepted', 'active', 'done_pending'].includes(request.status)) return

    // 4. Participant check — only requester or helper can act
    const isParticipant =
      socket.user.userId === request.requester_id ||
      socket.user.userId === request.helper_id
    if (!isParticipant) return

    // 5. Business logic (repo calls, service calls)
    const result = await someRepo.doSomething({ requestId, userId: socket.user.userId })
    if (!result) return

    // 6. Emit to target rooms/users
    // To the other party:
    const targetUserId =
      socket.user.userId === request.requester_id
        ? request.helper_id
        : request.requester_id
    if (targetUserId) {
      io.to(`user:${targetUserId}`).emit('<event:response>', { requestId, /* payload */ })
    }

    // Acknowledge to sender (optional):
    socket.emit('<event:ack>', { requestId, /* payload */ })

  } catch (err) {
    console.error('Socket <event:name> error:', err.message)
    // Optionally emit error to sender:
    // socket.emit('error', { message: 'Failed to <action>' })
  }
})
```

### Emit target patterns

Choose the right target based on the event type:

| Target | Code | Use when |
|--------|------|----------|
| Other party only | `io.to(\`user:\${targetUserId}\`).emit(...)` | Location relay, messages, done proposals |
| Both parties | Emit to both `user:${request.requester_id}` and `user:${request.helper_id}` | Status changes (completed, cancelled) |
| All open-request watchers | `io.to('requests:open').emit(...)` | New request created, request accepted/cancelled |
| Sender only (ack) | `socket.emit(...)` | Message sent confirmation |
| Sender only (error) | `socket.emit('error', { message })` | Validation failures |

### Rate limiting (if needed)

For high-frequency events, add an in-handler rate limit using the same pattern as `message:send`:

```js
const lastAction = new Map()
const MIN_INTERVAL = 2000 // ms

socket.on('<event:name>', async (data) => {
  const key = `${socket.user.userId}:${data.requestId}`
  const last = lastAction.get(key)
  if (last && Date.now() - last < MIN_INTERVAL) return
  lastAction.set(key, Date.now())

  // ... rest of handler
})
```

### Imports

If the handler needs a new repository or service, add the import at the top of `handlers.js`:

```js
import * as newRepo from './repositories/new.js'
// or
import { someFunction } from './services/some.js'
```

### Conventions

- **Error handling**: `try/catch` with `console.error` — errors are logged but never crash the socket. Silent returns for invalid input, explicit error events only for actionable user failures (like eligibility rejection).
- **Status checks**: Always verify `request.status` before acting. The allowed statuses depend on the event — don't blindly copy from another handler.
- **Participant guard**: Always check `isParticipant` for events scoped to a session. Omit only for broadcast events (like `request:create`).
- **Fire-and-forget side effects**: Push notifications and other non-critical side effects use `.catch(() => {})` — never let them block or fail the main flow.
- **Socket.user**: Available after JWT middleware. Contains `{ userId, sub, name, provider }`.

### After adding the handler

1. **Verify imports**: Run `/check-exports` to ensure any new imports match actual exports
2. **Add frontend listener**: In the relevant component's `useEffect`, add `socket.on('<event:response>', handler)` with cleanup `socket.off(...)` in the return function
3. **Add frontend emitter**: `socket.emit('<event:name>', { requestId, ... })`
4. **Test manually**: The socket handlers can't be unit tested (they require a running Socket.io server) — test via the running stack with two browser tabs
