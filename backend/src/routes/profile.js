/**
 * Profile routes.
 *
 * Security:
 *   - Own profile: full data
 *   - Other user's profile: display name + verified badge only
 */

import { Router } from 'express'
import { authenticate } from '../auth/index.js'
import * as userRepo from '../repositories/users.js'
import * as ratingRepo from '../repositories/ratings.js'
import * as pointsRepo from '../repositories/points.js'
import { isEnabled } from '../features.js'

export const profileRouter = Router()

// All profile routes require authentication
profileRouter.use(authenticate)

/**
 * GET /api/profile — Own profile
 */
profileRouter.get('/', async (req, res) => {
  try {
    const user = await userRepo.findById(req.user.userId)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    const safetyScore = await ratingRepo.getSafetyScore(req.user.userId)
    const badges = isEnabled('POINTS_SYSTEM')
      ? await pointsRepo.getBadges(req.user.userId)
      : []

    res.json({
      user: {
        id: user.id,
        displayName: user.display_name,
        givenName: user.given_name,
        surname: user.surname,
        verified: user.verified,
        preferredLang: user.preferred_lang,
        createdAt: user.created_at,
        safetyScore,
        isGuardian: safetyScore >= 5,
        hasDemographics: !!(user.birth_year && user.sex),
        badges,
      },
    })
  } catch (err) {
    console.error('Get profile error:', err.message)
    res.status(500).json({ error: 'Failed to get profile' })
  }
})

/**
 * PUT /api/profile — Update display name, preferred language
 */
profileRouter.put('/', async (req, res) => {
  const { displayName, preferredLang } = req.body

  try {
    const user = await userRepo.updateProfile(req.user.userId, {
      displayName,
      preferredLang,
    })

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    res.json({
      user: {
        id: user.id,
        displayName: user.display_name,
        givenName: user.given_name,
        surname: user.surname,
        verified: user.verified,
        preferredLang: user.preferred_lang,
      },
    })
  } catch (err) {
    console.error('Update profile error:', err.message)
    res.status(500).json({ error: 'Failed to update profile' })
  }
})

/**
 * DELETE /api/profile — GDPR: request soft deletion
 */
profileRouter.delete('/', async (req, res) => {
  try {
    const success = await userRepo.softDelete(req.user.userId)
    if (!success) {
      return res.status(404).json({ error: 'User not found' })
    }
    res.json({ ok: true, message: 'Account will be permanently deleted after 30 days.' })
  } catch (err) {
    console.error('Delete profile error:', err.message)
    res.status(500).json({ error: 'Failed to delete account' })
  }
})

/**
 * GET /api/profile/:userId — Other user's public profile
 * Only returns display name + verified badge.
 */
profileRouter.get('/:userId', async (req, res) => {
  try {
    const user = await userRepo.findById(req.params.userId)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    const safetyScore = await ratingRepo.getSafetyScore(req.params.userId)
    const visibleBadges = isEnabled('POINTS_SYSTEM')
      ? (await pointsRepo.getBadges(req.params.userId)).filter(b => b.visible)
      : []

    res.json({
      user: {
        id: user.id,
        displayName: user.display_name,
        verified: user.verified,
        safetyScore,
        isGuardian: safetyScore >= 5,
        badges: visibleBadges,
      },
    })
  } catch (err) {
    console.error('Get public profile error:', err.message)
    res.status(500).json({ error: 'Failed to get profile' })
  }
})
