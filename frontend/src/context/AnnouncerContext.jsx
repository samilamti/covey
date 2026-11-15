/**
 * Screen-reader announcer, mounted once at the app root.
 *
 * Why this exists: a role="status" / role="alert" region rendered TOGETHER
 * with the text it is meant to announce is often skipped by assistive tech
 * (VoiceOver especially) — the region appears in the accessibility tree and
 * its text at the same tick, so there is no "change" event for the live
 * region observer to fire on. An always-mounted live region whose text we
 * then CHANGE is the pattern WAI-ARIA Authoring Practices recommends, and
 * is reliable across VoiceOver / NVDA / TalkBack.
 *
 * Usage:
 *   // Wrap the app
 *   <AnnouncerProvider><App /></AnnouncerProvider>
 *
 *   // In any component
 *   const { announce } = useAnnouncer()
 *   announce(t('requests.waitingForHelp'))           // polite, default
 *   announce(t('errors.connectionLost'), { assertive: true })
 *
 * Covey does not have safety-critical interruptions yet, so almost every
 * caller stays polite.
 */

import { createContext } from 'preact'
import { useCallback, useContext, useState } from 'preact/hooks'

// Zero-width space. VoiceOver won't re-read an aria-live region when the
// textContent is byte-identical to what it just announced — a session that
// transitions to the same state twice (e.g. a reconnect replaying a status)
// would otherwise go silent on the second one. Toggling an invisible ZWSP
// between announcements guarantees the DOM text genuinely changes without
// a sighted user ever seeing it.
const ZWSP = '​'

const noop = () => {}

const AnnouncerContext = createContext({ announce: noop })

export function AnnouncerProvider({ children }) {
  // { text, n } — n increments on every call so the render toggles the ZWSP
  // even when text is the same, forcing a DOM mutation.
  const [polite, setPolite] = useState({ text: '', n: 0 })
  const [assertive, setAssertive] = useState({ text: '', n: 0 })

  const announce = useCallback((text, { assertive: isAssertive = false } = {}) => {
    if (!text) return
    const setter = isAssertive ? setAssertive : setPolite
    setter((prev) => ({ text, n: prev.n + 1 }))
  }, [])

  const politeText = polite.text + (polite.n % 2 === 0 ? '' : ZWSP)
  const assertiveText = assertive.text + (assertive.n % 2 === 0 ? '' : ZWSP)

  return (
    <AnnouncerContext.Provider value={{ announce }}>
      {children}
      <div class="sr-only">
        <div role="status" aria-live="polite" aria-atomic="true">
          {politeText}
        </div>
        <div role="alert" aria-live="assertive" aria-atomic="true">
          {assertiveText}
        </div>
      </div>
    </AnnouncerContext.Provider>
  )
}

/**
 * @returns {{ announce: (text: string, opts?: { assertive?: boolean }) => void }}
 */
export function useAnnouncer() {
  return useContext(AnnouncerContext)
}
