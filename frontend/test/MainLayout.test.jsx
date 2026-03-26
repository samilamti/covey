import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, waitFor } from '@testing-library/preact'
import { h } from 'preact'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
    i18n: { language: 'sv', changeLanguage: vi.fn() },
  }),
}))

// Track RequestList mount count to detect key-driven re-mounts
let requestListMountCount = 0
vi.mock('../src/components/RequestList', () => ({
  RequestList: ({ currentUserId }) => {
    requestListMountCount++
    return h('div', { 'data-testid': 'request-list', 'data-mount': requestListMountCount }, `RequestList:${currentUserId}`)
  },
}))

vi.mock('../src/components/ProfileView', () => ({
  ProfileView: () => h('div', { 'data-testid': 'profile-view' }, 'ProfileView'),
}))

vi.mock('../src/components/LanguageSelector', () => ({
  LanguageSelector: () => h('div', null, 'LanguageSelector'),
}))

vi.mock('../src/components/InstallPrompt', () => ({
  InstallPrompt: () => null,
}))

vi.mock('../src/components/BottomNav', () => ({
  BottomNav: ({ currentPath, onNavigate }) =>
    h('div', { 'data-testid': 'bottom-nav' },
      h('button', { onClick: () => onNavigate('/profile'), 'data-testid': 'nav-profile' }, 'Profile'),
      h('button', { onClick: () => onNavigate('/requests'), 'data-testid': 'nav-requests' }, 'Requests'),
    ),
}))

// Socket mock
const listeners = {}
vi.mock('../src/socket', () => ({
  socket: {
    on: vi.fn((event, fn) => { listeners[event] = listeners[event] || []; listeners[event].push(fn) }),
    off: vi.fn((event, fn) => {
      if (listeners[event]) listeners[event] = listeners[event].filter((f) => f !== fn)
    }),
  },
}))

const { MainLayout } = await import('../src/components/MainLayout')
const { socket } = await import('../src/socket')

