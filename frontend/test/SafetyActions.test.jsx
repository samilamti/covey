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
  Flag: () => h('span', null, 'Flag'),
  Ban: () => h('span', null, 'Ban'),
}))

vi.mock('../src/services/safety', () => ({
  safetyService: {
    getPartners: vi.fn().mockResolvedValue({ partners: [] }),
    block: vi.fn().mockResolvedValue({ blocked: true, endedSessions: 0 }),
    unblock: vi.fn().mockResolvedValue({ blocked: false }),
    report: vi.fn().mockResolvedValue({ report: { id: 'rep1' }, blocked: true }),
  },
}))

const { SafetyActions } = await import('../src/components/SafetyActions')
const { SafetyPartners } = await import('../src/components/SafetyPartners')
const { safetyService } = await import('../src/services/safety')

describe('SafetyActions', () => {
  let consoleErrorSpy

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.clearAllMocks()
  })

  afterEach(() => {
    expect(consoleErrorSpy).not.toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
    window.confirm?.mockRestore?.()
  })

  it('does not block when the confirmation is declined', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const { getByText } = render(<SafetyActions userId="u2" name="Kim" />)
    fireEvent.click(getByText('safety.block'))
    expect(safetyService.block).not.toHaveBeenCalled()
  })

  it('blocks after confirmation and switches to unblock', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const onBlocked = vi.fn()
    const { getByText } = render(<SafetyActions userId="u2" name="Kim" onBlocked={onBlocked} />)
    fireEvent.click(getByText('safety.block'))
    await waitFor(() => expect(getByText('safety.unblock')).toBeTruthy())
    expect(safetyService.block).toHaveBeenCalledWith('u2')
    expect(onBlocked).toHaveBeenCalled()
  })

  it('cannot send a report without a reason', () => {
    const { getByText } = render(<SafetyActions userId="u2" />)
    fireEvent.click(getByText('safety.report'))
    expect(getByText('safety.send').disabled).toBe(true)
  })

  it('sends reason, trimmed details and the block choice', async () => {
    const onBlocked = vi.fn()
    const { getByText, getByLabelText, queryByRole } = render(
      <SafetyActions userId="u2" requestId="r9" onBlocked={onBlocked} />
    )
    fireEvent.click(getByText('safety.report'))
    fireEvent.click(getByLabelText('safety.reasons.harassment'))
    fireEvent.input(getByLabelText('safety.details'), { target: { value: '  hotfull  ' } })
    fireEvent.click(getByLabelText('safety.alsoBlock'))
    fireEvent.click(getByText('safety.send'))

    await waitFor(() => expect(getByText('safety.reportSent')).toBeTruthy())
    expect(safetyService.report).toHaveBeenCalledWith({
      userId: 'u2', reason: 'harassment', details: 'hotfull', requestId: 'r9', block: true,
    })
    expect(onBlocked).toHaveBeenCalled()
    expect(queryByRole('dialog')).toBeNull()
  })

  it('shows an error and keeps the form open when the report fails', async () => {
    safetyService.report.mockRejectedValueOnce(new Error('nope'))
    const { getByText, getByLabelText, getByRole } = render(<SafetyActions userId="u2" />)
    fireEvent.click(getByText('safety.report'))
    fireEvent.click(getByLabelText('safety.reasons.other'))
    fireEvent.click(getByText('safety.send'))
    await waitFor(() => expect(getByText('app.error')).toBeTruthy())
    expect(getByRole('dialog')).toBeTruthy()
  })

  it('unblocks a blocked user', async () => {
    const { getByText } = render(<SafetyActions userId="u2" blocked />)
    fireEvent.click(getByText('safety.unblock'))
    await waitFor(() => expect(getByText('safety.block')).toBeTruthy())
    expect(safetyService.unblock).toHaveBeenCalledWith('u2')
  })

  it('labels the report dialog and its radio group for screen readers', () => {
    // A dialog with role="dialog" + aria-modal="true" needs an accessible
    // name, or screen readers announce it as an unnamed dialog on open.
    // Similarly, the fieldset of reasons needs a group label so the radios
    // are announced with context ("Reason: harassment, 1 of 5") rather than
    // in isolation.
    const { getByText, getByRole } = render(<SafetyActions userId="u2" name="Kim" />)
    fireEvent.click(getByText('safety.report'))

    const dialog = getByRole('dialog')
    const titleId = dialog.getAttribute('aria-labelledby')
    const introId = dialog.getAttribute('aria-describedby')
    expect(titleId).toBeTruthy()
    expect(introId).toBeTruthy()
    expect(titleId).not.toBe(introId)

    // The referenced elements must exist and carry the expected content.
    // getElementById handles ids containing characters CSS selectors treat
    // specially (useId returns ids like ":r0:"), which querySelector would
    // need escaped.
    const titleEl = document.getElementById(titleId)
    const introEl = document.getElementById(introId)
    expect(titleEl?.textContent).toBe('safety.reportTitle')
    expect(introEl?.textContent).toBe('safety.reportIntro')

    // The fieldset points at the intro paragraph, which names the question.
    const fieldset = dialog.querySelector('fieldset')
    expect(fieldset?.getAttribute('aria-labelledby')).toBe(introId)
  })

  it('closes the report dialog on Escape', () => {
    // A modal dialog with role="dialog" + aria-modal="true" must be dismissable
    // from the keyboard (WCAG 2.1.1 + the ARIA dialog pattern). Without this
    // escape hatch, a keyboard-only user has to Tab to Cancel to leave.
    const { getByText, queryByRole } = render(<SafetyActions userId="u2" />)
    fireEvent.click(getByText('safety.report'))
    expect(queryByRole('dialog')).toBeTruthy()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(queryByRole('dialog')).toBeNull()
  })

  it('only listens for Escape while the report dialog is open', () => {
    // The handler must be scoped to the open dialog, or Escape would be
    // swallowed for anything else on the page — the SafetyActions sitting
    // on a profile row would eat Esc meant for an open outer dialog.
    const { getByText, queryByRole } = render(<SafetyActions userId="u2" />)
    // No dialog open yet — Escape should be a no-op.
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(queryByRole('dialog')).toBeNull()

    fireEvent.click(getByText('safety.report'))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(queryByRole('dialog')).toBeNull()

    // Re-opening still works after a dismissal.
    fireEvent.click(getByText('safety.report'))
    expect(queryByRole('dialog')).toBeTruthy()
  })

  it('gives each mounted SafetyActions its own dialog ids', () => {
    // Two instances can be on screen at once (live session + partner list);
    // hardcoded ids would duplicate and break the label associations.
    const { getAllByText, getAllByRole } = render(
      <div>
        <SafetyActions userId="u2" name="Kim" />
        <SafetyActions userId="u3" name="Sam" />
      </div>
    )
    const reportButtons = getAllByText('safety.report')
    fireEvent.click(reportButtons[0])
    fireEvent.click(reportButtons[1])

    const dialogs = getAllByRole('dialog')
    expect(dialogs).toHaveLength(2)
    expect(dialogs[0].getAttribute('aria-labelledby')).not.toBe(
      dialogs[1].getAttribute('aria-labelledby')
    )
  })
})

describe('SafetyPartners', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lists past session partners with report and block', async () => {
    safetyService.getPartners.mockResolvedValueOnce({ partners: [
      { user_id: 'u2', display_name: 'Kim', request_id: null, met_at: '2026-11-01T20:00:00Z', blocked: false },
      { user_id: 'u3', display_name: '', request_id: null, met_at: '2026-10-30T20:00:00Z', blocked: true },
    ] })
    const { findByText, getAllByText, getByText } = render(<SafetyPartners />)
    expect(await findByText('Kim')).toBeTruthy()
    expect(getByText('safety.someone')).toBeTruthy()
    expect(getAllByText('safety.report')).toHaveLength(2)
    expect(getByText('safety.unblock')).toBeTruthy()
  })

  it('says so when there are no partners', async () => {
    const { findByText } = render(<SafetyPartners />)
    expect(await findByText('safety.partnersEmpty')).toBeTruthy()
  })
})
