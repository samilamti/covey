/**
 * Personnummer pseudonymisation.
 *
 * The raw personnummer is never stored. `users.nin_hash` holds a keyed
 * HMAC-SHA256 of it, with the secret in `NIN_HASH_KEY`. A plain SHA-256 (what
 * this replaced) is reversible by brute force: there are only ~10^8 plausible
 * personnummer, fewer still once birth_year and sex sit in the same row. Without
 * the key, an HMAC cannot be enumerated.
 *
 * Losing NIN_HASH_KEY means no returning user matches their account again, so
 * the key is backed up outside the server (macOS Keychain, see docs/deployment.md).
 *
 * Without a key (local dev, tests) hashNin() falls back to the legacy SHA-256 so
 * nothing breaks; production refuses to boot without one (assertNinHashKey).
 */

import crypto from 'node:crypto'

const MIN_KEY_LENGTH = 32

/** The configured key, read at call time so tests can set it. */
export function ninHashKey() {
  return process.env.NIN_HASH_KEY || ''
}

/**
 * The legacy unkeyed hash. Used only to find and re-key rows written before
 * NIN_HASH_KEY existed (see repositories/users.js rekeyLegacyNinHash).
 * @param {string} nin
 * @returns {string}
 */
export function legacyHashNin(nin) {
  return crypto.createHash('sha256').update(String(nin)).digest('hex')
}

/**
 * The value stored in users.nin_hash.
 * @param {string} nin
 * @param {string} [key] - defaults to NIN_HASH_KEY
 * @returns {string}
 */
export function hashNin(nin, key = ninHashKey()) {
  if (!key) return legacyHashNin(nin)
  return crypto.createHmac('sha256', key).update(String(nin)).digest('hex')
}

/**
 * Refuse to run production without a usable key. Called at boot, before the
 * server accepts traffic, so a missing key fails the deploy's health check
 * instead of silently storing reversible hashes.
 *
 * The local Docker stack also runs NODE_ENV=production, so it opts out
 * explicitly with ALLOW_UNKEYED_NIN_HASH=true (docker-compose.local.yml only).
 * The opt-out is never inferred from a missing key.
 * @param {object} [env]
 * @throws {Error}
 */
export function assertNinHashKey(env = process.env) {
  if (env.NODE_ENV !== 'production') return
  if (env.ALLOW_UNKEYED_NIN_HASH === 'true') return
  const key = env.NIN_HASH_KEY || ''
  if (key.length < MIN_KEY_LENGTH) {
    throw new Error(
      `NIN_HASH_KEY must be set to at least ${MIN_KEY_LENGTH} characters in production ` +
      '(generate with: openssl rand -hex 32)'
    )
  }
}
