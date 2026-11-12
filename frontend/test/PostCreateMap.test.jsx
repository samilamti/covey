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
