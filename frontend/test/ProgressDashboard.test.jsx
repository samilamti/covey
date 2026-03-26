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

  it('renders loading spinner initially', () => {
    const { container } = render(<ProgressDashboard />)
    const spinner = container.querySelector('.animate-spin')
    expect(spinner).toBeTruthy()
  })
})
