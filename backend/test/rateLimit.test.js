import { describe, it, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { rateLimit } from '../src/middleware/rateLimit.js'
import { mockReq, mockRes } from './helpers.js'

// Capture stdout/stderr around the structured warn log the limiter now emits
// when a request is blocked.
let origStdout
let origStderr
const stdout = []
const stderr = []

before(() => {
  origStdout = process.stdout.write.bind(process.stdout)
  origStderr = process.stderr.write.bind(process.stderr)
  process.stdout.write = (chunk) => { stdout.push(String(chunk)); return true }
  process.stderr.write = (chunk) => { stderr.push(String(chunk)); return true }
})

after(() => {
  process.stdout.write = origStdout
  process.stderr.write = origStderr
})

beforeEach(() => { stdout.length = 0; stderr.length = 0 })

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

  it('emits a warn log line when a request is blocked', () => {
    const mw = rateLimit({ windowMs: 60_000, max: 1, name: 'auth' })
    // First request passes, no log yet.
    mw(mockReq({ ip: '50.0.0.1', method: 'POST', path: '/api/auth/login' }), mockRes(), () => {})
    assert.equal(stderr.length, 0)
    // Second is blocked and should log.
    const res = mockRes()
    mw(mockReq({ ip: '50.0.0.1', method: 'POST', path: '/api/auth/login' }), res, () => {})
    assert.equal(res.statusCode, 429)
    assert.equal(stderr.length, 1, 'exactly one warn line per blocked request')
    const line = stderr[0]
    assert.ok(line.startsWith('[warn] rate_limit_exceeded'))
    assert.ok(line.includes('"event":"rate_limit_exceeded"'))
    assert.ok(line.includes('"limiter":"auth"'))
    assert.ok(line.includes('"limit":1'))
    assert.ok(line.includes('"window_ms":60000'))
    assert.ok(line.includes('"method":"POST"'))
    assert.ok(line.includes('"path":"/api/auth/login"'))
    // Key is deliberately NOT logged: no IP, no user id leaks here.
    assert.ok(!line.includes('50.0.0.1'), 'the key (IP here) is not logged')
  })

  it('does not log when a request is allowed', () => {
    const mw = rateLimit({ windowMs: 60_000, max: 5 })
    mw(mockReq({ ip: '51.0.0.1' }), mockRes(), () => {})
    mw(mockReq({ ip: '51.0.0.1' }), mockRes(), () => {})
    assert.equal(stderr.length, 0)
    assert.equal(stdout.length, 0)
  })

  it('defaults the limiter name to "rate_limit" when none is given', () => {
    const mw = rateLimit({ windowMs: 60_000, max: 1 })
    mw(mockReq({ ip: '52.0.0.1' }), mockRes(), () => {})
    mw(mockReq({ ip: '52.0.0.1' }), mockRes(), () => {})
    assert.equal(stderr.length, 1)
    assert.ok(stderr[0].includes('"limiter":"rate_limit"'))
  })

  it('is silenced by LOG_HTTP=off', () => {
    const prior = process.env.LOG_HTTP
    process.env.LOG_HTTP = 'off'
    try {
      const mw = rateLimit({ windowMs: 60_000, max: 1, name: 'quiet' })
      mw(mockReq({ ip: '53.0.0.1' }), mockRes(), () => {})
      const res = mockRes()
      mw(mockReq({ ip: '53.0.0.1' }), res, () => {})
      assert.equal(res.statusCode, 429, 'still enforces the limit')
      assert.equal(stderr.length, 0, 'but emits no log line')
    } finally {
      if (prior === undefined) delete process.env.LOG_HTTP
      else process.env.LOG_HTTP = prior
    }
  })
})
