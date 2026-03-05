import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, waitFor } from '@testing-library/preact'
import { h } from 'preact'

/* ── Mocks ── */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
    i18n: { language: 'sv', changeLanguage: vi.fn() },
  }),
}))

vi.mock('lucide-preact', () => ({
  CheckCircle: (props) => h('span', props, 'CheckCircle'),
  Phone: (props) => h('span', props, 'Phone'),
  MapPin: (props) => h('span', props, 'MapPin'),
  X: (props) => h('span', props, 'X'),
  Clock: (props) => h('span', props, 'Clock'),
  MessageCircle: (props) => h('span', props, 'MessageCircle'),
  Send: (props) => h('span', props, 'Send'),
}))

// Track socket emissions
const emitted = []
const listeners = {}
vi.mock('../src/socket', () => ({
  socket: {
    emit: vi.fn((...args) => emitted.push(args)),
    on: vi.fn((event, fn) => { listeners[event] = listeners[event] || []; listeners[event].push(fn) }),
    off: vi.fn((event, fn) => {
      if (listeners[event]) listeners[event] = listeners[event].filter((f) => f !== fn)
    }),
  },
}))

vi.mock('../src/services/requests', () => ({
  requestService: {
    start: vi.fn().mockResolvedValue({ request: { id: 'r1', status: 'active' } }),
    get: vi.fn().mockResolvedValue({ request: { id: 'r1', status: 'active' } }),
    getMessages: vi.fn().mockResolvedValue({ messages: [] }),
    initiateDone: vi.fn().mockResolvedValue({ request: { id: 'r1', status: 'done_pending', done_initiated_by: 'user-a' } }),
    acceptDone: vi.fn().mockResolvedValue({ request: { id: 'r1', status: 'completed' } }),
    rejectDone: vi.fn().mockResolvedValue({ request: { id: 'r1', status: 'active' } }),
    confirmSafety: vi.fn().mockResolvedValue({}),
    cancel: vi.fn().mockResolvedValue({}),
  },
}))

vi.mock('../src/utils/geo', () => ({
  haversineKm: vi.fn(() => 1.2),
}))

// Mock leaflet dynamic import
vi.mock('leaflet', () => {
  const mockMap = {
    setView: vi.fn().mockReturnThis(),
    remove: vi.fn(),
  }
  const mockTileLayer = { addTo: vi.fn() }
  return {
    default: {
      map: vi.fn(() => mockMap),
      tileLayer: vi.fn(() => mockTileLayer),
      divIcon: vi.fn(() => ({})),
      marker: vi.fn(() => ({
        addTo: vi.fn().mockReturnThis(),
        setLatLng: vi.fn(),
      })),
    },
    map: vi.fn(() => mockMap),
    tileLayer: vi.fn(() => mockTileLayer),
    divIcon: vi.fn(() => ({})),
    marker: vi.fn(() => ({
      addTo: vi.fn().mockReturnThis(),
      setLatLng: vi.fn(),
    })),
  }
})

// Control useGeolocation return value from tests
let geoState = { position: null, error: null, loading: true, retry: vi.fn(), supported: true }
vi.mock('../src/hooks/useGeolocation', () => ({
  useGeolocation: () => geoState,
}))

const { ActiveSession } = await import('../src/components/ActiveSession')
const { socket } = await import('../src/socket')

const makeRequest = (overrides = {}) => ({
  id: 'r1',
  type: 'walk',
  status: 'active',
  requester_id: 'user-a',
  helper_id: 'user-b',
  message: 'Help me walk home',
  pickup_lat: '59.33',
  pickup_lng: '18.07',
  done_initiated_by: null,
  done_initiated_at: null,
  ...overrides,
})

