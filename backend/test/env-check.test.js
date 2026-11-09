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
    // observable without hard-coding the list in two places. AUTH_PROVIDER
    // is a consistency check — unset (so not 'bankid') is a legitimate
    // production shape and counts as "passed", matching today's prod box
    // which still runs AUTH_PROVIDER=stub until the Idura RP agreement
    // lands.
    assert.deepEqual(checked, ['JWT_SECRET', 'AUTH_PROVIDER'])
  })

  it('throws when AUTH_PROVIDER=bankid but FEATURE_BANKID_AUTH is off in production', () => {
    // The silent-footgun case this check exists for: auth/router.js emits ONE
    // warn line and falls back to the stub provider, which accepts any
    // personnummer — every production login would be anonymous, with nothing
    // visible to a user clicking through. Fail the boot instead.
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
        // Name the fallback behaviour so a reader of the error does not
        // have to open auth/router.js to understand what "unsafe" means
        // here.
        assert.match(err.message, /stub provider/)
        return true
      },
    )
  })

  it('throws when AUTH_PROVIDER=bankid and FEATURE_BANKID_AUTH is literally "false"', () => {
    // Explicitly setting the flag to the string "false" is the same shape as
    // leaving it unset — features.js reads env vars as strings and only
    // "true" turns the flag on. The check must treat both the same.
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
    // A production boot with multiple broken configs should surface all of
    // them in one restart cycle, not force the operator to restart to find
    // the next failure.
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
