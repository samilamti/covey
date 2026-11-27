/**
 * In-memory sliding window rate limiter. No Redis needed: single-process VPS only.
 * Sets X-RateLimit-* headers on every response and Retry-After on a 429.
 */

import { log } from '../logger.js'

/**
 * Create a rate limiter middleware.
 * @param {object} options
 * @param {number} options.windowMs - Time window in milliseconds
 * @param {number} options.max - Max requests per window
 * @param {function} [options.keyFn] - Function to extract rate limit key from req (default: IP)
 * @param {string} [options.message] - Error message
 * @param {string} [options.name] - Short identifier logged with the warn event (e.g. "auth")
 */
export function rateLimit({ windowMs, max, keyFn, message, name } = {}) {
  const window = windowMs || 60_000
  const limit = max || 100
  const msg = message || 'Too many requests, please try again later'
  const getKey = keyFn || ((req) => req.ip || req.socket.remoteAddress || 'unknown')
  const limiterName = name || 'rate_limit'

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

    // Seconds until the oldest counted request leaves the window; 0 when empty.
    const oldest = data.timestamps[0]
    const resetSecs = oldest ? Math.max(0, Math.ceil((oldest + window - now) / 1000)) : 0

    if (data.timestamps.length >= limit) {
      if (process.env.LOG_HTTP !== 'off') {
        log.warn('rate_limit_exceeded', {
          event: 'rate_limit_exceeded',
          limiter: limiterName,
          limit,
          window_ms: window,
          method: req.method,
          path: req.path,
        })
      }
      setRateLimitHeaders(res, limit, 0, resetSecs)
      if (typeof res.setHeader === 'function') {
        res.setHeader('Retry-After', String(resetSecs))
      }
      // request_id in the body too, so a user's screenshot of the 429 can be traced.
      const body = { error: msg }
      if (req.requestId) body.request_id = req.requestId
      return res.status(429).json(body)
    }

    data.timestamps.push(now)
    // This request counts, so remaining is one less than it would have been.
    setRateLimitHeaders(res, limit, Math.max(0, limit - data.timestamps.length), resetSecs)
    next()
  }
}

// Guarded: some test mocks don't implement setHeader.
function setRateLimitHeaders(res, limit, remaining, resetSecs) {
  if (typeof res.setHeader !== 'function') return
  res.setHeader('X-RateLimit-Limit', String(limit))
  res.setHeader('X-RateLimit-Remaining', String(remaining))
  res.setHeader('X-RateLimit-Reset', String(resetSecs))
}

/**
 * Pre-configured rate limiters for common use cases.
 */
export const authRateLimit = rateLimit({
  windowMs: 60_000,
  max: 10,
  message: 'Too many authentication attempts',
  name: 'auth',
})

export const apiRateLimit = rateLimit({
  windowMs: 60_000,
  max: 100,
  keyFn: (req) => req.user?.userId || req.ip || 'unknown',
  name: 'api',
})

export const nearbyRateLimit = rateLimit({
  windowMs: 60_000,
  max: 5,
  keyFn: (req) => req.user?.userId || req.ip || 'unknown',
  message: 'Too many discovery requests',
  name: 'nearby',
})
