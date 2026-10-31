/**
 * Request expiration worker.
 *
 * Runs in-process via setInterval every 60 seconds.
 * Finds non-terminal requests past their expires_at (2-hour hard limit)
 * and marks them as expired. Covers open, accepted, active, and done_pending.
 */

import * as reqRepo from '../repositories/requests.js'
import { log } from '../logger.js'

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
        log.info('requests_expired', { count: expired.length })
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
      // Pass the Error so the stack reaches the log aggregator; a tick that
      // repeatedly fails is the kind of thing you want a trace for.
      log.error(err, { event: 'expiration_worker_failed' })
    }
  }, INTERVAL_MS)

  log.info('expiration_worker_started', { interval_ms: INTERVAL_MS })
}
