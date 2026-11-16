/**
 * RatingBanner component tests.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/preact'
import { h } from 'preact'
import { RatingBanner } from '../src/components/RatingBanner'

// Mock i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
    i18n: { language: 'sv', changeLanguage: vi.fn() },
  }),
}))

// Mock rating service
vi.mock('../src/services/ratings', () => ({
  ratingService: {
    submit: vi.fn().mockResolvedValue({ rating: {} }),
  },
}))

// Spy on the global announcer. The inline role="status" on the prompt still
// exists, but Sami's a11y notes point out that an inline region mounted
// TOGETHER with its text is often skipped by VoiceOver — the reliable
// channel is the always-mounted announcer, so we assert the component wires
// through it.
const announceSpy = vi.fn()
vi.mock('../src/context/AnnouncerContext', () => ({
  useAnnouncer: () => ({ announce: announceSpy }),
  AnnouncerProvider: ({ children }) => children,
}))

const { ratingService } = await import('../src/services/ratings')

describe('RatingBanner', () => {
  const pendingRating = {
    request_id: 'req-123',
    type: 'walk',
    message: 'Need company walking home',
    requester_id: 'user-a',
    helper_id: 'user-b',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    announceSpy.mockClear()
  })

  it('renders the prompt text', () => {
    const { getByText } = render(
      <RatingBanner pendingRating={pendingRating} onRated={() => {}} />
    )
    expect(getByText('ratings.prompt')).toBeDefined()
  })

  it('renders all three rating buttons', () => {
    const { getByText } = render(
      <RatingBanner pendingRating={pendingRating} onRated={() => {}} />
    )
    expect(getByText('ratings.safe')).toBeDefined()
    expect(getByText('ratings.neutral')).toBeDefined()
    expect(getByText('ratings.uncomfortable')).toBeDefined()
  })

  it('shows the request type and message', () => {
    const { container } = render(
      <RatingBanner pendingRating={pendingRating} onRated={() => {}} />
    )
    const desc = container.querySelector('.text-xs.text-amber-600')
    expect(desc.textContent).toContain('requests.types.walk')
    expect(desc.textContent).toContain('Need company walking home')
  })

  it('calls ratingService.submit with value 1 for SAFE', async () => {
    const onRated = vi.fn()
    const { getByText } = render(
      <RatingBanner pendingRating={pendingRating} onRated={onRated} />
    )

    await fireEvent.click(getByText('ratings.safe'))

    expect(ratingService.submit).toHaveBeenCalledWith({
      requestId: 'req-123',
      value: 1,
    })
  })

  it('calls ratingService.submit with value 0 for NEUTRAL', async () => {
    const onRated = vi.fn()
    const { getByText } = render(
      <RatingBanner pendingRating={pendingRating} onRated={onRated} />
    )

    await fireEvent.click(getByText('ratings.neutral'))

    expect(ratingService.submit).toHaveBeenCalledWith({
      requestId: 'req-123',
      value: 0,
    })
  })

  it('calls ratingService.submit with value -3 for UNCOMFORTABLE', async () => {
    const onRated = vi.fn()
    const { getByText } = render(
      <RatingBanner pendingRating={pendingRating} onRated={onRated} />
    )

    await fireEvent.click(getByText('ratings.uncomfortable'))

    expect(ratingService.submit).toHaveBeenCalledWith({
      requestId: 'req-123',
      value: -3,
    })
  })

  it('calls onRated callback after successful submission', async () => {
    const onRated = vi.fn()
    const { getByText } = render(
      <RatingBanner pendingRating={pendingRating} onRated={onRated} />
    )

    await fireEvent.click(getByText('ratings.safe'))

    // Wait for async submission
    await vi.waitFor(() => {
      expect(onRated).toHaveBeenCalledWith('req-123')
    })
  })

  it('routes the rating prompt through the global announcer on mount', () => {
    // RatingBanner appears after a session completes and asks the user to
    // rate what just happened. For a screen-reader user the banner IS the
    // post-session feedback: if it doesn't announce, they finish an escort
    // and hear nothing about the ask. VoiceOver skips inline live regions
    // that mount together with their text, so the always-mounted announcer
    // is the reliable channel.
    render(
      <RatingBanner pendingRating={pendingRating} onRated={() => {}} />
    )
    expect(announceSpy).toHaveBeenCalledWith('ratings.prompt')
  })

  it('wraps the prompt text in a polite live region as a fallback channel', () => {
    // Belt-and-braces alongside the announcer: an AT that does read a
    // mounted-with-text region still catches the prompt. Scoped to the
    // prompt paragraph, NOT the whole banner — wrapping the rating buttons
    // and the request description in a live region would read the full
    // layout on every mount and overwhelm a screen-reader user.
    const { getByText } = render(
      <RatingBanner pendingRating={pendingRating} onRated={() => {}} />
    )
    const prompt = getByText('ratings.prompt')
    expect(prompt.getAttribute('role')).toBe('status')
    expect(prompt.getAttribute('aria-live')).toBe('polite')
    // The buttons must remain OUTSIDE the live region, or every mount
    // reads "How did it feel? Safe Neutral Uncomfortable" at once.
    expect(prompt.querySelector('button')).toBeNull()
  })

  it('re-announces when a new pending rating replaces the previous one', () => {
    // RequestList may stack several pending ratings — one per completed
    // session awaiting feedback. Keying the announce effect on the request
    // id guards against the same component instance silently swallowing
    // subsequent prompts if React reuses it (the banner is rendered in a
    // .map() keyed by request_id, so a key change does normally remount,
    // but the id-keyed effect is the real guarantee).
    const { rerender } = render(
      <RatingBanner pendingRating={pendingRating} onRated={() => {}} />
    )
    expect(announceSpy).toHaveBeenCalledTimes(1)

    rerender(
      <RatingBanner
        pendingRating={{ ...pendingRating, request_id: 'req-456' }}
        onRated={() => {}}
      />
    )
    expect(announceSpy).toHaveBeenCalledTimes(2)
  })

  it('does not re-announce when the parent re-renders with the same pending rating', () => {
    // The inverse of the above: a parent re-render (e.g. RequestList reloading
    // the list after a socket event) must NOT re-announce the same prompt, or
    // a screen-reader user sits through "How did it feel?" on every refresh
    // while they are still deciding.
    const { rerender } = render(
      <RatingBanner pendingRating={pendingRating} onRated={() => {}} />
    )
    expect(announceSpy).toHaveBeenCalledTimes(1)

    rerender(
      <RatingBanner pendingRating={pendingRating} onRated={() => {}} />
    )
    expect(announceSpy).toHaveBeenCalledTimes(1)
  })
})
