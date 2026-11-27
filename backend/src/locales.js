// The one list of locale codes the backend serves. It must match the frontend bundles,
// or users silently fall back to Swedish push notifications.
export const SUPPORTED_LOCALES = Object.freeze([
  'sv', 'nb', 'da', 'fi', 'ar', 'is', 'pl', 'fo', 'kl', 'se', 'uk', 'en',
])

const SUPPORTED_SET = new Set(SUPPORTED_LOCALES)

/**
 * Exact, case-sensitive match: "ar-SA" must be rejected, not stored and pushed in Swedish.
 * @param {unknown} lng
 * @returns {boolean}
 */
export function isSupportedLocale(lng) {
  return typeof lng === 'string' && SUPPORTED_SET.has(lng)
}
