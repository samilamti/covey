/**
 * Socket.io event handlers.
 *
 * JWT authentication middleware runs before connection.
 * After auth, the socket joins the user's personal room.
 * Handles community subscriptions and request/location events.
 */

import { verifyToken } from './auth/jwt.js'
import * as reqRepo from './repositories/requests.js'
import * as msgRepo from './repositories/messages.js'
import { processLocationUpdate } from './services/geolocation.js'
import { checkEligibility } from './services/eligibility.js'
import { notifyNewRequest, notifyRequestAccepted } from './services/notifications.js'

/**
 * Register Socket.io middleware and event handlers.
 * @param {import('socket.io').Server} io
 */
export function registerSocketHandlers(io) {
  // --- JWT authentication middleware ---
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token
    if (!token) {
      return next(new Error('Authentication required'))
    }

    try {
      const payload = await verifyToken(token)
      socket.user = {
        userId: payload.userId,
        sub: payload.sub,
        name: payload.name,
        provider: payload.provider,
      }
      next()
    } catch {
      next(new Error('Invalid or expired token'))
    }
  })

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id} (user: ${socket.user.name})`)

    // Join user's personal room for targeted events
    socket.join(`user:${socket.user.userId}`)

    // Join the open requests room for request events
    socket.join('requests:open')

    // --- Assistance request events ---

    /**
     * request:create — create a new assistance request
     */
    socket.on('request:create', async (data) => {
      const { type, message, pickupLat, pickupLng, destLat, destLng, eligibilityTier } = data || {}

      try {
        const validTiers = ['same_demographics', 'verified_guardians', 'any_member']
        const tier = eligibilityTier && validTiers.includes(eligibilityTier) ? eligibilityTier : 'same_demographics'

        const request = await reqRepo.create({
          requesterId: socket.user.userId,
          type,
          message,
          eligibilityTier: tier,
          pickupLat: pickupLat ? parseFloat(pickupLat) : null,
          pickupLng: pickupLng ? parseFloat(pickupLng) : null,
          destinationLat: destLat ? parseFloat(destLat) : null,
          destinationLng: destLng ? parseFloat(destLng) : null,
        })

        io.to('requests:open').emit('request:new', { request })

        // Push-notify eligible responders (fire-and-forget)
        notifyNewRequest(request).catch(() => {})
      } catch (err) {
        console.error('Socket request:create error:', err.message)
        socket.emit('error', { message: 'Failed to create request' })
      }
    })

    /**
     * request:accept — accept an assistance request
     */
    socket.on('request:accept', async ({ requestId }) => {
      if (!requestId) return

      try {
        // Check eligibility before accepting
        const existing = await reqRepo.findById(requestId)
        if (!existing || existing.status !== 'open') {
          socket.emit('error', { message: 'Request not available' })
          return
        }

        if (existing.requester_id === socket.user.userId) {
          socket.emit('error', { message: 'Cannot accept your own request' })
          return
        }

        const eligible = await checkEligibility(existing, socket.user.userId)
        if (!eligible) {
          socket.emit('error', { message: 'Not eligible to accept this request' })
          return
        }

        const request = await reqRepo.acceptAndStart(requestId, socket.user.userId)
        if (!request) {
          socket.emit('error', { message: 'Request not available' })
          return
        }

        // Notify the room (so other potential helpers remove the request)
        io.to('requests:open').emit('request:accepted', { requestId })
        // Notify the requester with full request data for auto-entering ActiveSession
        io.to(`user:${request.requester_id}`).emit('request:accepted', {
          requestId,
          request,
        })

        // Push notification to requester (fire-and-forget)
        notifyRequestAccepted(request).catch(() => {})
      } catch (err) {
        console.error('Socket request:accept error:', err.message)
      }
    })

    /**
     * request:complete — initiate a "done" proposal (legacy event name, now uses done flow)
     */
    socket.on('request:complete', async ({ requestId }) => {
      if (!requestId) return

      try {
        const existing = await reqRepo.findById(requestId)
        if (!existing) return

        const isParticipant =
          socket.user.userId === existing.requester_id ||
          socket.user.userId === existing.helper_id
        if (!isParticipant) return

        // Race condition: already done_pending by other party → auto-accept
        if (existing.status === 'done_pending' && existing.done_initiated_by !== socket.user.userId) {
          const completed = await reqRepo.acceptDone(requestId)
          if (completed) {
            io.to(`user:${completed.requester_id}`).emit('request:completed', { requestId })
            if (completed.helper_id) {
              io.to(`user:${completed.helper_id}`).emit('request:completed', { requestId })
            }
          }
          return
        }

        const request = await reqRepo.initiateDone(requestId, socket.user.userId)
        if (!request) return

        const otherUserId = socket.user.userId === request.requester_id
          ? request.helper_id
          : request.requester_id

        io.to(`user:${socket.user.userId}`).emit('request:done-initiated', {
          requestId,
          initiatedBy: socket.user.userId,
        })
        if (otherUserId) {
          io.to(`user:${otherUserId}`).emit('request:done-initiated', {
            requestId,
            initiatedBy: socket.user.userId,
          })
        }
      } catch (err) {
        console.error('Socket request:complete error:', err.message)
      }
    })

    /**
     * request:done-accept — accept a pending done proposal
     */
    socket.on('request:done-accept', async ({ requestId }) => {
      if (!requestId) return

      try {
        const existing = await reqRepo.findById(requestId)
        if (!existing || existing.status !== 'done_pending') return

        if (existing.done_initiated_by === socket.user.userId) return

        const isParticipant =
          socket.user.userId === existing.requester_id ||
          socket.user.userId === existing.helper_id
        if (!isParticipant) return

        const request = await reqRepo.acceptDone(requestId)
        if (!request) return

        io.to(`user:${request.requester_id}`).emit('request:completed', { requestId })
        if (request.helper_id) {
          io.to(`user:${request.helper_id}`).emit('request:completed', { requestId })
        }
      } catch (err) {
        console.error('Socket request:done-accept error:', err.message)
      }
    })

    /**
     * request:done-reject — reject a pending done proposal
     */
    socket.on('request:done-reject', async ({ requestId }) => {
      if (!requestId) return

      try {
        const existing = await reqRepo.findById(requestId)
        if (!existing || existing.status !== 'done_pending') return

        if (existing.done_initiated_by === socket.user.userId) return

        const isParticipant =
          socket.user.userId === existing.requester_id ||
          socket.user.userId === existing.helper_id
        if (!isParticipant) return

        const request = await reqRepo.rejectDone(requestId)
        if (!request) return

        io.to(`user:${existing.done_initiated_by}`).emit('request:done-rejected', { requestId })
        io.to(`user:${socket.user.userId}`).emit('request:done-rejected', { requestId })
      } catch (err) {
        console.error('Socket request:done-reject error:', err.message)
      }
    })

    /**
     * request:done-cancel — initiator retracts their done proposal
     */
    socket.on('request:done-cancel', async ({ requestId }) => {
      if (!requestId) return

      try {
        const existing = await reqRepo.findById(requestId)
        if (!existing || existing.status !== 'done_pending') return

        if (existing.done_initiated_by !== socket.user.userId) return

        const isParticipant =
          socket.user.userId === existing.requester_id ||
          socket.user.userId === existing.helper_id
        if (!isParticipant) return

        const request = await reqRepo.rejectDone(requestId)
        if (!request) return

        io.to(`user:${existing.requester_id}`).emit('request:done-cancelled', { requestId })
        if (existing.helper_id) {
          io.to(`user:${existing.helper_id}`).emit('request:done-cancelled', { requestId })
        }
      } catch (err) {
        console.error('Socket request:done-cancel error:', err.message)
      }
    })

    /**
     * request:cancel — cancel a request
     */
    socket.on('request:cancel', async ({ requestId }) => {
      if (!requestId) return

      try {
        const request = await reqRepo.cancel(requestId)
        if (!request) return

        io.to('requests:open').emit('request:cancelled', { requestId })

        // Notify helper if one was assigned
        if (request.helper_id) {
          io.to(`user:${request.helper_id}`).emit('request:cancelled', { requestId })
        }
      } catch (err) {
        console.error('Socket request:cancel error:', err.message)
      }
    })

    // --- Location sharing ---

    /**
     * location:update — relay location to the other party in an active session
     */
    socket.on('location:update', async ({ requestId, lat, lng, accuracy }) => {
      if (!requestId || lat == null || lng == null) return

      try {
        const result = await processLocationUpdate({
          requestId,
          userId: socket.user.userId,
          latitude: parseFloat(lat),
          longitude: parseFloat(lng),
          accuracyM: accuracy != null ? parseFloat(accuracy) : null,
        })

        if (!result) return // Rate limited or invalid

        // Find the request to determine the other party
        const request = await reqRepo.findById(requestId)
        if (!request) return

        // Only relay during accepted/active/done_pending sessions
        if (!['accepted', 'active', 'done_pending'].includes(request.status)) return

        const targetUserId =
          socket.user.userId === request.requester_id
            ? request.helper_id
            : request.requester_id

        if (targetUserId) {
          io.to(`user:${targetUserId}`).emit('request:locationUpdate', {
            requestId,
            userId: socket.user.userId,
            lat: parseFloat(lat),
            lng: parseFloat(lng),
            accuracy,
          })
        }
      } catch (err) {
        console.error('Socket location:update error:', err.message)
      }
    })

    // --- Session messaging ---

    const msgLastSend = new Map()
    const MSG_MIN_INTERVAL = 2000

    /**
     * message:send — send a short message to the other party in an active/accepted session
     */
    socket.on('message:send', async ({ requestId, content, isQuick }) => {
      if (!requestId || !content) return

      const trimmed = String(content).trim()
      if (trimmed.length === 0 || trimmed.length > 200) return

      // Rate limit: 1 message per 2s per user per request
      const msgKey = `${socket.user.userId}:${requestId}`
      const lastSend = msgLastSend.get(msgKey)
      if (lastSend && Date.now() - lastSend < MSG_MIN_INTERVAL) return
      msgLastSend.set(msgKey, Date.now())

      try {
        const request = await reqRepo.findById(requestId)
        if (!request) return

        // Only participants in accepted/active sessions can message
        const isParticipant =
          socket.user.userId === request.requester_id ||
          socket.user.userId === request.helper_id
        if (!isParticipant) return
        if (!['accepted', 'active', 'done_pending'].includes(request.status)) return

        const message = await msgRepo.create({
          requestId,
          senderId: socket.user.userId,
          content: trimmed,
          isQuick: !!isQuick,
        })

        const payload = {
          requestId,
          message: {
            id: message.id,
            senderId: message.sender_id,
            content: message.content,
            isQuick: message.is_quick,
            createdAt: message.created_at,
          },
        }

        // Send to the other party
        const targetUserId =
          socket.user.userId === request.requester_id
            ? request.helper_id
            : request.requester_id
        if (targetUserId) {
          io.to(`user:${targetUserId}`).emit('message:received', payload)
        }

        // Acknowledge to sender
        socket.emit('message:sent', payload)
      } catch (err) {
        console.error('Socket message:send error:', err.message)
      }
    })

    socket.on('disconnect', (reason) => {
      console.log(`Socket disconnected: ${socket.id} (${reason})`)
    })
  })
}
