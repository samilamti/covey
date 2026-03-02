/**
 * i18n configuration and locale coverage tests.
 *
 * Verifies:
 * - All 11 locale files exist and have the same key structure as sv.json
 * - Swedish is the fallback language
 * - All required top-level sections exist
 */

import { describe, it, expect } from 'vitest'

import sv from '../src/locales/sv.json'
import nb from '../src/locales/nb.json'
import da from '../src/locales/da.json'
import fi from '../src/locales/fi.json'
import ar from '../src/locales/ar.json'
import is from '../src/locales/is.json'
import pl from '../src/locales/pl.json'
import fo from '../src/locales/fo.json'
import kl from '../src/locales/kl.json'
import se from '../src/locales/se.json'
import en from '../src/locales/en.json'

const locales = { sv, nb, da, fi, ar, is, pl, fo, kl, se, en }

/**
 * Recursively collect all keys from a nested object as dot-separated paths.
 * e.g. { a: { b: 'hello' } } → ['a.b']
 */
function collectKeys(obj, prefix = '') {
  const keys = []
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'object' && value !== null) {
      keys.push(...collectKeys(value, path))
    } else {
      keys.push(path)
    }
  }
  return keys.sort()
}

const svKeys = collectKeys(sv)

describe('i18n locale files', () => {
  it('Swedish (sv) is the canonical source with all required sections', () => {
    const topLevelKeys = Object.keys(sv).sort()
    expect(topLevelKeys).toEqual(
      expect.arrayContaining([
        'landing',
        'language',
        'nav',
        'app',
        'requests',
        'communities',
        'admin',
        'profile',
        'notifications',
        'map',
      ])
    )
  })

  it('should have 11 locales', () => {
    expect(Object.keys(locales)).toHaveLength(11)
  })

  // Test each locale has the same keys as Swedish
  for (const [code, locale] of Object.entries(locales)) {
    if (code === 'sv') continue

    it(`${code} should have all keys from sv.json`, () => {
      const localeKeys = collectKeys(locale)
      const missingKeys = svKeys.filter((k) => !localeKeys.includes(k))

      expect(missingKeys).toEqual([])
    })

    it(`${code} should not have extra keys beyond sv.json`, () => {
      const localeKeys = collectKeys(locale)
      const extraKeys = localeKeys.filter((k) => !svKeys.includes(k))

      expect(extraKeys).toEqual([])
    })
  }

  // Verify language names are in native script
  it('each locale should list all 11 language names', () => {
    const expectedLanguageCodes = ['sv', 'nb', 'da', 'fi', 'ar', 'is', 'pl', 'fo', 'kl', 'se', 'en']
    for (const [code, locale] of Object.entries(locales)) {
      for (const langCode of expectedLanguageCodes) {
        expect(locale.language[langCode], `${code} missing language.${langCode}`).toBeDefined()
        expect(locale.language[langCode].length).toBeGreaterThan(0)
      }
    }
  })

  // Language names should be the same across all locales (native names, not translated)
  it('language names should be in native script (same across all locales)', () => {
    const nativeNames = {
      sv: 'Svenska',
      nb: 'Norsk',
      da: 'Dansk',
      fi: 'Suomi',
      ar: 'العربية',
      is: 'Íslenska',
      pl: 'Polski',
      fo: 'Føroyskt',
      kl: 'Kalaallisut',
      se: 'Davvisámegiella',
      en: 'English',
    }

    for (const [, locale] of Object.entries(locales)) {
      for (const [langCode, nativeName] of Object.entries(nativeNames)) {
        expect(locale.language[langCode]).toBe(nativeName)
      }
    }
  })
})

describe('i18n configuration', () => {
  it('fallback language should be sv', async () => {
    // Import the i18n instance
    const i18n = (await import('../src/i18n.js')).default
    // i18next fallbackLng can be a string or array
    const fallback = i18n.options.fallbackLng
    if (Array.isArray(fallback)) {
      expect(fallback).toContain('sv')
    } else {
      expect(fallback).toBe('sv')
    }
  })
})
