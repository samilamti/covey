/**
 * Feature Flag Context for Preact.
 *
 * Fetches feature flags from the backend on mount, then provides them
 * to the component tree. Components use the useFeatureFlag() hook to
 * check individual flags.
 *
 * Usage:
 *   import { FeatureFlagProvider, useFeatureFlag } from '../context/FeatureFlagContext'
 *
 *   // Wrap your app:
 *   <FeatureFlagProvider><App /></FeatureFlagProvider>
 *
 *   // In any component:
 *   const isBankId = useFeatureFlag('BANKID_AUTH')
 */

import { createContext } from 'preact'
import { useContext, useEffect, useState } from 'preact/hooks'
import { getFeatureFlags } from '../services/features'

// Default shape matches the provider value so useFeatureFlag() is safe even
// if a consumer renders outside the provider (flags default to all-false).
const FeatureFlagContext = createContext({ flags: {}, loaded: false })

/**
 * Provider that fetches feature flags once on mount.
 * While loading, flags default to an empty object (all flags → false).
 */
export function FeatureFlagProvider({ children }) {
  const [flags, setFlags] = useState({})
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    getFeatureFlags()
      .then((f) => {
        setFlags(f)
        setLoaded(true)
      })
      .catch(() => {
        // Fallback: empty flags (everything disabled)
        setLoaded(true)
      })
  }, [])

  return (
    <FeatureFlagContext.Provider value={{ flags, loaded }}>
      {children}
    </FeatureFlagContext.Provider>
  )
}

/**
 * Check if a feature flag is enabled.
 * @param {string} flag - Flag name (e.g. 'BANKID_AUTH')
 * @returns {boolean}
 */
export function useFeatureFlag(flag) {
  const { flags } = useContext(FeatureFlagContext)
  return flags[flag] === true
}

/**
 * Returns true once feature flags have been fetched (or fallback applied).
 * Useful for showing a loading state while flags are being fetched.
 * @returns {boolean}
 */
export function useFeatureFlagsLoaded() {
  const { loaded } = useContext(FeatureFlagContext)
  return loaded
}
