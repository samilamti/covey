import { describe, it, expect } from 'vitest'
import { render, fireEvent } from '@testing-library/preact'
import { h } from 'preact'
import { AnnouncerProvider, useAnnouncer } from '../src/context/AnnouncerContext'

function Harness({ text, assertive = false }) {
  const { announce } = useAnnouncer()
  return (
    <button type="button" onClick={() => announce(text, { assertive })}>
      say
    </button>
  )
}

describe('AnnouncerContext', () => {
  it('always mounts a polite live region so VoiceOver has a stable target', () => {
    // Sami's note: a role="status" region rendered TOGETHER with its text is
    // often skipped (VoiceOver especially). The reliable fix is an
    // always-mounted hidden announcer whose text CHANGES after the region
    // already exists in the a11y tree. Render the provider with no children
    // and the region should still be there.
    const { container } = render(
      <AnnouncerProvider>
        <div />
      </AnnouncerProvider>
    )
    const polite = container.querySelector('[role="status"][aria-live="polite"]')
    expect(polite).not.toBeNull()
    // aria-atomic ensures the WHOLE new text is read, not just a diff of
    // the appended characters.
    expect(polite.getAttribute('aria-atomic')).toBe('true')
  })

  it('always mounts an assertive live region for safety-critical announcements', () => {
    const { container } = render(
      <AnnouncerProvider>
        <div />
      </AnnouncerProvider>
    )
    const assertive = container.querySelector('[role="alert"][aria-live="assertive"]')
    expect(assertive).not.toBeNull()
    expect(assertive.getAttribute('aria-atomic')).toBe('true')
  })

  it('announces polite text through the polite region', () => {
    const { container, getByText } = render(
      <AnnouncerProvider>
        <Harness text="help is on its way" />
      </AnnouncerProvider>
    )
    fireEvent.click(getByText('say'))
    const polite = container.querySelector('[role="status"][aria-live="polite"]')
    expect(polite.textContent).toContain('help is on its way')
  })

  it('announces assertive text through the assertive region', () => {
    const { container, getByText } = render(
      <AnnouncerProvider>
        <Harness text="connection lost" assertive />
      </AnnouncerProvider>
    )
    fireEvent.click(getByText('say'))
    const assertive = container.querySelector('[role="alert"][aria-live="assertive"]')
    expect(assertive.textContent).toContain('connection lost')
  })

  it('keeps the same text re-announceable by changing the DOM between calls', () => {
    // VoiceOver will skip an aria-live update whose textContent is byte-identical
    // to what it just read. A session that expires twice (e.g. a reconnect
    // bringing the same state back) would otherwise go silent on the second one.
    // The announcer toggles an invisible ZWSP so the DOM genuinely changes.
    const { container, getByText } = render(
      <AnnouncerProvider>
        <Harness text="session expired" />
      </AnnouncerProvider>
    )
    fireEvent.click(getByText('say'))
    const polite = container.querySelector('[role="status"][aria-live="polite"]')
    const first = polite.textContent
    fireEvent.click(getByText('say'))
    const second = polite.textContent
    expect(first).not.toBe(second)
    // Both renders still carry the real text (stripping the ZWSP).
    expect(first.replace(/​/g, '')).toBe('session expired')
    expect(second.replace(/​/g, '')).toBe('session expired')
  })

  it('hides the live regions from sighted users via the sr-only class', () => {
    // The announcer is a screen-reader-only channel. The Tailwind sr-only
    // utility is what makes the region readable by AT but not painted.
    const { container } = render(
      <AnnouncerProvider>
        <div />
      </AnnouncerProvider>
    )
    const polite = container.querySelector('[role="status"][aria-live="polite"]')
    const assertive = container.querySelector('[role="alert"][aria-live="assertive"]')
    // Either the region itself or a wrapping element must carry sr-only.
    const isHidden = (el) => el.closest('.sr-only') !== null
    expect(isHidden(polite)).toBe(true)
    expect(isHidden(assertive)).toBe(true)
  })

  it('returns a no-op announce when used outside a provider so callers do not crash', () => {
    // Sami's accessibility work is incremental. A component that calls
    // announce() must not depend on the provider being mounted — if a sibling
    // test renders the component in isolation, the hook has to degrade
    // gracefully. The default must be a function, not undefined.
    const { getByText } = render(<Harness text="x" />)
    expect(() => fireEvent.click(getByText('say'))).not.toThrow()
  })
})
