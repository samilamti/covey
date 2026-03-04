/**
 * In-memory sliding window rate limiter.
 *
 * No Redis needed — suitable for single-process deployment on a VPS.
 */

/**
 * Create a rate limiter middleware.
 * @param {object} options
 * @param {number} options.windowMs - Time window in milliseconds
 * @param {number} options.max - Max requests per window
 * @param {function} [options.keyFn] - Function to extract rate limit key from req (default: IP)
 * @param {string} [options.message] - Error message
 */
export function rateLimit({ windowMs, max, keyFn, message } = {}) {
  const window = windowMs || 60_000
  const limit = max || 100
  const msg = message || 'Too many requests, please try again later'
  const getKey = keyFn || ((req) => req.ip || req.socket.remoteAddress || 'unknown')

  /** Map<key, { timestamps: number[] }> */
  const clients = new Map()

  // Cleanup old entries every window period (unref so it doesn't prevent process exit)
  const cleanup = setInterval(() => {
    const now = Date.now()
    for (const [key, data] of clients) {
      data.timestamps = data.timestamps.filter((t) => now - t < window)
      if (data.timestamps.length === 0) {
        clients.delete(key)
      }
    }
  }, window)
  cleanup.unref()

  return (req, res, next) => {
    const key = getKey(req)
    const now = Date.now()

    if (!clients.has(key)) {
      clients.set(key, { timestamps: [] })
    }

    const data = clients.get(key)
    // Remove timestamps outside the window
    data.timestamps = data.timestamps.filter((t) => now - t < window)

    if (data.timestamps.length >= limit) {
      return res.status(429).json({ error: msg })
    }

    data.timestamps.push(now)
    next()
  }
}

/**
 * Pre-configured rate limiters for common use cases.
 */
export const authRateLimit = rateLimit({
  windowMs: 60_000,
  max: 10,
  message: 'Too many authentication attempts',
})

export const apiRateLimit = rateLimit({
  windowMs: 60_000,
  max: 100,
  keyFn: (req) => req.user?.userId || req.ip || 'unknown',
})

export const nearbyRateLimit = rateLimit({
  windowMs: 60_000,
  max: 5,
  keyFn: (req) => req.user?.userId || req.ip || 'unknown',
  message: 'Too many discovery requests',
})
