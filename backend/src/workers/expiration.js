/**
 * Request expiration worker.
 *
 * Runs in-process via setInterval every 60 seconds.
 * Finds non-terminal requests past their expires_at (2-hour hard limit)
 * and marks them as expired. Covers open, accepted, active, and done_pending.
 */

import * as reqRepo from '../repositories/requests.js'

const INTERVAL_MS = 60_000

/**
 * Start the expiration worker. Optionally accepts a Socket.io server
 * to emit expiration events.
 * @param {import('socket.io').Server} [io]
 */
export function startExpirationWorker(io) {
  setInterval(async () => {
    try {
      const expired = await reqRepo.expireOldRequests()
      if (expired.length > 0) {
        console.log(`Expired ${expired.length} request(s)`)
        if (io) {
          for (const req of expired) {
            // Always notify the open requests room (for list updates)
            io.to('requests:open').emit('request:expired', {
              requestId: req.id,
            })
            // Notify session participants directly (requester + helper)
            if (req.requester_id) {
              io.to(`user:${req.requester_id}`).emit('request:expired', {
                requestId: req.id,
              })
            }
            if (req.helper_id) {
              io.to(`user:${req.helper_id}`).emit('request:expired', {
                requestId: req.id,
              })
            }
          }
        }
      }
    } catch (err) {
      console.error('Expiration worker error:', err.message)
    }
  }, INTERVAL_MS)

  console.log('Expiration worker started (60s interval)')
}
