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
  Flag: (props) => h('span', props, 'Flag'),
  Ban: (props) => h('span', props, 'Ban'),
}))

// Spy on the global announcer. It is the only channel that speaks a routed
// message: an inline live region mounted together with its text is often
// skipped by VoiceOver, and keeping both would read the message twice.
const announceSpy = vi.fn()

// True when `text` sits inside any live region in `container`. Routed
// messages must not: the announcer (mocked here) is their only channel.
const LIVE = '[role="status"],[role="alert"],[role="log"],[aria-live]'
const inLiveRegion = (container, text) =>
  Array.from(container.querySelectorAll(LIVE)).some((el) => el.textContent.includes(text))
vi.mock('../src/context/AnnouncerContext', () => ({
  useAnnouncer: () => ({ announce: announceSpy }),
  AnnouncerProvider: ({ children }) => children,
}))

vi.mock('../src/services/safety', () => ({
  safetyService: {
    block: vi.fn().mockResolvedValue({ blocked: true, endedSessions: 1 }),
    unblock: vi.fn().mockResolvedValue({ blocked: false }),
    report: vi.fn().mockResolvedValue({ report: { id: 'rep1' }, blocked: false }),
  },
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
const { safetyService } = await import('../src/services/safety')

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
    announceSpy.mockClear()
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

  it('names the map container as a region so screen readers can find or skip it', () => {
    // Leaflet makes the map div focusable once it initialises, so a
    // keyboard user tabs onto an unnamed widget and a screen-reader
    // user has nothing to find or skip by landmark. The legend and ETA
    // carry what the map shows visually; the label just names the pane.
    const { getByRole } = render(
      <ActiveSession request={makeRequest()} currentUserId="user-a" onClose={vi.fn()} />
    )
    const map = getByRole('region', { name: 'map.title' })
    expect(map).toBeTruthy()
  })

  it('names the header as an h2 so heading navigation lands on this view', () => {
    // ActiveSession takes over the whole screen and replaces the
    // RequestList h2. Shipping the header as h3 would leave a screen
    // reader jumping headings with nothing at this level to land on.
    const { getByRole } = render(
      <ActiveSession request={makeRequest()} currentUserId="user-a" onClose={vi.fn()} />
    )
    const heading = getByRole('heading', { level: 2, name: 'requests.types.walk' })
    expect(heading).toBeTruthy()
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
    const line = getByText('requests.waitingLocation')
    expect(line).toBeTruthy()
    expect(line.getAttribute('class') || '').not.toMatch(/\btext-gray-400\b/)
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

  it('exposes an accessible name for the header close button', () => {
    // The header X button has no visible text — screen readers need the
    // aria-label to announce it. requests.close is translated in all 12
    // locales so this works for every language.
    const { getByLabelText } = render(
      <ActiveSession request={makeRequest()} currentUserId="user-a" onClose={vi.fn()} />
    )
    expect(getByLabelText('requests.close')).toBeTruthy()
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


  it('shows the other party\'s done proposal outside any inline live region', () => {
    // The announcer speaks the proposal (next test). An inline live region
    // around it would make a screen reader that does read inserted regions
    // say it twice, and would read the two buttons out as part of it.
    const { container, getByText } = render(
      <ActiveSession
        request={makeRequest({ status: 'done_pending', done_initiated_by: 'user-b' })}
        currentUserId="user-a"
        onClose={vi.fn()}
      />
    )
    expect(getByText('requests.doneProposal')).toBeTruthy()
    expect(inLiveRegion(container, 'requests.doneProposal')).toBe(false)
  })

  it('routes the other party\'s done proposal through the global announcer', () => {
    // A done proposal appears from a socket event while the user is walking
    // and almost certainly not looking at the screen. The inline role="status"
    // below gets mounted together with its text and is often skipped by
    // VoiceOver; the always-mounted announcer is the reliable channel.
    render(
      <ActiveSession
        request={makeRequest({ status: 'done_pending', done_initiated_by: 'user-b' })}
        currentUserId="user-a"
        onClose={vi.fn()}
      />
    )
    expect(announceSpy).toHaveBeenCalledWith('requests.doneProposal')
  })

  it('does not announce the user\'s own done tap as a proposal', () => {
    // When the current user initiates done, they know — they just tapped the
    // button — so re-announcing it would be noise. Only the OTHER party's
    // proposal goes to the announcer.
    render(
      <ActiveSession
        request={makeRequest({ status: 'done_pending', done_initiated_by: 'user-a' })}
        currentUserId="user-a"
        onClose={vi.fn()}
      />
    )
    expect(announceSpy).not.toHaveBeenCalledWith('requests.doneProposal')
  })

  it('routes session expiry through the global announcer', () => {
    // Expiry is server-driven — nothing the user did — so a VoiceOver user
    // keeps believing the session is live unless the transition is spoken.
    render(
      <ActiveSession
        request={makeRequest({ status: 'expired' })}
        currentUserId="user-a"
        onClose={vi.fn()}
      />
    )
    expect(announceSpy).toHaveBeenCalledWith('requests.expired')
  })


  it('shows session expiry outside any inline live region', () => {
    // Expiry is server-driven; the announcer speaks it. The visible band
    // must not be a live region too, or it is read twice.
    const { container, getByText } = render(
      <ActiveSession
        request={makeRequest({ status: 'expired' })}
        currentUserId="user-a"
        onClose={vi.fn()}
      />
    )
    expect(getByText('requests.expired')).toBeTruthy()
    expect(inLiveRegion(container, 'requests.expired')).toBe(false)
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

  it('exposes the message toggle as a disclosure with aria-expanded and aria-controls', async () => {
    // The message toggle opens and closes the chat panel; a screen
    // reader needs aria-expanded to know the state and aria-controls to
    // point at the panel the button toggles. Without them the button
    // announces as a generic push with no hint that it reveals content.
    Element.prototype.scrollIntoView = vi.fn()
    const { getByText } = render(
      <ActiveSession request={makeRequest()} currentUserId="user-a" onClose={vi.fn()} />
    )
    const toggle = getByText('messages.title').closest('button')
    expect(toggle).toBeTruthy()
    // Closed by default.
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    const panelId = toggle.getAttribute('aria-controls')
    expect(panelId).toBeTruthy()
    // Opening it flips the state and reveals a panel with the referenced id.
    await fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    const panel = document.getElementById(panelId)
    expect(panel).not.toBeNull()
  })

  it('reads the empty message-panel placeholder at WCAG AA contrast', async () => {
    Element.prototype.scrollIntoView = vi.fn()
    const { getByText, getAllByText } = render(
      <ActiveSession request={makeRequest()} currentUserId="user-a" onClose={vi.fn()} />
    )
    fireEvent.click(getByText('messages.title'))
    const matches = getAllByText('messages.placeholder')
    const emptyLine = matches.find((el) => el.tagName === 'P')
    expect(emptyLine).toBeTruthy()
    const cls = emptyLine.getAttribute('class') || ''
    expect(cls).toMatch(/\btext-gray-600\b/)
    expect(cls).not.toMatch(/\btext-gray-400\b/)
    expect(cls).not.toMatch(/\btext-gray-500\b/)
  })

  it('announces new messages as a polite live region', async () => {
    // A blind user can see "Messages 3" but has no reason to re-read a
    // number that never speaks for itself, so an incoming reply used to
    // land silently. role="log" with aria-live="polite" tells a screen
    // reader to announce each appended message without stealing focus
    // from whatever the user is doing.
    Element.prototype.scrollIntoView = vi.fn()
    const { getByText, getByRole } = render(
      <ActiveSession request={makeRequest()} currentUserId="user-a" onClose={vi.fn()} />
    )
    fireEvent.click(getByText('messages.title'))
    const log = getByRole('log', { name: 'messages.title' })
    expect(log.getAttribute('aria-live')).toBe('polite')
    // aria-relevant="additions" keeps the announcement to new messages
    // instead of re-reading the entire list on every repaint.
    expect(log.getAttribute('aria-relevant')).toBe('additions')
  })

  it('pairs the unread badge with a hidden accessible description', async () => {
    // The visible badge is just "3", which announces as "Messages 3" and
    // leaves the user guessing whether that is an id, a time, or a count.
    // The raw digit is hidden from AT and paired with a sr-only
    // count-aware string that stands on its own.
    const { container } = render(
      <ActiveSession request={makeRequest()} currentUserId="user-a" onClose={vi.fn()} />
    )
    // Give useEffect a chance to register the socket listener before we
    // fire its event.
    await waitFor(() => {
      expect(listeners['message:received']?.[0]).toBeDefined()
    })
    const handleReceived = listeners['message:received'][0]
    // Fire an inbound message while the panel is CLOSED so unreadCount
    // ticks and the badge actually renders.
    handleReceived({
      requestId: 'r1',
      message: { id: 'm1', senderId: 'user-b', content: 'hi', createdAt: new Date().toISOString() },
    })
    // sr-only span carries the resolved key — the mocked t() echoes the
    // key, so we assert the hidden description is PRESENT and the digit
    // is marked aria-hidden.
    await waitFor(() => {
      const srOnly = container.querySelector('.sr-only')
      expect(srOnly).toBeTruthy()
      expect(srOnly.textContent).toContain('messages.unread')
    })
  })

  it('gives the chat input and send button accessible names', async () => {
    // The chat input relied on `placeholder` as its label, which assistive
    // tech does not treat as an accessible name — a placeholder disappears
    // when the user types, so the input would announce as "edit text, blank"
    // mid-message. The icon-only send button had no name at all.
    // jsdom has no scrollIntoView; opening the message panel runs an effect
    // that would call it, so stub it before firing the toggle.
    Element.prototype.scrollIntoView = vi.fn()
    const { getByText, getByLabelText } = render(
      <ActiveSession request={makeRequest()} currentUserId="user-a" onClose={vi.fn()} />
    )
    // Toggle the message panel open.
    fireEvent.click(getByText('messages.title'))
    const input = getByLabelText('messages.placeholder')
    expect(input.tagName).toBe('INPUT')
    const sendBtn = getByLabelText('messages.send')
    expect(sendBtn.tagName).toBe('BUTTON')
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

  /* ── Report and block ── */

  it('offers report and block against the other party during the session', () => {
    const { getByText } = render(
      <ActiveSession request={makeRequest()} currentUserId="user-a" onClose={vi.fn()} />
    )
    expect(getByText('safety.report')).toBeTruthy()
    expect(getByText('safety.block')).toBeTruthy()
  })

  it('keeps report and block after the session has ended', () => {
    const { getByText } = render(
      <ActiveSession request={makeRequest({ status: 'completed' })} currentUserId="user-a" onClose={vi.fn()} />
    )
    expect(getByText('safety.report')).toBeTruthy()
    expect(getByText('safety.block')).toBeTruthy()
  })

  it('blocks the helper (not the user) and shows the session as ended', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { getByText } = render(
      <ActiveSession request={makeRequest()} currentUserId="user-a" onClose={vi.fn()} />
    )
    fireEvent.click(getByText('safety.block'))
    await waitFor(() => expect(safetyService.block).toHaveBeenCalledWith('user-b'))
    await waitFor(() => expect(getByText('requests.close')).toBeTruthy())
    window.confirm.mockRestore()
  })

  it('reports the requester with the session id when the helper reports', async () => {
    const { getByText, getByLabelText } = render(
      <ActiveSession request={makeRequest()} currentUserId="user-b" onClose={vi.fn()} />
    )
    fireEvent.click(getByText('safety.report'))
    fireEvent.click(getByLabelText('safety.reasons.unsafe'))
    fireEvent.click(getByText('safety.send'))
    await waitFor(() => expect(safetyService.report).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-a', reason: 'unsafe', requestId: 'r1', block: false })
    ))
  })
})
