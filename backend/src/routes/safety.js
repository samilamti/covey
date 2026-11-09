/**
 * Block and report routes.
 *
 * Both work on people you have shared a session with (session_partners), and
 * keep working after the session has ended.
 */

import { Router } from 'express'
import { authenticate } from '../auth/index.js'
import * as safetyRepo from '../repositories/safety.js'
import * as reqRepo from '../repositories/requests.js'
import { notifyReportFiled } from '../services/report-notify.js'
import { log } from '../logger.js'

export const safetyRouter = Router()

safetyRouter.use(authenticate)

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_DETAILS = 1000

/**
 * Block a partner and end any session still running between the two.
 * Exported so the report route can block in the same request.
 */
export async function blockPartner(io, blockerId, blockedId) {
  await safetyRepo.block(blockerId, blockedId)
  const cancelled = await reqRepo.cancelSessionsBetween(blockerId, blockedId)
  if (io) {
    for (const r of cancelled) {
      io.to(`user:${r.requester_id}`).emit('request:cancelled', { requestId: r.id })
      io.to(`user:${r.helper_id}`).emit('request:cancelled', { requestId: r.id })
    }
  }
  return cancelled.length
}

async function requirePartner(req, res, otherId) {
  if (!otherId || !UUID_RE.test(otherId) || otherId === req.user.userId) {
    res.status(400).json({ error: 'Invalid user' })
    return false
  }
  if (!(await safetyRepo.isRecentPartner(req.user.userId, otherId))) {
    // Same answer as an unknown id, so ids cannot be probed
    res.status(404).json({ error: 'Not a recent session partner' })
    return false
  }
  return true
}

/**
 * GET /api/safety/partners — people you have shared a session with recently
 */
safetyRouter.get('/partners', async (req, res) => {
  try {
    const partners = await safetyRepo.listRecentPartners(req.user.userId)
    res.json({ partners })
  } catch (err) {
    log.error(err, { event: 'list_partners_failed', user: req.user.userId })
    res.status(500).json({ error: 'Failed to list partners' })
  }
})

/**
 * GET /api/safety/blocks — users you have blocked
 */
safetyRouter.get('/blocks', async (req, res) => {
  try {
    const blocks = await safetyRepo.listBlocked(req.user.userId)
    res.json({ blocks })
  } catch (err) {
    log.error(err, { event: 'list_blocks_failed', user: req.user.userId })
    res.status(500).json({ error: 'Failed to list blocks' })
  }
})

/**
 * POST /api/safety/blocks { userId } — block a session partner
 */
safetyRouter.post('/blocks', async (req, res) => {
  const { userId } = req.body || {}
  try {
    if (!(await requirePartner(req, res, userId))) return
    const endedSessions = await blockPartner(req.app.get('io'), req.user.userId, userId)
    log.info('user_blocked', { event: 'user_blocked', user: req.user.userId, endedSessions })
    res.status(201).json({ blocked: true, endedSessions })
  } catch (err) {
    log.error(err, { event: 'block_failed', user: req.user.userId })
    res.status(500).json({ error: 'Failed to block user' })
  }
})

/**
 * DELETE /api/safety/blocks/:userId — undo your own block
 */
safetyRouter.delete('/blocks/:userId', async (req, res) => {
  if (!UUID_RE.test(req.params.userId)) return res.status(400).json({ error: 'Invalid user' })
  try {
    const removed = await safetyRepo.unblock(req.user.userId, req.params.userId)
    if (!removed) return res.status(404).json({ error: 'Not blocked' })
    res.json({ blocked: false })
  } catch (err) {
    log.error(err, { event: 'unblock_failed', user: req.user.userId })
    res.status(500).json({ error: 'Failed to unblock user' })
  }
})

/**
 * POST /api/safety/reports { userId, reason, details?, requestId?, block? }
 */
safetyRouter.post('/reports', async (req, res) => {
  const { userId, reason, details, requestId, block } = req.body || {}
  if (!safetyRepo.REPORT_REASONS.includes(reason)) {
    return res.status(400).json({ error: 'Invalid reason' })
  }
  const text = typeof details === 'string' ? details.trim() : ''
  if (text.length > MAX_DETAILS) {
    return res.status(400).json({ error: 'Details too long' })
  }
  if (requestId != null && !UUID_RE.test(requestId)) {
    return res.status(400).json({ error: 'Invalid request' })
  }

  try {
    if (!(await requirePartner(req, res, userId))) return

    // Snapshot the chat BEFORE a block ends the session and deletes it
    const report = await safetyRepo.createReport({
      reporterId: req.user.userId,
      reportedId: userId,
      requestId: requestId || null,
      reason,
      details: text,
    })

    let blocked = false
    if (block) {
      await blockPartner(req.app.get('io'), req.user.userId, userId)
      blocked = true
    }

    notifyReportFiled(report).catch((err) =>
      log.error(err, { event: 'report_notify_failed', report: report.id }))

    res.status(201).json({ report: { id: report.id, status: report.status }, blocked })
  } catch (err) {
    log.error(err, { event: 'report_failed', user: req.user.userId })
    res.status(500).json({ error: 'Failed to file report' })
  }
})