describe('ActiveSession', () => {
  let consoleErrorSpy

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.clearAllMocks()
    emitted.length = 0
    Object.keys(listeners).forEach((k) => delete listeners[k])
    // Default: geolocation working
    geoState = {
      position: { lat: 59.33, lng: 18.07, accuracy: 10 },
      error: null,
      loading: false,
      retry: vi.fn(),
      supported: true,
    }
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  /* ── Rendering basics ── */

  it('renders request type in header', () => {
    const { getByText } = render(
      <ActiveSession request={makeRequest()} currentUserId="user-a" onClose={vi.fn()} />
    )
    expect(getByText('requests.types.walk')).toBeTruthy()
  })

  it('shows "you requested" label for requester', () => {
    const { getByText } = render(
      <ActiveSession request={makeRequest()} currentUserId="user-a" onClose={vi.fn()} />
    )
    expect(getByText('requests.youRequested')).toBeTruthy()
  })

  it('shows "you are helper" label for helper', () => {
    const { getByText } = render(
      <ActiveSession request={makeRequest()} currentUserId="user-b" onClose={vi.fn()} />
    )
    expect(getByText('requests.youAreHelper')).toBeTruthy()
  })

  /* ── Geolocation error banners ── */

  it('shows LocationBanner with warning severity when geolocation denied', () => {
    geoState = { ...geoState, position: null, error: 'denied', loading: false }
    const { getByText } = render(
      <ActiveSession request={makeRequest()} currentUserId="user-a" onClose={vi.fn()} />
    )
    expect(getByText('location.denied')).toBeTruthy()
  })

  it('shows session warning when geolocation fails', () => {
    geoState = { ...geoState, position: null, error: 'unavailable', loading: false }
    const { getByText } = render(
      <ActiveSession request={makeRequest()} currentUserId="user-a" onClose={vi.fn()} />
    )
    expect(getByText('location.sessionWarning')).toBeTruthy()
  })

  it('shows retry button in LocationBanner when geolocation denied', () => {
    const retryFn = vi.fn()
    geoState = { ...geoState, position: null, error: 'denied', loading: false, retry: retryFn }
    const { getByText } = render(
      <ActiveSession request={makeRequest()} currentUserId="user-a" onClose={vi.fn()} />
    )
    const retryBtn = getByText('location.retry')
    fireEvent.click(retryBtn)
    expect(retryFn).toHaveBeenCalledOnce()
  })

  it('does not show LocationBanner when geolocation works', () => {
    const { queryByText } = render(
      <ActiveSession request={makeRequest()} currentUserId="user-a" onClose={vi.fn()} />
    )
    expect(queryByText('location.denied')).toBeNull()
    expect(queryByText('location.unavailable')).toBeNull()
    expect(queryByText('location.sessionWarning')).toBeNull()
  })

  /* ── Socket location relay ── */

  it('emits location:update via socket when myLocation is available', async () => {
    render(
      <ActiveSession request={makeRequest()} currentUserId="user-a" onClose={vi.fn()} />
    )
    await waitFor(() => {
      const locationEmits = emitted.filter(([event]) => event === 'location:update')
      expect(locationEmits.length).toBeGreaterThan(0)
      expect(locationEmits[0][1]).toEqual({
        requestId: 'r1',
        lat: 59.33,
        lng: 18.07,
        accuracy: 10,
      })
    })
  })

  it('does not emit location:update when myLocation is null', async () => {
    geoState = { ...geoState, position: null, error: 'denied', loading: false }
    render(
      <ActiveSession request={makeRequest()} currentUserId="user-a" onClose={vi.fn()} />
    )
    // Give effects time to run
    await waitFor(() => {
      const locationEmits = emitted.filter(([event]) => event === 'location:update')
      expect(locationEmits.length).toBe(0)
    })
  })

  /* ── Location indicators ── */

  it('shows "waiting for location" when other party has not shared', () => {
    const { getByText } = render(
      <ActiveSession request={makeRequest()} currentUserId="user-a" onClose={vi.fn()} />
    )
    expect(getByText('requests.waitingLocation')).toBeTruthy()
  })

  it('shows You and Helper/Requester location legend', () => {
    const { getByText } = render(
      <ActiveSession request={makeRequest()} currentUserId="user-a" onClose={vi.fn()} />
    )
    expect(getByText('requests.you')).toBeTruthy()
    expect(getByText('requests.helper')).toBeTruthy()
  })

  /* ── Action buttons ── */

  it('shows done button for active status', () => {
    const { getByText } = render(
      <ActiveSession request={makeRequest()} currentUserId="user-a" onClose={vi.fn()} />
    )
    expect(getByText('requests.done')).toBeTruthy()
  })

  it('shows cancel button for non-terminal status', () => {
    const { getByText } = render(
      <ActiveSession request={makeRequest()} currentUserId="user-a" onClose={vi.fn()} />
    )
    expect(getByText('requests.cancel')).toBeTruthy()
  })

  it('shows close button for completed sessions', () => {
    const { getByText } = render(
      <ActiveSession request={makeRequest({ status: 'completed' })} currentUserId="user-a" onClose={vi.fn()} />
    )
    expect(getByText('requests.close')).toBeTruthy()
  })

  /* ── Done flow ── */

  it('shows done-waiting message when current user initiated done', () => {
    const { getByText } = render(
      <ActiveSession
        request={makeRequest({ status: 'done_pending', done_initiated_by: 'user-a' })}
        currentUserId="user-a"
        onClose={vi.fn()}
      />
    )
    expect(getByText('requests.doneWaiting')).toBeTruthy()
  })

  it('shows accept/reject buttons when other party initiated done', () => {
    const { getByText } = render(
      <ActiveSession
        request={makeRequest({ status: 'done_pending', done_initiated_by: 'user-b' })}
        currentUserId="user-a"
        onClose={vi.fn()}
      />
    )
    expect(getByText('requests.doneAccept')).toBeTruthy()
    expect(getByText('requests.doneReject')).toBeTruthy()
  })

  /* ── Socket listener registration ── */

  it('registers socket listeners for location updates on mount', () => {
    render(
      <ActiveSession request={makeRequest()} currentUserId="user-a" onClose={vi.fn()} />
    )
    const onCalls = socket.on.mock.calls.map(([event]) => event)
    expect(onCalls).toContain('request:locationUpdate')
    expect(onCalls).toContain('request:completed')
    expect(onCalls).toContain('request:cancelled')
    expect(onCalls).toContain('request:done-initiated')
    expect(onCalls).toContain('request:done-rejected')
    expect(onCalls).toContain('message:received')
    expect(onCalls).toContain('message:sent')
  })

  /* ── Messaging UI ── */

  it('shows message toggle button', () => {
    const { getByText } = render(
      <ActiveSession request={makeRequest()} currentUserId="user-a" onClose={vi.fn()} />
    )
    expect(getByText('messages.title')).toBeTruthy()
  })

  it('does not show message toggle for terminal states', () => {
    const { queryByText } = render(
      <ActiveSession request={makeRequest({ status: 'completed' })} currentUserId="user-a" onClose={vi.fn()} />
    )
    // messages.title is the toggle, should not appear for completed
    const msgToggles = queryByText('messages.title')
    expect(msgToggles).toBeNull()
  })

  /* ── Reconnect and visibility refresh ── */

  it('registers connect listener for reconnect refresh', () => {
    render(
      <ActiveSession request={makeRequest()} currentUserId="user-a" onClose={vi.fn()} />
    )
    const onCalls = socket.on.mock.calls.map(([event]) => event)
    expect(onCalls).toContain('connect')
  })

  it('re-fetches request state on socket reconnect', async () => {
    const { requestService } = await import('../src/services/requests')
    requestService.get.mockResolvedValue({
      request: { id: 'r1', status: 'done_pending', done_initiated_by: 'user-b' },
    })

    render(
      <ActiveSession request={makeRequest()} currentUserId="user-a" onClose={vi.fn()} />
    )
    vi.clearAllMocks()

    // Simulate socket reconnect
    listeners['connect']?.forEach((fn) => fn())

    await waitFor(() => {
      expect(requestService.get).toHaveBeenCalledWith('r1')
    })
  })

  it('re-fetches request state on visibilitychange', async () => {
    const { requestService } = await import('../src/services/requests')
    requestService.get.mockResolvedValue({
      request: { id: 'r1', status: 'done_pending', done_initiated_by: 'user-b' },
    })

    render(
      <ActiveSession request={makeRequest()} currentUserId="user-a" onClose={vi.fn()} />
    )
    vi.clearAllMocks()

    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))

    await waitFor(() => {
      expect(requestService.get).toHaveBeenCalledWith('r1')
    })
  })

  it('updates UI from re-fetched done_pending state', async () => {
    const { requestService } = await import('../src/services/requests')
    requestService.get.mockResolvedValue({
      request: { id: 'r1', status: 'done_pending', done_initiated_by: 'user-b' },
    })

    const { getByText } = render(
      <ActiveSession request={makeRequest()} currentUserId="user-a" onClose={vi.fn()} />
    )

    // Simulate socket reconnect to trigger refresh
    listeners['connect']?.forEach((fn) => fn())

    await waitFor(() => {
      expect(getByText('requests.doneProposal')).toBeTruthy()
    })
  })

  it('cleans up connect listener on unmount', () => {
    const { unmount } = render(
      <ActiveSession request={makeRequest()} currentUserId="user-a" onClose={vi.fn()} />
    )
    unmount()

    const offCalls = socket.off.mock.calls.map(([event]) => event)
    expect(offCalls).toContain('connect')
  })
})
