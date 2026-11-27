import { useEffect, useId, useState } from 'preact/hooks'
import { useTranslation } from 'react-i18next'
import { Send, MapPin } from 'lucide-preact'
import { requestService } from '../services/requests'
import { LocationBanner } from './LocationBanner'
import { useGeolocation } from '../hooks/useGeolocation'
import { useAnnouncer } from '../context/AnnouncerContext'
import { WalkIcon } from './icons/WalkIcon'
import { WaitIcon } from './icons/WaitIcon'
import { FewPeopleIcon } from './icons/FewPeopleIcon'
import { MorePeopleIcon } from './icons/MorePeopleIcon'
import { EveryoneIcon } from './icons/EveryoneIcon'

/**
 * Arrow keys move the choice within a radiogroup. role="radio" tells a
 * screen reader the arrows work (ARIA radio group pattern), so they have
 * to. Left and right swap in a right-to-left layout, where the next card
 * sits to the left. Only the checked radio is in the tab order, so Tab
 * leaves the group in one step.
 */
function onRadioKeyDown(e, values, current, select) {
  const rtl = document.dir === 'rtl'
  const step = {
    ArrowDown: 1,
    ArrowUp: -1,
    ArrowRight: rtl ? -1 : 1,
    ArrowLeft: rtl ? 1 : -1,
  }[e.key]
  if (!step) return
  e.preventDefault()
  const next = values[(values.indexOf(current) + step + values.length) % values.length]
  select(next)
  const radios = e.currentTarget.closest('[role="radiogroup"]').querySelectorAll('[role="radio"]')
  radios[values.indexOf(next)]?.focus()
}

const TYPE_OPTIONS = [
  { key: 'walk', Icon: WalkIcon },
  { key: 'wait', Icon: WaitIcon },
]
const TYPE_VALUES = TYPE_OPTIONS.map((o) => o.key)
const TIER_VALUES = ['same_demographics', 'verified_guardians', 'any_member']

/**
 * CreateRequest — form to create a new assistance request.
 *
 * User selects a type (walk/wait), writes an optional message,
 * and optionally sets pickup coordinates.
 */
export function CreateRequest({ onCreated }) {
  const { t } = useTranslation()
  const { announce } = useAnnouncer()
  const [type, setType] = useState('walk')
  const [eligibilityTier, setEligibilityTier] = useState('same_demographics')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const { position, error: geoError, loading: geoLoading, retry: retryGeo } = useGeolocation()

  // Speak a failed submit through the global announcer. An inline role="alert"
  // mounted together with its text is often skipped by VoiceOver, so the
  // visible error has no live role of its own. Assertive: the user just
  // tried to send a request and it failed.
  useEffect(() => {
    if (error) announce(error, { assertive: true })
  }, [error])
  const messageId = useId()
  const eligibilityLabelId = useId()

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
    <form onSubmit={handleSubmit} class="space-y-4">
        {/* Cards that act as radios, named by aria-label because the design has no visible heading. */}
        <div class="flex gap-3" role="radiogroup" aria-label={t('requests.type')}>
          {TYPE_OPTIONS.map(({ key, Icon }) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={type === key}
              tabIndex={type === key ? 0 : -1}
              onClick={() => setType(key)}
              onKeyDown={(e) => onRadioKeyDown(e, TYPE_VALUES, type, setType)}
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

        {/* Label is a <div>, not <label>: the group is buttons, not a form control. */}
        <div>
          <div id={eligibilityLabelId} class="block text-sm font-medium text-gray-700 mb-1">
            {t('requests.eligibility')}
          </div>
          <div class="space-y-2" role="radiogroup" aria-labelledby={eligibilityLabelId}>
            {[
              { value: 'same_demographics', label: t('requests.tiers.sameDemographics'), desc: t('requests.tiers.sameDemographicsDesc'), Icon: FewPeopleIcon },
              { value: 'verified_guardians', label: t('requests.tiers.verifiedGuardians'), desc: t('requests.tiers.verifiedGuardiansDesc'), Icon: MorePeopleIcon },
              { value: 'any_member', label: t('requests.tiers.anyMember'), desc: t('requests.tiers.anyMemberDesc'), Icon: EveryoneIcon },
            ].map((tier) => (
              <button
                key={tier.value}
                type="button"
                role="radio"
                aria-checked={eligibilityTier === tier.value}
                tabIndex={eligibilityTier === tier.value ? 0 : -1}
                onClick={() => setEligibilityTier(tier.value)}
                onKeyDown={(e) => onRadioKeyDown(e, TIER_VALUES, eligibilityTier, setEligibilityTier)}
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
          <label for={messageId} class="block text-sm font-medium text-gray-700 mb-1">
            {t('requests.message')} <span class="text-gray-500 font-normal">({t('requests.optional')})</span>
          </label>
          <textarea
            id={messageId}
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
          <div class="flex items-center gap-2 text-xs text-gray-600">
            <MapPin size={12} />
            <span>{t('requests.locationAttached')}</span>
          </div>
        )}
        {!position && geoLoading && (
          <div class="flex items-center gap-2 text-xs text-gray-600">
            <MapPin size={12} />
            <span>{t('location.requesting')}</span>
          </div>
        )}
        {!position && geoError && (
          <LocationBanner error={geoError} onRetry={retryGeo} />
        )}

        {/* Error message. The effect above speaks it assertively through
            the announcer, so it carries no live role here. WCAG 4.1.3. */}
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
  )
}
