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
  Award: () => h('span', null, 'Award'),
  LogOut: () => h('span', null, 'LogOut'),
}))

// Language selector moved into the profile/settings tab; stub it so this unit
// test doesn't pull in its icon + flag dependencies.
vi.mock('../src/components/LanguageSelector', () => ({
  LanguageSelector: () => h('div', null, 'LanguageSelector'),
}))

// Report/block list has its own tests (SafetyActions.test.jsx)
vi.mock('../src/components/SafetyPartners', () => ({
  SafetyPartners: () => h('div', null, 'SafetyPartners'),
}))

vi.mock('../src/services/profile', () => ({
  profileService: {
    get: vi.fn().mockResolvedValue({ user: { safetyScore: 3, isGuardian: false } }),
    update: vi.fn().mockResolvedValue({}),
    deleteAccount: vi.fn().mockResolvedValue({}),
  },
}))

const { ProfileView } = await import('../src/components/ProfileView')
const { profileService } = await import('../src/services/profile')

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

  it('renders the verified badge when the backend reports a BankID-verified user', async () => {
    profileService.get.mockResolvedValueOnce({ user: { safetyScore: 3, isGuardian: false, verified: true } })
    const { findByText } = render(<ProfileView user={user} onLogout={vi.fn()} />)
    expect(await findByText('profile.verified')).toBeTruthy()
  })

  it('hides the verified badge for a stub login (verified false)', async () => {
    profileService.get.mockResolvedValueOnce({ user: { safetyScore: 3, isGuardian: false, verified: false } })
    const { queryByText, findByText } = render(<ProfileView user={user} onLogout={vi.fn()} />)
    // Wait for the profile to load (safety score renders), then assert no badge
    await findByText('profile.safetyScore')
    expect(queryByText('profile.verified')).toBeNull()
  })

  it('hides the verified badge before the profile has loaded', () => {
    const { queryByText } = render(<ProfileView user={user} onLogout={vi.fn()} />)
    expect(queryByText('profile.verified')).toBeNull()
  })

  it('renders display name input with user name', () => {
    const { container } = render(<ProfileView user={user} onLogout={vi.fn()} />)
    const input = container.querySelector('input[type="text"]')
    expect(input).toBeTruthy()
    expect(input.value).toBe('TestUser')
  })

  it('ties the display name label to the input', () => {
    // A <label> sitting next to an <input> only provides an accessible name
    // when `for=id` links them together. Without this, screen readers
    // announce an unnamed edit field on the profile screen.
    const { getByLabelText } = render(<ProfileView user={user} onLogout={vi.fn()} />)
    const input = getByLabelText('profile.displayName')
    expect(input.tagName).toBe('INPUT')
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

  it('does not render the language section header as a dangling <label>', () => {
    // A <label> with no `for` attribute is a malformed accessible-name
    // relationship: a screen reader does not attach it to the picker that
    // follows, so the visible "Language" heading claims to name a control
    // it never reaches. Keep it as a <div> and let the LanguageSelector
    // carry its own accessible name.
    const { container } = render(<ProfileView user={user} onLogout={vi.fn()} />)
    const labels = container.querySelectorAll('label')
    for (const el of labels) {
      // Every surviving <label> must point at a real input/select/textarea
      // (the display-name input in this view). A <label> without `for` is
      // the bug we are guarding against.
      const forAttr = el.getAttribute('for')
      expect(forAttr, `expected every <label> to have a for="" target, offender: ${el.outerHTML}`).toBeTruthy()
      // Use getElementById rather than CSS.escape — jsdom's global CSS is
      // undefined, and the real DOM uses getElementById under the hood too.
      expect(container.ownerDocument.getElementById(forAttr)).toBeTruthy()
    }
  })

  it('announces a translated save confirmation (not a bare ✓)', async () => {
    // Earlier the success text was a bare "✓" glyph, which is silent to
    // assistive tech — the user got no acknowledgement that their edit
    // landed. After this, the surrounding role="status" live region
    // announces a real translated word that each voice reads correctly.
    const { fireEvent } = await import('@testing-library/preact')
    const { getByText, findByText } = render(<ProfileView user={user} onLogout={vi.fn()} />)
    await fireEvent.click(getByText('profile.save'))
    expect(await findByText('profile.saved')).toBeTruthy()
  })
})
