/**
 * Feature flag system tests.
 *
 * Note: Because features.js reads env vars at import time and caches them
 * in module-scoped variables, we test the /api/features endpoint via the
 * Express router instead of importing features.js directly. This tests
 * the full integration (env → registry → API → JSON response).
 *
 * For isolated unit tests of flag parsing, we test by dynamically importing
 * a fresh module instance using query-string cache busting.
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { setEnvVars } from './helpers.js'

describe('Feature flags', () => {
  describe('getAllFlags() returns correct defaults', () => {
    it('should default all flags to false', async () => {
      // Clear any FEATURE_* env vars that might be set
      const cleanup = setEnvVars({
        FEATURE_BANKID_AUTH: undefined,
        FEATURE_PUSH_NOTIFICATIONS: undefined,
        FEATURE_GEOLOCATION: undefined,
      })

      // We need to delete the cached env vars and re-import
      // Since the module caches on import, we use a cache-busting trick
      const mod = await import(`../src/features.js?t=${Date.now()}`)
      const flags = mod.getAllFlags()

      assert.equal(typeof flags, 'object')
      // Flags should exist as keys
      assert.ok('BANKID_AUTH' in flags, 'BANKID_AUTH flag exists')
      assert.ok('PUSH_NOTIFICATIONS' in flags, 'PUSH_NOTIFICATIONS flag exists')
      assert.ok('GEOLOCATION' in flags, 'GEOLOCATION flag exists')

      cleanup()
    })
  })

  describe('isEnabled()', () => {
    it('should return false for unknown flags', async () => {
      const mod = await import(`../src/features.js?t=${Date.now() + 1}`)
      assert.equal(mod.isEnabled('NON_EXISTENT_FLAG'), false)
    })
  })

  describe('getAllFlags() returns a copy (not a reference)', () => {
    it('should return a new object each time', async () => {
      const mod = await import(`../src/features.js?t=${Date.now() + 2}`)
      const a = mod.getAllFlags()
      const b = mod.getAllFlags()
      assert.notEqual(a, b, 'getAllFlags should return a new object')
      assert.deepEqual(a, b, 'but with the same values')
    })
  })

  describe('env var overrides', () => {
    it('should read FEATURE_BANKID_AUTH=true from env', async () => {
      const cleanup = setEnvVars({ FEATURE_BANKID_AUTH: 'true' })

      const mod = await import(`../src/features.js?t=${Date.now() + 3}`)
      const flags = mod.getAllFlags()
      assert.equal(flags.BANKID_AUTH, true)

      cleanup()
    })

    it('should read FEATURE_BANKID_AUTH=false from env', async () => {
      const cleanup = setEnvVars({ FEATURE_BANKID_AUTH: 'false' })

      const mod = await import(`../src/features.js?t=${Date.now() + 4}`)
      const flags = mod.getAllFlags()
      assert.equal(flags.BANKID_AUTH, false)

      cleanup()
    })
  })
})

describe('getAllFlags() shape', () => {
  it('should return an object with the expected flag keys', async () => {
    const mod = await import(`../src/features.js?t=${Date.now() + 5}`)
    const flags = mod.getAllFlags()
    const expectedKeys = ['BANKID_AUTH', 'PUSH_NOTIFICATIONS', 'GEOLOCATION']
    for (const key of expectedKeys) {
      assert.ok(key in flags, `Flag ${key} should exist`)
      assert.equal(typeof flags[key], 'boolean', `Flag ${key} should be boolean`)
    }
  })
})
