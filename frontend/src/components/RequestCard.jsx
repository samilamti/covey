import { useTranslation } from 'react-i18next'
import { Clock, MapPin, User, CheckCircle, AlertCircle } from 'lucide-preact'
import { haversineKm, formatDistance } from '../utils/geo'

/**
 * RequestCard — displays a single assistance request.
 *
 * Shows type, status, message, and action buttons based on the request state.
 */
export function RequestCard({ request, currentUserId, viewerPosition, onAccept, onCancel, onComplete, onConfirmSafety }) {
  const { t } = useTranslation()

  const statusColors = {
    open: 'bg-slate-100 text-slate-600',
    accepted: 'bg-blue-100 text-blue-800',
    active: 'bg-green-100 text-green-800',
    done_pending: 'bg-amber-100 text-amber-800',
    completed: 'bg-gray-100 text-gray-800',
    safety_confirmed: 'bg-emerald-100 text-emerald-800',
    cancelled: 'bg-red-100 text-red-800',
    expired: 'bg-gray-100 text-gray-500',
  }

  const typeIcons = {
    walk: '🚶',
    wait: '🚏',
  }

  const isRequester = request.requester_id === currentUserId
  const isHelper = request.helper_id === currentUserId
  const isTerminal = ['completed', 'safety_confirmed', 'cancelled', 'expired'].includes(request.status)

  const timeAgo = (dateStr) => {
    if (!dateStr) return ''
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return t('requests.justNow')
    if (mins < 60) return t('requests.minutesAgo', { count: mins })
    const hours = Math.floor(mins / 60)
    return t('requests.hoursAgo', { count: hours })
  }

  return (
    <div class={`bg-white rounded-lg shadow-sm border border-gray-100 p-4 ${isTerminal ? 'opacity-60' : ''}`}>
      {/* Header: type + status */}
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center gap-2">
          <span class="text-lg">{typeIcons[request.type] || '❓'}</span>
          <span class="font-semibold text-gray-900">
            {t(`requests.types.${request.type}`)}
          </span>
        </div>
        <div class="flex items-center gap-2">
          <span class={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[request.status] || 'bg-gray-100'}`}>
            {t(`requests.status.${request.status}`)}
          </span>
        </div>
      </div>

      {/* Message */}
      {request.message && (
        <p class="text-sm text-gray-600 mb-3">{request.message}</p>
      )}

      {/* Meta info */}
      <div class="flex items-center gap-4 text-xs text-gray-400 mb-3">
        <span class="flex items-center gap-1">
          <Clock size={12} />
          {timeAgo(request.created_at)}
        </span>
        {request.pickup_lat && viewerPosition && (
          <span class="flex items-center gap-1">
            <MapPin size={12} />
            {formatDistance(
              haversineKm(
                viewerPosition.lat, viewerPosition.lng,
                parseFloat(request.pickup_lat), parseFloat(request.pickup_lng)
              ),
              t
            )}
          </span>
        )}
        {request.pickup_lat && !viewerPosition && (
          <span class="flex items-center gap-1">
            <MapPin size={12} />
            {t('requests.locationAvailable')}
          </span>
        )}
        {request.helper_id && (
          <span class="flex items-center gap-1">
            <User size={12} />
            {isHelper ? t('requests.youAreHelper') : t('requests.helperAssigned')}
          </span>
        )}
      </div>

      {/* Action buttons */}
      <div class="flex gap-2">
        {/* Accept — only for open requests by non-requesters */}
        {request.status === 'open' && !isRequester && onAccept && (
          <button
            onClick={() => onAccept(request.id)}
            class="flex-1 bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            {t('requests.accept')}
          </button>
        )}

        {/* Done — for active requests (either party can initiate) */}
        {request.status === 'active' && (isRequester || isHelper) && onComplete && (
          <button
            onClick={() => onComplete(request.id)}
            class="flex-1 bg-green-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-1"
          >
            <CheckCircle size={14} />
            {t('requests.done')}
          </button>
        )}

        {/* Confirm safety — for completed requests (requester confirms) */}
        {request.status === 'completed' && isRequester && onConfirmSafety && (
          <button
            onClick={() => onConfirmSafety(request.id)}
            class="flex-1 bg-emerald-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1"
          >
            <CheckCircle size={14} />
            {t('requests.confirmSafety')}
          </button>
        )}

        {/* Cancel — for non-terminal requests by requester or helper */}
        {!isTerminal && (isRequester || isHelper) && onCancel && (
          <button
            onClick={() => onCancel(request.id)}
            class="px-3 py-2 rounded-lg text-sm font-medium text-red-600 border border-red-200 hover:bg-red-50 transition-colors flex items-center gap-1"
          >
            <AlertCircle size={14} />
            {t('requests.cancel')}
          </button>
        )}
      </div>
    </div>
  )
}
