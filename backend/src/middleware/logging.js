// httpLogger: one structured line per response (skips both health endpoints).
// errorLogger: last-resort JSON 500 for errors routes didn't catch. LOG_HTTP=off silences both.

import { log } from '../logger.js'

const DISABLED = process.env.LOG_HTTP === 'off'
const DEFAULT_SKIP = new Set(['/api/health', '/api/health/ready'])

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
 * Last-resort error handler (4-arg signature, keep it last). A 4xx from express.json()
 * keeps its status; anything else becomes a JSON 500 carrying request_id.
 */
export function errorLogger() {
  // eslint-disable-next-line no-unused-vars
  return function errorLoggerMiddleware(err, req, res, _next) {
    const meta = {
      method: req.method,
      path: req.path,
      ...(req.user?.userId ? { user: req.user.userId } : {}),
    }
    const status = err.status || err.statusCode
    const clientError = status >= 400 && status < 500
    if (clientError) {
      log.warn('http_client_error', { event: 'http_client_error', status, type: err.type || null, ...meta })
    } else {
      log.error(err, { event: 'http_error', ...meta })
    }
    if (res.headersSent) return
    const body = { error: clientError ? err.type || 'bad_request' : 'internal_error' }
    if (req.requestId) body.request_id = req.requestId
    res.status(clientError ? status : 500).json(body)
  }
}
