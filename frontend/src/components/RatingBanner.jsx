import { useState } from 'preact/hooks'
import { useTranslation } from 'react-i18next'
import { ThumbsUp, Minus, ThumbsDown } from 'lucide-preact'
import { ratingService } from '../services/ratings'

/**
 * RatingBanner — non-blocking prompt to rate a completed session.
 * Shows three buttons: Safe (+1), Neutral (0), Uncomfortable (-3).
 */
export function RatingBanner({ pendingRating, onRated }) {
  const { t } = useTranslation()
  const [submitting, setSubmitting] = useState(false)

  const handleRate = async (value) => {
    setSubmitting(true)
    try {
      await ratingService.submit({ requestId: pendingRating.request_id, value })
      if (onRated) onRated(pendingRating.request_id)
    } catch (err) {
      console.error('Rating error:', err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div class="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-3">
      <p class="text-sm font-medium text-amber-800 mb-2">
        {t('ratings.prompt')}
      </p>
      <p class="text-xs text-amber-600 mb-3 truncate">
        {t(`requests.types.${pendingRating.type}`)} — {pendingRating.message || ''}
      </p>
      <div class="flex gap-2">
        <button
          onClick={() => handleRate(1)}
          disabled={submitting}
          class="flex-1 flex items-center justify-center gap-1 bg-green-100 text-green-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-green-200 disabled:opacity-50"
        >
          <ThumbsUp size={14} />
          {t('ratings.safe')}
        </button>
        <button
          onClick={() => handleRate(0)}
          disabled={submitting}
          class="flex-1 flex items-center justify-center gap-1 bg-gray-100 text-gray-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-50"
        >
          <Minus size={14} />
          {t('ratings.neutral')}
        </button>
        <button
          onClick={() => handleRate(-3)}
          disabled={submitting}
          class="flex-1 flex items-center justify-center gap-1 bg-red-100 text-red-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-red-200 disabled:opacity-50"
        >
          <ThumbsDown size={14} />
          {t('ratings.uncomfortable')}
        </button>
      </div>
    </div>
  )
}
