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
  const { t, i18n } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)
  const triggerRef = useRef(null)
  const menuRef = useRef(null)
  // Stops the close branch of the focus effect from stealing focus on first mount.
  const wasOpenRef = useRef(false)

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

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setIsOpen(false)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen])

  // Focus flow: on open, focus the current language; on close by Escape or selection,
  // return focus to the trigger. A click or Tab elsewhere already placed focus, so leave it.
  useEffect(() => {
    if (isOpen) {
      const menu = menuRef.current
      if (!menu) return
      const items = Array.from(menu.querySelectorAll('[role="menuitem"]'))
      const current = items.find((el) => el.getAttribute('aria-current') === 'true')
      const target = current || items[0]
      target?.focus()
      wasOpenRef.current = true
    } else if (wasOpenRef.current) {
      wasOpenRef.current = false
      const active = document.activeElement
      if (!active || active === document.body || dropdownRef.current?.contains(active)) {
        triggerRef.current?.focus()
      }
    }
  }, [isOpen])

  // Arrow keys (wrapping) and Home/End move between items, as the APG menu pattern requires;
  // same wrap as CreateRequest's onRadioKeyDown.
  const onMenuKeyDown = (e) => {
    // Tab leaves the menu (ARIA APG Menu Button). Close it only after the
    // browser has moved focus to the next control: closing at once unmounts
    // the focused item before the Tab is handled, and focus could land back at
    // the top of the page.
    if (e.key === 'Tab') {
      setTimeout(() => setIsOpen(false), 0)
      return
    }
    const menu = menuRef.current
    if (!menu) return
    const items = Array.from(menu.querySelectorAll('[role="menuitem"]'))
    const currentIdx = items.indexOf(document.activeElement)
    if (currentIdx < 0) return
    let nextIdx
    if (e.key === 'ArrowDown') nextIdx = (currentIdx + 1) % items.length
    else if (e.key === 'ArrowUp') nextIdx = (currentIdx - 1 + items.length) % items.length
    else if (e.key === 'Home') nextIdx = 0
    else if (e.key === 'End') nextIdx = items.length - 1
    else return
    e.preventDefault()
    items[nextIdx]?.focus()
  }

  const currentLang = languages.find((l) => l.code === i18n.language)

  return (
    <div class="relative text-left" ref={dropdownRef}>
      <button
        ref={triggerRef}
        type="button"
        class="inline-flex justify-center w-full rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 items-center gap-2"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <Globe size={16} />
        {/* Hidden prefix names the picker; an aria-label would drop the label's own lang attribute. */}
        <span class="sr-only">{t('language.select')} </span>
        {currentLang
          ? <span lang={currentLang.code}>{currentLang.label}</span>
          : 'Språk'}
      </button>

      {isOpen && (
        <div class="absolute left-0 right-0 mt-2 max-h-64 overflow-y-auto rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
          <div
            ref={menuRef}
            class="py-1"
            role="menu"
            aria-orientation="vertical"
            aria-label={t('language.select')}
            onKeyDown={onMenuKeyDown}
          >
            {languages.map((lng) => {
              const FlagComponent = lng.flag
              const isCurrent = i18n.language === lng.code
              return (
                <button
                  key={lng.code}
                  onClick={() => changeLanguage(lng.code)}
                  class={`${
                    isCurrent
                      ? 'bg-gray-100 text-gray-900'
                      : 'text-gray-700'
                  } w-full text-left px-4 py-2 text-sm hover:bg-gray-100 hover:text-gray-900 flex items-center focus:outline-none focus:bg-indigo-50 focus:text-indigo-900`}
                  role="menuitem"
                  aria-current={isCurrent ? 'true' : undefined}
                  // Roving tabindex: only the current item is a Tab stop; arrows move within.
                  tabIndex={isCurrent ? 0 : -1}
                >
                  <span class="mr-3 inline-flex items-center" style={{ minWidth: '1.5rem' }}>
                    <FlagComponent size={20} />
                  </span>
                  {/* Each name is in its own language (WCAG 3.1.2). */}
                  <span lang={lng.code}>{lng.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
