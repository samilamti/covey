/**
 * GDPR routes.
 *
 * Data export and deletion for compliance.
 */

import { Router } from 'express'
import { authenticate } from '../auth/index.js'
import * as userRepo from '../repositories/users.js'
import * as msgRepo from '../repositories/messages.js'
import { db } from '../pool.js'

export const gdprRouter = Router()

gdprRouter.use(authenticate)

/**
 * GET /api/gdpr/export — Download all personal data as JSON
 */
gdprRouter.get('/export', async (req, res) => {
  try {
    const user = await userRepo.findById(req.user.userId)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Gather all user data
    const [memberships, requests, subscriptions, ratingsGiven, ratingsReceived, sessionMessages] = await Promise.all([
      db.query(`
        SELECT c.name, cm.role, cm.status, cm.joined_at, cm.requested_at
        FROM community_members cm
        JOIN communities c ON c.id = cm.community_id
        WHERE cm.user_id = $1
      `, [req.user.userId]),
      db.query(`
        SELECT id, type, message, status, created_at, completed_at, done_initiated_at
        FROM assistance_requests
        WHERE requester_id = $1 OR helper_id = $1
        ORDER BY created_at DESC
      `, [req.user.userId]),
      db.query(`
        SELECT endpoint, created_at
        FROM push_subscriptions
        WHERE user_id = $1
      `, [req.user.userId]),
      db.query(`
        SELECT request_id, rated_id, value, created_at
        FROM ratings WHERE rater_id = $1
        ORDER BY created_at DESC
      `, [req.user.userId]),
      db.query(`
        SELECT request_id, rater_id, value, created_at
        FROM ratings WHERE rated_id = $1
        ORDER BY created_at DESC
      `, [req.user.userId]),
      msgRepo.findByUser(req.user.userId),
    ])

    res.json({
      exportDate: new Date().toISOString(),
      user: {
        id: user.id,
        displayName: user.display_name,
        givenName: user.given_name,
        surname: user.surname,
        verified: user.verified,
        preferredLang: user.preferred_lang,
        createdAt: user.created_at,
        lastLoginAt: user.last_login_at,
      },
      communityMemberships: memberships.rows,
      assistanceRequests: requests.rows,
      pushSubscriptions: subscriptions.rows.map((s) => ({
        endpoint: s.endpoint,
        createdAt: s.created_at,
      })),
      ratingsGiven: ratingsGiven.rows,
      ratingsReceived: ratingsReceived.rows,
      sessionMessages,
    })
  } catch (err) {
    console.error('GDPR export error:', err.message)
    res.status(500).json({ error: 'Failed to export data' })
  }
})

/**
 * POST /api/gdpr/delete — Request account deletion
 * Soft-deletes immediately. Hard-delete runs via worker after 30 days.
 */
gdprRouter.post('/delete', async (req, res) => {
  try {
    const success = await userRepo.softDelete(req.user.userId)
    if (!success) {
      return res.status(404).json({ error: 'User not found' })
    }
    res.json({
      ok: true,
      message: 'Account marked for deletion. All data will be permanently removed after 30 days.',
    })
  } catch (err) {
    console.error('GDPR delete error:', err.message)
    res.status(500).json({ error: 'Failed to delete account' })
  }
})
