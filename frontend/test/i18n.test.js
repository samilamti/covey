/**
 * i18n configuration and locale coverage tests.
 *
 * Verifies:
 * - All 12 locale files exist and have the same key structure as sv.json
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
import uk from '../src/locales/uk.json'
import en from '../src/locales/en.json'

const locales = { sv, nb, da, fi, ar, is, pl, fo, kl, se, uk, en }

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
        'profile',
        'notifications',
        'map',
      ])
    )
  })

  it('should have 12 locales', () => {
    expect(Object.keys(locales)).toHaveLength(12)
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
  it('each locale should list all 12 language names', () => {
    const expectedLanguageCodes = ['sv', 'nb', 'da', 'fi', 'ar', 'is', 'pl', 'fo', 'kl', 'se', 'uk', 'en']
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
      uk: 'Українська',
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

describe('resolveDocumentLanguage()', () => {
  it('marks Arabic as RTL', async () => {
    const { resolveDocumentLanguage } = await import('../src/i18n.js')
    expect(resolveDocumentLanguage('ar')).toEqual({ lang: 'ar', dir: 'rtl' })
  })

  it('marks every Arabic region subtag as RTL', async () => {
    const { resolveDocumentLanguage } = await import('../src/i18n.js')
    // The old handler compared `lng === 'ar'` and silently rendered
    // ar-SA / ar-EG / AR-eg as LTR — this is the regression test for it.
    for (const tag of ['ar-SA', 'ar-EG', 'AR-eg', 'ar-Latn-XA']) {
      expect(resolveDocumentLanguage(tag).dir).toBe('rtl')
    }
  })

  it('leaves non-RTL locales as LTR', async () => {
    const { resolveDocumentLanguage } = await import('../src/i18n.js')
    for (const tag of ['sv', 'en', 'en-US', 'fi', 'kl', 'se', 'uk']) {
      expect(resolveDocumentLanguage(tag).dir).toBe('ltr')
    }
  })

  it('preserves the full language tag on `lang`', async () => {
    // Full BCP 47 tags on the document carry locale precision for assistive
    // tech; we deliberately pass them through rather than truncate to base.
    const { resolveDocumentLanguage } = await import('../src/i18n.js')
    expect(resolveDocumentLanguage('en-US').lang).toBe('en-US')
    expect(resolveDocumentLanguage('ar-SA').lang).toBe('ar-SA')
  })

  it('falls back to LTR and an empty lang for a non-string input', async () => {
    const { resolveDocumentLanguage } = await import('../src/i18n.js')
    expect(resolveDocumentLanguage(undefined)).toEqual({ lang: '', dir: 'ltr' })
    expect(resolveDocumentLanguage(null)).toEqual({ lang: '', dir: 'ltr' })
  })
})

describe('languageChanged → document attributes', () => {
  it('syncs document.documentElement.lang and document.dir when the language changes', async () => {
    const i18n = (await import('../src/i18n.js')).default
    await i18n.changeLanguage('ar')
    expect(document.documentElement.lang).toBe('ar')
    expect(document.dir).toBe('rtl')
    await i18n.changeLanguage('sv')
    expect(document.documentElement.lang).toBe('sv')
    expect(document.dir).toBe('ltr')
  })

  it('switches an Arabic region subtag into RTL too', async () => {
    const i18n = (await import('../src/i18n.js')).default
    await i18n.changeLanguage('ar-SA')
    expect(document.dir).toBe('rtl')
    // Reset so later tests in the same jsdom window start from a neutral state.
    await i18n.changeLanguage('sv')
  })
})
