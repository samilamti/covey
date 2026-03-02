/**
 * Feature flag client tests.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getFeatureFlags, isEnabled, clearFlagCache } from '../src/services/features'

describe('Feature flag client', () => {
  beforeEach(() => {
    clearFlagCache()
    vi.restoreAllMocks()
  })

  it('fetches flags from /api/features', async () => {
    const mockFlags = {
      BANKID_AUTH: false,
      PUSH_NOTIFICATIONS: false,
      GEOLOCATION: true,
      COMMUNITIES: true,
    }

    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ flags: mockFlags }),
    })

    const flags = await getFeatureFlags()

    expect(fetch).toHaveBeenCalledWith('/api/features')
    expect(flags).toEqual(mockFlags)
  })

  it('caches flags after first fetch', async () => {
    const mockFlags = { BANKID_AUTH: true }

    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ flags: mockFlags }),
    })

    await getFeatureFlags()
    const second = await getFeatureFlags()

    // fetch should only have been called once
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(second).toEqual(mockFlags)
  })

  it('returns empty object on fetch error', async () => {
    globalThis.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'))

    const flags = await getFeatureFlags()
    expect(flags).toEqual({})
  })

  it('returns empty object on non-ok response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
    })

    const flags = await getFeatureFlags()
    expect(flags).toEqual({})
  })

  it('isEnabled returns true for enabled flags', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ flags: { GEOLOCATION: true } }),
    })

    await getFeatureFlags()
    expect(isEnabled('GEOLOCATION')).toBe(true)
  })

  it('isEnabled returns false for disabled flags', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ flags: { GEOLOCATION: false } }),
    })

    await getFeatureFlags()
    expect(isEnabled('GEOLOCATION')).toBe(false)
  })

  it('isEnabled returns false for unknown flags', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ flags: {} }),
    })

    await getFeatureFlags()
    expect(isEnabled('NON_EXISTENT')).toBe(false)
  })

  it('isEnabled returns false before flags are fetched', () => {
    // No fetch has happened yet (cache cleared in beforeEach)
    expect(isEnabled('BANKID_AUTH')).toBe(false)
  })

  it('clearFlagCache forces re-fetch', async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ flags: { BANKID_AUTH: false } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ flags: { BANKID_AUTH: true } }),
      })

    const first = await getFeatureFlags()
    expect(first.BANKID_AUTH).toBe(false)

    clearFlagCache()

    const second = await getFeatureFlags()
    expect(second.BANKID_AUTH).toBe(true)
    expect(fetch).toHaveBeenCalledTimes(2)
  })
})
