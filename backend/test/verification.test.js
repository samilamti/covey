/**
 * Verification status tests.
 *
 * The stub provider accepts any personnummer typed into the form, so only a
 * login through the real BankID provider may be stored or shown as verified.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { verifiedForLogin, displayedVerified } from '../src/services/verification.js'

describe('verifiedForLogin()', () => {
  it('is true for a real BankID login', () => {
    assert.equal(verifiedForLogin(true), true)
  })

  it('is false for a stub login', () => {
    assert.equal(verifiedForLogin(false), false)
  })

  it('is false for anything that is not literally true', () => {
    assert.equal(verifiedForLogin(undefined), false)
    assert.equal(verifiedForLogin('true'), false)
    assert.equal(verifiedForLogin(1), false)
  })
})

describe('displayedVerified()', () => {
  it('shows verified only when BankID is enabled AND the row is verified', () => {
    assert.equal(displayedVerified({ verified: true }, true), true)
  })

  it('hides a row written by the stub before this fix while BankID is off', () => {
    assert.equal(displayedVerified({ verified: true }, false), false)
  })

  it('hides an unverified row even with BankID on', () => {
    assert.equal(displayedVerified({ verified: false }, true), false)
  })

  it('tolerates a missing user', () => {
    assert.equal(displayedVerified(null, true), false)
    assert.equal(displayedVerified(undefined, false), false)
  })
})

describe('wiring (source assertions)', () => {
  const users = readFileSync(new URL('../src/repositories/users.js', import.meta.url), 'utf8')
  const router = readFileSync(new URL('../src/auth/router.js', import.meta.url), 'utf8')
  const profile = readFileSync(new URL('../src/routes/profile.js', import.meta.url), 'utf8')

  it('upsertFromAuth no longer hardcodes verified = TRUE', () => {
    assert.doesNotMatch(users, /verified\s*=\s*TRUE/)
    assert.match(users, /verified\s*=\s*EXCLUDED\.verified/)
  })

  it('the collect route records verification from the provider', () => {
    assert.match(router, /verified:\s*verifiedForLogin\(provider === bankidProvider\)/)
  })

  it('every verified field the profile routes return goes through displayedVerified()', () => {
    const fields = profile.match(/verified:\s*[^,\n]+/g) || []
    assert.ok(fields.length >= 3, 'expected the own, update and public profile responses')
    for (const field of fields) {
      assert.match(field, /displayedVerified\(/, `profile route returns raw verified: ${field}`)
    }
  })
})
