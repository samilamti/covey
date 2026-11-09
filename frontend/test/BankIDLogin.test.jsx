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

const { BankIDLogin } = await import('../src/components/BankIDLogin')

describe('BankIDLogin (Secure Start)', () => {
  let consoleErrorSpy
  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.clearAllMocks()
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

  it('announces the pending BankID instruction as a live region', async () => {
    // The hint text flips from "Open BankID app" to "Enter your security
    // code" the moment the user actually opens BankID. Without a live
    // region a screen reader never speaks that transition, so an assistive
    // user has no idea the device is now waiting on them.
    authService.login.mockResolvedValue({ orderRef: 'o1', autoStartToken: 'ast-xyz' })
    authService.collect.mockResolvedValue({ status: 'pending', hintCode: 'outstandingTransaction' })

    const { container, getByText } = render(<BankIDLogin onLogin={vi.fn()} pollMs={30} qrMs={30} />)
    fireEvent.click(getByText('landing.loginButton'))

    await waitFor(() => {
      const live = container.querySelector('[role="status"][aria-live="polite"]')
      expect(live, 'expected the pending instruction to live inside a polite status region').toBeTruthy()
      expect(live.textContent).toContain('landing.bankidPending')
    })
  })

  it('shows a cancel message when the order fails with userCancel', async () => {
    authService.login.mockResolvedValue({ orderRef: 'o1', autoStartToken: 'ast-xyz' })
    authService.collect.mockResolvedValue({ status: 'failed', hintCode: 'userCancel' })

    const { getByText } = render(<BankIDLogin onLogin={vi.fn()} pollMs={30} qrMs={30} />)
    fireEvent.click(getByText('landing.loginButton'))

    await waitFor(() => expect(getByText('landing.bankidCancel')).toBeTruthy())
  })
})
