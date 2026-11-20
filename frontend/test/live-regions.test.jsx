/**
 * One message, one live region.
 *
 * Components speak status changes through the global announcer
 * (src/context/AnnouncerContext.jsx). If a component ALSO wraps the same
 * visible text in its own role="status"/"alert"/aria-live block, a screen
 * reader that announces inserted regions reads the message twice. These tests
 * render real components inside the REAL provider (the per-component tests
 * mock it) and check that each routed message ends up in exactly one live
 * region, and that the one region is the announcer's.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, waitFor } from '@testing-library/preact'
import { h } from 'preact'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
    i18n: { language: 'sv', changeLanguage: vi.fn() },
  }),
}))

vi.mock('leaflet', () => ({
  default: {
    map: vi.fn(() => ({ setView: vi.fn().mockReturnThis(), remove: vi.fn() })),
    tileLayer: vi.fn(() => ({ addTo: vi.fn() })),
    marker: vi.fn(() => ({ addTo: vi.fn() })),
    divIcon: vi.fn(() => ({})),
  },
}))

vi.mock('../src/services/ratings', () => ({
  ratingService: { submit: vi.fn().mockResolvedValue({ rating: {} }) },
}))

vi.mock('../src/services/requests', () => ({
  requestService: { create: vi.fn() },
}))

const { AnnouncerProvider } = await import('../src/context/AnnouncerContext')
const { LocationBanner } = await import('../src/components/LocationBanner')
const { RatingBanner } = await import('../src/components/RatingBanner')
const { PostCreateMap } = await import('../src/components/PostCreateMap')
const { CreateRequest } = await import('../src/components/CreateRequest')
const { requestService } = await import('../src/services/requests')

const LIVE = '[role="status"],[role="alert"],[role="log"],[aria-live]'

// Every live region whose text contains `text`.
const regionsWith = (container, text) =>
  Array.from(container.querySelectorAll(LIVE)).filter((el) => el.textContent.includes(text))

// Waits for the announcer to speak `text`, then checks nothing else does.
async function expectSpokenOnce(container, text) {
  await waitFor(() => expect(regionsWith(container, text).length).toBeGreaterThan(0))
  const regions = regionsWith(container, text)
  expect(regions, `"${text}" is in ${regions.length} live regions`).toHaveLength(1)
  expect(regions[0].closest('.sr-only'), 'the one region must be the announcer').not.toBeNull()
}

const inProvider = (ui) => render(<AnnouncerProvider>{ui}</AnnouncerProvider>)

describe('one message, one live region', () => {
  let consoleErrorSpy

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    Object.defineProperty(navigator, 'geolocation', {
      value: {
        getCurrentPosition: vi.fn((success) => success({ coords: { latitude: 59.33, longitude: 18.07 } })),
      },
      configurable: true,
    })
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  it('location warning (assertive)', async () => {
    const { container } = inProvider(<LocationBanner error="denied" severity="warning" />)
    await expectSpokenOnce(container, 'location.denied')
  })

  it('location notice (polite)', async () => {
    const { container } = inProvider(<LocationBanner error="unavailable" />)
    await expectSpokenOnce(container, 'location.unavailable')
  })

  it('rating prompt', async () => {
    const pendingRating = { request_id: 'r1', type: 'walk', requester_id: 'a', helper_id: 'b' }
    const { container } = inProvider(<RatingBanner pendingRating={pendingRating} onRated={() => {}} />)
    await expectSpokenOnce(container, 'ratings.prompt')
  })

  it('post-create confirmation', async () => {
    const { container } = inProvider(<PostCreateMap position={{ lat: 59.33, lng: 18.07 }} onBack={() => {}} />)
    await expectSpokenOnce(container, 'requests.waitingForHelp')
  })

  it('failed request submission', async () => {
    requestService.create.mockRejectedValueOnce(new Error('requests.errorFull'))
    const { container, getByText } = inProvider(<CreateRequest />)
    await fireEvent.click(getByText('requests.send'))
    await expectSpokenOnce(container, 'requests.errorFull')
  })

  it('rating prompt and location notice mounting together are both spoken', async () => {
    // The request list can mount both at once. Before same-tick batching the
    // second announce() replaced the first before anything was rendered.
    const pendingRating = { request_id: 'r2', type: 'walk', requester_id: 'a', helper_id: 'b' }
    const { container } = inProvider(
      <div>
        <RatingBanner pendingRating={pendingRating} onRated={() => {}} />
        <LocationBanner error="unavailable" />
      </div>
    )
    await expectSpokenOnce(container, 'ratings.prompt')
    await expectSpokenOnce(container, 'location.unavailable')
  })
})
