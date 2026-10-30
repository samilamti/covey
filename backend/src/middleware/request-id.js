/**
 * Request-ID middleware.
 *
 * Picks an inbound `X-Request-Id` header when it looks sane (so a load
 * balancer or CLI client can propagate a trace id across hops), otherwise
 * mints a UUID. The id lands on `req.requestId`, is echoed back as
 * `X-Request-Id` on the response, and seeds an AsyncLocalStorage store so
 * every `log.*` call made during this request carries it automatically.
 *
 * The inbound regex is deliberately strict — printable ASCII, 1-128 chars —
 * to keep a hostile header from injecting log control chars or blowing up
 * aggregator parsers.
 */

import crypto from 'node:crypto'
import { requestContext } from '../request-context.js'

const SAFE_ID = /^[A-Za-z0-9_.-]{1,128}$/

function pickId(req) {
  const inbound = typeof req.get === 'function' ? req.get('x-request-id') : undefined
  if (inbound && SAFE_ID.test(inbound)) return inbound
  return crypto.randomUUID()
}

export function requestId() {
  return function requestIdMiddleware(req, res, next) {
    const id = pickId(req)
    req.requestId = id
    if (typeof res.setHeader === 'function') {
      res.setHeader('X-Request-Id', id)
    }
    requestContext.run({ requestId: id }, next)
  }
}
