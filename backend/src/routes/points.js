/**
 * Points & personal progress routes.
 */

import { Router } from 'express'
import { authenticate } from '../auth/index.js'
import { isEnabled } from '../features.js'
import * as pointsRepo from '../repositories/points.js'
import { BADGE_DEFS } from '../points-config.js'

export const pointsRouter = Router()

pointsRouter.use(authenticate)

pointsRouter.use((_req, res, next) => {
  if (!isEnabled('POINTS_SYSTEM')) {
    return res.status(404).json({ error: 'Feature not available' })
  }
  next()
})

/**
 * GET /api/points — Summary stats (total points, session counts, badges earned)
 */
pointsRouter.get('/', async (req, res) => {
  try {
    const [stats, badges] = await Promise.all([
      pointsRepo.getStats(req.user.userId),
      pointsRepo.getBadges(req.user.userId),
    ])
    res.json({
      ...stats,
      badgesEarned: badges.length,
      badgesTotal: BADGE_DEFS.length,
    })
  } catch (err) {
    console.error('Points summary error:', err.message)
    res.status(500).json({ error: 'Failed to get points' })
  }
})

/**
 * GET /api/points/history — Paginated points ledger
 */
pointsRouter.get('/history', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100)
    const offset = parseInt(req.query.offset) || 0
    const history = await pointsRepo.getPointsHistory(req.user.userId, { limit, offset })
    res.json({ history })
  } catch (err) {
    console.error('Points history error:', err.message)
    res.status(500).json({ error: 'Failed to get history' })
  }
})

/**
 * GET /api/points/badges — All badges (earned + available)
 */
pointsRouter.get('/badges', async (req, res) => {
  try {
    const earned = await pointsRepo.getBadges(req.user.userId)
    const earnedMap = new Map(earned.map(b => [b.badge_key, b]))
    const badges = BADGE_DEFS.map(def => {
      const e = earnedMap.get(def.key)
      return {
        key: def.key,
        earned: !!e,
        earnedAt: e?.earned_at || null,
        visible: e?.visible || false,
      }
    })
    res.json({ badges })
  } catch (err) {
    console.error('Points badges error:', err.message)
    res.status(500).json({ error: 'Failed to get badges' })
  }
})

/**
 * PUT /api/points/badges/:badgeKey/visibility — Toggle badge visibility
 */
pointsRouter.put('/badges/:badgeKey/visibility', async (req, res) => {
  try {
    const { visible } = req.body
    if (typeof visible !== 'boolean') {
      return res.status(400).json({ error: 'visible must be a boolean' })
    }
    const updated = await pointsRepo.setBadgeVisibility(
      req.user.userId,
      req.params.badgeKey,
      visible
    )
    if (!updated) {
      return res.status(404).json({ error: 'Badge not found' })
    }
    res.json({ ok: true })
  } catch (err) {
    console.error('Badge visibility error:', err.message)
    res.status(500).json({ error: 'Failed to update badge' })
  }
})
