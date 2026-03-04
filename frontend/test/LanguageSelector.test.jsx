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
})
