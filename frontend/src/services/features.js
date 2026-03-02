/**
 * Feature flag client.
 *
 * Fetches feature flags from GET /api/features once, then caches them
 * for the session lifetime. Used by the FeatureFlagContext to provide
 * flags to the component tree via useFeatureFlag() hook.
 */

let cachedFlags = null

/**
 * Fetch feature flags from the backend (cached after first call).
 * @returns {Promise<Record<string, boolean>>}
 */
export async function getFeatureFlags() {
  if (cachedFlags) return cachedFlags
  try {
    const res = await fetch('/api/features')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    cachedFlags = data.flags
    return cachedFlags
  } catch (err) {
    console.warn('Failed to fetch feature flags, using defaults:', err.message)
    cachedFlags = {}
    return cachedFlags
  }
}

/**
 * Check if a feature flag is enabled (sync, requires prior fetch).
 * @param {string} flag - Flag name (e.g. 'BANKID_AUTH')
 * @returns {boolean}
 */
export function isEnabled(flag) {
  return cachedFlags?.[flag] === true
}

/**
 * Clear the cache (useful for testing).
 */
export function clearFlagCache() {
  cachedFlags = null
}
