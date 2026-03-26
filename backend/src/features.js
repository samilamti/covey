/**
 * Feature flag registry.
 *
 * Each flag is controlled by an env var: FEATURE_<FLAG_NAME>=true|false
 * Default values are defined in DEFAULTS. The backend reads from process.env
 * on startup; the frontend fetches via GET /api/features.
 *
 * Usage:
 *   import { isEnabled } from './features.js'
 *   if (isEnabled('BANKID_AUTH')) { ... }
 */

const DEFAULTS = {
  BANKID_AUTH: false,
  PUSH_NOTIFICATIONS: false,
  GEOLOCATION: false,
  POINTS_SYSTEM: false,
}

const flags = {}

for (const [key, defaultValue] of Object.entries(DEFAULTS)) {
  const envVal = process.env[`FEATURE_${key}`]
  flags[key] = envVal !== undefined ? envVal === 'true' : defaultValue
}

/**
 * Check if a feature flag is enabled.
 * @param {string} flag - Flag name (e.g. 'BANKID_AUTH')
 * @returns {boolean}
 */
export function isEnabled(flag) {
  if (!(flag in flags)) {
    console.warn(`Unknown feature flag: ${flag}`)
    return false
  }
  return flags[flag] === true
}

/**
 * Get all feature flags as a snapshot (for the /api/features endpoint).
 * @returns {Record<string, boolean>}
 */
export function getAllFlags() {
  return { ...flags }
}
