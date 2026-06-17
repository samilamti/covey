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
  MapPin: (props) => h('span', { 'data-testid': 'map-pin', ...props }),
}))

const { LocationBanner } = await import('../src/components/LocationBanner')

describe('LocationBanner', () => {
  let consoleErrorSpy

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    expect(consoleErrorSpy).not.toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
  })

  it('renders nothing when error is null', () => {
    const { container } = render(<LocationBanner error={null} />)
    expect(container.innerHTML).toBe('')
  })

  it('shows denied message with retry button when error is "denied"', () => {
    const retry = vi.fn()
    const { getByText } = render(<LocationBanner error="denied" onRetry={retry} />)
    expect(getByText('location.denied')).toBeTruthy()
    expect(getByText('location.retry')).toBeTruthy()
    fireEvent.click(getByText('location.retry'))
    expect(retry).toHaveBeenCalledOnce()
  })

  it('shows unavailable message when error is "unavailable"', () => {
    const { getByText } = render(<LocationBanner error="unavailable" />)
    expect(getByText('location.unavailable')).toBeTruthy()
  })

  it('shows timeout message as unavailable', () => {
    const { getByText } = render(<LocationBanner error="timeout" />)
    expect(getByText('location.unavailable')).toBeTruthy()
  })

  it('uses warning colors when severity is "warning"', () => {
    const { container } = render(<LocationBanner error="denied" severity="warning" />)
    const banner = container.firstChild
    expect(banner.className).toContain('bg-red-50')
    expect(banner.className).toContain('border-red-200')
  })

  it('uses info colors by default', () => {
    const { container } = render(<LocationBanner error="denied" />)
    const banner = container.firstChild
    expect(banner.className).toContain('bg-blue-50')
    expect(banner.className).toContain('border-blue-200')
  })

  it('hides retry button when onRetry is not provided', () => {
    const { queryByText } = render(<LocationBanner error="denied" />)
    expect(queryByText('location.retry')).toBeNull()
  })
})
