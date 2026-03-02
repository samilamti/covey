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
      en: { translation: en },
    },
    fallbackLng: 'sv',
    interpolation: {
      escapeValue: false, // not needed for Preact
    },
  })

// Handle RTL for Arabic and set document lang attribute
i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng
  document.dir = lng === 'ar' ? 'rtl' : 'ltr'
})

export default i18n
