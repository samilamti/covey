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
  ArrowLeft: (props) => h('span', props, 'ArrowLeft'),
}))

// Spy on the global announcer. The inline role="status" banner still exists,
// but Sami's a11y notes point out that an inline region mounted TOGETHER with
// its text is often skipped by VoiceOver — the reliable channel is the
// always-mounted announcer, so we assert the component wires through it.
const announceSpy = vi.fn()
vi.mock('../src/context/AnnouncerContext', () => ({
  useAnnouncer: () => ({ announce: announceSpy }),
  AnnouncerProvider: ({ children }) => children,
}))

// Mock Leaflet dynamic import
vi.mock('leaflet', () => ({
  default: {
    map: vi.fn(() => ({
      setView: vi.fn().mockReturnThis(),
      remove: vi.fn(),
    })),
    tileLayer: vi.fn(() => ({ addTo: vi.fn() })),
    marker: vi.fn(() => ({ addTo: vi.fn() })),
    divIcon: vi.fn(() => ({})),
  },
}))

const { PostCreateMap } = await import('../src/components/PostCreateMap')

describe('PostCreateMap', () => {
  let consoleErrorSpy

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    announceSpy.mockClear()
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  it('renders success message', () => {
    const { getByText } = render(
      <PostCreateMap position={{ lat: 59.33, lng: 18.07 }} onBack={() => {}} />
    )
    expect(getByText('requests.waitingForHelp')).toBeTruthy()
  })

  it('announces the success banner in a polite live region', () => {
    // PostCreateMap mounts only after a successful request submission, so
    // for a screen reader user this banner IS the submission feedback.
    // Without role="status" the user finishes creating a request and hears
    // nothing: focus moves to a view with no landmark, no heading, and a
    // decorative map. Polite so the acknowledgement doesn't talk over
    // anything the user may still be reading on the previous view.
    const { getByRole } = render(
      <PostCreateMap position={{ lat: 59.33, lng: 18.07 }} onBack={() => {}} />
    )
    const status = getByRole('status')
    expect(status).toBeTruthy()
    expect(status.getAttribute('aria-live')).toBe('polite')
    expect(status.textContent).toContain('requests.waitingForHelp')
  })

  it('routes the success banner through the global announcer on mount', () => {
    // PostCreateMap mounts only after a successful request submission, so a
    // VoiceOver user who can't rely on the inline region getting read needs
    // the words spoken through the always-mounted announcer.
    render(
      <PostCreateMap position={{ lat: 59.33, lng: 18.07 }} onBack={() => {}} />
    )
    expect(announceSpy).toHaveBeenCalledWith('requests.waitingForHelp')
  })

  it('names the map container as a region so screen readers can find or skip it', () => {
    // Leaflet makes the container focusable the moment it initialises;
    // without a name the user tabs onto a nameless widget and landmark
    // navigation has nothing to list.
    const { getByRole } = render(
      <PostCreateMap position={{ lat: 59.33, lng: 18.07 }} onBack={() => {}} />
    )
    const map = getByRole('region', { name: 'map.title' })
    expect(map).toBeTruthy()
  })

  it('renders back button', () => {
    const { getByText } = render(
      <PostCreateMap position={{ lat: 59.33, lng: 18.07 }} onBack={() => {}} />
    )
    expect(getByText('requests.backToList')).toBeTruthy()
  })

  it('calls onBack when back button is clicked', () => {
    const onBack = vi.fn()
    const { getByText } = render(
      <PostCreateMap position={{ lat: 59.33, lng: 18.07 }} onBack={onBack} />
    )
    fireEvent.click(getByText('requests.backToList'))
    expect(onBack).toHaveBeenCalledOnce()
  })
})
