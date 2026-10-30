/**
 * Assistance request routes.
 */

import { Router } from 'express'
import { authenticate } from '../auth/index.js'
import * as reqRepo from '../repositories/requests.js'
import * as msgRepo from '../repositories/messages.js'
import * as userRepo from '../repositories/users.js'
import * as ratingRepo from '../repositories/ratings.js'
import { checkEligibility } from '../services/eligibility.js'
import { notifyNewRequest, notifyRequestAccepted } from '../services/notifications.js'
import { isEnabled } from '../features.js'
import * as pointsRepo from '../repositories/points.js'
import { log } from '../logger.js'

export const requestRouter = Router()

requestRouter.use(authenticate)

/**
 * POST /api/requests — Create a new request
 * communityId is optional — omit for freestanding requests.
 */
requestRouter.post('/', async (req, res) => {
  const { type, message, pickupLat, pickupLng, destinationLat, destinationLng, eligibilityTier } = req.body

  const validTiers = ['same_demographics', 'verified_guardians', 'any_member']
  const tier = eligibilityTier && validTiers.includes(eligibilityTier) ? eligibilityTier : 'same_demographics'

  try {
    const request = await reqRepo.create({
      requesterId: req.user.userId,
      type,
      message,
      eligibilityTier: tier,
      pickupLat: pickupLat ? parseFloat(pickupLat) : null,
      pickupLng: pickupLng ? parseFloat(pickupLng) : null,
      destinationLat: destinationLat ? parseFloat(destinationLat) : null,
      destinationLng: destinationLng ? parseFloat(destinationLng) : null,
    })

    // Broadcast to other clients via Socket.io
    const io = req.app.get('io')
    if (io) {
      io.to('requests:open').emit('request:new', { request })
    }

    // Push-notify eligible responders (fire-and-forget)
    notifyNewRequest(request).catch(() => {})

    res.status(201).json({ request })
  } catch (err) {
    log.error(err, { event: 'create_request_failed', user: req.user.userId })
    res.status(500).json({ error: 'Failed to create request' })
  }
})

/**
 * GET /api/requests — My requests (as requester or helper)
 */
requestRouter.get('/', async (req, res) => {
  try {
    const requests = await reqRepo.findByUser(req.user.userId)
    res.json({ requests })
  } catch (err) {
    log.error(err, { event: 'list_requests_failed', user: req.user.userId })
    res.status(500).json({ error: 'Failed to list requests' })
  }
})

/**
 * GET /api/requests/open — Open freestanding requests (no community)
 */
requestRouter.get('/open', async (req, res) => {
  try {
    const [helper, score] = await Promise.all([
      userRepo.findById(req.user.userId),
      ratingRepo.getSafetyScore(req.user.userId),
    ])
    const requests = await reqRepo.findOpenFreestanding({
      userId: req.user.userId,
      sex: helper?.sex || null,
      birthYear: helper?.birth_year || null,
      safetyScore: score,
    })
    res.json({ requests })
  } catch (err) {
    log.error(err, { event: 'list_open_requests_failed', user: req.user.userId })
    res.status(500).json({ error: 'Failed to list open requests' })
  }
})

/**
 * GET /api/requests/:id/messages — Message history for a session
 */
requestRouter.get('/:id/messages', async (req, res) => {
  try {
    const request = await reqRepo.findById(req.params.id)
    if (!request) return res.status(404).json({ error: 'Request not found' })

    const isParticipant =
      req.user.userId === request.requester_id ||
      req.user.userId === request.helper_id
    if (!isParticipant) return res.status(403).json({ error: 'Not a participant' })

    const messages = await msgRepo.findByRequest(req.params.id)
    res.json({ messages })
  } catch (err) {
    log.error(err, { event: 'list_messages_failed', requestId: req.params.id })
    res.status(500).json({ error: 'Failed to load messages' })
  }
})

/**
 * GET /api/requests/:id — Request detail
 */
requestRouter.get('/:id', async (req, res) => {
  try {
    const request = await reqRepo.findById(req.params.id)
    if (!request) return res.status(404).json({ error: 'Request not found' })
    res.json({ request })
  } catch (err) {
    log.error(err, { event: 'request_detail_failed', requestId: req.params.id })
    res.status(500).json({ error: 'Failed to get request' })
  }
})

/**
 * POST /api/requests/:id/accept — Accept (become helper)
 */
requestRouter.post('/:id/accept', async (req, res) => {
  try {
    const existing = await reqRepo.findById(req.params.id)
    if (!existing || existing.status !== 'open') {
      return res.status(409).json({ error: 'Request not available for acceptance' })
    }

    if (existing.requester_id === req.user.userId) {
      return res.status(403).json({ error: 'Cannot accept your own request' })
    }

    const eligible = await checkEligibility(existing, req.user.userId)
    if (!eligible) {
      return res.status(403).json({ error: 'You are not eligible to accept this request' })
    }

    const request = await reqRepo.acceptAndStart(req.params.id, req.user.userId)
    if (!request) return res.status(409).json({ error: 'Request not available for acceptance' })

    // Broadcast socket events so other clients update in real-time
    const io = req.app.get('io')
    if (io) {
      io.to('requests:open').emit('request:accepted', { requestId: request.id })
      io.to(`user:${request.requester_id}`).emit('request:accepted', {
        requestId: request.id,
        request,
      })
    }

    // Push notification to requester (fire-and-forget)
    notifyRequestAccepted(request).catch(() => {})

    res.json({ request })
  } catch (err) {
    log.error(err, { event: 'accept_request_failed', requestId: req.params.id })
    res.status(500).json({ error: 'Failed to accept request' })
  }
})

