import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/preact'
import { h } from 'preact'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
    i18n: { language: 'sv', changeLanguage: vi.fn() },
  }),
}))

vi.mock('lucide-preact', () => ({
  ShieldCheck: () => h('span', null, 'ShieldCheck'),
  Users: () => h('span', null, 'Users'),
  Loader2: () => h('span', null, 'Loader2'),
  ExternalLink: () => h('span', null, 'ExternalLink'),
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

vi.mock('../src/services/auth', () => ({
  authService: {
    login: vi.fn().mockResolvedValue({ orderRef: 'order-123' }),
    collect: vi.fn().mockResolvedValue({
      status: 'complete',
      completionData: { user: { userId: 'u1' }, token: 'tok' },
    }),
  },
}))

vi.mock('../src/components/LanguageSelector', () => ({
  LanguageSelector: () => h('div', { 'data-testid': 'lang-selector' }, 'LanguageSelector'),
}))

const { LandingPage } = await import('../src/components/LandingPage')

describe('LandingPage', () => {
  let consoleErrorSpy

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.clearAllMocks()
    announceSpy.mockClear()
  })

  afterEach(() => {
    expect(consoleErrorSpy).not.toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
  })

  it('renders the landing page title', () => {
    const { getByText } = render(<LandingPage onLogin={vi.fn()} />)
    expect(getByText('landing.title')).toBeTruthy()
  })

  it('renders the NIN input field with a translated aria-label', () => {
    // aria-label was previously hardcoded in Swedish — screen readers for
    // non-Swedish users had no idea what the input was for. It now goes
    // through t('landing.ninLabel'), which is keyed in all 12 locales.
    const { container } = render(<LandingPage onLogin={vi.fn()} />)
    const input = container.querySelector('input[aria-label="landing.ninLabel"]')
    expect(input).toBeTruthy()
  })

  it('renders the login button', () => {
    const { getByText } = render(<LandingPage onLogin={vi.fn()} />)
    expect(getByText('landing.loginButton')).toBeTruthy()
  })

  it('renders description', () => {
    const { getByText } = render(<LandingPage onLogin={vi.fn()} />)
    expect(getByText('landing.description')).toBeTruthy()
  })

  it('renders LanguageSelector', () => {
    const { getByTestId } = render(<LandingPage onLogin={vi.fn()} />)
    expect(getByTestId('lang-selector')).toBeTruthy()
  })

  it('routes a failed login through the global announcer as assertive', async () => {
    // The inline role="alert" error block is mounted together with its text,
    // which VoiceOver often skips. The announcer is the reliable channel.
    // Assertive — the user just tried to sign in and nothing happened; a
    // quiet update would leave them with no feedback.
    const { fireEvent, waitFor } = await import('@testing-library/preact')
    const { authService } = await import('../src/services/auth')
    authService.login.mockRejectedValueOnce(new Error('BankID unavailable'))
    const { getByText } = render(<LandingPage onLogin={vi.fn()} />)
    await fireEvent.click(getByText('landing.loginButton'))
    // The catch sets error to the translated landing.bankidError key, not
    // the raw Error message — the component owns its own user-facing copy.
    await waitFor(() => expect(announceSpy).toHaveBeenCalledWith('landing.bankidError', { assertive: true }))
  })


  it('shows the stub BankID pending text outside any inline live region', async () => {
    // The announcer speaks the pending text (and each change to it); the
    // visible block is not a live region, so nothing is read twice.
    const { fireEvent, waitFor } = await import('@testing-library/preact')
    const { authService } = await import('../src/services/auth')
    authService.collect.mockResolvedValue({ status: 'pending', hintCode: 'outstandingTransaction' })
    const { container, getByText } = render(<LandingPage onLogin={vi.fn()} />)
    await fireEvent.click(getByText('landing.loginButton'))
    await waitFor(() => expect(container.textContent).toContain('landing.bankidPending'))
    expect(inLiveRegion(container, 'landing.bankidPending')).toBe(false)
  })

  it('routes the initial pending instruction through the global announcer (polite)', async () => {
    // The inline role="status" region above is mounted together with its
    // first instruction text, which VoiceOver often skips. The announcer
    // seeds the first paint; aria-live takes over for subsequent hint-code
    // transitions so VoiceOver doesn't read the same line twice. Mirrors
    // the BankIDLogin fix for the real flow — this test covers the stub
    // path that ships in local dev (FEATURE_BANKID_AUTH off). Polite — the
    // user initiated the sign-in, whatever they were reading shouldn't be
    // interrupted.
    const { fireEvent, waitFor } = await import('@testing-library/preact')
    const { authService } = await import('../src/services/auth')
    authService.collect.mockResolvedValue({ status: 'pending', hintCode: 'outstandingTransaction' })
    const { getByText } = render(<LandingPage onLogin={vi.fn()} />)
    await fireEvent.click(getByText('landing.loginButton'))
    // The announcer is invoked without an opts arg (default polite); we
    // explicitly assert that so an accidental assertive slip is caught.
    await waitFor(() => {
      const call = announceSpy.mock.calls.find((c) => c[0] === 'landing.bankidPending')
      expect(call).toBeTruthy()
      expect(call[1]).toBeUndefined()
    })
  })
  it('announces the change to "enter your security code" in the stub flow', async () => {
    // With no inline live region the announcer carries the hint change too.
    // The stub flow polls once a second.
    const { fireEvent, waitFor } = await import('@testing-library/preact')
    const { authService } = await import('../src/services/auth')
    authService.collect.mockResolvedValue({ status: 'pending', hintCode: 'userSign' })
    const { getByText } = render(<LandingPage onLogin={vi.fn()} />)
    await fireEvent.click(getByText('landing.loginButton'))
    await waitFor(() => {
      const said = announceSpy.mock.calls.map((c) => c[0])
      expect(said).toContain('landing.bankidPending')
      expect(said).toContain('landing.bankidUserSign')
    }, { timeout: 3000 })
  })
})
