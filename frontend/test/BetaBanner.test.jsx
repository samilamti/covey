import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/preact'
import { h } from 'preact'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
    i18n: { language: 'sv', changeLanguage: vi.fn() },
  }),
}))

const { BetaBanner } = await import('../src/components/BetaBanner')

describe('BetaBanner', () => {
  let consoleErrorSpy

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    expect(consoleErrorSpy).not.toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
  })

  it('renders the beta notice text', () => {
    const { getByText } = render(<BetaBanner />)
    expect(getByText('beta.notice')).toBeTruthy()
  })

  it('does not have a dismiss button', () => {
    const { queryByText } = render(<BetaBanner />)
    expect(queryByText('beta.dismiss')).toBeNull()
  })
})