/**
 * POST /api/requests/:id/start — Mark active
 */
requestRouter.post('/:id/start', async (req, res) => {
  try {
    const request = await reqRepo.start(req.params.id)
    if (!request) return res.status(409).json({ error: 'Request not ready to start' })
    res.json({ request })
  } catch (err) {
    log.error(err, { event: 'start_request_failed', requestId: req.params.id })
    res.status(500).json({ error: 'Failed to start session' })
  }
})

/**
 * POST /api/requests/:id/done/accept — Accept a pending done proposal
 */
requestRouter.post('/:id/done/accept', async (req, res) => {
  try {
    const existing = await reqRepo.findById(req.params.id)
    if (!existing) return res.status(404).json({ error: 'Request not found' })

    const isParticipant =
      req.user.userId === existing.requester_id ||
      req.user.userId === existing.helper_id
    if (!isParticipant) return res.status(403).json({ error: 'Not a participant' })

    if (existing.done_initiated_by === req.user.userId) {
      return res.status(403).json({ error: 'Cannot accept your own done proposal' })
    }

    if (existing.status !== 'done_pending') {
      return res.status(409).json({ error: 'No pending done proposal' })
    }

    const request = await reqRepo.acceptDone(req.params.id)
    if (!request) return res.status(409).json({ error: 'Failed to accept done' })

    const io = req.app.get('io')
    if (io) {
      io.to(`user:${request.requester_id}`).emit('request:completed', { requestId: request.id })
      if (request.helper_id) {
        io.to(`user:${request.helper_id}`).emit('request:completed', { requestId: request.id })
      }
    }

    if (isEnabled('POINTS_SYSTEM') && request.requester_id && request.helper_id) {
      pointsRepo.awardSessionPoints({
        requestId: request.id,
        requesterId: request.requester_id,
        helperId: request.helper_id,
      }).catch(err => log.error(err, { event: 'points_award_failed' }))
    }

    res.json({ request })
  } catch (err) {
    log.error(err, { event: 'done_accept_failed', requestId: req.params.id })
    res.status(500).json({ error: 'Failed to accept done' })
  }
})

/**
 * POST /api/requests/:id/done/reject — Reject a pending done proposal
 */
requestRouter.post('/:id/done/reject', async (req, res) => {
  try {
    const existing = await reqRepo.findById(req.params.id)
    if (!existing) return res.status(404).json({ error: 'Request not found' })

    const isParticipant =
      req.user.userId === existing.requester_id ||
      req.user.userId === existing.helper_id
    if (!isParticipant) return res.status(403).json({ error: 'Not a participant' })

    if (existing.done_initiated_by === req.user.userId) {
      return res.status(403).json({ error: 'Cannot reject your own done proposal' })
    }

    if (existing.status !== 'done_pending') {
      return res.status(409).json({ error: 'No pending done proposal' })
    }

    const request = await reqRepo.rejectDone(req.params.id)
    if (!request) return res.status(409).json({ error: 'Failed to reject done' })

    const io = req.app.get('io')
    if (io) {
      io.to(`user:${existing.done_initiated_by}`).emit('request:done-rejected', { requestId: request.id })
      io.to(`user:${req.user.userId}`).emit('request:done-rejected', { requestId: request.id })
    }

    res.json({ request })
  } catch (err) {
    log.error(err, { event: 'done_reject_failed', requestId: req.params.id })
    res.status(500).json({ error: 'Failed to reject done' })
  }
})

/**
 * POST /api/requests/:id/done/cancel — Initiator retracts their done proposal
 */
requestRouter.post('/:id/done/cancel', async (req, res) => {
  try {
    const existing = await reqRepo.findById(req.params.id)
    if (!existing) return res.status(404).json({ error: 'Request not found' })

    const isParticipant =
      req.user.userId === existing.requester_id ||
      req.user.userId === existing.helper_id
    if (!isParticipant) return res.status(403).json({ error: 'Not a participant' })

    if (existing.done_initiated_by !== req.user.userId) {
      return res.status(403).json({ error: 'Only the initiator can cancel a done proposal' })
    }

    if (existing.status !== 'done_pending') {
      return res.status(409).json({ error: 'No pending done proposal' })
    }

    const request = await reqRepo.rejectDone(req.params.id)
    if (!request) return res.status(409).json({ error: 'Failed to cancel done' })

    const io = req.app.get('io')
    if (io) {
      io.to(`user:${existing.requester_id}`).emit('request:done-cancelled', { requestId: request.id })
      if (existing.helper_id) {
        io.to(`user:${existing.helper_id}`).emit('request:done-cancelled', { requestId: request.id })
      }
    }

    res.json({ request })
  } catch (err) {
    log.error(err, { event: 'done_cancel_failed', requestId: req.params.id })
    res.status(500).json({ error: 'Failed to cancel done' })
  }
})

