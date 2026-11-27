// Production boot check: refuse to start when a secret is missing or still has its
// dev fallback, so the misconfig fails at deploy time. No-op outside production.

// Same literal as the fallback in auth/jwt.js (not imported, to keep crypto out of
// module eval); keep the two in sync.
export const JWT_SECRET_DEV_FALLBACK = 'dev-secret-do-not-use-in-prod'

const REQUIRED_IN_PROD = [
  {
    name: 'JWT_SECRET',
    // Reject unset, empty, and the dev fallback literal.
    isUnsafe: (env) => !env.JWT_SECRET || env.JWT_SECRET === JWT_SECRET_DEV_FALLBACK,
    reason: (env) =>
      !env.JWT_SECRET
        ? 'JWT_SECRET is unset — tokens would be signed with the well-known dev fallback'
        : 'JWT_SECRET still equals the dev fallback literal — anyone reading the source can forge a session',
  },
  {
    // auth/router.js silently falls back to the stub provider (any personnummer logs in)
    // when FEATURE_BANKID_AUTH is off, so fail the boot instead.
    name: 'AUTH_PROVIDER',
    isUnsafe: (env) =>
      env.AUTH_PROVIDER === 'bankid' && env.FEATURE_BANKID_AUTH !== 'true',
    reason: () =>
      'AUTH_PROVIDER=bankid requires FEATURE_BANKID_AUTH=true — otherwise login silently falls back to the stub provider, which accepts any personnummer',
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
    if (check.isUnsafe(env)) {
      failures.push(`${check.name}: ${check.reason(env)}`)
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
