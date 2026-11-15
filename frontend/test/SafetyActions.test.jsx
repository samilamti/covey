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

// Spy on the global announcer — the inline role="status|alert" notice still
// exists, but Sami's a11y notes point out that an inline region mounted
// TOGETHER with its text is often skipped (VoiceOver especially). The
// reliable channel is the always-mounted announcer, so we verify
// SafetyActions routes its success and failure messages through it.
const announceSpy = vi.fn()
vi.mock('../src/context/AnnouncerContext', () => ({
  useAnnouncer: () => ({ announce: announceSpy }),
  AnnouncerProvider: ({ children }) => children,
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
    announceSpy.mockClear()
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

  it('routes block success through the global announcer so VoiceOver speaks it', async () => {
    // The inline role="status" notice is mounted together with its text,
    // which VoiceOver tends to skip. The global announcer is the reliable
    // channel. Polite because success is a confirmation, not an alarm.
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { getByText } = render(<SafetyActions userId="u2" name="Kim" />)
    fireEvent.click(getByText('safety.block'))
    await waitFor(() => expect(getByText('safety.unblock')).toBeTruthy())
    expect(announceSpy).toHaveBeenCalledWith('safety.blockDone', { assertive: false })
  })

  it('routes block failure through the global announcer as assertive', async () => {
    // The user just tried to act and the action failed. Assertive — a quiet
    // polite announcement would be talked over by anything else happening
    // on the page and the user would not realise their block did not land.
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    safetyService.block.mockRejectedValueOnce(new Error('nope'))
    const { getByText } = render(<SafetyActions userId="u2" name="Kim" />)
    fireEvent.click(getByText('safety.block'))
    await waitFor(() => expect(announceSpy).toHaveBeenCalledWith('app.error', { assertive: true }))
  })

  it('routes report success through the global announcer', async () => {
    const { getByText, getByLabelText } = render(<SafetyActions userId="u2" />)
    fireEvent.click(getByText('safety.report'))
    fireEvent.click(getByLabelText('safety.reasons.harassment'))
    fireEvent.click(getByText('safety.send'))
    await waitFor(() => expect(announceSpy).toHaveBeenCalledWith('safety.reportSent', { assertive: false }))
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

  it('moves focus into the dialog on open and returns it to the trigger on close', async () => {
    // ARIA APG Dialog pattern + WCAG 2.4.3 Focus Order. Without moving
    // focus into the dialog, the caret stays on the Report button that
    // is now behind an inert scrim — Tab then walks the page under the
    // modal instead of the modal's controls. Returning focus on close
    // keeps keyboard navigation coherent so the user picks up where they
    // left off rather than losing their place.
    const { getByText, getByRole } = render(<SafetyActions userId="u2" name="Kim" />)
    const trigger = getByText('safety.report').closest('button')
    // Browser gives initial focus to document.body; clicking opens the
    // modal, at which point the heading should become the active element.
    fireEvent.click(trigger)
    const dialog = getByRole('dialog')
    const heading = document.getElementById(dialog.getAttribute('aria-labelledby'))
    expect(heading).toBeTruthy()
    // The heading needs tabIndex="-1" to be a valid focus target — a bare
    // <h3> is otherwise unfocusable and .focus() is a no-op.
    expect(heading.getAttribute('tabindex')).toBe('-1')
    await waitFor(() => expect(document.activeElement).toBe(heading))

    // Dismiss with Escape; focus must land back on the Report trigger.
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(document.activeElement).toBe(trigger))
  })

  it('does not steal focus to the Report trigger on initial mount', () => {
    // A naive useEffect that focuses the trigger whenever the dialog is
    // closed would also fire on first render (showReport starts false),
    // yanking focus the moment the component appears and stomping on
    // whatever the user was tabbing through on the surrounding screen.
    // The initial-mount guard makes this branch inert until the dialog
    // has been opened at least once.
    const outsideButton = document.createElement('button')
    outsideButton.textContent = 'outside'
    document.body.appendChild(outsideButton)
    outsideButton.focus()
    try {
      render(<SafetyActions userId="u2" />)
      expect(document.activeElement).toBe(outsideButton)
    } finally {
      outsideButton.remove()
    }
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

  it('exposes the partners as a named list with one item per person', async () => {
    // A pile of <div>s is invisible to assistive tech as a collection — the
    // screen reader cannot announce "3 items" and the user cannot jump
    // between entries with the list shortcut. WCAG 1.3.1.
    safetyService.getPartners.mockResolvedValueOnce({ partners: [
      { user_id: 'u2', display_name: 'Kim', request_id: null, met_at: '2026-11-01T20:00:00Z', blocked: false },
      { user_id: 'u3', display_name: 'Pat', request_id: null, met_at: '2026-10-30T20:00:00Z', blocked: true },
    ] })
    const { findByRole, getAllByRole } = render(<SafetyPartners />)
    const list = await findByRole('list')
    // Visible section heading must be the list's accessible name, so the
    // list announces as "Safety partners, list" rather than unnamed.
    const labelId = list.getAttribute('aria-labelledby')
    expect(labelId).toBeTruthy()
    const heading = list.ownerDocument.getElementById(labelId)
    expect(heading).toBeTruthy()
    expect(heading.textContent).toContain('safety.partnersTitle')
    // One listitem per person, each containing the person's name.
    const items = getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0].textContent).toContain('Kim')
    expect(items[1].textContent).toContain('Pat')
  })

  it('does not render an empty list when there are no partners', async () => {
    // An empty <ul> is announced as "list, 0 items" by some screen readers,
    // which is noise next to the dedicated empty-state message. Collapse
    // the shell entirely on the no-partners branch.
    const { findByText, queryByRole } = render(<SafetyPartners />)
    await findByText('safety.partnersEmpty')
    expect(queryByRole('list')).toBeNull()
  })
})
