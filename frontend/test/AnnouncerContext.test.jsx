import { describe, it, expect } from 'vitest'
import { render, fireEvent, waitFor } from '@testing-library/preact'
import { h } from 'preact'
import { AnnouncerProvider, useAnnouncer } from '../src/context/AnnouncerContext'

// Each click announces every entry of `say` in the same tick.
function Harness({ say, assertive = false, label = 'say' }) {
  const { announce } = useAnnouncer()
  return (
    <button type="button" onClick={() => say.forEach((s) => announce(s, { assertive }))}>
      {label}
    </button>
  )
}

const politeRegion = (c) => c.querySelector('[role="status"][aria-live="polite"]')
const assertiveRegion = (c) => c.querySelector('[role="alert"][aria-live="assertive"]')

describe('AnnouncerContext', () => {
  it('always mounts a polite live region so VoiceOver has a stable target', () => {
    // A role="status" region rendered TOGETHER with its text is often skipped
    // (VoiceOver especially). The reliable fix is an always-mounted hidden
    // announcer whose content CHANGES after the region already exists in the
    // a11y tree. Render the provider with no children and the region is there.
    const { container } = render(
      <AnnouncerProvider>
        <div />
      </AnnouncerProvider>
    )
    const polite = politeRegion(container)
    expect(polite).not.toBeNull()
    // aria-atomic ensures the WHOLE new text is read, not a diff.
    expect(polite.getAttribute('aria-atomic')).toBe('true')
  })

  it('always mounts an assertive live region for safety-critical announcements', () => {
    const { container } = render(
      <AnnouncerProvider>
        <div />
      </AnnouncerProvider>
    )
    const assertive = assertiveRegion(container)
    expect(assertive).not.toBeNull()
    expect(assertive.getAttribute('aria-atomic')).toBe('true')
  })

  it('announces polite text through the polite region', async () => {
    const { container, getByText } = render(
      <AnnouncerProvider>
        <Harness say={['help is on its way']} />
      </AnnouncerProvider>
    )
    fireEvent.click(getByText('say'))
    await waitFor(() => expect(politeRegion(container).textContent).toBe('help is on its way'))
    expect(assertiveRegion(container).textContent).toBe('')
  })

  it('announces assertive text through the assertive region', async () => {
    const { container, getByText } = render(
      <AnnouncerProvider>
        <Harness say={['connection lost']} assertive />
      </AnnouncerProvider>
    )
    fireEvent.click(getByText('say'))
    await waitFor(() => expect(assertiveRegion(container).textContent).toBe('connection lost'))
    expect(politeRegion(container).textContent).toBe('')
  })

  it('re-announces the same text by inserting a new node, with no invisible characters', async () => {
    // A live region only speaks when its content changes. A session that
    // expires twice, or a retry that fails the same way, must be heard both
    // times, so every batch is rendered as a fresh node.
    const { container, getByText } = render(
      <AnnouncerProvider>
        <Harness say={['session expired']} />
      </AnnouncerProvider>
    )
    fireEvent.click(getByText('say'))
    await waitFor(() => expect(politeRegion(container).textContent).toBe('session expired'))
    const first = politeRegion(container).firstElementChild
    fireEvent.click(getByText('say'))
    await waitFor(() => expect(politeRegion(container).firstElementChild).not.toBe(first))
    expect(politeRegion(container).textContent).toBe('session expired')
    expect(first.isConnected).toBe(false)
  })

  it('keeps every message announced in the same tick', async () => {
    // The rating prompt and a location banner mount together on the request
    // list. If the second call replaced the first before a render, only one
    // would ever be spoken.
    const { container, getByText } = render(
      <AnnouncerProvider>
        <Harness say={['rate your session', 'location unavailable']} />
      </AnnouncerProvider>
    )
    fireEvent.click(getByText('say'))
    await waitFor(() => {
      const ps = Array.from(politeRegion(container).querySelectorAll('p')).map((p) => p.textContent)
      expect(ps).toEqual(['rate your session', 'location unavailable'])
    })
  })

  it('speaks a message announced twice in one tick only once', async () => {
    const { container, getByText } = render(
      <AnnouncerProvider>
        <Harness say={['saved', 'saved']} />
      </AnnouncerProvider>
    )
    fireEvent.click(getByText('say'))
    await waitFor(() => expect(politeRegion(container).textContent).toBe('saved'))
    expect(politeRegion(container).querySelectorAll('p')).toHaveLength(1)
  })

  it('hides the live regions from sighted users via the sr-only class', () => {
    const { container } = render(
      <AnnouncerProvider>
        <div />
      </AnnouncerProvider>
    )
    const isHidden = (el) => el.closest('.sr-only') !== null
    expect(isHidden(politeRegion(container))).toBe(true)
    expect(isHidden(assertiveRegion(container))).toBe(true)
  })

  it('returns a no-op announce when used outside a provider so callers do not crash', () => {
    const { getByText } = render(<Harness say={['x']} />)
    expect(() => fireEvent.click(getByText('say'))).not.toThrow()
  })
})
