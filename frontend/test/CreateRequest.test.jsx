import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, waitFor } from '@testing-library/preact'
import { h } from 'preact'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
    i18n: { language: 'sv', changeLanguage: vi.fn() },
  }),
}))

vi.mock('lucide-preact', () => ({
  Send: () => h('span', null, 'Send'),
  MapPin: () => h('span', null, 'MapPin'),
  X: () => h('span', null, 'X'),
}))

vi.mock('../src/services/requests', () => ({
  requestService: {
    create: vi.fn().mockResolvedValue({ request: { id: 'new-1', type: 'walk', status: 'open' } }),
  },
}))

const { requestService } = await import('../src/services/requests')
const { CreateRequest } = await import('../src/components/CreateRequest')

describe('CreateRequest', () => {
  let consoleErrorSpy

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.clearAllMocks()
    // Mock geolocation
    Object.defineProperty(navigator, 'geolocation', {
      value: {
        getCurrentPosition: vi.fn((success) =>
          success({ coords: { latitude: 59.33, longitude: 18.07 } })
        ),
      },
      configurable: true,
    })
  })

  afterEach(() => {
    expect(consoleErrorSpy).not.toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
  })

  it('renders the form header', () => {
    const { getByText } = render(<CreateRequest />)
    expect(getByText('requests.create')).toBeTruthy()
  })

  it('renders walk and wait type buttons', () => {
    const { getByText } = render(<CreateRequest />)
    expect(getByText('requests.types.walk')).toBeTruthy()
    expect(getByText('requests.types.wait')).toBeTruthy()
  })

  it('has walk selected by default', () => {
    const { getByText } = render(<CreateRequest />)
    const walkBtn = getByText('requests.types.walk')
    expect(walkBtn.className).toContain('bg-indigo-50')
  })

  it('clicking wait selects wait type', async () => {
    const { getByText } = render(<CreateRequest />)
    await fireEvent.click(getByText('requests.types.wait'))
    expect(getByText('requests.types.wait').className).toContain('bg-indigo-50')
    expect(getByText('requests.types.walk').className).not.toContain('bg-indigo-50')
  })

  it('renders all three eligibility tier options', () => {
    const { getByText } = render(<CreateRequest />)
    expect(getByText('requests.tiers.sameDemographics')).toBeTruthy()
    expect(getByText('requests.tiers.verifiedGuardians')).toBeTruthy()
    expect(getByText('requests.tiers.anyMember')).toBeTruthy()
  })

  it('submitting calls requestService.create', async () => {
    const onCreated = vi.fn()
    const { getByText } = render(<CreateRequest onCreated={onCreated} />)

    await fireEvent.click(getByText('requests.send'))

    await waitFor(() => {
      expect(requestService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'walk',
          eligibilityTier: 'same_demographics',
        })
      )
    })
  })

  /* ── Geolocation states ── */

  it('shows "location attached" when geolocation succeeds', async () => {
    const { getByText } = render(<CreateRequest />)
    await waitFor(() => {
      expect(getByText('requests.locationAttached')).toBeTruthy()
    })
  })

  it('submits pickupLat/pickupLng from geolocation on success', async () => {
    const onCreated = vi.fn()
    const { getByText } = render(<CreateRequest onCreated={onCreated} />)
    // Wait for geo to resolve then submit
    await waitFor(() => expect(getByText('requests.locationAttached')).toBeTruthy())
    await fireEvent.click(getByText('requests.send'))
    await waitFor(() => {
      expect(requestService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          pickupLat: 59.33,
          pickupLng: 18.07,
        })
      )
    })
  })

  it('shows LocationBanner when geolocation is denied', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      value: {
        getCurrentPosition: vi.fn((_success, error) =>
          error({ code: 1 })
        ),
      },
      configurable: true,
    })
    const { getByText } = render(<CreateRequest />)
    await waitFor(() => {
      expect(getByText('location.denied')).toBeTruthy()
    })
  })

  it('shows LocationBanner when geolocation is unavailable', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      value: {
        getCurrentPosition: vi.fn((_success, error) =>
          error({ code: 2 })
        ),
      },
      configurable: true,
    })
    const { getByText } = render(<CreateRequest />)
    await waitFor(() => {
      expect(getByText('location.unavailable')).toBeTruthy()
    })
  })

  it('shows retry button in LocationBanner on geo error', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      value: {
        getCurrentPosition: vi.fn((_success, error) =>
          error({ code: 1 })
        ),
      },
      configurable: true,
    })
    const { getByText } = render(<CreateRequest />)
    await waitFor(() => {
      expect(getByText('location.retry')).toBeTruthy()
    })
  })

  it('submits null coords when geolocation fails', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      value: {
        getCurrentPosition: vi.fn((_success, error) =>
          error({ code: 1 })
        ),
      },
      configurable: true,
    })
    const onCreated = vi.fn()
    const { getByText } = render(<CreateRequest onCreated={onCreated} />)
    await waitFor(() => expect(getByText('location.denied')).toBeTruthy())
    await fireEvent.click(getByText('requests.send'))
    await waitFor(() => {
      expect(requestService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          pickupLat: null,
          pickupLng: null,
        })
      )
    })
  })
})
