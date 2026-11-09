/**
 * Supported-locale list and validator.
 *
 * The canonical list in `src/locales.js` is what the profile route checks
 * `preferredLang` against, and what the push notification body maps are
 * keyed by. Drift between those two consumers would silently downgrade
 * users to the Swedish fallback, so both are asserted here.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { SUPPORTED_LOCALES, isSupportedLocale } from '../src/locales.js'

describe('SUPPORTED_LOCALES', () => {
  it('lists the 12 canonical frontend bundle codes', () => {
    assert.deepEqual(
      [...SUPPORTED_LOCALES].sort(),
      ['ar', 'da', 'en', 'fi', 'fo', 'is', 'kl', 'nb', 'pl', 'se', 'sv', 'uk'],
    )
  })

  it('is frozen so a consumer cannot mutate it in place', () => {
    assert.ok(Object.isFrozen(SUPPORTED_LOCALES))
  })
})

describe('isSupportedLocale()', () => {
  it('accepts every canonical code', () => {
    for (const code of SUPPORTED_LOCALES) {
      assert.equal(isSupportedLocale(code), true, `expected ${code} to be supported`)
    }
  })

  it('rejects locale subtags (ar-SA, en-US) — the short form is canonical', () => {
    // This is the regression the validator exists for: an "ar-SA" stored in
    // preferred_lang would not match the notification body maps and the
    // user would silently get Swedish instead of Arabic.
    for (const subtag of ['ar-SA', 'en-US', 'sv-SE', 'AR']) {
      assert.equal(isSupportedLocale(subtag), false, `expected ${subtag} to be rejected`)
    }
  })

  it('rejects codes outside the bundle set', () => {
    for (const bogus of ['xx', 'de', 'fr', 'zh', '']) {
      assert.equal(isSupportedLocale(bogus), false, `expected ${bogus} to be rejected`)
    }
  })

  it('rejects non-string inputs without throwing', () => {
    assert.equal(isSupportedLocale(undefined), false)
    assert.equal(isSupportedLocale(null), false)
    assert.equal(isSupportedLocale(42), false)
    assert.equal(isSupportedLocale({}), false)
    assert.equal(isSupportedLocale([]), false)
  })
})

describe('notification body maps cover every supported locale', () => {
  // The push body maps aren't exported (they're private module state in
  // services/notifications.js), and importing that module pulls the whole
  // repositories graph plus the pool's boot-time DB connect. So instead we
  // parse the source file directly — a drift between SUPPORTED_LOCALES
  // and either body map fails this test with an actionable message.
  it('NOTIFY_BODY and ACCEPTED_BODY each carry one entry per supported locale', async () => {
    const fs = await import('node:fs')
    const src = await fs.promises.readFile(
      new URL('../src/services/notifications.js', import.meta.url),
      'utf8',
    )

    function keysOf(mapName) {
      const match = src.match(new RegExp(`const\\s+${mapName}\\s*=\\s*\\{([\\s\\S]*?)\\n\\}`, 'm'))
      assert.ok(match, `${mapName} definition not found`)
      const keys = []
      for (const line of match[1].split('\n')) {
        const m = line.match(/^\s*([a-z]{2}):\s*['"]/)
        if (m) keys.push(m[1])
      }
      return keys
    }
    const notifyKeys = keysOf('NOTIFY_BODY')
    const acceptKeys = keysOf('ACCEPTED_BODY')
    for (const code of SUPPORTED_LOCALES) {
      assert.ok(notifyKeys.includes(code), `NOTIFY_BODY is missing an entry for ${code}`)
      assert.ok(acceptKeys.includes(code), `ACCEPTED_BODY is missing an entry for ${code}`)
    }
    for (const key of [...notifyKeys, ...acceptKeys]) {
      assert.ok(
        SUPPORTED_LOCALES.includes(key),
        `notification body map carries ${key} but SUPPORTED_LOCALES does not`,
      )
    }
  })
})
