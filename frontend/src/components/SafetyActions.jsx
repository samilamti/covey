import { useState } from 'preact/hooks'
import { useTranslation } from 'react-i18next'
import { Flag, Ban } from 'lucide-preact'
import { safetyService } from '../services/safety'

export const REPORT_REASONS = ['harassment', 'inappropriate', 'unsafe', 'spam', 'other']

/**
 * SafetyActions — report and block another person.
 *
 * Used in the live session (also after it has ended) and in the profile's
 * list of past session partners. Reporting copies the session chat to Covey
 * support server-side; blocking ends any running session between the two.
 */
export function SafetyActions({ userId, name, requestId, blocked = false, onBlocked, onUnblocked }) {
  const { t } = useTranslation()
  const [isBlocked, setIsBlocked] = useState(blocked)
  const [showReport, setShowReport] = useState(false)
  const [reason, setReason] = useState(null)
  const [details, setDetails] = useState('')
  const [alsoBlock, setAlsoBlock] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null)

  const who = name || t('safety.someone')

  const markBlocked = () => {
    setIsBlocked(true)
    onBlocked?.()
  }

  const handleBlock = async () => {
    if (!confirm(t('safety.blockConfirm', { name: who }))) return
    setBusy(true)
    try {
      await safetyService.block(userId)
      markBlocked()
      setNotice({ type: 'success', text: t('safety.blockDone', { name: who }) })
    } catch {
      setNotice({ type: 'error', text: t('app.error') })
    } finally {
      setBusy(false)
    }
  }

  const handleUnblock = async () => {
    setBusy(true)
    try {
      await safetyService.unblock(userId)
      setIsBlocked(false)
      setNotice(null)
      onUnblocked?.()
    } catch {
      setNotice({ type: 'error', text: t('app.error') })
    } finally {
      setBusy(false)
    }
  }

  const handleReport = async () => {
    if (!reason) return
    setBusy(true)
    try {
      const { blocked: nowBlocked } = await safetyService.report({
        userId,
        reason,
        details: details.trim(),
        requestId: requestId || undefined,
        block: alsoBlock && !isBlocked,
      })
      if (nowBlocked) markBlocked()
      setShowReport(false)
      setReason(null)
      setDetails('')
      setAlsoBlock(false)
      setNotice({ type: 'success', text: t('safety.reportSent') })
    } catch {
      setNotice({ type: 'error', text: t('app.error') })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div class="flex gap-2">
        <button
          onClick={() => { setShowReport(true); setNotice(null) }}
          class="flex-1 flex items-center justify-center gap-1 text-sm px-3 py-2 rounded-lg border border-gray-200 text-gray-700"
        >
          <Flag size={14} />
          {t('safety.report')}
        </button>
        {isBlocked ? (
          <button
            onClick={handleUnblock}
            disabled={busy}
            class="flex-1 flex items-center justify-center gap-1 text-sm px-3 py-2 rounded-lg border border-gray-200 text-gray-700 disabled:opacity-50"
          >
            <Ban size={14} />
            {t('safety.unblock')}
          </button>
        ) : (
          <button
            onClick={handleBlock}
            disabled={busy}
            class="flex-1 flex items-center justify-center gap-1 text-sm px-3 py-2 rounded-lg border border-red-200 text-red-600 disabled:opacity-50"
          >
            <Ban size={14} />
            {t('safety.block')}
          </button>
        )}
      </div>

      {notice && (
        <p
          role="status"
          class={`mt-2 text-sm ${notice.type === 'success' ? 'text-green-700' : 'text-red-600'}`}
        >
          {notice.text}
        </p>
      )}

      {showReport && (
        <div class="fixed inset-0 bg-black/40 z-[1200] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
          <div class="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-4 space-y-3 safe-area-bottom max-h-[90vh] overflow-y-auto">
            <h3 class="font-semibold text-lg">{t('safety.reportTitle', { name: who })}</h3>
            <p class="text-sm text-gray-600">{t('safety.reportIntro')}</p>

            <fieldset class="space-y-2">
              {REPORT_REASONS.map((r) => (
                <label key={r} class="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="report-reason"
                    value={r}
                    checked={reason === r}
                    onChange={() => setReason(r)}
                  />
                  {t(`safety.reasons.${r}`)}
                </label>
              ))}
            </fieldset>

            <textarea
              value={details}
              onInput={(e) => setDetails(e.target.value)}
              placeholder={t('safety.details')}
              aria-label={t('safety.details')}
              maxLength={1000}
              rows={3}
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />

            {!isBlocked && (
              <label class="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={alsoBlock} onChange={(e) => setAlsoBlock(e.target.checked)} />
                {t('safety.alsoBlock')}
              </label>
            )}

            <div class="flex gap-2 pt-1">
              <button
                onClick={() => setShowReport(false)}
                class="flex-1 px-4 py-3 rounded-lg bg-gray-100 text-gray-700 font-medium"
              >
                {t('safety.cancel')}
              </button>
              <button
                onClick={handleReport}
                disabled={!reason || busy}
                class="flex-1 px-4 py-3 rounded-lg bg-red-600 text-white font-medium disabled:opacity-50"
              >
                {t('safety.send')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
