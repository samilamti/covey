---
name: add-service
description: Scaffold a new frontend API service (fetch wrapper). Use when adding a frontend client for a new backend route.
argument-hint: "<serviceName>"
---

Create a new frontend API service. Parse `$ARGUMENTS` for the service name in camelCase (e.g. `reportService`).

### Create `frontend/src/services/<name>.js`

Follow this exact pattern (matches existing services like `requestService`, `ratingService`):

```js
/**
 * <Name> API client.
 */

const API_URL = '/api/<resource>'

function authHeaders() {
  const token = localStorage.getItem('token')
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

export const <name>Service = {
  async list() {
    const res = await fetch(API_URL, { headers: authHeaders() })
    if (!res.ok) throw new Error('Failed to list <resource>')
    return res.json()
  },

  async get(id) {
    const res = await fetch(`${API_URL}/${id}`, { headers: authHeaders() })
    if (!res.ok) throw new Error('Failed to get <resource>')
    return res.json()
  },

  async create(data) {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error('Failed to create <resource>')
    return res.json()
  },

  // Add more methods as needed (update, delete, etc.)
}
```

### Conventions
- **`authHeaders()`** is defined locally in each service file — not shared (keeps services self-contained)
- **Error handling**: `throw new Error(...)` on non-ok responses — components catch these in try/catch
- **Method names**: Use `get(id)`, `list()`, `create(data)` — NOT `getById`, `getAll`, `add`. This is a documented gotcha: importing a non-existent method name causes runtime errors, not import errors
- **API_URL**: Always `/api/<resource>` — Traefik routes `/api/*` to the backend
- **Export**: Named export as `<name>Service` object — NOT a default export, NOT a class

### After creating the service
- Verify the backend route exists at the matching path
- Import in the component: `import { <name>Service } from '../services/<name>'`
- Verify the method names match what the component calls (the #1 source of runtime errors)
