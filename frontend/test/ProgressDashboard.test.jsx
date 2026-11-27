import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, waitFor } from '@testing-library/preact'
import { h } from 'preact'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, params) => (params ? `${key}:${JSON.stringify(params)}` : key),
    i18n: { language: 'sv', changeLanguage: vi.fn() },
  }),
}))

vi.mock('lucide-preact', () => ({
  Trophy: () => h('span', null, 'Trophy'),
  Star: () => h('span', null, 'Star'),
  Award: () => h('span', null, 'Award'),
  Lock: () => h('span', null, 'Lock'),
  Eye: () => h('span', null, 'Eye'),
  EyeOff: () => h('span', null, 'EyeOff'),
  HelpCircle: () => h('span', null, 'HelpCircle'),
  Heart: () => h('span', null, 'Heart'),
}))

const mockSummary = {
  totalPoints: 42,
  totalSessions: 5,
  helperSessions: 3,
  requesterSessions: 2,
  badgesEarned: 2,
  badgesTotal: 7,
}

const mockBadges = {
  badges: [
    { key: 'first_session', earned: true, earnedAt: '2026-03-20T10:00:00Z', visible: false },
    { key: 'helper_5', earned: false, earnedAt: null, visible: false },
    { key: 'helper_20', earned: false, earnedAt: null, visible: false },
    { key: 'helper_50', earned: false, earnedAt: null, visible: false },
    { key: 'points_50', earned: false, earnedAt: null, visible: false },
    { key: 'points_200', earned: false, earnedAt: null, visible: false },
    { key: 'points_500', earned: false, earnedAt: null, visible: false },
  ],
}

const mockHistory = {
  history: [
    { id: 'p1', role: 'helper', points: 10, reason: 'session_completed', created_at: '2026-03-20T10:00:00Z' },
    { id: 'p2', role: 'requester', points: 3, reason: 'session_completed', created_at: '2026-03-19T10:00:00Z' },
  ],
}

vi.mock('../src/services/points', () => ({
  pointsService: {
    getSummary: vi.fn().mockResolvedValue(mockSummary),
    getBadges: vi.fn().mockResolvedValue(mockBadges),
    getHistory: vi.fn().mockResolvedValue(mockHistory),
    setBadgeVisibility: vi.fn().mockResolvedValue({ ok: true }),
  },
}))

const { ProgressDashboard } = await import('../src/components/ProgressDashboard')

