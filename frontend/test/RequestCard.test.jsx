import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/preact'
import { h } from 'preact'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
    i18n: { language: 'sv', changeLanguage: vi.fn() },
  }),
}))

vi.mock('lucide-preact', () => ({
  Clock: () => h('span', null, 'Clock'),
  MapPin: () => h('span', null, 'MapPin'),
  User: () => h('span', null, 'User'),
  CheckCircle: () => h('span', null, 'CheckCircle'),
  AlertCircle: () => h('span', null, 'AlertCircle'),
}))

vi.mock('../src/utils/geo', () => ({
  haversineKm: () => 0.5,
  formatDistance: () => '500 m',
}))

const { RequestCard } = await import('../src/components/RequestCard')

const makeRequest = (overrides = {}) => ({
  id: 'req-1',
  type: 'walk',
  status: 'open',
  message: 'Need help walking home',
  eligibility_tier: 'same_demographics',
  requester_id: 'user-a',
  helper_id: null,
  pickup_lat: null,
  pickup_lng: null,
  created_at: new Date().toISOString(),
  ...overrides,
})

describe('RequestCard', () => {
  let consoleErrorSpy

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    expect(consoleErrorSpy).not.toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
  })

  it('renders walk request type', () => {
    const { getByText } = render(
      <RequestCard request={makeRequest()} currentUserId="user-b" />
    )
    expect(getByText('requests.types.walk')).toBeTruthy()
  })

  it('renders wait request type', () => {
    const { getByText } = render(
      <RequestCard request={makeRequest({ type: 'wait' })} currentUserId="user-b" />
    )
    expect(getByText('requests.types.wait')).toBeTruthy()
  })

  const statuses = ['open', 'accepted', 'active', 'done_pending', 'completed', 'safety_confirmed', 'cancelled', 'expired']

  for (const status of statuses) {
    it(`renders ${status} status without errors`, () => {
      const request = makeRequest({
        status,
        helper_id: status !== 'open' ? 'user-b' : null,
      })
      const { getByText } = render(
        <RequestCard request={request} currentUserId="user-a" />
      )
      expect(getByText(`requests.status.${status}`)).toBeTruthy()
    })
  }

  it('shows accept button for open request when not requester', () => {
    const onAccept = vi.fn()
    const { getByText } = render(
      <RequestCard
        request={makeRequest()}
        currentUserId="user-b"
        onAccept={onAccept}
      />
    )
    expect(getByText('requests.accept')).toBeTruthy()
  })

  it('hides accept button when user is the requester', () => {
    const { queryByText } = render(
      <RequestCard
        request={makeRequest()}
        currentUserId="user-a"
        onAccept={vi.fn()}
      />
    )
    expect(queryByText('requests.accept')).toBeNull()
  })

  it('shows done button for active request when user is participant', () => {
    const { getByText } = render(
      <RequestCard
        request={makeRequest({ status: 'active', helper_id: 'user-b' })}
        currentUserId="user-a"
        onComplete={vi.fn()}
      />
    )
    expect(getByText('requests.done')).toBeTruthy()
  })

  it('shows cancel button for non-terminal request', () => {
    const { getByText } = render(
      <RequestCard
        request={makeRequest({ status: 'active', helper_id: 'user-b' })}
        currentUserId="user-a"
        onCancel={vi.fn()}
      />
    )
    expect(getByText('requests.cancel')).toBeTruthy()
  })

  it('hides cancel button for terminal states', () => {
    const { queryByText } = render(
      <RequestCard
        request={makeRequest({ status: 'completed', helper_id: 'user-b' })}
        currentUserId="user-a"
        onCancel={vi.fn()}
      />
    )
    expect(queryByText('requests.cancel')).toBeNull()
  })

  it('shows confirm safety button for completed request when requester', () => {
    const { getByText } = render(
      <RequestCard
        request={makeRequest({ status: 'completed', helper_id: 'user-b' })}
        currentUserId="user-a"
        onConfirmSafety={vi.fn()}
      />
    )
    expect(getByText('requests.confirmSafety')).toBeTruthy()
  })

  it('applies reduced opacity for terminal states', () => {
    const { container } = render(
      <RequestCard
        request={makeRequest({ status: 'cancelled' })}
        currentUserId="user-a"
      />
    )
    expect(container.firstChild.className).toContain('opacity-60')
  })

  /* ── viewerPosition / distance display ── */

  it('shows formatted distance when viewerPosition and pickup coords both exist', () => {
    const { getByText } = render(
      <RequestCard
        request={makeRequest({ pickup_lat: '59.34', pickup_lng: '18.08' })}
        currentUserId="user-b"
        viewerPosition={{ lat: 59.33, lng: 18.07 }}
      />
    )
    // formatDistance mock returns '500 m'
    expect(getByText('500 m')).toBeTruthy()
  })

  it('shows "location available" when request has coords but no viewerPosition', () => {
    const { getByText } = render(
      <RequestCard
        request={makeRequest({ pickup_lat: '59.34', pickup_lng: '18.08' })}
        currentUserId="user-b"
        viewerPosition={null}
      />
    )
    expect(getByText('requests.locationAvailable')).toBeTruthy()
  })

  it('does not show distance or location when request has no pickup coords', () => {
    const { queryByText } = render(
      <RequestCard
        request={makeRequest({ pickup_lat: null, pickup_lng: null })}
        currentUserId="user-b"
        viewerPosition={{ lat: 59.33, lng: 18.07 }}
      />
    )
    expect(queryByText('500 m')).toBeNull()
    expect(queryByText('requests.locationAvailable')).toBeNull()
  })

  it('does not show distance when neither coords nor viewerPosition exist', () => {
    const { queryByText } = render(
      <RequestCard
        request={makeRequest()}
        currentUserId="user-b"
        viewerPosition={null}
      />
    )
    expect(queryByText('500 m')).toBeNull()
    expect(queryByText('requests.locationAvailable')).toBeNull()
  })
})
