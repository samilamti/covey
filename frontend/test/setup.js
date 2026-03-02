/**
 * Test setup for frontend tests (vitest + jsdom).
 *
 * Runs before every test file. Sets up the DOM environment and
 * any global mocks needed by Preact components.
 */

import { cleanup } from '@testing-library/preact'
import { afterEach } from 'vitest'

// Automatically unmount components after each test
afterEach(() => {
  cleanup()
})

// Mock fetch globally for tests that don't provide their own mock
if (typeof globalThis.fetch === 'undefined') {
  globalThis.fetch = () =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({}),
    })
}
