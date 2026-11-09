/**
 * Canonical list of locale codes the backend can serve.
 *
 * This is the one place every language-aware surface (push notification
 * body maps, preferred_lang validation on profile updates) must agree on,
 * so a drift between the frontend's 12 bundles and the backend's accepted
 * values cannot silently downgrade a user to Swedish notifications.
 *
 * Order mirrors the frontend's `LanguageSelector` priority list.
 */
export const SUPPORTED_LOCALES = Object.freeze([
  'sv', 'nb', 'da', 'fi', 'ar', 'is', 'pl', 'fo', 'kl', 'se', 'uk', 'en',
])

const SUPPORTED_SET = new Set(SUPPORTED_LOCALES)

/**
 * True when `lng` is one of the canonical codes exactly. Case-sensitive on
 * purpose — the DB column stores the short form and the push body maps are
 * keyed by it, so an "ar-SA" needs to be rejected at the API boundary
 * rather than quietly fall through to the Swedish fallback.
 *
 * @param {unknown} lng
 * @returns {boolean}
 */
export function isSupportedLocale(lng) {
  return typeof lng === 'string' && SUPPORTED_SET.has(lng)
}
