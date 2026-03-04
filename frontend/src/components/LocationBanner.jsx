import { useTranslation } from 'react-i18next'
import { MapPin } from 'lucide-preact'

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

  if (!error) return null

  const message = error === 'denied'
    ? t('location.denied')
    : t('location.unavailable')

  const colors = severity === 'warning'
    ? 'bg-red-50 border-red-200 text-red-800'
    : 'bg-amber-50 border-amber-200 text-amber-800'

  const buttonColors = severity === 'warning'
    ? 'text-red-700 hover:bg-red-100'
    : 'text-amber-700 hover:bg-amber-100'

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
