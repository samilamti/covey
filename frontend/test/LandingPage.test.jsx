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

  it('wraps the stub BankID pending indicator in a polite live region', async () => {
    // The pending text flips from "Open BankID" to "Enter your security
    // code" as BankID moves through its hints, and a screen reader
    // otherwise never hears the transition. Mirror BankIDLogin's
    // production path: role="status" + aria-live="polite" so the text
    // is announced without interrupting whatever the user is reading.
    const { fireEvent, waitFor } = await import('@testing-library/preact')
    const { authService } = await import('../src/services/auth')
    // Hold the collect in "pending" so the branch under test stays on
    // screen long enough to assert.
    authService.collect.mockResolvedValue({ status: 'pending', hintCode: 'outstandingTransaction' })
    const { getByText, findByRole } = render(<LandingPage onLogin={vi.fn()} />)
    await fireEvent.click(getByText('landing.loginButton'))
    const status = await findByRole('status')
    await waitFor(() => {
      expect(status.getAttribute('aria-live')).toBe('polite')
      expect(status.textContent).toContain('landing.bankidPending')
    })
  })
})
