import { useState } from 'preact/hooks'
import { useTranslation } from 'react-i18next'
import { Send, MapPin, X } from 'lucide-preact'
import { requestService } from '../services/requests'
import { LocationBanner } from './LocationBanner'
import { useGeolocation } from '../hooks/useGeolocation'
import { WalkIcon } from './icons/WalkIcon'
import { WaitIcon } from './icons/WaitIcon'
import { FewPeopleIcon } from './icons/FewPeopleIcon'
import { MorePeopleIcon } from './icons/MorePeopleIcon'
import { EveryoneIcon } from './icons/EveryoneIcon'

/**
 * CreateRequest — form to create a new assistance request.
 *
 * User selects a type (walk/wait), writes an optional message,
 * and optionally sets pickup coordinates.
 */
export function CreateRequest({ onCreated, onClose }) {
  const { t } = useTranslation()
  const [type, setType] = useState('walk')
  const [eligibilityTier, setEligibilityTier] = useState('same_demographics')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const { position, error: geoError, loading: geoLoading, retry: retryGeo } = useGeolocation()

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
        <div class="flex gap-3">
          {[
            { key: 'walk', Icon: WalkIcon },
            { key: 'wait', Icon: WaitIcon },
          ].map(({ key, Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setType(key)}
              class={`flex-1 flex flex-col items-center text-center px-4 py-5 rounded-xl border-2 transition-colors ${
                type === key
                  ? 'bg-indigo-50 border-indigo-400 text-indigo-700'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Icon size={44} />
              <span class="text-lg font-bold mt-2">{t(`requests.types.${key}`)}</span>
              <span class="text-xs opacity-60 mt-1 leading-snug">{t(`requests.types.${key}Examples`)}</span>
            </button>
          ))}
        </div>

        {/* Eligibility tier */}
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            {t('requests.eligibility')}
          </label>
          <div class="space-y-2">
            {[
              { value: 'same_demographics', label: t('requests.tiers.sameDemographics'), desc: t('requests.tiers.sameDemographicsDesc'), Icon: FewPeopleIcon },
              { value: 'verified_guardians', label: t('requests.tiers.verifiedGuardians'), desc: t('requests.tiers.verifiedGuardiansDesc'), Icon: MorePeopleIcon },
              { value: 'any_member', label: t('requests.tiers.anyMember'), desc: t('requests.tiers.anyMemberDesc'), Icon: EveryoneIcon },
            ].map((tier) => (
              <button
                key={tier.value}
                type="button"
                onClick={() => setEligibilityTier(tier.value)}
                class={`w-full flex items-center gap-3 text-left px-3 py-2 rounded-lg text-sm border transition-colors ${
                  eligibilityTier === tier.value
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <tier.Icon size={28} />
                <div>
                  <div class="font-medium">{tier.label}</div>
                  <div class="text-xs opacity-70">{tier.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Message */}
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            {t('requests.message')} <span class="text-gray-400 font-normal">({t('requests.optional')})</span>
          </label>
          <textarea
            value={message}
            onInput={(e) => setMessage(e.target.value)}
            placeholder={t('requests.messagePlaceholder')}
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-base focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
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
        {!position && geoLoading && (
          <div class="flex items-center gap-2 text-xs text-gray-400">
            <MapPin size={12} />
            <span>{t('location.requesting')}</span>
          </div>
        )}
        {!position && geoError && (
          <LocationBanner error={geoError} onRetry={retryGeo} />
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
