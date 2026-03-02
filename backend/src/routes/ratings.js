/**
 * Rating routes — post-session safety ratings.
 */

import { Router } from 'express'
import { authenticate } from '../auth/index.js'
import * as ratingRepo from '../repositories/ratings.js'
import * as reqRepo from '../repositories/requests.js'

export const ratingRouter = Router()

ratingRouter.use(authenticate)

/**
 * GET /api/ratings/pending — Requests awaiting rating by this user
 */
ratingRouter.get('/pending', async (req, res) => {
  try {
    const pending = await ratingRepo.findPendingRatings(req.user.userId)
    res.json({ pending })
  } catch (err) {
    console.error('Pending ratings error:', err.message)
    res.status(500).json({ error: 'Failed to get pending ratings' })
  }
})

/**
 * POST /api/ratings — Submit a rating
 * Body: { requestId, value }
 * value: 1 (SAFE), 0 (NEUTRAL), -3 (UNCOMFORTABLE)
 */
ratingRouter.post('/', async (req, res) => {
  const { requestId, value } = req.body

  if (!requestId || typeof requestId !== 'string') {
    return res.status(400).json({ error: 'requestId is required' })
  }

  if (![1, 0, -3].includes(value)) {
    return res.status(400).json({ error: 'value must be 1, 0, or -3' })
  }

  try {
    const request = await reqRepo.findById(requestId)
    if (!request) {
      return res.status(404).json({ error: 'Request not found' })
    }

    if (request.status !== 'safety_confirmed') {
      return res.status(409).json({ error: 'Request must be safety_confirmed before rating' })
    }

    const isRequester = request.requester_id === req.user.userId
    const isHelper = request.helper_id === req.user.userId
    if (!isRequester && !isHelper) {
      return res.status(403).json({ error: 'You did not participate in this request' })
    }

    const ratedId = isRequester ? request.helper_id : request.requester_id

    const rating = await ratingRepo.submitRating({
      requestId,
      raterId: req.user.userId,
      ratedId,
      value,
    })

    res.status(201).json({ rating })
  } catch (err) {
    console.error('Submit rating error:', err.message)
    res.status(500).json({ error: 'Failed to submit rating' })
  }
})
