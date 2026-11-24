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
  MessageCircle: (props) => h('span', props, 'MessageCircle'),
  Phone: (props) => h('span', props, 'Phone'),
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

vi.mock('../src/components/ActiveSession', () => ({
  // Expose an onClose hook so a test can simulate the user backing out
  // of the full-screen session view, which is the only path that
  // mounts the "resume active session" banner in RequestList.
  ActiveSession: ({ request, onClose }) => h(
    'div',
    { 'data-testid': 'active-session' },
    [
      `ActiveSession:${request.id}`,
      h('button', { 'data-testid': 'active-session-close', onClick: onClose }, 'close'),
    ],
  ),
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

  it('announces the initial loading state in a polite live region', async () => {
    // RequestList is the app's default view on sign-in, so between the auth
    // redirect and the first list paint there is a bare "loading…" line.
    // Without role="status" + aria-live a screen reader user has no idea
    // whether the page is working, empty, or broken — WCAG 4.1.3 Status
    // Messages. Hold list() unresolved so the loading branch stays mounted
    // long enough to inspect.
    let resolveList
    requestService.list.mockImplementationOnce(
      () => new Promise((resolve) => { resolveList = resolve })
    )
    const { getByRole } = render(<RequestList currentUserId="user-a" />)
    const status = getByRole('status')
    expect(status).toBeTruthy()
    expect(status.getAttribute('aria-live')).toBe('polite')
    expect(status.textContent).toContain('app.loading')
    // The loading text is visible (not sr-only), so a sighted low-vision
    // user has to be able to read it too — WCAG 1.4.3. text-gray-400
    // measured ~2.6:1 on this card and failed the 4.5:1 AA bar;
    // text-gray-500 clears ~4.9:1. Guard the token so a later edit
    // cannot put the low-contrast class back.
    const statusCls = status.getAttribute('class') || ''
    expect(statusCls).toMatch(/\btext-gray-500\b/)
    expect(statusCls).not.toMatch(/\btext-gray-400\b/)
    // Let the suspended list resolve so React can tear down the loading
    // branch cleanly and we don't leak a pending promise into the next test.
    resolveList({ requests: [] })
    await waitFor(() => {})
  })

  it('renders the requests title after loading', async () => {
    const { getByText } = render(<RequestList currentUserId="user-a" />)
    await waitFor(() => {
      expect(getByText('requests.title')).toBeTruthy()
    })
  })

  it('shows create request form by default when no open requests', async () => {
    const { getByText } = render(<RequestList currentUserId="user-a" />)
    await waitFor(() => {
      // Create mode: breadcrumb shows "→ Ny" and the toggle offers "Alla"
      expect(getByText('requests.createShort')).toBeTruthy()
      expect(getByText('requests.all')).toBeTruthy()
    })
  })

  it('reads the empty-state line at WCAG AA contrast', async () => {
    // When the user has no requests and nothing is open, this empty
    // line is the first thing they see on the Requests tab. It was
    // drawn in `text-gray-400` (~2.6:1 on white), below WCAG 1.4.3's
    // 4.5:1 AA bar for normal text — a low-vision user could see
    // nothing where the empty state was supposed to explain the
    // blank screen. `text-gray-500` clears ~4.9:1 on the same card.
    const { getByText, container } = render(<RequestList currentUserId="user-a" />)
    // The empty state only renders in list view (showCreate===false).
    await waitFor(() => expect(getByText('requests.all')).toBeTruthy())
    fireEvent.click(getByText('requests.all'))
    await waitFor(() => {
      const line = getByText('requests.empty')
      const cls = line.getAttribute('class') || ''
      expect(cls).toMatch(/\btext-gray-500\b/)
      expect(container.innerHTML).not.toMatch(/\btext-gray-400\b/)
    })
  })

  it('reads the breadcrumb back-button at WCAG AA contrast', async () => {
    // The breadcrumb's "Requests" crumb is an interactive back-button
    // to the list view. It had been rendered in `text-gray-400`
    // (#9ca3af) on a white card: ~2.6:1 against the background.
    // Even as 20px bold text (which WCAG counts as large), that
    // sits under the 3:1 large-text bar, so a low-vision user could
    // not tell the crumb was the way back. `text-gray-500` (#6b7280)
    // measures ~4.9:1 on the same surface and keeps it a crumb — the
    // current-page span beside it still reads as the active crumb.
    const { getByText } = render(<RequestList currentUserId="user-a" />)
    await waitFor(() => expect(getByText('requests.createShort')).toBeTruthy())
    const back = getByText('requests.title').closest('button')
    const cls = back.getAttribute('class') || ''
    expect(cls).toMatch(/\btext-gray-500\b/)
    expect(cls).not.toMatch(/\btext-gray-400\b/)
  })

  it('hides the decorative breadcrumb arrow from assistive tech', async () => {
    // The visual "→" between the two breadcrumb crumbs is a separator, not
    // a word; without aria-hidden a screen reader reads it as "rightwards
    // arrow" every time it visits the heading. The final crumb carries
    // aria-current="page" so it announces as the current page rather than
    // as a second identical-sounding span. Guards the ARIA Breadcrumb
    // pattern on RequestList's create-mode header.
    const { container, getByText } = render(<RequestList currentUserId="user-a" />)
    await waitFor(() => expect(getByText('requests.createShort')).toBeTruthy())

    const arrow = container.querySelector('h2 span[aria-hidden="true"]')
    expect(arrow).toBeTruthy()
    expect(arrow.textContent).toBe('→')

    const current = getByText('requests.createShort')
    expect(current.getAttribute('aria-current')).toBe('page')
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
      expect(queryByText('requests.all')).toBeNull()
    })
  })

  it('toggles between create form and request list', async () => {
    const { getByText, queryByText } = render(<RequestList currentUserId="user-a" />)
    await waitFor(() => expect(getByText('requests.all')).toBeTruthy())

    // Click "Alla" to hide create form and show the list
    fireEvent.click(getByText('requests.all'))
    await waitFor(() => {
      expect(getByText('requests.create')).toBeTruthy() // now shows "Ny förfrågan" button
      expect(queryByText('requests.all')).toBeNull()
    })

    // Click "Ny förfrågan" to show create form again
    fireEvent.click(getByText('requests.create'))
    await waitFor(() => {
      expect(getByText('requests.all')).toBeTruthy()
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
    await waitFor(() => expect(getByText('requests.all')).toBeTruthy())
    fireEvent.click(getByText('requests.all'))
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
    await waitFor(() => expect(getByText('requests.all')).toBeTruthy())
    fireEvent.click(getByText('requests.all'))
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
    await waitFor(() => expect(getByText('requests.all')).toBeTruthy())
    fireEvent.click(getByText('requests.all'))
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
    await waitFor(() => expect(getByText('requests.all')).toBeTruthy())

    // Simulate a socket-driven refresh (triggers loadAll again)
    const { socket } = await import('../src/socket')
    const handleNew = socket.on.mock.calls.find(([event]) => event === 'request:new')?.[1]
    if (handleNew) await handleNew()

    // Create form should still be visible (not flipped back to list)
    await waitFor(() => {
      expect(getByText('requests.all')).toBeTruthy()
    })
  })

  /* ── Semantic list wrapping ── */

  it('wraps the user\'s requests in a semantic list tied to its heading', async () => {
    // Each RequestCard carries its own actions (Accept, Done, Cancel), so the
    // collection is a true list — not a visual stack. Without role="list" +
    // aria-labelledby a screen reader has no "N items" count on the Requests
    // tab (the app's default view after sign-in) and no quick list-jump
    // between entries. Same shape SafetyPartners already carries.
    const myRequests = [
      // Both 'open' so the auto-navigate-to-ActiveSession branch
      // (active/accepted/done_pending) stays out of the way; the list
      // semantics are what the test is here to verify.
      {
        id: 'r1', type: 'walk', status: 'open', message: '',
        requester_id: 'user-a', helper_id: null,
        pickup_lat: null, pickup_lng: null,
        eligibility_tier: 'any_member', created_at: new Date().toISOString(),
      },
      {
        id: 'r2', type: 'wait', status: 'open', message: '',
        requester_id: 'user-a', helper_id: null,
        pickup_lat: null, pickup_lng: null,
        eligibility_tier: 'any_member', created_at: new Date().toISOString(),
      },
    ]
    requestService.list.mockResolvedValue({ requests: myRequests })

    const { getByText, getByRole, container } = render(<RequestList currentUserId="user-a" />)
    // Flip to list view so the user's own list renders (create form is the
    // default when there are no open requests).
    await waitFor(() => expect(getByText('requests.all')).toBeTruthy())
    fireEvent.click(getByText('requests.all'))

    await waitFor(() => {
      const heading = getByText('requests.title')
      expect(heading.tagName).toBe('H2')
      expect(heading.id).toBeTruthy()

      const list = getByRole('list', { name: 'requests.title' })
      expect(list.tagName).toBe('UL')
      expect(list.getAttribute('aria-labelledby')).toBe(heading.id)

      // Children are <li>, one per request.
      const items = list.querySelectorAll(':scope > li')
      expect(items.length).toBe(2)
    })

    // The default-item-marker rule (Tailwind strips list-style on <ul>
    // explicitly; we belt-and-braces with list-none) keeps the visible
    // layout identical, so no stray bullets appear.
    const list = container.querySelector('ul[aria-labelledby]')
    expect(list.className).toContain('list-none')
  })

  it('wraps open requests from others in a semantic list tied to its heading', async () => {
    // Same reason as the user's own list above — a screen reader user
    // listing open requests from others needs an item count and the list
    // shortcut their reader provides.
    requestService.listOpen.mockResolvedValue({ requests: [
      {
        id: 'r-open-1', type: 'walk', status: 'open', message: '',
        requester_id: 'user-b', helper_id: null,
        pickup_lat: null, pickup_lng: null,
        eligibility_tier: 'any_member', created_at: new Date().toISOString(),
      },
      {
        id: 'r-open-2', type: 'wait', status: 'open', message: '',
        requester_id: 'user-c', helper_id: null,
        pickup_lat: null, pickup_lng: null,
        eligibility_tier: 'any_member', created_at: new Date().toISOString(),
      },
    ] })
    const { getByText, getByRole } = render(<RequestList currentUserId="user-a" />)

    await waitFor(() => {
      const heading = getByText('requests.openRequests')
      expect(heading.tagName).toBe('H3')
      expect(heading.id).toBeTruthy()

      const list = getByRole('list', { name: 'requests.openRequests' })
      expect(list.tagName).toBe('UL')
      expect(list.getAttribute('aria-labelledby')).toBe(heading.id)

      const items = list.querySelectorAll(':scope > li')
      expect(items.length).toBe(2)
    })
  })

  it('auto-navigates to ActiveSession when user has an active request', async () => {
    const myRequests = [{
      id: 'r1', type: 'walk', status: 'active', message: '',
      requester_id: 'user-a', helper_id: 'user-b',
      pickup_lat: null, pickup_lng: null,
      eligibility_tier: 'any_member', created_at: new Date().toISOString(),
    }]
    requestService.list.mockResolvedValue({ requests: myRequests })

    const { getByTestId } = render(<RequestList currentUserId="user-a" />)
    await waitFor(() => {
      expect(getByTestId('active-session')).toBeTruthy()
    })
  })

  it('draws a visible keyboard focus ring on the resume-active-session banner', async () => {
    // The banner is how a user who has backed out of the full-screen
    // session view rejoins it — safety-critical, so a keyboard user
    // has to be able to see when it is focused. The default browser
    // outline on a green-tinted button is often weak, so a
    // `focus-visible` green ring answers WCAG 2.4.7 without disturbing
    // pointer input.
    const myRequests = [{
      id: 'r1', type: 'walk', status: 'active', message: '',
      requester_id: 'user-a', helper_id: 'user-b',
      pickup_lat: null, pickup_lng: null,
      eligibility_tier: 'any_member', created_at: new Date().toISOString(),
    }]
    requestService.list.mockResolvedValue({ requests: myRequests })

    const { getByTestId, getByText } = render(<RequestList currentUserId="user-a" />)
    // First render takes the user straight into the (mocked) full-screen
    // ActiveSession view — the auto-navigate branch.
    await waitFor(() => expect(getByTestId('active-session')).toBeTruthy())
    // Simulate backing out of it: the mock exposes an onClose button.
    fireEvent.click(getByTestId('active-session-close'))

    // Back on the list, the banner now sits at the top as the one-tap
    // route back in. Read its focus-visible classes.
    await waitFor(() => expect(getByText('requests.activeSession')).toBeTruthy())
    const banner = getByText('requests.activeSession').closest('button')
    expect(banner).toBeTruthy()
    const cls = banner.getAttribute('class') || ''
    expect(cls).toMatch(/focus-visible:ring-2\b/)
    expect(cls).toMatch(/focus-visible:ring-green-600\b/)
    expect(cls).toMatch(/focus-visible:ring-offset-2\b/)
  })
})
