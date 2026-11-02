/**
 * Personnummer pseudonymisation tests.
 *
 * users.nin_hash used to be a plain SHA-256 of the personnummer, which can be
 * reversed by enumerating the ~10^8 plausible numbers. It is now a keyed
 * HMAC (auth/nin-hash.js), production refuses to boot without the key, and
 * login re-keys accounts written before the key existed.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { readFileSync } from 'node:fs'
import { hashNin, legacyHashNin, assertNinHashKey } from '../src/auth/nin-hash.js'

const NIN = '199001011234'
const KEY = 'a'.repeat(64)

describe('hashNin()', () => {
  it('is an HMAC-SHA256 of the personnummer under the key', () => {
    const expected = crypto.createHmac('sha256', KEY).update(NIN).digest('hex')
    assert.equal(hashNin(NIN, KEY), expected)
  })

  it('differs from the unkeyed SHA-256', () => {
    assert.notEqual(hashNin(NIN, KEY), legacyHashNin(NIN))
  })

  it('is deterministic, so a returning user matches their row', () => {
    assert.equal(hashNin(NIN, KEY), hashNin(NIN, KEY))
  })

  it('depends on the key', () => {
    assert.notEqual(hashNin(NIN, KEY), hashNin(NIN, 'b'.repeat(64)))
  })

  it('falls back to the legacy hash without a key (dev and tests only)', () => {
    assert.equal(hashNin(NIN, ''), legacyHashNin(NIN))
  })

  it('reads NIN_HASH_KEY at call time', () => {
    const original = process.env.NIN_HASH_KEY
    process.env.NIN_HASH_KEY = KEY
    try {
      assert.equal(hashNin(NIN), hashNin(NIN, KEY))
    } finally {
      if (original === undefined) delete process.env.NIN_HASH_KEY
      else process.env.NIN_HASH_KEY = original
    }
  })
})

describe('legacyHashNin()', () => {
  it('is the plain SHA-256 that older rows hold', () => {
    assert.equal(legacyHashNin(NIN), crypto.createHash('sha256').update(NIN).digest('hex'))
  })
})

describe('assertNinHashKey()', () => {
  it('refuses production without a key', () => {
    assert.throws(() => assertNinHashKey({ NODE_ENV: 'production' }), /NIN_HASH_KEY/)
  })

  it('refuses production with a short key', () => {
    assert.throws(() => assertNinHashKey({ NODE_ENV: 'production', NIN_HASH_KEY: 'short' }), /NIN_HASH_KEY/)
  })

  it('accepts production with a 32+ character key', () => {
    assert.doesNotThrow(() => assertNinHashKey({ NODE_ENV: 'production', NIN_HASH_KEY: 'x'.repeat(64) }))
  })

  it('does not apply outside production', () => {
    assert.doesNotThrow(() => assertNinHashKey({ NODE_ENV: 'development' }))
    assert.doesNotThrow(() => assertNinHashKey({}))
  })

  it('allows an explicit local opt-out, never an implicit one', () => {
    assert.doesNotThrow(() => assertNinHashKey({ NODE_ENV: 'production', ALLOW_UNKEYED_NIN_HASH: 'true' }))
    assert.throws(() => assertNinHashKey({ NODE_ENV: 'production', ALLOW_UNKEYED_NIN_HASH: '1' }), /NIN_HASH_KEY/)
  })
})

describe('wiring (source assertions)', () => {
  const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8')
  const stub = read('../src/auth/providers/stub.js')
  const bankid = read('../src/auth/providers/bankid.js')
  const router = read('../src/auth/router.js')
  const index = read('../src/index.js')
  const prodCompose = read('../../docker-compose.yml')
  const prodOverride = read('../../docker-compose.prod.yml')

  it('both providers pseudonymise through hashNin()', () => {
    assert.match(stub, /ninHash = hashNin\(pn\)/)
    assert.match(bankid, /ninHash: hashNin\(nin\)/)
  })

  it('no provider hashes the personnummer with an unkeyed SHA-256', () => {
    for (const [name, src] of [['stub.js', stub], ['bankid.js', bankid]]) {
      assert.doesNotMatch(src, /createHash\(\s*'sha256'\s*\)/, `${name} still uses createHash('sha256')`)
    }
  })

  it('login re-keys legacy rows before the upsert', () => {
    const rekey = router.indexOf('rekeyLegacyNinHash(')
    const upsert = router.indexOf('upsertFromAuth(')
    assert.ok(rekey > 0, 'collect no longer calls rekeyLegacyNinHash')
    assert.ok(rekey < upsert, 'rekeyLegacyNinHash must run before upsertFromAuth')
  })

  it('the server checks the key before running migrations', () => {
    const guard = index.indexOf('assertNinHashKey()')
    const migrate = index.indexOf('await migrate()')
    assert.ok(guard > 0 && guard < migrate)
  })

  it('production compose passes the key and never sets the opt-out', () => {
    assert.match(prodCompose, /NIN_HASH_KEY: \$\{NIN_HASH_KEY/)
    assert.doesNotMatch(prodCompose, /ALLOW_UNKEYED_NIN_HASH/)
    assert.doesNotMatch(prodOverride, /ALLOW_UNKEYED_NIN_HASH/)
  })
})
