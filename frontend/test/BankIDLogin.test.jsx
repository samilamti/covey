import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, waitFor } from '@testing-library/preact'
import { h } from 'preact'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key, i18n: { language: 'sv' } }),
}))

vi.mock('lucide-preact', () => ({
  ShieldCheck: (props) => h('span', props, 'ShieldCheck'),
  Loader2: (props) => h('span', props, 'Loader2'),
  Smartphone: (props) => h('span', props, 'Smartphone'),
}))

const authService = {
  login: vi.fn(),
  qr: vi.fn().mockResolvedValue({ qr: 'bankid.67df3917.0.abc123' }),
  collect: vi.fn(),
  cancel: vi.fn().mockResolvedValue({ ok: true }),
}
vi.mock('../src/services/auth', () => ({ authService }))

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

const { BankIDLogin } = await import('../src/components/BankIDLogin')

describe('BankIDLogin (Secure Start)', () => {
  let consoleErrorSpy
  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.clearAllMocks()
    announceSpy.mockClear()
    authService.qr.mockResolvedValue({ qr: 'bankid.67df3917.0.abc123' })
    authService.cancel.mockResolvedValue({ ok: true })
  })
  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  it('shows the BankID login button initially (no personnummer field)', () => {
    const { getByText, container } = render(<BankIDLogin onLogin={vi.fn()} />)
    expect(getByText('landing.loginButton')).toBeTruthy()
    expect(container.querySelector('input')).toBeNull() // v6 has no NIN entry
  })

  it('starts Secure Start: renders the QR, scan hint, and autostart link', async () => {
    authService.login.mockResolvedValue({ orderRef: 'o1', autoStartToken: 'ast-xyz' })
    authService.collect.mockResolvedValue({ status: 'pending', hintCode: 'outstandingTransaction' })

    const { getByText, container } = render(<BankIDLogin onLogin={vi.fn()} pollMs={30} qrMs={30} />)
    fireEvent.click(getByText('landing.loginButton'))

    await waitFor(() => {
      // client-side QR image — alt is empty so a screen reader doesn't read
      // the untranslated "BankID QR" on every tick; the scan paragraph
      // immediately below it carries the meaning in the user's language.
      const img = container.querySelector('img[alt=""]')
      expect(img).toBeTruthy()
      expect(img.getAttribute('src').startsWith('data:image/gif')).toBe(true)
      // scan instruction
      expect(getByText('landing.bankidScan')).toBeTruthy()
      // same-device autostart link carries the token
      const link = container.querySelector('a[href*="autostarttoken=ast-xyz"]')
      expect(link).toBeTruthy()
    })
    expect(authService.login).toHaveBeenCalled()
  })

  it('calls onLogin with the verified user + token when collect completes', async () => {
    authService.login.mockResolvedValue({ orderRef: 'o1', autoStartToken: 'ast-xyz' })
    const user = { userId: 'u1', name: 'Anna Andersson' }
    authService.collect.mockResolvedValue({
      status: 'complete',
      completionData: { user, token: 'jwt-token' },
    })
    const onLogin = vi.fn()

    const { getByText } = render(<BankIDLogin onLogin={onLogin} pollMs={30} qrMs={30} />)
    fireEvent.click(getByText('landing.loginButton'))

    await waitFor(() => expect(onLogin).toHaveBeenCalledWith(user, 'jwt-token'))
  })


  it('speaks the pending BankID instruction through the announcer only', async () => {
    // The hint text flips from "Open BankID app" to "Enter your security
    // code" the moment the user opens BankID. The announcer speaks it; the
    // visible line is not a live region, so nothing reads it twice.
    authService.login.mockResolvedValue({ orderRef: 'o1', autoStartToken: 'ast-xyz' })
    authService.collect.mockResolvedValue({ status: 'pending', hintCode: 'outstandingTransaction' })

    const { container, getByText } = render(<BankIDLogin onLogin={vi.fn()} pollMs={30} qrMs={30} />)
    fireEvent.click(getByText('landing.loginButton'))

    await waitFor(() => expect(container.textContent).toContain('landing.bankidPending'))
    expect(inLiveRegion(container, 'landing.bankidPending')).toBe(false)
    expect(announceSpy).toHaveBeenCalledWith('landing.bankidPending')
  })

  it('names the QR placeholder while BankID has not returned the first frame', async () => {
    // Before the first qr() call resolves, the UI shows a plain spinner in a
    // box. Without an accessible name a screen reader user on the login
    // screen hears nothing and cannot tell the device is waiting. The box
    // is marked role="status" with a translated aria-label so a polite
    // live region speaks a real sentence.
    authService.login.mockResolvedValue({ orderRef: 'o1', autoStartToken: 'ast-xyz' })
    authService.collect.mockResolvedValue({ status: 'pending', hintCode: 'outstandingTransaction' })
    // Hold the qr promise open so the placeholder stays on screen through
    // the assertion.
    let resolveQr
    authService.qr.mockReturnValue(new Promise((resolve) => { resolveQr = resolve }))

    const { container, getByText } = render(<BankIDLogin onLogin={vi.fn()} pollMs={30} qrMs={30} />)
    fireEvent.click(getByText('landing.loginButton'))

    await waitFor(() => {
      const placeholder = container.querySelector('div[role="status"]')
      expect(placeholder, 'expected a status region around the QR spinner').toBeTruthy()
      // A live region speaks its text content; an aria-label is never announced.
      expect(placeholder.textContent).toContain('landing.bankidQrLoading')
      expect(placeholder.hasAttribute('aria-label')).toBe(false)
    })
    // Clean up — let the deferred qr settle before the component unmounts
    // so the test doesn't trail an unhandled promise.
    resolveQr({ qr: 'bankid.67df3917.0.abc123' })
  })

  it('shows a cancel message when the order fails with userCancel', async () => {
    authService.login.mockResolvedValue({ orderRef: 'o1', autoStartToken: 'ast-xyz' })
    authService.collect.mockResolvedValue({ status: 'failed', hintCode: 'userCancel' })

    const { getByText } = render(<BankIDLogin onLogin={vi.fn()} pollMs={30} qrMs={30} />)
    fireEvent.click(getByText('landing.loginButton'))

    await waitFor(() => expect(getByText('landing.bankidCancel')).toBeTruthy())
  })

  it('reads the pending-flow cancel button at WCAG AA contrast', async () => {
    authService.login.mockResolvedValue({ orderRef: 'o1', autoStartToken: 'ast-xyz' })
    authService.collect.mockResolvedValue({ status: 'pending', hintCode: 'outstandingTransaction' })

    const { getByText } = render(<BankIDLogin onLogin={vi.fn()} pollMs={30} qrMs={30} />)
    fireEvent.click(getByText('landing.loginButton'))

    // Cancel only renders while the flow is pending, so wait for it.
    const cancelBtn = await waitFor(() => {
      const btn = getByText('requests.cancel')
      return btn.closest('button')
    })
    expect(cancelBtn).toBeTruthy()
    const cls = cancelBtn.getAttribute('class') || ''
    expect(cls).toMatch(/\btext-gray-600\b/)
    expect(cls).not.toMatch(/\btext-gray-400\b/)
  })

  it('routes a failed BankID flow through the global announcer as assertive', async () => {
    // The inline role="alert" error block is mounted together with its text,
    // which VoiceOver often skips. The announcer is the reliable channel.
    // Assertive — the user just tried to sign in and their BankID cancelled
    // or errored; a polite update would be talked over.
    authService.login.mockResolvedValue({ orderRef: 'o1', autoStartToken: 'ast-xyz' })
    authService.collect.mockResolvedValue({ status: 'failed', hintCode: 'expiredTransaction' })

    const { getByText } = render(<BankIDLogin onLogin={vi.fn()} pollMs={30} qrMs={30} />)
    fireEvent.click(getByText('landing.loginButton'))

    await waitFor(() => expect(announceSpy).toHaveBeenCalledWith('landing.bankidExpired', { assertive: true }))
  })

  it('routes a failed login call through the global announcer as assertive', async () => {
    // A thrown error from authService.login (not a BankID hint code) hits
    // the catch branch that sets a generic error message — same announcer
    // channel.
    authService.login.mockRejectedValueOnce(new Error('network'))
    const { getByText } = render(<BankIDLogin onLogin={vi.fn()} pollMs={30} qrMs={30} />)
    fireEvent.click(getByText('landing.loginButton'))
    await waitFor(() => expect(announceSpy).toHaveBeenCalledWith('landing.bankidError', { assertive: true }))
  })

  it('routes the initial pending instruction through the global announcer (polite)', async () => {
    // The inline role="status" region below the QR is mounted together with
    // its first instruction text, which VoiceOver often skips. The
    // announcer is the reliable channel for that first message. aria-live
    // takes over naturally for the subsequent userCancel → userSign
    // transition, so we only need to seed the first paint. Polite — the
    // user initiated the flow and whatever they were reading before
    // shouldn't be interrupted.
    authService.login.mockResolvedValue({ orderRef: 'o1', autoStartToken: 'ast-xyz' })
    authService.collect.mockResolvedValue({ status: 'pending', hintCode: 'outstandingTransaction' })

    const { getByText } = render(<BankIDLogin onLogin={vi.fn()} pollMs={30} qrMs={30} />)
    fireEvent.click(getByText('landing.loginButton'))

    await waitFor(() => expect(announceSpy).toHaveBeenCalledWith('landing.bankidPending'))
    // Default call shape — no second arg means polite (the useAnnouncer
    // default). We explicitly assert that so an accidental { assertive: true }
    // slip doesn't survive review.
    const call = announceSpy.mock.calls.find((c) => c[0] === 'landing.bankidPending')
    expect(call[1]).toBeUndefined()
  })


  it('announces each pending instruction once, including the hint-code change', async () => {
    // With no inline live region, the announcer has to carry the switch to
    // "Enter your security code" as well, or that transition is silent.
    authService.login.mockResolvedValue({ orderRef: 'o1', autoStartToken: 'ast-xyz' })
    authService.collect
      .mockResolvedValueOnce({ status: 'pending', hintCode: 'outstandingTransaction' })
      .mockResolvedValue({ status: 'pending', hintCode: 'userSign' })

    const { getByText, container } = render(<BankIDLogin onLogin={vi.fn()} pollMs={30} qrMs={30} />)
    fireEvent.click(getByText('landing.loginButton'))

    await waitFor(() => expect(container.textContent).toContain('landing.bankidUserSign'))
    await waitFor(() => {
      const pendingCalls = announceSpy.mock.calls
        .map((c) => c[0])
        .filter((t) => t === 'landing.bankidPending' || t === 'landing.bankidUserSign')
      expect(pendingCalls).toEqual(['landing.bankidPending', 'landing.bankidUserSign'])
    })
  })
})
