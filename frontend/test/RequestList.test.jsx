import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, waitFor, fireEvent } from '@testing-library/preact'
import { h } from 'preact'

/* ── Mocks ── */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
    i18n: { language: 'sv', changeLanguage: vi.fn() },
  }),
}))

vi.mock('lucide-preact', () => ({
  HelpCircle: (props) => h('span', props, 'HelpCircle'),
  Plus: (props) => h('span', props, 'Plus'),
  List: (props) => h('span', props, 'List'),
  Send: (props) => h('span', props, 'Send'),
  MapPin: (props) => h('span', props, 'MapPin'),
  X: (props) => h('span', props, 'X'),
  Clock: (props) => h('span', props, 'Clock'),
  User: (props) => h('span', props, 'User'),
  CheckCircle: (props) => h('span', props, 'CheckCircle'),
  AlertCircle: (props) => h('span', props, 'AlertCircle'),
  ArrowLeft: (props) => h('span', props, 'ArrowLeft'),
}))

vi.mock('../src/services/requests', () => ({
  requestService: {
    list: vi.fn().mockResolvedValue({ requests: [] }),
    listOpen: vi.fn().mockResolvedValue({ requests: [] }),
    accept: vi.fn(),
    cancel: vi.fn(),
    initiateDone: vi.fn(),
    confirmSafety: vi.fn(),
    create: vi.fn().mockResolvedValue({ request: { id: 'new-1' } }),
  },
}))

vi.mock('../src/services/ratings', () => ({
  ratingService: {
    getPending: vi.fn().mockResolvedValue({ pending: [] }),
  },
}))

vi.mock('../src/socket', () => ({
  socket: {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  },
}))

vi.mock('../src/utils/geo', () => ({
  haversineKm: vi.fn(() => 0.8),
  formatDistance: vi.fn(() => '~800m bort'),
}))

// Control useGeolocation return value from tests
let geoState = { position: null, error: null, loading: true, retry: vi.fn(), supported: true }
vi.mock('../src/hooks/useGeolocation', () => ({
  useGeolocation: () => geoState,
}))

const { RequestList } = await import('../src/components/RequestList')
const { requestService } = await import('../src/services/requests')

