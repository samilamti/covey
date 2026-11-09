import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import sv from './locales/sv.json'
import nb from './locales/nb.json'
import da from './locales/da.json'
import fi from './locales/fi.json'
import ar from './locales/ar.json'
import is from './locales/is.json'
import pl from './locales/pl.json'
import fo from './locales/fo.json'
import kl from './locales/kl.json'
import se from './locales/se.json'
import uk from './locales/uk.json'
import en from './locales/en.json'

/**
 * Custom language detector: uses Intl.DateTimeFormat to detect
 * the user's regional format, which often reflects their real
 * locale better than navigator.language on shared devices.
 */
const cultureDetector = {
  name: 'culture',
  lookup() {
    if (typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
      return new Intl.DateTimeFormat().resolvedOptions().locale
    }
    return undefined
  },
}

const languageDetector = new LanguageDetector()
languageDetector.addDetector(cultureDetector)

i18n
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    detection: {
      // Only check stored user preference — no browser/culture auto-detection.
      // Fresh visitors get Swedish (fallbackLng). Once a user picks a language
      // via the LanguageSelector, that choice is persisted and respected.
      order: ['querystring', 'localStorage', 'cookie'],
      lookupQuerystring: 'lng',
      lookupCookie: 'i18next',
      lookupLocalStorage: 'i18nextLng',
      caches: ['localStorage', 'cookie'],
    },
    resources: {
      sv: { translation: sv },
      nb: { translation: nb },
      da: { translation: da },
      fi: { translation: fi },
      ar: { translation: ar },
      is: { translation: is },
      pl: { translation: pl },
      fo: { translation: fo },
      kl: { translation: kl },
      se: { translation: se },
      uk: { translation: uk },
      en: { translation: en },
    },
    fallbackLng: 'sv',
    interpolation: {
      escapeValue: false, // not needed for Preact
    },
  })

/**
 * Languages whose base tag writes right-to-left. A Set so new RTL scripts
 * (Hebrew, Farsi, Urdu, …) can be added without touching the handler. We
 * match on the BASE subtag (lowercase, pre-hyphen) so any region variant
 * — `ar`, `ar-SA`, `AR-eg` — resolves the same way; before this normalisation
 * a stored `ar-SA` quietly rendered LTR.
 */
const RTL_LANGUAGES = new Set(['ar'])

/**
 * Compute the `lang` and `dir` attributes the document should carry for a
 * given i18next language code. Exported for unit tests.
 */
export function resolveDocumentLanguage(lng) {
  const code = typeof lng === 'string' ? lng : ''
  const base = code.toLowerCase().split('-')[0]
  return {
    lang: code,
    dir: RTL_LANGUAGES.has(base) ? 'rtl' : 'ltr',
  }
}

// Mirror the active language onto the document so assistive tech and the
// CSS cascade (direction-dependent spacing, logical properties) follow along.
i18n.on('languageChanged', (lng) => {
  const { lang, dir } = resolveDocumentLanguage(lng)
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lang
    document.dir = dir
  }
})

export default i18n
