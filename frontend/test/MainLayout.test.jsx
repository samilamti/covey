import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent } from '@testing-library/preact'
import { h } from 'preact'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
    i18n: { language: 'sv', changeLanguage: vi.fn() },
  }),
}))

vi.mock('../src/components/RequestList', () => ({
  RequestList: ({ currentUserId }) =>
    h('div', { 'data-testid': 'request-list' }, `RequestList:${currentUserId}`),
}))

vi.mock('../src/components/ProfileView', () => ({
  ProfileView: () => h('div', { 'data-testid': 'profile-view' }, 'ProfileView'),
}))

vi.mock('../src/components/LanguageSelector', () => ({
  LanguageSelector: () => h('div', null, 'LanguageSelector'),
}))

vi.mock('../src/components/BetaBanner', () => ({
  BetaBanner: () => h('div', { 'data-testid': 'beta-banner' }, 'BetaBanner'),
}))

vi.mock('../src/components/BottomNav', () => ({
  BottomNav: ({ currentPath, onNavigate }) =>
    h('div', { 'data-testid': 'bottom-nav' },
      h('button', { onClick: () => onNavigate('/profile'), 'data-testid': 'nav-profile' }, 'Profile'),
      h('button', { onClick: () => onNavigate('/requests'), 'data-testid': 'nav-requests' }, 'Requests'),
    ),
}))

const { MainLayout } = await import('../src/components/MainLayout')

describe('MainLayout', () => {
  let consoleErrorSpy
  const user = { userId: 'u1', name: 'Test' }

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    expect(consoleErrorSpy).not.toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
  })

  it('renders "Covey" header', () => {
    const { getByText } = render(<MainLayout user={user} onLogout={vi.fn()} />)
    expect(getByText('Covey')).toBeTruthy()
  })

  it('renders RequestList by default', () => {
    const { getByTestId } = render(<MainLayout user={user} onLogout={vi.fn()} />)
    expect(getByTestId('request-list')).toBeTruthy()
  })

  it('does not render ProfileView initially', () => {
    const { queryByTestId } = render(<MainLayout user={user} onLogout={vi.fn()} />)
    expect(queryByTestId('profile-view')).toBeNull()
  })

  it('navigates to ProfileView when profile tab clicked', async () => {
    const { getByTestId, queryByTestId } = render(
      <MainLayout user={user} onLogout={vi.fn()} />
    )
    await fireEvent.click(getByTestId('nav-profile'))
    expect(getByTestId('profile-view')).toBeTruthy()
    expect(queryByTestId('request-list')).toBeNull()
  })

  it('navigates back to RequestList when requests tab clicked', async () => {
    const { getByTestId } = render(
      <MainLayout user={user} onLogout={vi.fn()} />
    )
    await fireEvent.click(getByTestId('nav-profile'))
    await fireEvent.click(getByTestId('nav-requests'))
    expect(getByTestId('request-list')).toBeTruthy()
  })

  it('renders the BottomNav', () => {
    const { getByTestId } = render(<MainLayout user={user} onLogout={vi.fn()} />)
    expect(getByTestId('bottom-nav')).toBeTruthy()
  })
})
