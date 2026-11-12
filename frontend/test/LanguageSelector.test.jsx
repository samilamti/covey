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
