/**
 * Rate-limited location relay service.
 *
 * Ensures a user can only send location updates once every 5 seconds
 * per request session. Prevents flooding the DB and WebSocket.
 */

import * as reqRepo from '../repositories/requests.js'

/** In-memory rate limit: userId → last update timestamp */
const lastUpdate = new Map()

const MIN_INTERVAL_MS = 5000

/**
 * Process and relay a location update.
 * @returns {object|null} The saved location update, or null if rate-limited
 */
export async function processLocationUpdate({ requestId, userId, latitude, longitude, accuracyM }) {
  const now = Date.now()
  const key = `${userId}:${requestId}`
  const last = lastUpdate.get(key)

  if (last && now - last < MIN_INTERVAL_MS) {
    return null // Rate limited
  }

  lastUpdate.set(key, now)

  return reqRepo.saveLocationUpdate({
    requestId,
    userId,
    latitude,
    longitude,
    accuracyM,
  })
}

/**
 * Clear rate limit entries for a request (on completion/cancellation).
 */
export function clearRateLimit(requestId) {
  for (const key of lastUpdate.keys()) {
    if (key.endsWith(`:${requestId}`)) {
      lastUpdate.delete(key)
    }
  }
}