describe('ProgressDashboard', () => {
  let consoleErrorSpy

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.clearAllMocks()
  })

  afterEach(() => {
    expect(consoleErrorSpy).not.toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
  })

  it('renders progress title', async () => {
    const { getByText } = render(<ProgressDashboard />)
    await waitFor(() => {
      expect(getByText('progress.title')).toBeTruthy()
    })
  })

  it('names the loading state so a screen reader knows the tab is working', () => {
    // Before this, the loading branch rendered only a spinning div with no
    // text or accessible name — a blind user hitting the Progress tab
    // heard nothing between navigation and the first content paint. A
    // status region speaks its text content, never an aria-label, so the
    // word has to be in the region as (visually hidden) text.
    const { container } = render(<ProgressDashboard />)
    const status = container.querySelector('div[role="status"][aria-live="polite"]')
    expect(status, 'expected a status region around the progress spinner').toBeTruthy()
    expect(status.textContent).toContain('app.loading')
    expect(status.hasAttribute('aria-label')).toBe(false)
  })

  it('renders total points after loading', async () => {
    const { getByText } = render(<ProgressDashboard />)
    await waitFor(() => {
      expect(getByText('42')).toBeTruthy()
    })
  })

  it('renders session counts after loading', async () => {
    const { getByText } = render(<ProgressDashboard />)
    await waitFor(() => {
      expect(getByText('3')).toBeTruthy()  // helperSessions
      expect(getByText('2')).toBeTruthy()  // requesterSessions
    })
  })

  it('renders badges section header', async () => {
    const { getByText } = render(<ProgressDashboard />)
    await waitFor(() => {
      expect(getByText('progress.badges')).toBeTruthy()
    })
  })

  it('renders badge names', async () => {
    const { getByText } = render(<ProgressDashboard />)
    await waitFor(() => {
      expect(getByText('progress.badge.first_session')).toBeTruthy()
      expect(getByText('progress.badge.helper_5')).toBeTruthy()
    })
  })

  it('renders recent activity', async () => {
    const { getByText } = render(<ProgressDashboard />)
    await waitFor(() => {
      expect(getByText('progress.asHelper')).toBeTruthy()
      expect(getByText('progress.asRequester')).toBeTruthy()
    })
  })

  it('reads the activity-row date at WCAG AA contrast', async () => {
    const { container } = render(<ProgressDashboard />)
    // Format the fixture date exactly as the component does so the
    // test survives moving between runners with different locales.
    const expected = new Date('2026-03-20T10:00:00Z').toLocaleDateString()
    await waitFor(() => {
      expect(container.textContent).toContain(expected)
    })
    const dateSpan = Array.from(container.querySelectorAll('span'))
      .find((el) => el.textContent === expected)
    expect(dateSpan, 'expected a <span> with just the date text').toBeTruthy()
    const cls = dateSpan.getAttribute('class') || ''
    expect(cls).toMatch(/\btext-gray-500\b/)
    expect(cls).not.toMatch(/\btext-gray-400\b/)
  })

  it('renders loading spinner initially', () => {
    const { container } = render(<ProgressDashboard />)
    const spinner = container.querySelector('.animate-spin')
    expect(spinner).toBeTruthy()
  })

  it('marks locked badges with a visually hidden "locked" label', async () => {
    // Earned and locked badges are distinguished by colour and a padlock
    // icon, neither of which reaches a screen reader (colour is not a
    // signal; lucide hides the icon). Without this a blind user hears
    // every badge name identically and cannot tell which goals they have
    // met. sr-only text next to each locked badge name fixes it in all
    // 12 languages at once via the existing locale key.
    const { container } = render(<ProgressDashboard />)
    await waitFor(() => {
      expect(container.textContent).toContain('progress.badge.first_session')
    })
    const srOnlyLocked = Array.from(container.querySelectorAll('span.sr-only'))
      .filter((n) => n.textContent.includes('progress.locked'))
    // The fixture has 6 locked badges and 1 earned, so we expect 6 tags.
    expect(srOnlyLocked.length).toBe(6)
    // The earned badge (first_session) must NOT carry the locked label.
    const earnedSpan = Array.from(container.querySelectorAll('span'))
      .find((n) => n.textContent.includes('progress.badge.first_session'))
    expect(earnedSpan).toBeTruthy()
    expect(earnedSpan.textContent).not.toContain('progress.locked')
  })

  it('names the icon-only badge visibility toggle', async () => {
    // The button holds only an Eye/EyeOff icon, so its name has to come from
    // an attribute. It says what a tap does, which is why it must not also
    // carry aria-pressed: "Show on profile, pressed" would read as a
    // contradiction.
    const { getByLabelText } = render(<ProgressDashboard />)
    const toggle = await waitFor(() => getByLabelText('progress.showOnProfile'))
    expect(toggle.tagName).toBe('BUTTON')
    expect(toggle.hasAttribute('aria-pressed')).toBe(false)
  })

  it('wraps the badges grid in a named list tied to the badges heading', async () => {
    const { container } = render(<ProgressDashboard />)
    const heading = await waitFor(() => {
      const h = Array.from(container.querySelectorAll('h3'))
        .find((n) => n.textContent === 'progress.badges')
      expect(h, 'expected a visible "Badges" heading').toBeTruthy()
      return h
    })
    const list = container.querySelector(`ul[aria-labelledby="${heading.id}"]`)
    expect(list, 'expected a <ul> tied to the badges heading via aria-labelledby').toBeTruthy()
    expect(list.getAttribute('role')).toBe('list')
    // Fixture has 7 badges, each must be an <li> directly inside the list.
    const items = list.querySelectorAll(':scope > li')
    expect(items.length).toBe(7)
  })

  it('wraps the recent-activity entries in a named list tied to their heading', async () => {
    const { container } = render(<ProgressDashboard />)
    const heading = await waitFor(() => {
      const h = Array.from(container.querySelectorAll('h3'))
        .find((n) => n.textContent === 'progress.recentActivity')
      expect(h, 'expected a visible "Recent activity" heading').toBeTruthy()
      return h
    })
    const list = container.querySelector(`ul[aria-labelledby="${heading.id}"]`)
    expect(list, 'expected a <ul> tied to the activity heading').toBeTruthy()
    expect(list.getAttribute('role')).toBe('list')
    // Fixture has 2 activity entries.
    const items = list.querySelectorAll(':scope > li')
    expect(items.length).toBe(2)
  })

  it('gives the badges list and the activity list distinct names', async () => {
    const { container } = render(<ProgressDashboard />)
    await waitFor(() => {
      const h = Array.from(container.querySelectorAll('h3'))
        .find((n) => n.textContent === 'progress.recentActivity')
      expect(h).toBeTruthy()
    })
    const badgesHeading = Array.from(container.querySelectorAll('h3'))
      .find((n) => n.textContent === 'progress.badges')
    const activityHeading = Array.from(container.querySelectorAll('h3'))
      .find((n) => n.textContent === 'progress.recentActivity')
    expect(badgesHeading.id).toBeTruthy()
    expect(activityHeading.id).toBeTruthy()
    expect(badgesHeading.id).not.toBe(activityHeading.id)
  })
})
