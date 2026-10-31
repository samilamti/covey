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

  it('surfaces request_id in the 429 body when the request-id middleware ran', () => {
    const mw = rateLimit({ windowMs: 60_000, max: 1 })
    mw(mockReq({ ip: '54.0.0.1', requestId: 'r-rl-1' }), mockRes(), () => {})
    const res = mockRes()
    mw(mockReq({ ip: '54.0.0.1', requestId: 'r-rl-1' }), res, () => {})
    assert.equal(res.statusCode, 429)
    assert.deepEqual(res.body, {
      error: 'Too many requests, please try again later',
      request_id: 'r-rl-1',
    })
  })

  it('omits request_id when the request-id middleware did not run', () => {
    const mw = rateLimit({ windowMs: 60_000, max: 1 })
    mw(mockReq({ ip: '55.0.0.1' }), mockRes(), () => {})
    const res = mockRes()
    mw(mockReq({ ip: '55.0.0.1' }), res, () => {})
    assert.equal(res.statusCode, 429)
    assert.deepEqual(res.body, { error: 'Too many requests, please try again later' })
  })

  it('sets X-RateLimit-* headers on every allowed response', () => {
    const mw = rateLimit({ windowMs: 60_000, max: 3 })
    const res = mockRes()
    mw(mockReq({ ip: '60.0.0.1' }), res, () => {})
    assert.equal(res._headers['x-ratelimit-limit'], '3')
    // First call counts, so 2 of 3 remain.
    assert.equal(res._headers['x-ratelimit-remaining'], '2')
    // Reset == 0 while the window is empty before this call; the oldest
    // timestamp is read before the current request is pushed, so a brand new
    // key reports 0 seconds (nothing to wait for).
    assert.equal(res._headers['x-ratelimit-reset'], '0')
  })

  it('decrements remaining on each successful request', () => {
    const mw = rateLimit({ windowMs: 60_000, max: 5 })
    const seen = []
    for (let i = 0; i < 4; i++) {
      const res = mockRes()
      mw(mockReq({ ip: '60.0.0.2' }), res, () => {})
      seen.push(res._headers['x-ratelimit-remaining'])
    }
    assert.deepEqual(seen, ['4', '3', '2', '1'])
  })

  it('reports remaining=0 and Retry-After on a blocked response', () => {
    const mw = rateLimit({ windowMs: 60_000, max: 1 })
    mw(mockReq({ ip: '60.0.0.3' }), mockRes(), () => {})
    const res = mockRes()
    mw(mockReq({ ip: '60.0.0.3' }), res, () => {})
    assert.equal(res.statusCode, 429)
    assert.equal(res._headers['x-ratelimit-limit'], '1')
    assert.equal(res._headers['x-ratelimit-remaining'], '0')
    // Reset is a whole number of seconds, positive while the window still
    // holds the earlier timestamp.
    const reset = Number(res._headers['x-ratelimit-reset'])
    assert.ok(Number.isInteger(reset) && reset >= 1 && reset <= 60, `reset was ${reset}`)
    assert.equal(res._headers['retry-after'], String(reset),
      'Retry-After matches X-RateLimit-Reset on a blocked response')
  })

  it('allowed responses do not carry Retry-After', () => {
    const mw = rateLimit({ windowMs: 60_000, max: 2 })
    const res = mockRes()
    mw(mockReq({ ip: '60.0.0.4' }), res, () => {})
    assert.equal(res._headers['retry-after'], undefined)
  })

  it('tolerates a response mock without setHeader (shape of older tests)', () => {
    const mw = rateLimit({ windowMs: 60_000, max: 2 })
    const bareRes = { statusCode: 200, body: null, status(c) { this.statusCode = c; return this }, json(d) { this.body = d; return this } }
    let called = false
    assert.doesNotThrow(() => mw(mockReq({ ip: '60.0.0.5' }), bareRes, () => { called = true }))
    assert.equal(called, true)
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
