/**
 * Request expiration worker.
 *
 * Runs in-process via setInterval every 60 seconds.
 * Finds open requests past their expires_at and marks them as expired.
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
        // Emit to the appropriate room (community or freestanding)
        if (io) {
          for (const req of expired) {
            const room = req.community_id
              ? `community:${req.community_id}`
              : 'requests:open'
            io.to(room).emit('request:expired', {
              requestId: req.id,
            })
          }
        }
      }
    } catch (err) {
      console.error('Expiration worker error:', err.message)
    }
  }, INTERVAL_MS)

  console.log('Expiration worker started (60s interval)')
}