describe('MainLayout', () => {
  let consoleErrorSpy
  const user = { userId: 'u1', name: 'Test' }

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.clearAllMocks()
    Object.keys(listeners).forEach((k) => delete listeners[k])
    requestListMountCount = 0
  })

  afterEach(() => {
    expect(consoleErrorSpy).not.toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
  })

  it('renders "Covey" header', () => {
    const { getByText } = render(<MainLayout user={user} onLogout={vi.fn()} />)
    expect(getByText('Covey')).toBeTruthy()
  })

  it('renders RequestList by default', () => {
    const { getByTestId } = render(<MainLayout user={user} onLogout={vi.fn()} />)
    expect(getByTestId('request-list')).toBeTruthy()
  })

  it('does not render ProfileView initially', () => {
    const { queryByTestId } = render(<MainLayout user={user} onLogout={vi.fn()} />)
    expect(queryByTestId('profile-view')).toBeNull()
  })

  it('navigates to ProfileView when profile tab clicked', async () => {
    const { getByTestId, queryByTestId } = render(
      <MainLayout user={user} onLogout={vi.fn()} />
    )
    await fireEvent.click(getByTestId('nav-profile'))
    expect(getByTestId('profile-view')).toBeTruthy()
    expect(queryByTestId('request-list')).toBeNull()
  })

  it('navigates back to RequestList when requests tab clicked', async () => {
    const { getByTestId } = render(
      <MainLayout user={user} onLogout={vi.fn()} />
    )
    await fireEvent.click(getByTestId('nav-profile'))
    await fireEvent.click(getByTestId('nav-requests'))
    expect(getByTestId('request-list')).toBeTruthy()
  })

  it('renders the BottomNav', () => {
    const { getByTestId } = render(<MainLayout user={user} onLogout={vi.fn()} />)
    expect(getByTestId('bottom-nav')).toBeTruthy()
  })

  /* ── Persistent socket listeners ── */

  it('registers socket listeners for critical lifecycle events', () => {
    render(<MainLayout user={user} onLogout={vi.fn()} />)
    const onCalls = socket.on.mock.calls.map(([event]) => event)
    expect(onCalls).toContain('request:done-initiated')
    expect(onCalls).toContain('request:accepted')
    expect(onCalls).toContain('connect')
  })

  it('auto-navigates to requests tab on request:done-initiated event', async () => {
    const { getByTestId, queryByTestId } = render(
      <MainLayout user={user} onLogout={vi.fn()} />
    )
    // Navigate to profile first
    await fireEvent.click(getByTestId('nav-profile'))
    expect(queryByTestId('request-list')).toBeNull()

    // Simulate done-initiated event
    listeners['request:done-initiated']?.forEach((fn) => fn({ requestId: 'r1', initiatedBy: 'other' }))

    await waitFor(() => {
      expect(getByTestId('request-list')).toBeTruthy()
    })
  })

  it('auto-navigates to requests tab on request:accepted event', async () => {
    const { getByTestId, queryByTestId } = render(
      <MainLayout user={user} onLogout={vi.fn()} />
    )
    await fireEvent.click(getByTestId('nav-profile'))
    expect(queryByTestId('request-list')).toBeNull()

    listeners['request:accepted']?.forEach((fn) => fn({ request: { id: 'r1' } }))

    await waitFor(() => {
      expect(getByTestId('request-list')).toBeTruthy()
    })
  })

  it('re-mounts RequestList on socket reconnect', async () => {
    const { getByTestId } = render(<MainLayout user={user} onLogout={vi.fn()} />)
    const initialMount = getByTestId('request-list').getAttribute('data-mount')

    // Simulate socket reconnect
    listeners['connect']?.forEach((fn) => fn())

    await waitFor(() => {
      const newMount = getByTestId('request-list').getAttribute('data-mount')
      expect(Number(newMount)).toBeGreaterThan(Number(initialMount))
    })
  })

  it('re-mounts RequestList on visibilitychange', async () => {
    const { getByTestId } = render(<MainLayout user={user} onLogout={vi.fn()} />)
    const initialMount = getByTestId('request-list').getAttribute('data-mount')

    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))

    await waitFor(() => {
      const newMount = getByTestId('request-list').getAttribute('data-mount')
      expect(Number(newMount)).toBeGreaterThan(Number(initialMount))
    })
  })

  it('does not re-mount RequestList on request:accepted when already on requests tab', async () => {
    const { getByTestId } = render(<MainLayout user={user} onLogout={vi.fn()} />)
    const initialMount = getByTestId('request-list').getAttribute('data-mount')

    // Fire request:accepted while already on requests tab
    listeners['request:accepted']?.forEach((fn) => fn({ requestId: 'r1' }))

    // Wait a tick to let any potential state updates flush
    await waitFor(() => {
      const currentMount = getByTestId('request-list').getAttribute('data-mount')
      expect(Number(currentMount)).toBe(Number(initialMount))
    })
  })

  it('does not re-mount RequestList on request:done-initiated when already on requests tab', async () => {
    const { getByTestId } = render(<MainLayout user={user} onLogout={vi.fn()} />)
    const initialMount = getByTestId('request-list').getAttribute('data-mount')

    // Fire done-initiated while already on requests tab
    listeners['request:done-initiated']?.forEach((fn) => fn({ requestId: 'r1', initiatedBy: 'other' }))

    // Wait a tick to let any potential state updates flush
    await waitFor(() => {
      const currentMount = getByTestId('request-list').getAttribute('data-mount')
      expect(Number(currentMount)).toBe(Number(initialMount))
    })
  })

  it('cleans up socket listeners on unmount', () => {
    const { unmount } = render(<MainLayout user={user} onLogout={vi.fn()} />)
    unmount()

    const offCalls = socket.off.mock.calls.map(([event]) => event)
    expect(offCalls).toContain('request:done-initiated')
    expect(offCalls).toContain('request:accepted')
    expect(offCalls).toContain('connect')
  })
})
