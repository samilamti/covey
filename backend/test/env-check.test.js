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
    // AUTH_PROVIDER not set to 'bankid' is a valid production shape, so it passes.
    assert.deepEqual(checked, ['JWT_SECRET', 'AUTH_PROVIDER'])
  })

  it('throws when AUTH_PROVIDER=bankid but FEATURE_BANKID_AUTH is off in production', () => {
    assert.throws(
      () =>
        assertProductionEnv({
          env: {
            NODE_ENV: 'production',
            JWT_SECRET: 'genuinely-random-secret',
            AUTH_PROVIDER: 'bankid',
            // FEATURE_BANKID_AUTH deliberately absent — identical to 'false'
            // under features.js's DEFAULTS table.
          },
        }),
      (err) => {
        assert.match(err.message, /AUTH_PROVIDER/)
        assert.match(err.message, /FEATURE_BANKID_AUTH=true/)
        assert.match(err.message, /stub provider/)
        return true
      },
    )
  })

  it('throws when AUTH_PROVIDER=bankid and FEATURE_BANKID_AUTH is literally "false"', () => {
    // features.js only treats the string "true" as on, so "false" equals unset.
    assert.throws(
      () =>
        assertProductionEnv({
          env: {
            NODE_ENV: 'production',
            JWT_SECRET: 'genuinely-random-secret',
            AUTH_PROVIDER: 'bankid',
            FEATURE_BANKID_AUTH: 'false',
          },
        }),
      /AUTH_PROVIDER/,
    )
  })

  it('accepts AUTH_PROVIDER=bankid when FEATURE_BANKID_AUTH=true', () => {
    // The intended production shape once the Idura RP agreement is live.
    const checked = assertProductionEnv({
      env: {
        NODE_ENV: 'production',
        JWT_SECRET: 'genuinely-random-secret',
        AUTH_PROVIDER: 'bankid',
        FEATURE_BANKID_AUTH: 'true',
      },
    })
    assert.deepEqual(checked, ['JWT_SECRET', 'AUTH_PROVIDER'])
  })

  it('does not require FEATURE_BANKID_AUTH when AUTH_PROVIDER is anything other than bankid', () => {
    // Today's prod box runs AUTH_PROVIDER=stub with FEATURE_BANKID_AUTH off;
    // that combination is the current shipping shape and must not throw.
    const checked = assertProductionEnv({
      env: {
        NODE_ENV: 'production',
        JWT_SECRET: 'genuinely-random-secret',
        AUTH_PROVIDER: 'stub',
      },
    })
    assert.deepEqual(checked, ['JWT_SECRET', 'AUTH_PROVIDER'])
  })

  it('collects every failing var into one Error', () => {
    try {
      assertProductionEnv({
        env: { NODE_ENV: 'production', AUTH_PROVIDER: 'bankid' },
      })
      assert.fail('expected the check to throw')
    } catch (err) {
      // The message is bulleted so humans can scan it in `docker compose logs`.
      assert.match(err.message, /Refusing to start/)
      assert.match(err.message, /- JWT_SECRET/)
      assert.match(err.message, /- AUTH_PROVIDER/)
    }
  })
})
