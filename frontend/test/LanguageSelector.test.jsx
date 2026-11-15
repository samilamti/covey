/**
 * LanguageSelector component tests.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/preact'
import { h } from 'preact'
import { LanguageSelector } from '../src/components/LanguageSelector'

// Mock i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
    i18n: {
      language: 'sv',
      changeLanguage: vi.fn(),
    },
  }),
}))

describe('LanguageSelector', () => {
  it('renders the toggle button', () => {
    const { getByRole } = render(<LanguageSelector />)
    const button = getByRole('button', { expanded: false })
    expect(button).toBeDefined()
    expect(button.textContent).toContain('Svenska')
  })

  it('names the trigger with the picker purpose, not only the current value', () => {
    // Without a leading hidden label the trigger reads as just "Svenska"
    // (or "English", …), i.e. the current *value* with no mention that the
    // control picks a language. A screen reader user cannot tell it apart
    // from an unrelated disclosure named after that word. A visually-hidden
    // span carrying language.select pulls the picker's purpose into the
    // accessible name; the visible label and its lang attribute stay intact
    // so a Swedish voice still pronounces "Svenska" the Swedish way.
    const { getByRole, container } = render(<LanguageSelector />)
    const button = getByRole('button', { expanded: false })
    expect(button.textContent).toContain('language.select')
    expect(button.textContent).toContain('Svenska')
    // The purpose text must stay visually hidden — a visible duplicate
    // would clutter the control. .sr-only is the project's shared class.
    const hidden = button.querySelector('span.sr-only')
    expect(hidden).toBeTruthy()
    expect(hidden.textContent.trim()).toBe('language.select')
    // The native-language label below must keep its lang="sv" wrapper so
    // the voice doesn't fall back to the UI language's phonetics for it.
    const nativeLabel = button.querySelector('span[lang="sv"]')
    expect(nativeLabel, 'expected the current language label to carry lang="sv"').toBeTruthy()
    expect(nativeLabel.textContent).toBe('Svenska')
    expect(container).toBeTruthy()
  })

  it('shows dropdown with all 12 languages on click', async () => {
    const { getByRole, getAllByRole } = render(<LanguageSelector />)
    const toggle = getByRole('button', { expanded: false })

    await fireEvent.click(toggle)

    const menuItems = getAllByRole('menuitem')
    expect(menuItems).toHaveLength(12)
  })

  it('displays all language labels', async () => {
    const { getByRole, getAllByRole } = render(<LanguageSelector />)
    await fireEvent.click(getByRole('button', { expanded: false }))

    const menuItems = getAllByRole('menuitem')
    // textContent includes flag emoji/SVG text, so we check with includes
    const allText = menuItems.map((item) => item.textContent).join('|')

    const expectedLabels = [
      'Svenska', 'Norsk', 'Dansk', 'Suomi', 'العربية',
      'Íslenska', 'Polski', 'Føroyskt', 'Kalaallisut',
      'Davvisámegiella', 'Українська', 'English',
    ]
    for (const label of expectedLabels) {
      expect(allText).toContain(label)
    }
  })

  it('renders the Sami flag as SVG (not emoji)', async () => {
    const { getByRole, container } = render(<LanguageSelector />)
    await fireEvent.click(getByRole('button', { expanded: false }))

    // The Sami flag should be an SVG element
    const svgs = container.querySelectorAll('svg[aria-label="Sami flag"]')
    expect(svgs.length).toBe(1)
  })

  it('closes the dropdown on Escape', async () => {
    // A keyboard user with the dropdown open should be able to dismiss it
    // without tabbing through all 12 options or hunting for empty space to
    // click — WCAG 2.1.1 Keyboard.
    const { getByRole, queryAllByRole } = render(<LanguageSelector />)
    await fireEvent.click(getByRole('button', { expanded: false }))
    expect(queryAllByRole('menuitem')).toHaveLength(12)

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(queryAllByRole('menuitem')).toHaveLength(0)
    // The toggle button goes back to aria-expanded=false, and the dropdown
    // can be re-opened.
    const toggle = getByRole('button', { expanded: false })
    expect(toggle).toBeDefined()
  })

  it('ignores Escape when the dropdown is already closed', () => {
    // Guard against swallowing Esc for anything else on the page while the
    // selector is idle.
    const { queryAllByRole } = render(<LanguageSelector />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(queryAllByRole('menuitem')).toHaveLength(0)
  })

  it('marks the current language with aria-current and no other', async () => {
    // Visually the active item gets bg-gray-100 and the others don't — nothing
    // in the DOM tells a screen reader which one is already chosen, so a user
    // tabbing through the menu has to guess from the voice's handling of the
    // highlighted row. aria-current="true" is the WCAG-approved marker for
    // "this is the current value in a group of choices".
    const { getByRole, getAllByRole } = render(<LanguageSelector />)
    await fireEvent.click(getByRole('button', { expanded: false }))

    const items = getAllByRole('menuitem')
    const current = items.filter((el) => el.getAttribute('aria-current') === 'true')
    expect(current).toHaveLength(1)
    // The mocked i18n.language is 'sv'; the current row carries its label.
    expect(current[0].textContent).toContain('Svenska')
    // Every other row must leave aria-current unset — a stale 'false' would
    // still be announced by some screen readers.
    for (const el of items) {
      if (el !== current[0]) {
        expect(el.getAttribute('aria-current')).toBeNull()
      }
    }
  })

  it('uses roving tabindex — only the current language is in the tab sequence', async () => {
    // ARIA APG Menu pattern: a role="menu" with twelve items that are all
    // tabIndex=0 forces a keyboard user to walk every one of them before
    // leaving the menu, which defeats the point of a menu. Roving tabindex
    // keeps exactly one item (the current language) in the tab sequence and
    // puts the others on tabIndex=-1 so arrow keys drive navigation within.
    const { getByRole, getAllByRole } = render(<LanguageSelector />)
    await fireEvent.click(getByRole('button', { expanded: false }))
    const items = getAllByRole('menuitem')
    const tabbable = items.filter((el) => el.tabIndex === 0)
    expect(tabbable).toHaveLength(1)
    expect(tabbable[0].textContent).toContain('Svenska')
    for (const el of items) {
      if (el !== tabbable[0]) expect(el.tabIndex).toBe(-1)
    }
  })

  it('focuses the current menuitem when the menu opens', async () => {
    // Without this a keyboard user tabbing onto the trigger and pressing
    // Enter lands the caret on … nothing inside the menu, and the next
    // Tab leaves the menu entirely. The APG menu pattern moves focus into
    // the menu on open so arrow keys start from the user's actual position
    // (the currently-selected language), not from an arbitrary first item
    // or the dangling trigger.
    const { getByRole, getAllByRole } = render(<LanguageSelector />)
    await fireEvent.click(getByRole('button', { expanded: false }))
    const items = getAllByRole('menuitem')
    const current = items.find((el) => el.getAttribute('aria-current') === 'true')
    expect(document.activeElement).toBe(current)
  })

  it('moves focus with ArrowDown and wraps past the last item', async () => {
    // The APG menu pattern makes arrow-key navigation mandatory — a
    // role="menu" that only responds to Tab reads as a menu to assistive
    // tech but behaves like a normal list, which is worse than no role at
    // all. Wrap behaviour matches CreateRequest's radio navigation so the
    // two patterns stay consistent.
    const { getByRole, getAllByRole } = render(<LanguageSelector />)
    await fireEvent.click(getByRole('button', { expanded: false }))
    const items = getAllByRole('menuitem')
    const current = items.find((el) => el.getAttribute('aria-current') === 'true')
    const currentIdx = items.indexOf(current)
    // ArrowDown from the current item lands on the next.
    fireEvent.keyDown(current, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(items[(currentIdx + 1) % items.length])
    // ArrowUp from the (new) focused item moves back to the previous one.
    fireEvent.keyDown(document.activeElement, { key: 'ArrowUp' })
    expect(document.activeElement).toBe(items[currentIdx])
    // Wrap: ArrowUp from the first item lands on the last.
    items[0].focus()
    fireEvent.keyDown(items[0], { key: 'ArrowUp' })
    expect(document.activeElement).toBe(items[items.length - 1])
    // Wrap the other way: ArrowDown from the last item lands on the first.
    items[items.length - 1].focus()
    fireEvent.keyDown(items[items.length - 1], { key: 'ArrowDown' })
    expect(document.activeElement).toBe(items[0])
  })

  it('jumps to first and last with Home and End', async () => {
    const { getByRole, getAllByRole } = render(<LanguageSelector />)
    await fireEvent.click(getByRole('button', { expanded: false }))
    const items = getAllByRole('menuitem')
    // Start from the middle; Home jumps to the first item.
    items[5].focus()
    fireEvent.keyDown(items[5], { key: 'Home' })
    expect(document.activeElement).toBe(items[0])
    // End jumps to the last item regardless of starting point.
    fireEvent.keyDown(items[0], { key: 'End' })
    expect(document.activeElement).toBe(items[items.length - 1])
  })

  it('returns focus to the trigger when the menu closes on Escape', async () => {
    // WCAG 2.4.3 Focus Order + ARIA APG Menu Button pattern — a dangling
    // focus on the dismissed menu would strand a keyboard user on a hidden
    // control, so the trigger has to catch the caret.
    const { getByRole } = render(<LanguageSelector />)
    const trigger = getByRole('button', { expanded: false })
    await fireEvent.click(trigger)
    // Focus is somewhere inside the menu at this point.
    expect(document.activeElement).not.toBe(trigger)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(document.activeElement).toBe(trigger)
  })

  it('returns focus to the trigger after selecting a language', async () => {
    // Same reason as the Escape path — a click on a menuitem dismisses the
    // menu, so without return-focus a sighted keyboard user who used the
    // arrow keys to land on English and pressed Enter would then have no
    // visible focus ring anywhere on the page.
    const { getByRole, getAllByRole } = render(<LanguageSelector />)
    const trigger = getByRole('button', { expanded: false })
    await fireEvent.click(trigger)
    const items = getAllByRole('menuitem')
    const english = items.find((el) => /English/.test(el.textContent))
    await fireEvent.click(english)
    expect(document.activeElement).toBe(trigger)
  })

  it('does not steal focus on initial mount', async () => {
    // The wasOpenRef guard: without it the "closed → focus the trigger"
    // branch of the focus-flow effect fires on first render and yanks focus
    // away from whatever element the browser picked (the auth form's first
    // input, say). The menu is closed on mount, so no focus change should
    // happen. We seed activeElement on a sentinel button to verify.
    const sentinel = document.createElement('button')
    sentinel.textContent = 'sentinel'
    document.body.appendChild(sentinel)
    sentinel.focus()
    expect(document.activeElement).toBe(sentinel)
    render(<LanguageSelector />)
    expect(document.activeElement).toBe(sentinel)
    document.body.removeChild(sentinel)
  })

  it('declares the menu purpose with aria-haspopup="menu", not the shorthand', async () => {
    // aria-haspopup="true" is spec-equivalent to "menu", but screen readers
    // vary on how they announce the shorthand. "menu" is explicit and
    // matches the role of the popup that actually opens — one round-trip
    // for any later maintainer who reads it.
    const { getByRole } = render(<LanguageSelector />)
    const trigger = getByRole('button', { expanded: false })
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu')
  })

  it('names the menu landmark with aria-label so assistive tech can skip to it', async () => {
    // A bare role="menu" announces as "menu" with no idea of what it holds —
    // a quick-navigation user has no reason to jump to it over the three
    // other menus in the app (quick messages, tier picker, type picker).
    // The visually-hidden label on the trigger says "choose language" and
    // the menu itself carries the same name.
    const { getByRole } = render(<LanguageSelector />)
    await fireEvent.click(getByRole('button', { expanded: false }))
    const menu = getByRole('menu')
    expect(menu.getAttribute('aria-label')).toBe('language.select')
  })

  it('marks every native language label with its own lang attribute', async () => {
    // WCAG 3.1.2 — without lang="ar", a screen reader pronounces "العربية"
    // with the current UI language's voice, which produces garbage.
    const { getByRole, container } = render(<LanguageSelector />)
    await fireEvent.click(getByRole('button', { expanded: false }))

    const expected = [
      ['sv', 'Svenska'],
      ['nb', 'Norsk'],
      ['da', 'Dansk'],
      ['fi', 'Suomi'],
      ['ar', 'العربية'],
      ['is', 'Íslenska'],
      ['pl', 'Polski'],
      ['fo', 'Føroyskt'],
      ['kl', 'Kalaallisut'],
      ['se', 'Davvisámegiella'],
      ['uk', 'Українська'],
      ['en', 'English'],
    ]

    for (const [code, label] of expected) {
      const span = container.querySelector(`span[lang="${code}"]`)
      expect(span, `expected a span with lang="${code}"`).toBeTruthy()
      expect(span.textContent).toBe(label)
    }
  })
})
