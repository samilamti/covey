import { useId, useState } from 'preact/hooks'
import { useTranslation } from 'react-i18next'
import { Send, MapPin } from 'lucide-preact'
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
export function CreateRequest({ onCreated }) {
  const { t } = useTranslation()
  const [type, setType] = useState('walk')
  const [eligibilityTier, setEligibilityTier] = useState('same_demographics')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const { position, error: geoError, loading: geoLoading, retry: retryGeo } = useGeolocation()
  // Stable per-instance id — the label sits next to the textarea, not around
  // it, so without an explicit htmlFor/id pair a screen reader reads the
  // textarea as unnamed. useId is safe with two CreateRequest instances on
  // screen; a hardcoded id would duplicate.
  const messageId = useId()
  // The eligibility group has a visible section label; tie it to the
  // radiogroup via aria-labelledby so the group announces as "Who can
  // help you? radiogroup" instead of an unnamed group.
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
        {/* Request type — a two-option choice with no visible header. The
            buttons styled as cards communicate "pick one" visually; mark
            them as a radiogroup with aria-checked so a screen reader
            announces the current selection too (WCAG 4.1.2 Name, Role,
            Value). The group gets an aria-label from the already-translated
            section name rather than an invisible <h3>, which avoids adding
            a heading the visual design deliberately omits. */}
        <div class="flex gap-3" role="radiogroup" aria-label={t('requests.type')}>
          {[
            { key: 'walk', Icon: WalkIcon },
            { key: 'wait', Icon: WaitIcon },
          ].map(({ key, Icon }) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={type === key}
              onClick={() => setType(key)}
              class={`flex-1 flex flex-col items-center text-center px-4 py-5 rounded-xl border-2 transition-colors ${
                type === key
                  ? 'bg-indigo-50 border-indigo-400 text-indigo-700'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Icon size={44} aria-hidden="true" />
              <span class="text-lg font-bold mt-2">{t(`requests.types.${key}`)}</span>
              <span class="text-xs opacity-60 mt-1 leading-snug">{t(`requests.types.${key}Examples`)}</span>
            </button>
          ))}
        </div>

        {/* Eligibility tier — same shape as the type group above: cards
            that read visually as "pick one". The visible section label is
            an id-pointed <div> instead of a bare <label> (a <label> is
            only semantically valid with an associated form control, and
            the group is three buttons, not an input), and it is tied to
            the radiogroup via aria-labelledby. */}
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
                onClick={() => setEligibilityTier(tier.value)}
                class={`w-full flex items-center gap-3 text-left px-3 py-2 rounded-lg text-sm border transition-colors ${
                  eligibilityTier === tier.value
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <tier.Icon size={28} aria-hidden="true" />
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
            {t('requests.message')} <span class="text-gray-400 font-normal">({t('requests.optional')})</span>
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

        {/* Error message — role="alert" + assertive so a failed submit
            interrupts to tell the user, since the only other sign is a
            small red line at the bottom of a scrolled form. The LandingPage
            BankID error block uses the same pattern. WCAG 4.1.3 Status
            Messages. */}
        {error && (
          <p role="alert" aria-live="assertive" class="text-sm text-red-600">{error}</p>
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
