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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/preact'
import { h } from 'preact'
import { ComponentName } from '../src/components/ComponentName'

// Mock i18next (standard boilerplate — same in every component test)
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
    i18n: { language: 'sv', changeLanguage: vi.fn() },
  }),
}))

// Mock services as needed
vi.mock('../src/services/xxx', () => ({
  xxxService: {
    list: vi.fn().mockResolvedValue({ items: [] }),
  },
}))

describe('ComponentName', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the title', () => {
    const { getByText } = render(<ComponentName />)
    expect(getByText('section.title')).toBeTruthy()
  })
})
```

**Frontend test conventions**:
- The i18n mock returns keys as-is (`t: (key) => key`), so assertions use key paths like `'ratings.prompt'`
- Service mocks use `vi.mock` at module level, then `vi.clearAllMocks()` in `beforeEach`
- Import `{ h } from 'preact'` even though JSX transform handles it — keeps the test explicit
- To access mocked service after mock setup: `const { xxxService } = await import('../src/services/xxx')`
- Test file location: `frontend/test/<Name>.test.jsx` (vitest finds them automatically)
