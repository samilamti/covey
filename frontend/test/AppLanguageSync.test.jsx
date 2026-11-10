/**
 * App keeps the account's preferred_lang (the language push notifications are
 * written in) in step with the language on screen while someone is signed in.
 * The decision logic is in test/language-sync.test.js; this covers the wiring.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, waitFor, fireEvent } from '@testing-library/preact'
import { h } from 'preact'

// A stand-in i18next that records languageChanged listeners so a test can
// fire the event the language picker would.
const i18nState = vi.hoisted(() => ({ language: 'sv', handlers: new Set() }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
    i18n: {
      get language() { return i18nState.language },
      changeLanguage: vi.fn(),
      on: (event, fn) => { if (event === 'languageChanged') i18nState.handlers.add(fn) },
      off: (event, fn) => { if (event === 'languageChanged') i18nState.handlers.delete(fn) },
    },
  }),
}))

const switchLanguage = (lng) => {
  i18nState.language = lng
  for (const fn of [...i18nState.handlers]) fn(lng)
}

vi.mock('../src/components/LandingPage', () => ({
  LandingPage: ({ onLogin }) =>
    h('div', { 'data-testid': 'landing' },
      h('button', {
        'data-testid': 'login-btn',
        onClick: () => onLogin({ userId: 'u1', name: 'Test', preferredLang: 'sv' }, 'tok123'),
      }, 'Login'),
    ),
}))

vi.mock('../src/components/MainLayout', () => ({
  MainLayout: ({ onLogout }) =>
    h('div', { 'data-testid': 'main-layout' },
      h('button', { 'data-testid': 'logout-btn', onClick: onLogout }, 'Logout'),
    ),
}))

vi.mock('../src/context/FeatureFlagContext', () => ({
  FeatureFlagProvider: ({ children }) => h('div', null, children),
}))

vi.mock('../src/socket', () => ({
  socket: { on: vi.fn(), off: vi.fn(), connect: vi.fn(), disconnect: vi.fn(), auth: null },
}))

vi.mock('../src/services/auth', () => ({ authService: { verify: vi.fn() } }))
vi.mock('../src/services/notifications', () => ({ subscribeToPush: vi.fn().mockResolvedValue({}) }))
vi.mock('../src/services/profile', () => ({
  profileService: { update: vi.fn().mockResolvedValue({}) },
}))

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
const { profileService } = await import('../src/services/profile')

describe('App language sync', () => {
  let logSpy

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.clearAllMocks()
    Object.keys(store).forEach((k) => delete store[k])
    i18nState.language = 'sv'
    i18nState.handlers.clear()
  })

  afterEach(() => { logSpy.mockRestore() })

  it('saves the screen language on session restore when the server holds another', async () => {
    store.token = 'stored-tok'
    i18nState.language = 'en'
    authService.verify.mockResolvedValue({ user: { userId: 'u1', name: 'Test', preferredLang: 'sv' } })

    render(<App />)

    await waitFor(() => {
      expect(profileService.update).toHaveBeenCalledWith({ preferredLang: 'en' })
    })
  })

  it('makes no request on restore when the two already agree', async () => {
    store.token = 'stored-tok'
    i18nState.language = 'fi'
    authService.verify.mockResolvedValue({ user: { userId: 'u1', name: 'Test', preferredLang: 'fi' } })

    const { findByTestId } = render(<App />)
    await findByTestId('main-layout')

    expect(profileService.update).not.toHaveBeenCalled()
  })

  it('saves a language picked after sign-in', async () => {
    const { getByTestId, findByTestId } = render(<App />)
    await fireEvent.click(await findByTestId('login-btn'))
    await findByTestId('main-layout')
    expect(profileService.update).not.toHaveBeenCalled()

    switchLanguage('ar')

    await waitFor(() => {
      expect(profileService.update).toHaveBeenCalledWith({ preferredLang: 'ar' })
    })
    expect(getByTestId('main-layout')).toBeTruthy()
  })

  it('saves a language picked on the landing page once the person signs in', async () => {
    const { findByTestId } = render(<App />)
    await findByTestId('landing')

    switchLanguage('uk')
    // Nobody is signed in yet, so there is no account to save it to.
    expect(profileService.update).not.toHaveBeenCalled()

    await fireEvent.click(await findByTestId('login-btn'))

    await waitFor(() => {
      expect(profileService.update).toHaveBeenCalledWith({ preferredLang: 'uk' })
    })
  })

  it('stops listening after sign-out', async () => {
    const { findByTestId } = render(<App />)
    await fireEvent.click(await findByTestId('login-btn'))
    await fireEvent.click(await findByTestId('logout-btn'))
    await findByTestId('landing')

    expect(i18nState.handlers.size).toBe(0)
    switchLanguage('pl')
    expect(profileService.update).not.toHaveBeenCalled()
  })
})