describe('RequestList', () => {
  let consoleErrorSpy

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.clearAllMocks()
    // Default: geolocation working
    geoState = {
      position: { lat: 59.33, lng: 18.07, accuracy: 10 },
      error: null,
      loading: false,
      retry: vi.fn(),
      supported: true,
    }
    // Default: empty request lists
    requestService.list.mockResolvedValue({ requests: [] })
    requestService.listOpen.mockResolvedValue({ requests: [] })
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  /* ── Basic rendering ── */

  it('renders the requests title after loading', async () => {
    const { getByText } = render(<RequestList currentUserId="user-a" />)
    await waitFor(() => {
      expect(getByText('requests.title')).toBeTruthy()
    })
  })

  it('shows create request form by default when no open requests', async () => {
    const { getByText } = render(<RequestList currentUserId="user-a" />)
    await waitFor(() => {
      // Header shows "view requests" toggle, form shows "Ny förfrågan" header
      expect(getByText('requests.viewRequests')).toBeTruthy()
      expect(getByText('requests.create')).toBeTruthy()
    })
  })

  it('defaults to list view when open requests exist', async () => {
    requestService.listOpen.mockResolvedValue({ requests: [{
      id: 'r-open-1', type: 'walk', status: 'open', message: 'Need help',
      requester_id: 'user-b', helper_id: null,
      pickup_lat: '59.34', pickup_lng: '18.08',
      eligibility_tier: 'any_member', created_at: new Date().toISOString(),
    }] })
    const { getByText, queryByText } = render(<RequestList currentUserId="user-a" />)
    await waitFor(() => {
      expect(getByText('requests.openRequests')).toBeTruthy()
      // Toggle button should offer "create" (we're in list view)
      expect(getByText('requests.create')).toBeTruthy()
      expect(queryByText('requests.viewRequests')).toBeNull()
    })
  })

  it('toggles between create form and request list', async () => {
    const { getByText, queryByText } = render(<RequestList currentUserId="user-a" />)
    await waitFor(() => expect(getByText('requests.viewRequests')).toBeTruthy())

    // Click "view requests" to hide create form
    fireEvent.click(getByText('requests.viewRequests'))
    await waitFor(() => {
      expect(getByText('requests.create')).toBeTruthy() // now shows "Ny förfrågan" button
      expect(queryByText('requests.viewRequests')).toBeNull()
    })

    // Click "Ny förfrågan" to show create form again
    fireEvent.click(getByText('requests.create'))
    await waitFor(() => {
      expect(getByText('requests.viewRequests')).toBeTruthy()
    })
  })

  /* ── Geolocation — success ── */

  it('does not show LocationBanner when geolocation succeeds', async () => {
    const { queryByText } = render(<RequestList currentUserId="user-a" />)
    await waitFor(() => {
      expect(queryByText('location.denied')).toBeNull()
      expect(queryByText('location.unavailable')).toBeNull()
    })
  })

  /* ── Geolocation — failure ── */

  it('shows LocationBanner when geolocation is denied', async () => {
    geoState = { ...geoState, position: null, error: 'denied', loading: false }
    requestService.list.mockResolvedValue({ requests: [{
      id: 'r1', type: 'walk', status: 'open', message: '',
      requester_id: 'user-a', helper_id: null,
      pickup_lat: null, pickup_lng: null,
      eligibility_tier: 'any_member', created_at: new Date().toISOString(),
    }] })
    const { getByText, getAllByText } = render(<RequestList currentUserId="user-a" />)
    // Toggle to list view to avoid duplicate LocationBanner from CreateRequest
    await waitFor(() => expect(getByText('requests.viewRequests')).toBeTruthy())
    fireEvent.click(getByText('requests.viewRequests'))
    await waitFor(() => {
      expect(getAllByText('location.denied').length).toBeGreaterThanOrEqual(1)
    })
  })

  it('shows LocationBanner when geolocation is unavailable', async () => {
    geoState = { ...geoState, position: null, error: 'unavailable', loading: false }
    requestService.list.mockResolvedValue({ requests: [{
      id: 'r1', type: 'walk', status: 'open', message: '',
      requester_id: 'user-a', helper_id: null,
      pickup_lat: null, pickup_lng: null,
      eligibility_tier: 'any_member', created_at: new Date().toISOString(),
    }] })
    const { getByText, getAllByText } = render(<RequestList currentUserId="user-a" />)
    await waitFor(() => expect(getByText('requests.viewRequests')).toBeTruthy())
    fireEvent.click(getByText('requests.viewRequests'))
    await waitFor(() => {
      expect(getAllByText('location.unavailable').length).toBeGreaterThanOrEqual(1)
    })
  })

  it('shows retry button in LocationBanner', async () => {
    const retryFn = vi.fn()
    geoState = { ...geoState, position: null, error: 'denied', loading: false, retry: retryFn }
    requestService.list.mockResolvedValue({ requests: [{
      id: 'r1', type: 'walk', status: 'open', message: '',
      requester_id: 'user-a', helper_id: null,
      pickup_lat: null, pickup_lng: null,
      eligibility_tier: 'any_member', created_at: new Date().toISOString(),
    }] })
    const { getByText, getAllByText } = render(<RequestList currentUserId="user-a" />)
    await waitFor(() => expect(getByText('requests.viewRequests')).toBeTruthy())
    fireEvent.click(getByText('requests.viewRequests'))
    await waitFor(() => {
      const btns = getAllByText('location.retry')
      fireEvent.click(btns[0])
      expect(retryFn).toHaveBeenCalledOnce()
    })
  })

  /* ── Requests with viewerPosition ── */

  it('passes viewerPosition to RequestCards for distance calculation', async () => {
    const requests = [{
      id: 'r1', type: 'walk', status: 'open', message: '',
      requester_id: 'user-b', helper_id: null,
      pickup_lat: '59.34', pickup_lng: '18.08',
      eligibility_tier: 'any_member', created_at: new Date().toISOString(),
    }]
    requestService.listOpen.mockResolvedValue({ requests })
    requestService.list.mockResolvedValue({ requests: [] })

    const { getByText } = render(<RequestList currentUserId="user-a" />)
    // List view shows by default when open requests exist
    await waitFor(() => {
      // The mocked formatDistance returns '~800m bort'
      expect(getByText('~800m bort')).toBeTruthy()
    })
  })

  it('shows "location available" text when no viewerPosition but request has coords', async () => {
    geoState = { ...geoState, position: null, error: null, loading: true }
    const requests = [{
      id: 'r1', type: 'walk', status: 'open', message: '',
      requester_id: 'user-b', helper_id: null,
      pickup_lat: '59.34', pickup_lng: '18.08',
      eligibility_tier: 'any_member', created_at: new Date().toISOString(),
    }]
    requestService.listOpen.mockResolvedValue({ requests })
    requestService.list.mockResolvedValue({ requests: [] })

    const { getByText } = render(<RequestList currentUserId="user-a" />)
    // List view shows by default when open requests exist
    await waitFor(() => {
      expect(getByText('requests.locationAvailable')).toBeTruthy()
    })
  })

  /* ── Active session detection ── */

  it('does not override manual toggle on subsequent data refreshes', async () => {
    requestService.listOpen.mockResolvedValue({ requests: [{
      id: 'r-open-1', type: 'walk', status: 'open', message: '',
      requester_id: 'user-b', helper_id: null,
      pickup_lat: null, pickup_lng: null,
      eligibility_tier: 'any_member', created_at: new Date().toISOString(),
    }] })
    const { getByText } = render(<RequestList currentUserId="user-a" />)
    // Should default to list view
    await waitFor(() => expect(getByText('requests.create')).toBeTruthy())

    // User manually toggles to create form
    fireEvent.click(getByText('requests.create'))
    await waitFor(() => expect(getByText('requests.viewRequests')).toBeTruthy())

    // Simulate a socket-driven refresh (triggers loadAll again)
    const { socket } = await import('../src/socket')
    const handleNew = socket.on.mock.calls.find(([event]) => event === 'request:new')?.[1]
    if (handleNew) await handleNew()

    // Create form should still be visible (not flipped back to list)
    await waitFor(() => {
      expect(getByText('requests.viewRequests')).toBeTruthy()
    })
  })

  it('shows active session banner when user has an active request', async () => {
    const myRequests = [{
      id: 'r1', type: 'walk', status: 'active', message: '',
      requester_id: 'user-a', helper_id: 'user-b',
      pickup_lat: null, pickup_lng: null,
      eligibility_tier: 'any_member', created_at: new Date().toISOString(),
    }]
    requestService.list.mockResolvedValue({ requests: myRequests })

    const { getByText } = render(<RequestList currentUserId="user-a" />)
    await waitFor(() => {
      expect(getByText('requests.activeSession')).toBeTruthy()
      expect(getByText('requests.tapToView')).toBeTruthy()
    })
  })
})
