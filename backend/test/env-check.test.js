import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  assertProductionEnv,
  JWT_SECRET_DEV_FALLBACK,
} from '../src/env-check.js'

describe('assertProductionEnv', () => {
  it('is a no-op outside production — development/test/undefined all pass', () => {
    // Covers the common day-to-day cases: a dev loop with no NODE_ENV, a CI
    // run with NODE_ENV=test, and whatever a fresh clone's env happens to be.
    for (const env of [{}, { NODE_ENV: 'development' }, { NODE_ENV: 'test' }]) {
      assert.deepEqual(assertProductionEnv({ env }), [])
    }
  })

  it('throws when JWT_SECRET is unset in production, naming the var', () => {
    assert.throws(
      () => assertProductionEnv({ env: { NODE_ENV: 'production' } }),
      (err) => {
        // The failure must name the variable so an operator reading the
        // crash can act without opening the source.
        assert.match(err.message, /JWT_SECRET/)
        assert.match(err.message, /unset/)
        return true
      },
    )
  })

  it('throws when JWT_SECRET still equals the dev fallback literal', () => {
    // This is the quiet-footgun case the check exists for: a running process
    // with a plausible-looking JWT_SECRET that anyone with the source can
    // forge against.
    assert.throws(
      () =>
        assertProductionEnv({
          env: { NODE_ENV: 'production', JWT_SECRET: JWT_SECRET_DEV_FALLBACK },
        }),
      /dev fallback/,
    )
  })

  it('throws when JWT_SECRET is an empty string', () => {
    // `.env.example` ships `JWT_SECRET=` for the operator to fill in; a
    // half-finished deploy leaves it empty, which is just as unsafe as unset.
    assert.throws(
      () => assertProductionEnv({ env: { NODE_ENV: 'production', JWT_SECRET: '' } }),
      /JWT_SECRET/,
    )
  })

  it('returns the names of checks that passed in production', () => {
    const checked = assertProductionEnv({
      env: { NODE_ENV: 'production', JWT_SECRET: 'genuinely-random-secret' },
    })
    // Letting the caller log what was checked makes the startup line
    // observable without hard-coding the list in two places.
    assert.deepEqual(checked, ['JWT_SECRET'])
  })

  it('collects every failing var into one Error', () => {
    // Today there is one required var in production; this test documents the
    // intent so a future addition cannot silently fall back to one-at-a-time
    // reporting. A production boot with multiple broken secrets should
    // surface all of them in one restart cycle.
    try {
      assertProductionEnv({ env: { NODE_ENV: 'production' } })
      assert.fail('expected the check to throw')
    } catch (err) {
      // The message is bulleted so humans can scan it in `docker compose logs`.
      assert.match(err.message, /Refusing to start/)
      assert.match(err.message, /- JWT_SECRET/)
    }
  })
})
