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

const { LocationBanner } = await import('../src/components/LocationBanner')

describe('LocationBanner', () => {
  let consoleErrorSpy

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    announceSpy.mockClear()
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


  it('gives the warning banner no live role of its own', () => {
    // The announcer speaks it assertively (see below); an inline role="alert"
    // as well would be read twice by screen readers that announce insertions.
    const { container } = render(<LocationBanner error="denied" severity="warning" />)
    expect(container.textContent).toContain('location.denied')
    expect(inLiveRegion(container, 'location.denied')).toBe(false)
  })


  it('gives the informational banner no live role of its own', () => {
    const { container } = render(<LocationBanner error="denied" />)
    expect(container.textContent).toContain('location.denied')
    expect(inLiveRegion(container, 'location.denied')).toBe(false)
  })

  it('announces the informational variant through the polite channel', () => {
    // Inline role="status" blocks mounted TOGETHER with their text are often
    // skipped by VoiceOver (region + text land in the a11y tree at the same
    // tick, so there is no CHANGE event). The global announcer already exists
    // in the tree, so this is where the reliable spoken update lives.
    render(<LocationBanner error="denied" />)
    expect(announceSpy).toHaveBeenCalledWith('location.denied', { assertive: false })
  })

  it('announces the safety-critical ("warning") variant through the assertive channel', () => {
    // ActiveSession passes severity="warning" because losing location relay
    // during an escort is a safety concern — a screen-reader user must be
    // interrupted to hear it, not told politely between other announcements.
    render(<LocationBanner error="denied" severity="warning" />)
    expect(announceSpy).toHaveBeenCalledWith('location.denied', { assertive: true })
  })

  it('does not announce when error is null (banner is hidden)', () => {
    render(<LocationBanner error={null} />)
    expect(announceSpy).not.toHaveBeenCalled()
  })

  it('announces the unavailable message for the "timeout" error code', () => {
    // 'timeout' shares the "unavailable" message because to the user the
    // distinction doesn't matter — the device simply couldn't answer.
    render(<LocationBanner error="timeout" />)
    expect(announceSpy).toHaveBeenCalledWith('location.unavailable', { assertive: false })
  })
})
