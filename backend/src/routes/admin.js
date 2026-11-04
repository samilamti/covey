/**
 * Admin routes: the moderation queue for user reports.
 *
 * Admins are listed by user UUID in ADMIN_USER_IDS (comma-separated). With
 * the variable unset nobody is an admin and every route answers 404.
 */

import { Router } from 'express'
import { authenticate } from '../auth/index.js'
import * as safetyRepo from '../repositories/safety.js'
import { log } from '../logger.js'

export const adminRouter = Router()

export function isAdmin(userId, env = process.env) {
  const ids = (env.ADMIN_USER_IDS || '').split(',').map((s) => s.trim()).filter(Boolean)
  return Boolean(userId) && ids.includes(userId)
}

adminRouter.use(authenticate)
adminRouter.use((req, res, next) => {
  if (!isAdmin(req.user.userId)) return res.status(404).json({ error: 'Not found' })
  next()
})

/**
 * GET /api/admin/reports?status=open|reviewed|actioned|dismissed|all
 */
adminRouter.get('/reports', async (req, res) => {
  const status = req.query.status === 'all' ? null : (req.query.status || 'open')
  if (status && !safetyRepo.REPORT_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' })
  }
  try {
    const reports = await safetyRepo.listReports({ status })
    res.json({ reports })
  } catch (err) {
    log.error(err, { event: 'admin_list_reports_failed' })
    res.status(500).json({ error: 'Failed to list reports' })
  }
})

/**
 * PATCH /api/admin/reports/:id { status }
 */
adminRouter.patch('/reports/:id', async (req, res) => {
  const { status } = req.body || {}
  if (!safetyRepo.REPORT_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' })
  }
  try {
    const report = await safetyRepo.setReportStatus(req.params.id, status)
    if (!report) return res.status(404).json({ error: 'Report not found' })
    log.info('admin_report_status', { report: report.id, status, admin: req.user.userId })
    res.json({ report })
  } catch (err) {
    log.error(err, { event: 'admin_set_report_failed' })
    res.status(500).json({ error: 'Failed to update report' })
  }
})
