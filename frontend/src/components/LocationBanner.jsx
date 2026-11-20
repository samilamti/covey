import { useEffect } from 'preact/hooks'
import { useTranslation } from 'react-i18next'
import { MapPin } from 'lucide-preact'
import { useAnnouncer } from '../context/AnnouncerContext'

/**
 * LocationBanner — inline notification shown when geolocation fails.
 *
 * @param {object} props
 * @param {'denied'|'unavailable'|'timeout'|null} props.error — null hides the banner
 * @param {() => void} [props.onRetry] — called when the user clicks "Retry"
 * @param {'info'|'warning'} [props.severity='info'] — 'warning' for safety-critical contexts
 */
export function LocationBanner({ error, onRetry, severity = 'info' }) {
  const { t } = useTranslation()
  const { announce } = useAnnouncer()

  const message = error === 'denied'
    ? t('location.denied')
    : t('location.unavailable')

  // Speak the banner through the global announcer whenever `error` changes
  // to a non-null value. A region mounted TOGETHER with its text is often
  // skipped by VoiceOver: the region and the text land in the a11y tree at
  // the same tick, so there is no CHANGE for the live-region observer to fire
  // on. The announcer already sits in the tree, so its update is heard, and
  // it is the only channel: the visible banner has no live role.
  // Warning severity is safety-critical (ActiveSession loses location
  // relay) → assertive; the pre-session informational use (CreateRequest,
  // RequestList) stays polite so it doesn't interrupt. The effect depends
  // on `error` and `severity`, so re-announces on a denied→unavailable
  // transition; `message` and `announce` round out the deps to satisfy the
  // exhaustive-deps lint without changing behaviour (message is derived
  // from error, announce is stable from useCallback).
  useEffect(() => {
    if (!error) return
    announce(message, { assertive: severity === 'warning' })
  }, [error, severity, message, announce])

  if (!error) return null

  // 'warning' (safety-critical) stays red; informational uses a calm blue so it
  // doesn't compete with the amber rating prompt (amber is reserved for that).
  const colors = severity === 'warning'
    ? 'bg-red-50 border-red-200 text-red-800'
    : 'bg-blue-50 border-blue-200 text-blue-800'

  const buttonColors = severity === 'warning'
    ? 'text-red-700 hover:bg-red-100'
    : 'text-blue-700 hover:bg-blue-100'

  return (
    <div class={`flex items-center gap-2 rounded-lg border p-3 mb-3 text-sm ${colors}`}>
      <MapPin size={16} class="flex-shrink-0" />
      <span class="flex-1">{message}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          class={`text-sm font-medium px-2 py-1 rounded ${buttonColors}`}
        >
          {t('location.retry')}
        </button>
      )}
    </div>
  )
}
