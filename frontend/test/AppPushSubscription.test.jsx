import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, waitFor } from '@testing-library/preact'
import { h } from 'preact'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
    i18n: { language: 'sv', changeLanguage: vi.fn() },
  }),
}))

vi.mock('../src/components/LandingPage', () => ({
  LandingPage: ({ onLogin }) =>
    h('div', { 'data-testid': 'landing' },
      h('button', { 'data-testid': 'login-btn', onClick: () => onLogin({ userId: 'u1', name: 'Test' }, 'tok123') }, 'Login'),
    ),
}))

vi.mock('../src/components/MainLayout', () => ({
  MainLayout: () => h('div', { 'data-testid': 'main-layout' }, 'MainLayout'),
}))

vi.mock('../src/context/FeatureFlagContext', () => ({
  FeatureFlagProvider: ({ children }) => h('div', null, children),
}))

const socketState = { auth: null }
vi.mock('../src/socket', () => ({
  socket: {
    on: vi.fn(),
    off: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    set auth(v) { socketState.auth = v },
    get auth() { return socketState.auth },
  },
}))

vi.mock('../src/services/auth', () => ({
  authService: {
    verify: vi.fn(),
  },
}))

const subscribeMock = vi.fn().mockResolvedValue({})
vi.mock('../src/services/notifications', () => ({
  subscribeToPush: (...args) => subscribeMock(...args),
}))

// Mock localStorage (jsdom may not provide full API)
const store = {}
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: vi.fn((key) => store[key] ?? null),
    setItem: vi.fn((key, val) => { store[key] = String(val) }),
    removeItem: vi.fn((key) => { delete store[key] }),
  },
  configurable: true,
})

const { App } = await import('../src/App')
const { authService } = await import('../src/services/auth')

describe('App push subscription', () => {
  let consoleErrorSpy
  let consoleLogSpy

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.clearAllMocks()
    Object.keys(store).forEach((k) => delete store[k])
    socketState.auth = null
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
    consoleLogSpy.mockRestore()
  })

  it('calls subscribeToPush after session restore', async () => {
    store.token = 'stored-tok'
    authService.verify.mockResolvedValue({ user: { userId: 'u1', name: 'Test' } })

    render(<App />)

    await waitFor(() => {
      expect(subscribeMock).toHaveBeenCalled()
    })
  })

  it('calls subscribeToPush after fresh login', async () => {
    const { getByTestId } = render(<App />)

    // Wait for loading to finish (no token → shows landing page)
    await waitFor(() => {
      expect(getByTestId('landing')).toBeTruthy()
    })

    // Simulate login
    const { fireEvent } = await import('@testing-library/preact')
    await fireEvent.click(getByTestId('login-btn'))

    await waitFor(() => {
      expect(subscribeMock).toHaveBeenCalled()
    })
  })

  it('handles subscribeToPush failure silently', async () => {
    store.token = 'stored-tok'
    authService.verify.mockResolvedValue({ user: { userId: 'u1', name: 'Test' } })
    subscribeMock.mockRejectedValueOnce(new Error('Permission denied'))

    render(<App />)

    await waitFor(() => {
      expect(subscribeMock).toHaveBeenCalled()
    })

    // Should log, not throw — consoleErrorSpy should NOT have been called
    await waitFor(() => {
      expect(consoleLogSpy).toHaveBeenCalledWith('Push subscription skipped:', 'Permission denied')
    })
  })

  it('does not call subscribeToPush when no user logged in', async () => {
    const { getByTestId } = render(<App />)

    await waitFor(() => {
      expect(getByTestId('landing')).toBeTruthy()
    })

    expect(subscribeMock).not.toHaveBeenCalled()
  })
})
