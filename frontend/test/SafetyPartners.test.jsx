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
    // Each partner row carries the date of the session they shared
    // — the metadata that answers "who is this". `text-xs
    // text-gray-400` dropped the date to ~2.6:1 on the white card,
    // below WCAG 1.4.3's 4.5:1 AA bar at 12 px. `text-gray-500`
    // clears ~4.9:1 on the same surface while still reading as
    // subdued next to the display name.
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
    // The empty state is what a brand-new user sees under the
    // "Past safety partners" heading — the first and only cue that
    // past-session partners show up here. It had been rendered in
    // `text-gray-400`, which measures ~2.6:1 on the white card and
    // falls below WCAG 1.4.3's 4.5:1 AA bar at the 14 px label size.
    // `text-gray-500` clears ~4.9:1 on the same surface.
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
