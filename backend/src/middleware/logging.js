/**
 * HTTP access + error logging middleware.
 *
 * `httpLogger` emits one structured line per completed response (method, path,
 * status, duration_ms, user id when authenticated) via the shared logger, so
 * `LOG_FORMAT=json` runs produce one JSON event per request — the shape a log
 * aggregator can group on without regex.
 *
 * `errorLogger` is a safety net: a route that throws (sync or async) lands
 * here with its stack logged as `event: http_error`, and the client gets a
 * JSON 500 instead of Express's default HTML. Routes still catch their own
 * errors with specific event names; this only runs when they don't.
 *
 * Both honour `LOG_HTTP=off` for quiet local runs. The access logger skips
 * `/api/health` by default because load balancers hammer it every few seconds.
 */

import { log } from '../logger.js'

const DISABLED = process.env.LOG_HTTP === 'off'
const DEFAULT_SKIP = new Set(['/api/health'])

export function httpLogger({ skip = DEFAULT_SKIP } = {}) {
  return function httpLoggerMiddleware(req, res, next) {
    if (DISABLED || skip.has(req.path)) return next()

    const started = process.hrtime.bigint()
    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - started) / 1e6
      log.info('http', {
        event: 'http_request',
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration_ms: Math.round(durationMs * 100) / 100,
        ...(req.user?.userId ? { user: req.user.userId } : {}),
      })
    })
    next()
  }
}

/**
 * Express error-handling middleware (4-arg signature). Keep it last.
 *
 * The 500 body includes `request_id` when the request-id middleware ran
 * upstream, so a user who screenshots the error can quote the id and an
 * operator can grep straight to the matching `http_error` log line. The id
 * is already on the `X-Request-Id` response header, but a header is invisible
 * to a user staring at an error dialog.
 */
export function errorLogger() {
  // eslint-disable-next-line no-unused-vars
  return function errorLoggerMiddleware(err, req, res, _next) {
    log.error(err, {
      event: 'http_error',
      method: req.method,
      path: req.path,
      ...(req.user?.userId ? { user: req.user.userId } : {}),
    })
    if (res.headersSent) return
    const body = { error: 'internal_error' }
    if (req.requestId) body.request_id = req.requestId
    res.status(500).json(body)
  }
}
