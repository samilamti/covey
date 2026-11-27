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

vi.mock('../src/services/gdpr', () => ({
  gdprService: {
    exportData: vi.fn().mockResolvedValue({ user: {}, requests: [] }),
  },
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
    announceSpy.mockClear()
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
    const { container } = render(<ProfileView user={user} onLogout={vi.fn()} />)
    const labels = container.querySelectorAll('label')
    for (const el of labels) {
      const forAttr = el.getAttribute('for')
      expect(forAttr, `expected every <label> to have a for="" target, offender: ${el.outerHTML}`).toBeTruthy()
      // Use getElementById rather than CSS.escape — jsdom's global CSS is
      // undefined, and the real DOM uses getElementById under the hood too.
      expect(container.ownerDocument.getElementById(forAttr)).toBeTruthy()
    }
  })

  it('announces a translated save confirmation (not a bare ✓)', async () => {
    const { fireEvent } = await import('@testing-library/preact')
    const { getByText, findByText } = render(<ProfileView user={user} onLogout={vi.fn()} />)
    await fireEvent.click(getByText('profile.save'))
    expect(await findByText('profile.saved')).toBeTruthy()
  })

  it('routes save success through the global announcer as polite', async () => {
    const { fireEvent } = await import('@testing-library/preact')
    const { container, getByText } = render(<ProfileView user={user} onLogout={vi.fn()} />)
    await fireEvent.click(getByText('profile.save'))
    await new Promise((r) => setTimeout(r, 0))
    expect(announceSpy).toHaveBeenCalledWith('profile.saved', { assertive: false })
    expect(container.textContent).toContain('profile.saved')
    expect(inLiveRegion(container, 'profile.saved')).toBe(false)
  })

  it('exposes visible badges as a labelled list, not a stack of divs', async () => {
    profileService.get.mockResolvedValueOnce({
      user: {
        safetyScore: 3,
        isGuardian: false,
        badges: [
          { badge_key: 'first_session', visible: true },
          { badge_key: 'helper_5', visible: true },
        ],
      },
    })
    const { container, findByText } = render(<ProfileView user={user} onLogout={vi.fn()} />)
    await findByText('progress.badge.first_session')
    const lists = container.querySelectorAll('ul[aria-label="progress.badges"]')
    expect(lists).toHaveLength(1)
    const items = lists[0].querySelectorAll('li')
    expect(items).toHaveLength(2)
    expect(lists[0].getAttribute('role')).toBe('list')
  })

  it('does not render hidden badges in the public row', async () => {
    profileService.get.mockResolvedValueOnce({
      user: {
        safetyScore: 3,
        isGuardian: false,
        badges: [
          { badge_key: 'first_session', visible: true },
          { badge_key: 'helper_5', visible: false },
        ],
      },
    })
    const { container, findByText, queryByText } = render(<ProfileView user={user} onLogout={vi.fn()} />)
    await findByText('progress.badge.first_session')
    const list = container.querySelector('ul[aria-label="progress.badges"]')
    expect(list).toBeTruthy()
    expect(list.querySelectorAll('li')).toHaveLength(1)
    expect(queryByText('progress.badge.helper_5')).toBeNull()
  })

  it('routes save failure through the global announcer as assertive', async () => {
    const { fireEvent } = await import('@testing-library/preact')
    profileService.update.mockRejectedValueOnce(new Error('nope'))
    const { container, getByText } = render(<ProfileView user={user} onLogout={vi.fn()} />)
    await fireEvent.click(getByText('profile.save'))
    await new Promise((r) => setTimeout(r, 0))
    expect(announceSpy).toHaveBeenCalledWith('app.error', { assertive: true })
    expect(container.textContent).toContain('app.error')
    expect(inLiveRegion(container, 'app.error')).toBe(false)
  })
})
