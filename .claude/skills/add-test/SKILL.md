---
name: add-test
description: Scaffold a test file for backend (node:test) or frontend (vitest). Use when adding tests for new modules or components.
argument-hint: "<backend|frontend> <module-name>"
---

Scaffold a test file. Parse `$ARGUMENTS` for the target (`backend` or `frontend`) and the module/component name.

## Backend test — `backend/test/<name>.test.js`

Uses `node:test` (built into Node 22). Pattern:

```js
/**
 * <Name> tests.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { functionToTest } from '../src/<path>.js'

describe('<functionName>', () => {
  it('should <expected behavior>', () => {
    const result = functionToTest(input)
    assert.equal(result, expected)
  })

  it('should handle edge case', () => {
    assert.throws(() => functionToTest(badInput), { message: /expected error/ })
  })
})
```

**Backend test constraints**:
- All tests are pure unit tests — no database, no HTTP server, no running Socket.io
- Test only pure/exported functions (e.g. `matchesDemographics`, `parseBirthYear`, `signToken`)
- If a function needs DB, extract its pure logic into a testable function (existing pattern: `checkEligibility` delegates to testable `matchesDemographics`)
- Use `assert` from `node:assert/strict`, not third-party assertion libraries
- Test file location: `backend/test/<name>.test.js` (glob pattern: `test/**/*.test.js`)

## Frontend test — `frontend/test/<Name>.test.jsx`

Uses `vitest` + `@testing-library/preact`. Pattern:

```jsx
/**
 * <ComponentName> component tests.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, waitFor } from '@testing-library/preact'
import { h } from 'preact'

// Mock i18next (standard boilerplate — same in every component test)
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
    i18n: { language: 'sv', changeLanguage: vi.fn() },
  }),
}))

// Mock lucide icons used by the component
vi.mock('lucide-preact', () => ({
  IconName: (props) => h('span', props, 'IconName'),
}))

// Mock services as needed
vi.mock('../src/services/xxx', () => ({
  xxxService: {
    list: vi.fn().mockResolvedValue({ items: [] }),
  },
}))

// Mock hooks with mutable state for per-test control
let hookState = { /* default values */ }
vi.mock('../src/hooks/useXxx', () => ({
  useXxx: () => hookState,
}))

// Use await import() AFTER vi.mock() to get mocked modules
const { ComponentName } = await import('../src/components/ComponentName')
const { xxxService } = await import('../src/services/xxx')

describe('ComponentName', () => {
  let consoleErrorSpy

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.clearAllMocks()
    // Reset mutable hook state
    hookState = { /* default values */ }
  })

  afterEach(() => {
    // Catch unexpected console.error calls (Preact prop warnings, etc.)
    expect(consoleErrorSpy).not.toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
  })

  it('renders the title', () => {
    const { getByText } = render(<ComponentName />)
    expect(getByText('section.title')).toBeTruthy()
  })

  it('handles async data loading', async () => {
    const { getByText } = render(<ComponentName />)
    await waitFor(() => {
      expect(getByText('expected.key')).toBeTruthy()
    })
  })
})
```

## Frontend hook test — `frontend/test/<hookName>.test.js`

For testing custom hooks in `frontend/src/hooks/`:

```js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/preact'
import { useHookName } from '../src/hooks/useHookName'

describe('useHookName', () => {
  let consoleErrorSpy

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    expect(consoleErrorSpy).not.toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
  })

  it('returns expected initial state', () => {
    const { result } = renderHook(() => useHookName())
    expect(result.current.value).toBe(expected)
  })

  it('updates state on action', () => {
    const { result } = renderHook(() => useHookName())
    act(() => {
      result.current.doAction()
    })
    expect(result.current.value).toBe(updated)
  })
})
```

**Frontend test conventions**:
- The i18n mock returns keys as-is (`t: (key) => key`), so assertions use key paths like `'ratings.prompt'`
- Service mocks use `vi.mock` at module level, then `vi.clearAllMocks()` in `beforeEach`
- Import `{ h } from 'preact'` even though JSX transform handles it — keeps the test explicit
- To access mocked service after mock setup: `const { xxxService } = await import('../src/services/xxx')`
- **Hook mocking pattern**: Declare a mutable `let hookState` at module level, `vi.mock` returns it, reset in `beforeEach` — allows per-test control of hook return values
- **consoleErrorSpy**: Use `beforeEach`/`afterEach` to catch unexpected `console.error` calls (Preact warnings, unmocked dependencies). This pattern is standard across all component tests
- **Async components**: Use `waitFor()` from `@testing-library/preact` for components that fetch data on mount
- **Duplicate text gotcha**: When testing parent components that render child components (e.g. `RequestList` renders `CreateRequest`), both may show the same i18n key — use `getAllByText` instead of `getByText`
- Test file location: `frontend/test/<Name>.test.jsx` (vitest finds them automatically)
