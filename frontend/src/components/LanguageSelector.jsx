import { useState, useRef, useEffect } from 'preact/hooks'
import { useTranslation } from 'react-i18next'
import { Globe } from 'lucide-preact'
import {
  SwedenFlag, NorwayFlag, DenmarkFlag, FinlandFlag,
  ArabicFlag, IcelandFlag, PolandFlag, FaroeFlag,
  GreenlandFlag, SamiFlag, UkraineFlag, UKFlag,
} from './flags'

/**
 * All supported languages in priority order.
 * Each flag is an SVG component that accepts { size } prop.
 */
const languages = [
  { code: 'sv', label: 'Svenska', flag: SwedenFlag },
  { code: 'nb', label: 'Norsk', flag: NorwayFlag },
  { code: 'da', label: 'Dansk', flag: DenmarkFlag },
  { code: 'fi', label: 'Suomi', flag: FinlandFlag },
  { code: 'ar', label: 'العربية', flag: ArabicFlag },
  { code: 'is', label: 'Íslenska', flag: IcelandFlag },
  { code: 'pl', label: 'Polski', flag: PolandFlag },
  { code: 'fo', label: 'Føroyskt', flag: FaroeFlag },
  { code: 'kl', label: 'Kalaallisut', flag: GreenlandFlag },
  { code: 'se', label: 'Davvisámegiella', flag: SamiFlag },
  { code: 'uk', label: 'Українська', flag: UkraineFlag },
  { code: 'en', label: 'English', flag: UKFlag },
]

export function LanguageSelector() {
  const { i18n } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng)
    setIsOpen(false)
  }

  // Close dropdown on click outside
  useEffect(() => {
    if (!isOpen) return
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isOpen])

  const currentLang = languages.find((l) => l.code === i18n.language)

  return (
    <div class="relative text-left" ref={dropdownRef}>
      <button
        type="button"
        class="inline-flex justify-center w-full rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 items-center gap-2"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <Globe size={16} />
        {currentLang?.label || 'Språk'}
      </button>

      {isOpen && (
        <div class="absolute left-0 right-0 mt-2 max-h-64 overflow-y-auto rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
          <div class="py-1" role="menu" aria-orientation="vertical">
            {languages.map((lng) => {
              const FlagComponent = lng.flag
              return (
                <button
                  key={lng.code}
                  onClick={() => changeLanguage(lng.code)}
                  class={`${
                    i18n.language === lng.code
                      ? 'bg-gray-100 text-gray-900'
                      : 'text-gray-700'
                  } w-full text-left px-4 py-2 text-sm hover:bg-gray-100 hover:text-gray-900 flex items-center`}
                  role="menuitem"
                >
                  <span class="mr-3 inline-flex items-center" style={{ minWidth: '1.5rem' }}>
                    <FlagComponent size={20} />
                  </span>
                  {lng.label}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
