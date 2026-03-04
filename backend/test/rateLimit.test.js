import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { rateLimit } from '../src/middleware/rateLimit.js'
import { mockReq, mockRes } from './helpers.js'

describe('rateLimit middleware', () => {
  it('allows requests within the limit', () => {
    const mw = rateLimit({ windowMs: 60_000, max: 3 })
    for (let i = 0; i < 3; i++) {
      const req = mockReq({ ip: '1.2.3.4' })
      const res = mockRes()
      let called = false
      mw(req, res, () => { called = true })
      assert.equal(called, true, `request ${i + 1} should pass`)
    }
  })

  it('blocks request when limit exceeded', () => {
    const mw = rateLimit({ windowMs: 60_000, max: 2 })
    // First two pass
    for (let i = 0; i < 2; i++) {
      const req = mockReq({ ip: '10.0.0.1' })
      const res = mockRes()
      mw(req, res, () => {})
    }
    // Third is blocked
    const req = mockReq({ ip: '10.0.0.1' })
    const res = mockRes()
    let called = false
    mw(req, res, () => { called = true })
    assert.equal(called, false)
    assert.equal(res.statusCode, 429)
  })

  it('returns default error message', () => {
    const mw = rateLimit({ windowMs: 60_000, max: 1 })
    // Exhaust the limit
    mw(mockReq({ ip: '20.0.0.1' }), mockRes(), () => {})
    // Blocked request
    const res = mockRes()
    mw(mockReq({ ip: '20.0.0.1' }), res, () => {})
    assert.equal(res.body.error, 'Too many requests, please try again later')
  })

  it('returns custom error message', () => {
    const mw = rateLimit({ windowMs: 60_000, max: 1, message: 'Custom limit' })
    mw(mockReq({ ip: '30.0.0.1' }), mockRes(), () => {})
    const res = mockRes()
    mw(mockReq({ ip: '30.0.0.1' }), res, () => {})
    assert.equal(res.body.error, 'Custom limit')
  })

  it('uses custom key function for separate counters', () => {
    const mw = rateLimit({
      windowMs: 60_000,
      max: 1,
      keyFn: (req) => req.user?.userId || 'anon',
    })
    // User A - one request
    mw(mockReq({ user: { userId: 'a' } }), mockRes(), () => {})
    // User B - separate counter, should pass
    const res = mockRes()
    let called = false
    mw(mockReq({ user: { userId: 'b' } }), res, () => { called = true })
    assert.equal(called, true)
  })

  it('different IPs have independent limits', () => {
    const mw = rateLimit({ windowMs: 60_000, max: 1 })
    // IP A exhausted
    mw(mockReq({ ip: '40.0.0.1' }), mockRes(), () => {})
    // IP B should still pass
    const res = mockRes()
    let called = false
    mw(mockReq({ ip: '40.0.0.2' }), res, () => { called = true })
    assert.equal(called, true)
  })
})
