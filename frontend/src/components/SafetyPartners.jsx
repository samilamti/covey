import { useState, useEffect } from 'preact/hooks'
import { useTranslation } from 'react-i18next'
import { safetyService } from '../services/safety'
import { SafetyActions } from './SafetyActions'

/**
 * SafetyPartners — people you have shared a session with recently, each with
 * report and block. Keeps both reachable after a session has ended.
 */
export function SafetyPartners() {
  const { t, i18n } = useTranslation()
  const [partners, setPartners] = useState(null)

  useEffect(() => {
    safetyService.getPartners()
      .then(({ partners: list }) => setPartners(list))
      .catch(() => setPartners([]))
  }, [])

  if (partners === null) return null

  return (
    <div class="bg-white rounded-lg shadow-sm border border-gray-100 p-4 space-y-3">
      <div>
        <h3 class="text-sm font-medium text-gray-700">{t('safety.partnersTitle')}</h3>
        <p class="text-xs text-gray-500">{t('safety.partnersDesc')}</p>
      </div>
      {partners.length === 0 && (
        <p class="text-sm text-gray-400">{t('safety.partnersEmpty')}</p>
      )}
      {partners.map((p) => (
        <div key={p.user_id} class="border-t border-gray-100 pt-3 space-y-2">
          <div class="flex items-baseline justify-between gap-2">
            <span class="text-sm font-medium text-gray-800">
              {p.display_name || t('safety.someone')}
              {p.blocked && <span class="ml-2 text-xs text-red-600">{t('safety.blocked')}</span>}
            </span>
            <span class="text-xs text-gray-400">
              {new Date(p.met_at).toLocaleDateString(i18n?.language || 'sv')}
            </span>
          </div>
          <SafetyActions
            userId={p.user_id}
            name={p.display_name}
            requestId={p.request_id}
            blocked={p.blocked}
            onBlocked={() => setPartners((list) => list.map((x) => x.user_id === p.user_id ? { ...x, blocked: true } : x))}
            onUnblocked={() => setPartners((list) => list.map((x) => x.user_id === p.user_id ? { ...x, blocked: false } : x))}
          />
        </div>
      ))}
    </div>
  )
}
