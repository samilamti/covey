import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/preact'
import { h } from 'preact'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
    i18n: { language: 'sv', changeLanguage: vi.fn() },
  }),
}))

vi.mock('lucide-preact', () => ({
  Flag: () => h('span', null, 'Flag'),
  Ban: () => h('span', null, 'Ban'),
}))

vi.mock('../src/context/AnnouncerContext', () => ({
  useAnnouncer: () => ({ announce: vi.fn() }),
  AnnouncerProvider: ({ children }) => children,
}))

const getPartnersMock = vi.fn()
vi.mock('../src/services/safety', () => ({
  safetyService: {
    getPartners: (...args) => getPartnersMock(...args),
    block: vi.fn(),
    unblock: vi.fn(),
    report: vi.fn(),
  },
}))

import { SafetyPartners } from '../src/components/SafetyPartners'

describe('SafetyPartners', () => {
  beforeEach(() => {
    getPartnersMock.mockReset()
  })

  it('reads the per-partner date at WCAG AA contrast', async () => {
    const metAt = '2026-03-20T10:00:00Z'
    getPartnersMock.mockResolvedValue({
      partners: [
        { user_id: 'u1', request_id: 'r1', display_name: 'Anna', met_at: metAt, blocked: false },
      ],
    })

    const { container } = render(<SafetyPartners />)
    const expected = new Date(metAt).toLocaleDateString('sv')
    await waitFor(() => {
      expect(container.textContent).toContain(expected)
    })
    const dateSpan = Array.from(container.querySelectorAll('span'))
      .find((el) => el.textContent === expected)
    expect(dateSpan, 'expected a <span> holding just the formatted date').toBeTruthy()
    const cls = dateSpan.getAttribute('class') || ''
    expect(cls).toMatch(/\btext-gray-500\b/)
    expect(cls).not.toMatch(/\btext-gray-400\b/)
  })

  it('reads the empty-state line at WCAG AA contrast', async () => {
    getPartnersMock.mockResolvedValue({ partners: [] })

    const { getByText, container } = render(<SafetyPartners />)

    const line = await waitFor(() => getByText('safety.partnersEmpty'))
    const cls = line.getAttribute('class') || ''
    expect(cls).toMatch(/\btext-gray-500\b/)
    // Guard against a later edit putting the low-contrast token back
    // anywhere in the empty-state render.
    expect(container.innerHTML).not.toMatch(/\btext-sm text-gray-400\b/)
  })
})
