/**
 * In-memory sliding window rate limiter.
 *
 * No Redis needed — suitable for single-process deployment on a VPS.
 *
 * When the limit is hit, emits a one-line `event: rate_limit_exceeded` warn
 * log carrying the limiter's `name`, `limit`, `window_ms`, and the request's
 * method and path. The access log already records the 429 response and (when
 * authenticated) the user id for the same request, and the request-id
 * middleware ties the two lines together — so an operator can tell WHICH
 * limiter fired and reach the full context without the limiter itself ever
 * logging an IP. Set `LOG_HTTP=off` to silence it alongside the access log.
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
      // Mirror the errorLogger convention: surface the correlation id in the
      // body too so a user who screenshots a 429 can quote something that an
      // operator can grep straight to the matching log lines. The id is also
      // on the X-Request-Id response header, but a header is invisible to a
      // user staring at an error message.
      const body = { error: msg }
      if (req.requestId) body.request_id = req.requestId
      return res.status(429).json(body)
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
