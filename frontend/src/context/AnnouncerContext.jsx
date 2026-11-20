/**
 * Screen-reader announcer, mounted once at the app root.
 *
 * Why this exists: a role="status" / role="alert" region rendered TOGETHER
 * with the text it is meant to announce is often skipped by assistive tech
 * (VoiceOver especially) — the region appears in the accessibility tree and
 * its text at the same tick, so there is no "change" event for the live
 * region observer to fire on. An always-mounted live region whose content we
 * then CHANGE is the pattern WAI-ARIA Authoring Practices recommends.
 *
 * This is the ONLY channel that speaks a routed message. A component that
 * calls announce() must not also wrap the same visible text in its own
 * role="status"/"alert"/aria-live block: a screen reader that does pick up
 * the inline region would then read the message twice. Keep the visible
 * text, drop the inline live role (test/live-regions.test.jsx guards this).
 *
 * Usage:
 *   // Wrap the app
 *   <AnnouncerProvider><App /></AnnouncerProvider>
 *
 *   // In any component
 *   const { announce } = useAnnouncer()
 *   announce(t('requests.waitingForHelp'))           // polite, default
 *   announce(t('errors.connectionLost'), { assertive: true })
 */

import { createContext } from 'preact'
import { useCallback, useContext, useRef, useState } from 'preact/hooks'

const noop = () => {}

const AnnouncerContext = createContext({ announce: noop })

const EMPTY = { messages: [], n: 0 }

export function AnnouncerProvider({ children }) {
  const [polite, setPolite] = useState(EMPTY)
  const [assertive, setAssertive] = useState(EMPTY)

  // Calls made in the same tick are collected and rendered together. Two
  // components that mount at once (the rating prompt and a location banner on
  // the request list) would otherwise each replace the other's text before
  // anything was spoken, and only the last one would be heard.
  const queue = useRef({ polite: [], assertive: [] })
  const scheduled = useRef(false)

  const flush = useCallback(() => {
    scheduled.current = false
    const { polite: p, assertive: a } = queue.current
    queue.current = { polite: [], assertive: [] }
    if (p.length) setPolite((prev) => ({ messages: p, n: prev.n + 1 }))
    if (a.length) setAssertive((prev) => ({ messages: a, n: prev.n + 1 }))
  }, [])

  const announce = useCallback((text, { assertive: isAssertive = false } = {}) => {
    if (!text) return
    const q = queue.current[isAssertive ? 'assertive' : 'polite']
    if (!q.includes(text)) q.push(text)
    if (!scheduled.current) {
      scheduled.current = true
      queueMicrotask(flush)
    }
  }, [flush])

  // Each batch renders as a NEW child node (keyed on the batch counter), so
  // the live region sees an addition even when the text matches the previous
  // batch. A session that expires twice, or a retry that fails the same way,
  // is spoken both times.
  return (
    <AnnouncerContext.Provider value={{ announce }}>
      {children}
      <div class="sr-only">
        <div role="status" aria-live="polite" aria-atomic="true">
          <Batch key={polite.n} messages={polite.messages} />
        </div>
        <div role="alert" aria-live="assertive" aria-atomic="true">
          <Batch key={assertive.n} messages={assertive.messages} />
        </div>
      </div>
    </AnnouncerContext.Provider>
  )
}

function Batch({ messages }) {
  if (!messages.length) return null
  return (
    <div>
      {messages.map((m) => <p key={m}>{m}</p>)}
    </div>
  )
}

/**
 * @returns {{ announce: (text: string, opts?: { assertive?: boolean }) => void }}
 */
export function useAnnouncer() {
  return useContext(AnnouncerContext)
}
