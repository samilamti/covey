import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, waitFor } from '@testing-library/preact'
import { h } from 'preact'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
    i18n: { language: 'sv', changeLanguage: vi.fn() },
  }),
}))

vi.mock('lucide-preact', () => ({
  Download: (props) => h('span', props, 'Download'),
  X: (props) => h('span', props, 'X'),
}))

const { InstallPrompt } = await import('../src/components/InstallPrompt')

describe('InstallPrompt', () => {
  let consoleErrorSpy
  let originalMatchMedia
  let originalUserAgent

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    originalMatchMedia = window.matchMedia
    originalUserAgent = navigator.userAgent

    // Default: not standalone, desktop browser
    window.matchMedia = vi.fn(() => ({ matches: false }))
    Object.defineProperty(navigator, 'standalone', { value: undefined, configurable: true })
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120',
      configurable: true,
    })
  })

  afterEach(() => {
    expect(consoleErrorSpy).not.toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
    window.matchMedia = originalMatchMedia
    Object.defineProperty(navigator, 'userAgent', { value: originalUserAgent, configurable: true })
  })

  it('renders nothing by default (no beforeinstallprompt, not iOS)', () => {
    const { container } = render(<InstallPrompt />)
    expect(container.innerHTML).toBe('')
  })

  it('hides when already in standalone mode', () => {
    window.matchMedia = vi.fn(() => ({ matches: true }))
    const { container } = render(<InstallPrompt />)

    // Dispatch beforeinstallprompt — should still not show
    window.dispatchEvent(new Event('beforeinstallprompt'))
    expect(container.innerHTML).toBe('')
  })

  it('shows install banner when beforeinstallprompt fires', async () => {
    const { getByText } = render(<InstallPrompt />)

    const evt = new Event('beforeinstallprompt')
    evt.preventDefault = vi.fn()
    window.dispatchEvent(evt)

    await waitFor(() => {
      expect(getByText('install.title')).toBeTruthy()
      expect(getByText('install.button')).toBeTruthy()
      expect(getByText('install.description')).toBeTruthy()
    })
  })

  it('calls prompt() when install button clicked', async () => {
    const { getByText } = render(<InstallPrompt />)

    const promptMock = vi.fn()
    const evt = new Event('beforeinstallprompt')
    evt.preventDefault = vi.fn()
    evt.prompt = promptMock
    evt.userChoice = Promise.resolve({ outcome: 'accepted' })
    window.dispatchEvent(evt)

    await waitFor(() => {
      expect(getByText('install.button')).toBeTruthy()
    })

    await fireEvent.click(getByText('install.button'))

    expect(promptMock).toHaveBeenCalled()
  })

  it('hides after install button clicked', async () => {
    const { getByText, container } = render(<InstallPrompt />)

    const evt = new Event('beforeinstallprompt')
    evt.preventDefault = vi.fn()
    evt.prompt = vi.fn()
    evt.userChoice = Promise.resolve({ outcome: 'accepted' })
    window.dispatchEvent(evt)

    await waitFor(() => {
      expect(getByText('install.button')).toBeTruthy()
    })

    await fireEvent.click(getByText('install.button'))

    await waitFor(() => {
      expect(container.innerHTML).toBe('')
    })
  })

  it('shows iOS hint on iOS Safari', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
      configurable: true,
    })

    const { getByText } = render(<InstallPrompt />)
    expect(getByText('install.title')).toBeTruthy()
    expect(getByText('install.iosHint')).toBeTruthy()
  })

  it('does not show iOS hint on Chrome iOS', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0 Mobile/15E148 Safari/604.1',
      configurable: true,
    })

    const { container } = render(<InstallPrompt />)
    expect(container.innerHTML).toBe('')
  })

  it('hides after dismiss button clicked', async () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
      configurable: true,
    })

    const { getByText, container } = render(<InstallPrompt />)
    expect(getByText('install.title')).toBeTruthy()

    // Click the X button
    await fireEvent.click(getByText('X'))

    expect(container.innerHTML).toBe('')
  })
})
