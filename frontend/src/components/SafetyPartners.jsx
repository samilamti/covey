import { useEffect, useId, useState } from 'preact/hooks'
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
  // Stable per-instance id tying the h3 to the list below via
  // aria-labelledby. useId is safe if SafetyPartners is ever rendered in
  // two places (profile + a sibling view).
  const titleId = useId()

  useEffect(() => {
    safetyService.getPartners()
      .then(({ partners: list }) => setPartners(list))
      .catch(() => setPartners([]))
  }, [])

  if (partners === null) return null

  return (
    <div class="bg-white rounded-lg shadow-sm border border-gray-100 p-4 space-y-3">
      <div>
        <h3 id={titleId} class="text-sm font-medium text-gray-700">{t('safety.partnersTitle')}</h3>
        <p class="text-xs text-gray-500">{t('safety.partnersDesc')}</p>
      </div>
      {/* The empty-state line explains that past partners show up here
          after a session — if the user cannot read it, the whole
          section reads as broken rather than empty. `text-gray-400`
          at the 14px label size came in at ~2.6:1 against the white
          card, below WCAG 1.4.3's 4.5:1 AA bar; `text-gray-500` clears
          4.9:1 on the same surface. */}
      {partners.length === 0 && (
        <p class="text-sm text-gray-500">{t('safety.partnersEmpty')}</p>
      )}
      {partners.length > 0 && (
        // A pile of sibling <div>s is not a list to assistive tech, so a
        // screen reader user navigating past-partner report/block actions
        // has no "N items" count and cannot jump between entries with the
        // list shortcuts their screen reader provides. WCAG 1.3.1.
        // role="list" is explicit because Tailwind's reset strips the
        // default list semantics in some browsers, and aria-labelledby
        // ties the list to the visible heading so it announces as
        // "Safety partners, list, 3 items" instead of unnamed.
        // list-none + padding-0 keep the visual layout identical.
        <ul
          role="list"
          aria-labelledby={titleId}
          class="list-none p-0 m-0 space-y-3"
        >
          {partners.map((p) => (
            <li key={p.user_id} class="border-t border-gray-100 pt-3 space-y-2">
              <div class="flex items-baseline justify-between gap-2">
                <span class="text-sm font-medium text-gray-800">
                  {p.display_name || t('safety.someone')}
                  {p.blocked && <span class="ml-2 text-xs text-red-600">{t('safety.blocked')}</span>}
                </span>
                {/* Date the session was shared. Same fix as the
                    activity-history row in ProgressDashboard:
                    `text-gray-400` sat at ~2.6:1 on the white card,
                    below WCAG 1.4.3's 4.5:1 AA bar at text-xs, so
                    a sighted low-vision user could not tell WHEN
                    they last sat in a session with this person —
                    the piece of metadata that makes "who is this"
                    answerable. `text-gray-500` clears ~4.9:1 while
                    still reading as subdued next to the display
                    name. */}
                <span class="text-xs text-gray-500">
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
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
