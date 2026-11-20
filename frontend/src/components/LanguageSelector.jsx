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
  // The trigger button is where focus has to land when the menu closes via
  // Escape (ARIA APG Menu Button pattern) — a dangling focus on the dismissed
  // dropdown would strand a keyboard user on a hidden control.
  const triggerRef = useRef(null)
  // The menu container is where the arrow-key handler looks up menuitems and
  // where "focus into the menu on open" starts from; scoping the queries to
  // this ref keeps us safe if another menu ever appears on the same page.
  const menuRef = useRef(null)
  // dialogWasOpenRef-equivalent guard: without it the "closed → focus the
  // trigger" branch fires on initial mount and steals focus from whatever
  // element the browser gave focus to on page load.
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

  // Escape closes the dropdown — WCAG 2.1.1 Keyboard. Without this a keyboard
  // user has to Tab through all 12 languages or click outside to dismiss the
  // open menu.
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

  // Menu focus flow (ARIA APG Menu Button pattern + WCAG 2.4.3 Focus Order):
  //   • On open, move focus INTO the menu so the caret lands on the current
  //     language — arrow-key navigation then works from the user's actual
  //     starting point, not from some arbitrary first item. Without this,
  //     the caret stays on the trigger and Tab walks past 12 items before
  //     leaving; the point of a menu is to collapse that choice.
  //   • On close via Escape or a selection, return focus to the trigger so a
  //     keyboard user picks up where they were. Those closes leave focus in
  //     the dropdown, or on <body> once the focused item unmounts. A close
  //     caused by clicking or tabbing elsewhere has already put focus where
  //     the user wanted it, so leave it there. The wasOpenRef guard keeps
  //     this branch from firing on initial mount.
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

  // Arrow keys move focus between menuitems; Home/End jump to the ends. The
  // ARIA APG menu pattern makes these mandatory — a `role="menu"` that only
  // responds to Tab reads as a menu to assistive tech but behaves like a
  // normal list, which is worse than no role at all. Enter and Space are
  // native <button> activators, so there's no need to intercept them; wrap
  // behaviour matches CreateRequest's radio navigation (`onRadioKeyDown`)
  // so the two patterns stay consistent.
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
        {/* Without this hidden prefix the trigger reads as just "Svenska"
            (or "English", …), so a screen reader user has no idea they've
            landed on a language picker vs. a disclosure named after that
            word. A visually-hidden span pulls the picker's purpose into
            the accessible name, and the visible label stays unchanged.
            Preferable to an aria-label override because that would strip
            the native language of the visible label — losing the SR's
            ability to pronounce it (e.g. a Swedish voice saying "English"
            vs. "English" wrapped in lang="en"). */}
        <span class="sr-only">{t('language.select')} </span>
        {/* Wrap the current language's label in its own lang attribute for
            the same reason as the menu items below (WCAG 3.1.2 Language of
            Parts): "English" inside a Swedish UI should read with English
            phonetics, and "العربية" should not be voiced as Latin. */}
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
                  // Roving tabindex (ARIA APG): only the current item is in
                  // the Tab sequence, so a Tab from the trigger reaches the
                  // menu's "anchor point" (the current language) and one more
                  // Tab leaves the menu entirely, rather than walking all
                  // twelve items. Arrow keys drive navigation within.
                  tabIndex={isCurrent ? 0 : -1}
                >
                  <span class="mr-3 inline-flex items-center" style={{ minWidth: '1.5rem' }}>
                    <FlagComponent size={20} />
                  </span>
                  {/* Each label is written in its own language, so mark it as
                      such — WCAG 3.1.2 Language of Parts. A screen reader
                      otherwise reads "العربية" and "Українська" with the
                      current UI language's phonetics. All our codes (sv, nb,
                      da, fi, ar, is, pl, fo, kl, se, uk, en) are valid BCP 47
                      primary language subtags. */}
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
