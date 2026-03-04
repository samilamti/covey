---
name: add-component
description: Scaffold a new Preact component following project conventions. Use when creating a new UI component.
argument-hint: "<ComponentName>"
---

Create a new Preact component. Parse `$ARGUMENTS` for the component name in PascalCase (e.g. `ReportForm`).

### Create `frontend/src/components/<ComponentName>.jsx`

Follow this template, including only the imports actually needed:

```jsx
import { useState, useEffect } from 'preact/hooks'
import { useTranslation } from 'react-i18next'
// import { IconName } from 'lucide-preact'       // if icons needed
// import { someService } from '../services/xxx'   // if API calls needed
// import { socket } from '../socket'              // if real-time needed

export function <ComponentName>({ /* props */ }) {
  const { t } = useTranslation()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    try {
      // const result = await someService.list()
      // setData(result)
    } catch (err) {
      console.error('<ComponentName> load error:', err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  if (loading) {
    return <div class="p-4 text-center text-gray-500">{t('app.loading')}</div>
  }

  return (
    <div class="p-4">
      <h2 class="text-lg font-semibold mb-4">{t('section.title')}</h2>
      {/* component body */}
    </div>
  )
}
```

### If the component needs geolocation

Use the centralized `useGeolocation` hook (in `frontend/src/hooks/`):

```jsx
import { useGeolocation } from '../hooks/useGeolocation'
import { LocationBanner } from './LocationBanner'

// In component body:
const { position, error: geoError, loading: geoLoading, retry: retryGeo } = useGeolocation()
// For continuous tracking: useGeolocation({ watch: true, enableHighAccuracy: true })

// In JSX:
{geoError && <LocationBanner error={geoError} onRetry={retryGeo} />}
// severity="warning" for safety-critical contexts (default is "info")
```

Do NOT use `navigator.geolocation` directly — always use the hook. It handles error mapping, retry, cleanup, and mounted-ref safety.

### If the component needs real-time updates

Add socket subscription in useEffect with cleanup:

```jsx
useEffect(() => {
  loadData()

  const handleUpdate = (updatedItem) => {
    setData(prev => /* merge update */)
  }

  socket.on('event:name', handleUpdate)
  return () => socket.off('event:name', handleUpdate)
}, [])
```

### Conventions
- **Preact, not React** — `import { h } from 'preact'` is implicit (JSX transform handles it)
- **Styling**: Tailwind utility classes only — no custom CSS, no CSS modules
- **Icons**: `lucide-preact` (not lucide-react)
- **Translations**: Every user-facing string uses `t('section.key')` — never hardcode text
- **Error handling**: `try/catch` with `console.error` — never show raw errors to users
- **Naming**: PascalCase for components, camelCase for functions/variables
- **Exports**: Named exports (`export function X`), not default exports

### After creating the component
- Add any new locale keys to all 12 locale files (use `/add-locale-key`)
- Import and render the component from a parent (e.g. `MainLayout.jsx`, `App.jsx`)
