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
  Shield: () => h('span', null, 'Shield'),
  Download: () => h('span', null, 'Download'),
  Trash2: () => h('span', null, 'Trash2'),
  Save: () => h('span', null, 'Save'),
}))

vi.mock('../src/services/profile', () => ({
  profileService: {
    get: vi.fn().mockResolvedValue({ user: { safetyScore: 3, isGuardian: false } }),
    update: vi.fn().mockResolvedValue({}),
    deleteAccount: vi.fn().mockResolvedValue({}),
  },
}))

const { ProfileView } = await import('../src/components/ProfileView')

describe('ProfileView', () => {
  let consoleErrorSpy

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.clearAllMocks()
  })

  afterEach(() => {
    expect(consoleErrorSpy).not.toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
  })

  const user = { userId: 'u1', displayName: 'TestUser', name: 'Test User' }

  it('renders profile title', () => {
    const { getByText } = render(<ProfileView user={user} onLogout={vi.fn()} />)
    expect(getByText('profile.title')).toBeTruthy()
  })

  it('renders verified badge', () => {
    const { getByText } = render(<ProfileView user={user} onLogout={vi.fn()} />)
    expect(getByText('profile.verified')).toBeTruthy()
  })

  it('renders display name input with user name', () => {
    const { container } = render(<ProfileView user={user} onLogout={vi.fn()} />)
    const input = container.querySelector('input[type="text"]')
    expect(input).toBeTruthy()
    expect(input.value).toBe('TestUser')
  })

  it('renders GDPR export button', () => {
    const { getByText } = render(<ProfileView user={user} onLogout={vi.fn()} />)
    expect(getByText('profile.gdprExport')).toBeTruthy()
  })

  it('renders delete account button', () => {
    const { getByText } = render(<ProfileView user={user} onLogout={vi.fn()} />)
    expect(getByText('profile.deleteAccount')).toBeTruthy()
  })

  it('renders logout button', () => {
    const { getByText } = render(<ProfileView user={user} onLogout={vi.fn()} />)
    expect(getByText('app.logout')).toBeTruthy()
  })
})
