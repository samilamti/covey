/**
 * Production env-var safety check.
 *
 * Every secret in this backend has a dev fallback so a fresh clone boots on
 * a laptop without a `.env` file. In production that same fallback is a
 * footgun: `JWT_SECRET` defaults to the string
 * `'dev-secret-do-not-use-in-prod'` inside `auth/jwt.js`, which would sign
 * tokens with a value anyone reading the source already knows — and nothing
 * at startup objects. This file closes that gap: when `NODE_ENV=production`,
 * refuse to boot if a required secret is absent or still carries the dev
 * default. The process dies with a readable error before `migrate()` runs,
 * so the fault lands at `docker compose up` time rather than on the first
 * forged JWT.
 *
 * Keeping it out of production (NODE_ENV !== 'production') is deliberate:
 * local, test, and CI runs legitimately boot with the dev defaults, and
 * the backend test suite already overrides JWT_SECRET for the signing tests.
 *
 * Exposed as a pure function with injected `env` so tests exercise every
 * branch without touching the real process environment, and so a future
 * caller (a provisioning script, a boot-time health check) can reuse it.
 */

// The literal is defined in `auth/jwt.js` as the dev fallback. Duplicated
// here so this check does not import crypto code at module eval time; keep
// the two in sync if the fallback is ever renamed.
export const JWT_SECRET_DEV_FALLBACK = 'dev-secret-do-not-use-in-prod'

const REQUIRED_IN_PROD = [
  {
    name: 'JWT_SECRET',
    // Reject unset, empty, and the dev fallback literal.
    isUnsafe: (v) => !v || v === JWT_SECRET_DEV_FALLBACK,
    reason: (v) =>
      !v
        ? 'JWT_SECRET is unset — tokens would be signed with the well-known dev fallback'
        : 'JWT_SECRET still equals the dev fallback literal — anyone reading the source can forge a session',
  },
]

/**
 * Assert that production env vars are safe. No-op outside production.
 *
 * @param {object} [opts]
 * @param {object} [opts.env=process.env]  env map (useful for tests)
 * @returns {string[]} the names of vars that were checked and passed
 * @throws {Error} with a readable message naming each failing var and WHY,
 *   so a reader of `docker compose logs` can act without opening the source.
 */
export function assertProductionEnv({ env = process.env } = {}) {
  if (env.NODE_ENV !== 'production') return []

  const failures = []
  const passed = []
  for (const check of REQUIRED_IN_PROD) {
    const value = env[check.name]
    if (check.isUnsafe(value)) {
      failures.push(`${check.name}: ${check.reason(value)}`)
    } else {
      passed.push(check.name)
    }
  }
  if (failures.length > 0) {
    // One Error carrying every failure, so a first run surfaces all of them
    // at once rather than making the operator restart to find the next one.
    const bullets = failures.map((f) => `  - ${f}`).join('\n')
    throw new Error(
      `Refusing to start: unsafe production env var(s):\n${bullets}\n` +
        `See docs/deployment.md and .env.example.`,
    )
  }
  return passed
}
