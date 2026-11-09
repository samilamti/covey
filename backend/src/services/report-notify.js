/**
 * Tell support that a user report came in.
 *
 * Always writes a `user_report_filed` warning to the log. When
 * POSTMARK_SERVER_TOKEN is set it also emails REPORT_EMAIL_TO (default
 * support@covey.se) from REPORT_EMAIL_FROM. The email carries the report id
 * and reason only: the details and chat stay in the database, readable
 * through GET /api/admin/reports.
 *
 * Fire-and-forget: a failed notification never fails the report.
 */

import { log } from '../logger.js'

const POSTMARK_URL = 'https://api.postmarkapp.com/email'

export async function notifyReportFiled(report, { fetchImpl = globalThis.fetch } = {}) {
  log.warn('user_report_filed', {
    event: 'user_report_filed',
    report: report.id,
    reason: report.reason,
    reported: report.reported_id,
    messages: report.message_count,
  })

  const token = process.env.POSTMARK_SERVER_TOKEN
  if (!token) return false

  const to = process.env.REPORT_EMAIL_TO || 'support@covey.se'
  const from = process.env.REPORT_EMAIL_FROM || 'support@covey.se'
  const res = await fetchImpl(POSTMARK_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Postmark-Server-Token': token,
    },
    body: JSON.stringify({
      From: from,
      To: to,
      Subject: `Covey: new user report (${report.reason})`,
      TextBody: [
        `Report ${report.id}`,
        `Reason: ${report.reason}`,
        `Chat messages captured: ${report.message_count}`,
        '',
        'Review it at GET https://covey.se/api/admin/reports (admin account).',
      ].join('\n'),
      MessageStream: 'outbound',
    }),
  })
  if (!res.ok) {
    log.error('report_email_failed', { event: 'report_email_failed', report: report.id, status: res.status })
    return false
  }
  return true
}
