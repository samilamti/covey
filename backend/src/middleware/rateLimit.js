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
 *
 * Every response — allowed OR blocked — carries three advisory headers so a
 * well-behaved client can throttle itself before it gets a 429:
 *   X-RateLimit-Limit      total allowed in the window
 *   X-RateLimit-Remaining  how many more this key can send in the current window
 *   X-RateLimit-Reset      seconds until the oldest counted request falls out
 *                          of the window (i.e. when one slot frees up); 0 when
 *                          there is nothing to wait for
 * Blocked responses also set a standard `Retry-After: <seconds>` header so
 * clients that honour the spec can back off without reading our vendor header.
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

    // Compute reset: how many whole seconds until the oldest counted
    // timestamp drops out of the window (i.e. when the next slot opens).
    // Zero when the window is empty — there is nothing to wait for.
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
      // Advisory headers plus the standard Retry-After so a spec-compliant
      // client can back off without parsing our vendor header. On a 429
      // remaining is always 0.
      setRateLimitHeaders(res, limit, 0, resetSecs)
      if (typeof res.setHeader === 'function') {
        res.setHeader('Retry-After', String(resetSecs))
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
    // This request counts, so remaining is one less than it would have been.
    setRateLimitHeaders(res, limit, Math.max(0, limit - data.timestamps.length), resetSecs)
    next()
  }
}

/**
 * Write the three advisory `X-RateLimit-*` headers if the response supports it.
 * Guarded against test mocks that may not implement setHeader.
 */
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
