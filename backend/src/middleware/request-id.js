// Use a sane inbound X-Request-Id (printable ASCII, 1-128 chars) or mint a UUID; echo it
// back and open the request context so every log line in this request carries it.

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
