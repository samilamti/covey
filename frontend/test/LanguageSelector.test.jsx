/**
 * LanguageSelector component tests.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, waitFor } from '@testing-library/preact'
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

    // The Sami flag is an SVG (no emoji exists); match it by SamiFlag's viewBox.
    const samiItem = Array.from(
      container.querySelectorAll('[role="menuitem"]')
    ).find((el) => el.textContent.includes('Davvisámegiella'))
    expect(samiItem, 'Sami menu item should exist').toBeTruthy()
    const svg = samiItem.querySelector('svg[viewBox="0 0 240 160"]')
    expect(svg, 'Sami menu item should contain the SamiFlag SVG').toBeTruthy()
  })

  it('hides every flag SVG from assistive tech', async () => {
    const { getByRole, container } = render(<LanguageSelector />)
    await fireEvent.click(getByRole('button', { expanded: false }))
    const items = container.querySelectorAll('[role="menuitem"]')
    expect(items).toHaveLength(12)
    for (const item of items) {
      const svg = item.querySelector('svg')
      expect(svg, `menu item "${item.textContent}" should have a flag SVG`).toBeTruthy()
      expect(svg.getAttribute('aria-hidden')).toBe('true')
      expect(svg.getAttribute('aria-label')).toBeNull()
      expect(svg.getAttribute('role')).toBeNull()
    }
  })

  it('closes the dropdown on Escape', async () => {
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
    const { getByRole, getAllByRole } = render(<LanguageSelector />)
    await fireEvent.click(getByRole('button', { expanded: false }))
    const items = getAllByRole('menuitem')
    const current = items.find((el) => el.getAttribute('aria-current') === 'true')
    expect(document.activeElement).toBe(current)
  })

  it('moves focus with ArrowDown and wraps past the last item', async () => {
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
    const { getByRole } = render(<LanguageSelector />)
    const trigger = getByRole('button', { expanded: false })
    await fireEvent.click(trigger)
    // Focus is somewhere inside the menu at this point.
    expect(document.activeElement).not.toBe(trigger)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(document.activeElement).toBe(trigger)
  })

  it('returns focus to the trigger after selecting a language', async () => {
    const { getByRole, getAllByRole } = render(<LanguageSelector />)
    const trigger = getByRole('button', { expanded: false })
    await fireEvent.click(trigger)
    const items = getAllByRole('menuitem')
    const english = items.find((el) => /English/.test(el.textContent))
    await fireEvent.click(english)
    expect(document.activeElement).toBe(trigger)
  })

  it('leaves focus where the user clicked when that click closes the menu', async () => {
    // Clicking another field while the menu is open closes it. Pulling focus
    // back to the language button would undo the click: the user would start
    // typing their display name into nothing.
    const { getByRole, getByLabelText } = render(
      <div>
        <LanguageSelector />
        <label>
          name
          <input />
        </label>
      </div>
    )
    const trigger = getByRole('button', { expanded: false })
    await fireEvent.click(trigger)
    const field = getByLabelText('name')
    // In a browser the click focuses the field before the menu's close
    // effect runs, so focus it first and then deliver the mousedown.
    field.focus()
    await fireEvent.mouseDown(field)
    await new Promise((r) => setTimeout(r, 50))
    expect(getByRole('button', { expanded: false })).toBe(trigger)
    expect(document.activeElement).toBe(field)
  })

  it('closes the menu when Tab leaves it', async () => {
    const { getByRole, queryByRole } = render(<LanguageSelector />)
    await fireEvent.click(getByRole('button', { expanded: false }))
    const menu = getByRole('menu')
    const item = document.activeElement
    await fireEvent.keyDown(item, { key: 'Tab' })
    // Still open while the browser handles the Tab, so the focused item is
    // not unmounted underneath it.
    expect(item.isConnected).toBe(true)
    await waitFor(() => expect(menu.isConnected).toBe(false))
    expect(queryByRole('menu')).toBeNull()
  })

  it('does not steal focus on initial mount', async () => {
    // Seed focus on a sentinel: mounting closed must not move it.
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
    const { getByRole } = render(<LanguageSelector />)
    const trigger = getByRole('button', { expanded: false })
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu')
  })

  it('names the menu landmark with aria-label so assistive tech can skip to it', async () => {
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
