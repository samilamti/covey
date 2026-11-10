/**
 * Keeping users.preferred_lang in step with the language on screen.
 *
 * Push notifications are written in preferred_lang. Until 2026-11-10 the app
 * never saved it, so every push arrived in Swedish. These tests cover the
 * decision logic; test/AppLanguageSync.test.jsx covers the wiring in App.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PROFILE_LOCALES, toProfileLocale, createLanguageSync } from '../src/language-sync.js'
// A separate package, but a plain module with no imports, so the test can load it
// directly. A code the backend refuses would make every save for that language
// fail with a 400.
import { SUPPORTED_LOCALES } from '../../backend/src/locales.js'

/** A save whose calls can be resolved or rejected by hand, in order. */
function deferredSave() {
  const calls = []
  const save = vi.fn((code) => new Promise((resolve, reject) => {
    calls.push({ code, resolve, reject })
  }))
  return { save, calls }
}

const flush = () => new Promise((r) => setTimeout(r, 0))

describe('PROFILE_LOCALES', () => {
  it('matches the locale bundles the app ships', () => {
    const bundles = Object.keys(import.meta.glob('../src/locales/*.json'))
      .map((path) => path.split('/').pop().replace(/\.json$/, ''))
    expect(bundles).toHaveLength(12)
    expect([...PROFILE_LOCALES].sort()).toEqual(bundles.sort())
  })

  it('matches the list the backend accepts (backend/src/locales.js)', () => {
    expect(SUPPORTED_LOCALES).toHaveLength(12)
    expect([...PROFILE_LOCALES].sort()).toEqual([...SUPPORTED_LOCALES].sort())
  })
})

describe('toProfileLocale()', () => {
  it('passes every supported code through', () => {
    for (const code of PROFILE_LOCALES) expect(toProfileLocale(code)).toBe(code)
  })

  it('reduces a region subtag to its base code, which is what the route accepts', () => {
    expect(toProfileLocale('en-GB')).toBe('en')
    expect(toProfileLocale('ar-SA')).toBe('ar')
    expect(toProfileLocale('SV-se')).toBe('sv')
  })

  it('returns null for languages the app does not have, and for non-strings', () => {
    expect(toProfileLocale('de')).toBeNull()
    expect(toProfileLocale('cimode')).toBeNull()
    expect(toProfileLocale('')).toBeNull()
    expect(toProfileLocale(undefined)).toBeNull()
    expect(toProfileLocale(null)).toBeNull()
  })
})

describe('createLanguageSync()', () => {
  let logSpy
  beforeEach(() => { logSpy = vi.spyOn(console, 'log').mockImplementation(() => {}) })
  afterEach(() => { logSpy.mockRestore() })

  it('makes no request when the server already holds the language on screen', async () => {
    const save = vi.fn().mockResolvedValue({})
    const sync = createLanguageSync({ stored: 'en', save })
    expect(await sync('en')).toBe(true)
    expect(await sync('en-GB')).toBe(true)
    expect(save).not.toHaveBeenCalled()
  })

  it('saves the screen language when the server holds a different one', async () => {
    const save = vi.fn().mockResolvedValue({})
    const sync = createLanguageSync({ stored: 'sv', save })
    expect(await sync('uk')).toBe(true)
    expect(save).toHaveBeenCalledExactlyOnceWith('uk')
  })

  it('saves when the server value is unknown (an older backend sends none)', async () => {
    const save = vi.fn().mockResolvedValue({})
    const sync = createLanguageSync({ save })
    await sync('sv')
    expect(save).toHaveBeenCalledExactlyOnceWith('sv')
  })

  it('sends the base code for a region subtag', async () => {
    const save = vi.fn().mockResolvedValue({})
    const sync = createLanguageSync({ stored: 'sv', save })
    await sync('ar-SA')
    expect(save).toHaveBeenCalledExactlyOnceWith('ar')
  })

  it('never sends a language the backend would refuse', async () => {
    const save = vi.fn().mockResolvedValue({})
    const sync = createLanguageSync({ stored: 'sv', save })
    expect(await sync('de')).toBe(false)
    expect(save).not.toHaveBeenCalled()
  })

  it('does not save the same language twice once it is stored', async () => {
    const save = vi.fn().mockResolvedValue({})
    const sync = createLanguageSync({ stored: 'sv', save })
    await sync('fi')
    await sync('fi')
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('retries on the next change after a failed save', async () => {
    const save = vi.fn()
      .mockRejectedValueOnce(new Error('Failed to update profile'))
      .mockResolvedValue({})
    const sync = createLanguageSync({ stored: 'sv', save })
    expect(await sync('en')).toBe(false)
    expect(logSpy).toHaveBeenCalledWith('Language sync skipped:', 'Failed to update profile')
    expect(await sync('en')).toBe(true)
    expect(save).toHaveBeenCalledTimes(2)
    expect(save).toHaveBeenLastCalledWith('en')
  })

  it('runs one save at a time and leaves the newest choice on the server', async () => {
    const { save, calls } = deferredSave()
    const sync = createLanguageSync({ stored: 'sv', save })

    const first = sync('en')
    sync('fi')
    sync('pl')
    await flush()
    // Only the first save has started; the later picks wait for it.
    expect(calls.map((c) => c.code)).toEqual(['en'])

    calls[0].resolve({})
    await flush()
    // 'fi' was overtaken by 'pl' before it was ever sent.
    expect(calls.map((c) => c.code)).toEqual(['en', 'pl'])

    calls[1].resolve({})
    expect(await first).toBe(true)
    expect(save).toHaveBeenCalledTimes(2)
  })

  it('does not queue a second save for the language already being saved', async () => {
    const { save, calls } = deferredSave()
    const sync = createLanguageSync({ stored: 'sv', save })

    const done = sync('en')
    sync('en')
    await flush()
    calls[0].resolve({})
    await done
    expect(save).toHaveBeenCalledTimes(1)
  })
})
