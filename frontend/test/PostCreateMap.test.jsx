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


  it('shows the success banner outside any inline live region', () => {
    // For a screen reader user this banner IS the submission feedback. The
    // announcer speaks it on mount (next test); the banner itself is not a
    // live region, so it is not read twice.
    const { container, getByText } = render(
      <PostCreateMap position={{ lat: 59.33, lng: 18.07 }} onBack={() => {}} />
    )
    expect(getByText('requests.waitingForHelp')).toBeTruthy()
    expect(inLiveRegion(container, 'requests.waitingForHelp')).toBe(false)
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