/**
 * POST /api/requests/:id/done — Initiate a "done" proposal
 */
requestRouter.post('/:id/done', async (req, res) => {
  try {
    const existing = await reqRepo.findById(req.params.id)
    if (!existing) return res.status(404).json({ error: 'Request not found' })

    const isParticipant =
      req.user.userId === existing.requester_id ||
      req.user.userId === existing.helper_id
    if (!isParticipant) return res.status(403).json({ error: 'Not a participant' })

    // Race condition: if already done_pending by the OTHER party, auto-accept
    if (existing.status === 'done_pending') {
      if (existing.done_initiated_by !== req.user.userId) {
        const completed = await reqRepo.acceptDone(req.params.id)
        if (completed) {
          const io = req.app.get('io')
          if (io) {
            io.to(`user:${completed.requester_id}`).emit('request:completed', { requestId: completed.id })
            if (completed.helper_id) {
              io.to(`user:${completed.helper_id}`).emit('request:completed', { requestId: completed.id })
            }
          }
          if (isEnabled('POINTS_SYSTEM') && completed.requester_id && completed.helper_id) {
            pointsRepo.awardSessionPoints({
              requestId: completed.id,
              requesterId: completed.requester_id,
              helperId: completed.helper_id,
            }).catch(err => log.error(err, { event: 'points_award_failed' }))
          }
          return res.json({ request: completed })
        }
      }
      // Already initiated by this user — idempotent
      return res.json({ request: existing })
    }

    if (existing.status !== 'active') {
      return res.status(409).json({ error: 'Request is not active' })
    }

    const request = await reqRepo.initiateDone(req.params.id, req.user.userId)
    if (!request) return res.status(409).json({ error: 'Request is not active' })

    const io = req.app.get('io')
    if (io) {
      const otherUserId = req.user.userId === request.requester_id
        ? request.helper_id
        : request.requester_id
      io.to(`user:${req.user.userId}`).emit('request:done-initiated', {
        requestId: request.id,
        initiatedBy: req.user.userId,
      })
      if (otherUserId) {
        io.to(`user:${otherUserId}`).emit('request:done-initiated', {
          requestId: request.id,
          initiatedBy: req.user.userId,
        })
      }
    }

    res.json({ request })
  } catch (err) {
    log.error(err, { event: 'done_initiate_failed', requestId: req.params.id })
    res.status(500).json({ error: 'Failed to initiate done' })
  }
})

/**
 * POST /api/requests/:id/complete — Legacy endpoint, redirects to done flow
 */
requestRouter.post('/:id/complete', async (req, res) => {
  try {
    const existing = await reqRepo.findById(req.params.id)
    if (!existing) return res.status(404).json({ error: 'Request not found' })

    // Use the done flow instead of direct completion
    const request = await reqRepo.initiateDone(req.params.id, req.user.userId)
    if (!request) return res.status(409).json({ error: 'Request not active' })

    const io = req.app.get('io')
    if (io) {
      const otherUserId = req.user.userId === request.requester_id
        ? request.helper_id
        : request.requester_id
      io.to(`user:${req.user.userId}`).emit('request:done-initiated', {
        requestId: request.id,
        initiatedBy: req.user.userId,
      })
      if (otherUserId) {
        io.to(`user:${otherUserId}`).emit('request:done-initiated', {
          requestId: request.id,
          initiatedBy: req.user.userId,
        })
      }
    }

    res.json({ request })
  } catch (err) {
    log.error(err, { event: 'complete_request_failed', requestId: req.params.id })
    res.status(500).json({ error: 'Failed to complete session' })
  }
})

/**
 * POST /api/requests/:id/confirm-safety — Requester confirms safe arrival
 */
requestRouter.post('/:id/confirm-safety', async (req, res) => {
  try {
    const request = await reqRepo.confirmSafety(req.params.id)
    if (!request) return res.status(409).json({ error: 'Request not completed' })
    res.json({ request })
  } catch (err) {
    log.error(err, { event: 'confirm_safety_failed', requestId: req.params.id })
    res.status(500).json({ error: 'Failed to confirm safety' })
  }
})

/**
 * POST /api/requests/:id/cancel — Cancel a request
 */
requestRouter.post('/:id/cancel', async (req, res) => {
  try {
    const request = await reqRepo.cancel(req.params.id)
    if (!request) return res.status(409).json({ error: 'Request cannot be cancelled' })
    res.json({ request })
  } catch (err) {
    log.error(err, { event: 'cancel_request_failed', requestId: req.params.id })
    res.status(500).json({ error: 'Failed to cancel request' })
  }
})
