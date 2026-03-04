---
name: add-hook
description: Scaffold a custom Preact hook in frontend/src/hooks/. Use when creating reusable stateful logic (geolocation, websocket, local storage, etc.).
argument-hint: "<hookName>"
---

Scaffold a custom Preact hook. Parse `$ARGUMENTS` for the hook name in camelCase starting with `use` (e.g. `useLocalStorage`, `useDebounce`).

### Create `frontend/src/hooks/<hookName>.js`

Follow this template, based on the established `useGeolocation` pattern:

```js
import { useState, useEffect, useCallback, useRef } from 'preact/hooks'

/**
 * <hookName> — <one-line description>.
 *
 * @param {object} opts
 * @param {type} opts.optionName — description
 * @returns {{ value: type, error: string|null, loading: boolean }}
 */
export function <hookName>(opts = {}) {
  const [value, setValue] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const mountedRef = useRef(true)

  const doWork = useCallback(() => {
    if (!mountedRef.current) return
    setLoading(true)
    setError(null)

    try {
      // Core logic here
      // Always guard with: if (!mountedRef.current) return
      setLoading(false)
    } catch (err) {
      if (!mountedRef.current) return
      setError(err.message || 'unknown')
      setLoading(false)
    }
  }, [/* deps */])

  useEffect(() => {
    mountedRef.current = true
    doWork()

    return () => {
      mountedRef.current = false
      // Clean up subscriptions, timers, watchers
    }
  }, [doWork])

  return { value, error, loading, retry: doWork }
}
```

### Key patterns

- **`mountedRef`**: Always use a mounted ref to guard state updates after unmount. Set `true` in effect body, `false` in cleanup. Check before every `setState` call.
- **Cleanup**: Return a cleanup function from `useEffect` that cancels any subscriptions, clears timers, or removes event listeners.
- **`useCallback` for start/retry**: Wrap the main logic in `useCallback` so consumers get a stable `retry()` function, and the effect re-runs only when deps change.
- **Error mapping**: Map raw error codes to semantic strings (like `useGeolocation` maps `1` → `'denied'`). Components should never see raw error objects.
- **JSDoc**: Document params and return type. Every hook returns an object (not an array) for named destructuring.

### Conventions

- **File location**: `frontend/src/hooks/<hookName>.js`
- **Naming**: Always `use` prefix, camelCase: `useGeolocation`, `useLocalStorage`, `useDebounce`
- **Export**: Named export (`export function useXxx`), never default
- **No JSX**: Hooks are plain JS files (`.js`), not `.jsx`
- **No i18n**: Hooks return error codes/strings — the consuming component handles translation via `t()`
- **No side effects on import**: All logic runs inside `useEffect` or callbacks, never at module scope
- **Browser API checks**: Guard with `typeof navigator !== 'undefined'` or similar before accessing browser APIs

### After creating the hook

1. Create a test file — use `/add-test frontend <hookName>` (the hook test scaffold)
2. Import in the component that needs it: `import { <hookName> } from '../hooks/<hookName>'`
3. If the hook exposes error states, consider pairing with `<LocationBanner>` or a similar error banner component
