import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { requestId } from '../src/middleware/request-id.js'
import { currentContext } from '../src/request-context.js'
import { mockReq, mockRes } from './helpers.js'

/**
 * Minimal response stub carrying the setHeader surface the middleware
 * touches. The shared mockRes() only has set(); setHeader is the raw Node
 * API Express uses when the middleware runs before Express methods are
 * attached.
 */
function headerRes() {
  const base = mockRes()
  return Object.assign(base, {
    _rawHeaders: {},
    setHeader(name, value) {
      this._rawHeaders[name.toLowerCase()] = value
      return this
    },
  })
}

describe('requestId middleware', () => {
  it('mints a UUID when no inbound header is present', () => {
    const req = mockReq({ method: 'GET', path: '/api/requests' })
    const res = headerRes()
    let captured = null
    requestId()(req, res, () => {
      captured = { id: req.requestId, ctx: currentContext() }
    })
    assert.match(req.requestId, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    assert.equal(res._rawHeaders['x-request-id'], req.requestId)
    assert.ok(captured, 'next() ran')
    assert.equal(captured.ctx.requestId, req.requestId, 'context carries the id')
  })

  it('propagates an inbound X-Request-Id that matches the safe pattern', () => {
    const req = mockReq({
      method: 'GET',
      path: '/api/requests',
      headers: { 'x-request-id': 'trace-abc_123.XY' },
    })
    const res = headerRes()
    let seen
    requestId()(req, res, () => { seen = currentContext() })
    assert.equal(req.requestId, 'trace-abc_123.XY')
    assert.equal(res._rawHeaders['x-request-id'], 'trace-abc_123.XY')
    assert.equal(seen.requestId, 'trace-abc_123.XY')
  })

  it('rejects an unsafe inbound header and mints a fresh id instead', () => {
    const req = mockReq({
      method: 'GET',
      path: '/api/requests',
      headers: { 'x-request-id': 'bad id with space\n' },
    })
    const res = headerRes()
    requestId()(req, res, () => {})
    assert.notEqual(req.requestId, 'bad id with space\n')
    assert.match(req.requestId, /^[0-9a-f-]{36}$/)
  })

  it('rejects an inbound header longer than 128 chars', () => {
    const tooLong = 'a'.repeat(129)
    const req = mockReq({
      method: 'GET',
      path: '/api/requests',
      headers: { 'x-request-id': tooLong },
    })
    const res = headerRes()
    requestId()(req, res, () => {})
    assert.notEqual(req.requestId, tooLong)
  })

  it('runs next inside a store so a nested async read sees the same id', async () => {
    const req = mockReq({ method: 'GET', path: '/api/requests' })
    const res = headerRes()
    const seen = await new Promise((resolve) => {
      requestId()(req, res, async () => {
        // One microtask + one macrotask of hop, to prove the store
        // follows us across both. AsyncLocalStorage must transparently
        // propagate through promises and timers for the logger note on
        // "every log.* during a request" to actually hold.
        await Promise.resolve()
        setImmediate(() => resolve(currentContext()?.requestId))
      })
    })
    assert.equal(seen, req.requestId)
  })

  it('does not leak the store outside the request chain', () => {
    const req = mockReq({ method: 'GET', path: '/api/requests' })
    const res = headerRes()
    requestId()(req, res, () => {})
    assert.equal(currentContext(), undefined, 'no store once next has returned')
  })
})
