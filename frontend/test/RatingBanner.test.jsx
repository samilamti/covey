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
})
