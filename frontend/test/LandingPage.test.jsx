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

vi.mock('../src/components/BetaBanner', () => ({
  BetaBanner: () => h('div', { 'data-testid': 'beta-banner' }, 'BetaBanner'),
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

  it('renders the NIN input field', () => {
    const { container } = render(<LandingPage onLogin={vi.fn()} />)
    const input = container.querySelector('input[aria-label="Personnummer"]')
    expect(input).toBeTruthy()
  })

  it('renders the login button', () => {
    const { getByText } = render(<LandingPage onLogin={vi.fn()} />)
    expect(getByText('landing.loginButton')).toBeTruthy()
  })

  it('renders subtitle and description', () => {
    const { getByText } = render(<LandingPage onLogin={vi.fn()} />)
    expect(getByText('landing.subtitle')).toBeTruthy()
    expect(getByText('landing.description')).toBeTruthy()
  })

  it('renders BetaBanner and LanguageSelector', () => {
    const { getByTestId } = render(<LandingPage onLogin={vi.fn()} />)
    expect(getByTestId('beta-banner')).toBeTruthy()
    expect(getByTestId('lang-selector')).toBeTruthy()
  })
})
