import { useState, useEffect } from 'preact/hooks'
import { useTranslation } from 'react-i18next'
import { Send, MapPin, X } from 'lucide-preact'
import { requestService } from '../services/requests'

/**
 * CreateRequest — form to create a new assistance request.
 *
 * User selects a type (walk/escort/check_in), writes a message,
 * and optionally sets pickup/destination coordinates.
 */
export function CreateRequest({ onCreated, onClose }) {
  const { t } = useTranslation()
  const [type, setType] = useState('walk')
  const [eligibilityTier, setEligibilityTier] = useState('same_demographics')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [position, setPosition] = useState(null)

  // Get current position
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {} // Ignore errors — position is optional
      )
    }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const data = {
        type,
        message,
        eligibilityTier,
        pickupLat: position?.lat || null,
        pickupLng: position?.lng || null,
      }

      const { request } = await requestService.create(data)
      if (onCreated) onCreated(request)
    } catch (err) {
      setError(err.message || t('app.error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div class="bg-white rounded-xl shadow-lg border border-gray-200 p-5">
      {/* Header */}
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-bold text-gray-900">{t('requests.create')}</h3>
        {onClose && (
          <button onClick={onClose} class="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} class="space-y-4">
        {/* Request type */}
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            {t('requests.type')}
          </label>
          <div class="flex gap-2">
            {['walk', 'escort', 'check_in'].map((reqType) => (
              <button
                key={reqType}
                type="button"
                onClick={() => setType(reqType)}
                class={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  type === reqType
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {t(`requests.types.${reqType}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Eligibility tier */}
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            {t('requests.eligibility')}
          </label>
          <div class="space-y-2">
            {[
              { value: 'same_demographics', label: t('requests.tiers.sameDemographics'), desc: t('requests.tiers.sameDemographicsDesc') },
              { value: 'verified_guardians', label: t('requests.tiers.verifiedGuardians'), desc: t('requests.tiers.verifiedGuardiansDesc') },
              { value: 'any_member', label: t('requests.tiers.anyMember'), desc: t('requests.tiers.anyMemberDesc') },
            ].map((tier) => (
              <button
                key={tier.value}
                type="button"
                onClick={() => setEligibilityTier(tier.value)}
                class={`w-full text-left px-3 py-2 rounded-lg text-sm border transition-colors ${
                  eligibilityTier === tier.value
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <div class="font-medium">{tier.label}</div>
                <div class="text-xs opacity-70">{tier.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Message */}
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            {t('requests.message')}
          </label>
          <textarea
            value={message}
            onInput={(e) => setMessage(e.target.value)}
            placeholder={t('requests.messagePlaceholder')}
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
            rows={3}
            maxLength={500}
          />
        </div>

        {/* Position indicator */}
        {position && (
          <div class="flex items-center gap-2 text-xs text-gray-400">
            <MapPin size={12} />
            <span>{t('requests.locationAttached')}</span>
          </div>
        )}

        {/* Error message */}
        {error && (
          <p class="text-sm text-red-600">{error}</p>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          class="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-3 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Send size={16} />
          {loading ? t('app.loading') : t('requests.send')}
        </button>
      </form>
    </div>
  )
}
