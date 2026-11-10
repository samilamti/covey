/**
 * Keep the account's preferred language in step with the language on screen.
 *
 * Push notifications are written in `users.preferred_lang`
 * (backend/src/services/notifications.js), which starts as 'sv'. The language
 * picker only switches i18next on this device, and until 2026-11-10 nothing
 * ever told the server, so every push arrived in Swedish whatever language the
 * person had picked.
 *
 * The language on screen wins: it is the one the person is looking at. Sign-in
 * and session restore hand us what the server holds (`stored`), so an app open
 * costs no request when the two already agree.
 */

/**
 * The codes the profile route accepts. Must match backend/src/locales.js and
 * the bundles in ./locales (test/language-sync.test.js checks both).
 */
export const PROFILE_LOCALES = Object.freeze([
  'sv', 'nb', 'da', 'fi', 'ar', 'is', 'pl', 'fo', 'kl', 'se', 'uk', 'en',
])

/**
 * Reduce an i18next language code to the base code the profile route takes.
 * A `?lng=en-GB` link leaves i18next on 'en-GB', which the route would refuse
 * with a 400, so only the part before the hyphen is sent.
 * @param {unknown} lng
 * @returns {string|null} a PROFILE_LOCALES code, or null for anything else
 */
export function toProfileLocale(lng) {
  if (typeof lng !== 'string') return null
  const base = lng.toLowerCase().split('-')[0]
  return PROFILE_LOCALES.includes(base) ? base : null
}

/**
 * Make a sync function for one signed-in session.
 *
 * Saves run one at a time and the newest request wins, so switching language
 * twice in quick succession cannot leave the older choice on the server. A
 * failed save is not retried at once; the next language change or app launch
 * tries again.
 *
 * @param {{ stored?: string|null, save: (code: string) => Promise<unknown> }} opts
 *   `stored` is the server's current value, `save` writes a new one.
 * @returns {(lng: string) => Promise<boolean>} resolves true once the server
 *   holds the latest requested language, false if a save failed or the
 *   language is not one the server accepts.
 */
export function createLanguageSync({ stored = null, save }) {
  let known = stored
  let wanted = null
  let running = null

  async function drain() {
    while (wanted !== known) {
      const code = wanted
      try {
        await save(code)
        known = code
      } catch (err) {
        console.log('Language sync skipped:', err?.message)
        return false
      }
    }
    return true
  }

  return function sync(lng) {
    const code = toProfileLocale(lng)
    if (!code) return Promise.resolve(false)
    wanted = code
    if (!running) {
      running = drain().finally(() => { running = null })
    }
    return running
  }
}
