import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent } from '@testing-library/preact'
import { h } from 'preact'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
    i18n: { language: 'sv', changeLanguage: vi.fn() },
  }),
}))

vi.mock('lucide-preact', () => ({
  Trophy: (props) => h('span', null, 'Trophy'),
  CircleUser: (props) => h('span', null, 'CircleUser'),
}))

vi.mock('../src/context/FeatureFlagContext', () => ({
  useFeatureFlag: () => false,
}))

const { BottomNav } = await import('../src/components/BottomNav')

describe('BottomNav', () => {
  let consoleErrorSpy

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    expect(consoleErrorSpy).not.toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
  })

  it('renders two tab buttons', () => {
    const { getAllByRole } = render(
      <BottomNav currentPath="/requests" onNavigate={vi.fn()} />
    )
    expect(getAllByRole('button')).toHaveLength(2)
  })

  it('displays translated labels', () => {
    const { getByText } = render(
      <BottomNav currentPath="/requests" onNavigate={vi.fn()} />
    )
    expect(getByText('nav.requests')).toBeTruthy()
    expect(getByText('nav.profile')).toBeTruthy()
  })

  it('applies active styling to current path', () => {
    const { getAllByRole } = render(
      <BottomNav currentPath="/requests" onNavigate={vi.fn()} />
    )
    // Active/inactive colour lives on the icon-pill + label spans inside each tab.
    const buttons = getAllByRole('button')
    expect(buttons[0].innerHTML).toContain('text-indigo-600')
    expect(buttons[1].innerHTML).toContain('text-gray-400')
  })

  it('calls onNavigate with /profile when profile tab clicked', async () => {
    const onNavigate = vi.fn()
    const { getByText } = render(
      <BottomNav currentPath="/requests" onNavigate={onNavigate} />
    )
    await fireEvent.click(getByText('nav.profile'))
    expect(onNavigate).toHaveBeenCalledWith('/profile')
  })

  it('calls onNavigate with /requests when requests tab clicked', async () => {
    const onNavigate = vi.fn()
    const { getByText } = render(
      <BottomNav currentPath="/profile" onNavigate={onNavigate} />
    )
    await fireEvent.click(getByText('nav.requests'))
    expect(onNavigate).toHaveBeenCalledWith('/requests')
  })
})
