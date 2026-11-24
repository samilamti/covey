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

  it('names the nav landmark so a screen reader can identify it', () => {
    // Without aria-label the <nav> announces as a bare "navigation", which is
    // fine until a second landmark joins the shell and the two become
    // indistinguishable. The label makes it "primary navigation" today and
    // keeps that distinction once sibling landmarks (a drawer, breadcrumbs)
    // arrive.
    const { getByRole } = render(
      <BottomNav currentPath="/requests" onNavigate={vi.fn()} />
    )
    const nav = getByRole('navigation', { name: 'nav.primary' })
    expect(nav).toBeDefined()
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

  it('draws a visible keyboard focus ring on every tab button', () => {
    // The browser default focus outline is often thin or suppressed on
    // mobile Chromium, and the nav bar is the whole app's primary
    // navigation — a keyboard user needs to see which tab is focused.
    // focus-visible so the ring shows only on keyboard focus; ring-inset
    // so it stays inside the fixed-height bar rather than bleeding into
    // the content above. WCAG 2.4.7 Focus Visible.
    const { getAllByRole } = render(
      <BottomNav currentPath="/requests" onNavigate={vi.fn()} />
    )
    const buttons = getAllByRole('button')
    for (const btn of buttons) {
      const cls = btn.getAttribute('class') || ''
      expect(cls).toMatch(/focus-visible:ring-2\b/)
      expect(cls).toMatch(/focus-visible:ring-indigo-500\b/)
      expect(cls).toMatch(/focus-visible:ring-inset\b/)
    }
  })
})
