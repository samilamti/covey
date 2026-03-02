/**
 * FeatureFlagContext tests.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/preact'
import { h } from 'preact'
import {
  FeatureFlagProvider,
  useFeatureFlag,
  useFeatureFlagsLoaded,
} from '../src/context/FeatureFlagContext'
import { clearFlagCache } from '../src/services/features'

// Test component that uses the hooks
function FlagDisplay({ flag }) {
  const enabled = useFeatureFlag(flag)
  const loaded = useFeatureFlagsLoaded()
  return (
    <div>
      <span data-testid="loaded">{loaded ? 'yes' : 'no'}</span>
      <span data-testid="flag">{enabled ? 'enabled' : 'disabled'}</span>
    </div>
  )
}

describe('FeatureFlagContext', () => {
  beforeEach(() => {
    clearFlagCache()
    vi.restoreAllMocks()
  })

  it('provides flags to child components after fetch', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({ flags: { BANKID_AUTH: true, COMMUNITIES: false } }),
    })

    const { getByTestId } = render(
      <FeatureFlagProvider>
        <FlagDisplay flag="BANKID_AUTH" />
      </FeatureFlagProvider>
    )

    // Wait for the fetch to resolve
    await waitFor(() => {
      expect(getByTestId('loaded').textContent).toBe('yes')
    })

    expect(getByTestId('flag').textContent).toBe('enabled')
  })

  it('defaults to disabled when flag is not present', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ flags: {} }),
    })

    const { getByTestId } = render(
      <FeatureFlagProvider>
        <FlagDisplay flag="BANKID_AUTH" />
      </FeatureFlagProvider>
    )

    await waitFor(() => {
      expect(getByTestId('loaded').textContent).toBe('yes')
    })

    expect(getByTestId('flag').textContent).toBe('disabled')
  })

  it('handles fetch errors gracefully', async () => {
    globalThis.fetch = vi.fn().mockRejectedValueOnce(new Error('Network'))

    const { getByTestId } = render(
      <FeatureFlagProvider>
        <FlagDisplay flag="COMMUNITIES" />
      </FeatureFlagProvider>
    )

    await waitFor(() => {
      expect(getByTestId('loaded').textContent).toBe('yes')
    })

    // Should default to disabled on error
    expect(getByTestId('flag').textContent).toBe('disabled')
  })
})
