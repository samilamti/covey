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
