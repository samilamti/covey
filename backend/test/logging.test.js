import { describe, it, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { mockReq, mockRes } from './helpers.js'

// Capture stdout/stderr so logger output doesn't leak into the test runner's
// own stream. Mirrors the pattern in logger.test.js.
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

/**
 * Minimal Express-like res that is also an EventEmitter so `res.on('finish')`
 * works. Inherits status()/json() from the shared mockRes().
 */
function finishableRes() {
  const base = mockRes()
  const emitter = new EventEmitter()
  return Object.assign(emitter, base, {
    status(code) { base.statusCode = code; this.statusCode = code; return this },
    get statusCode() { return base.statusCode },
    set statusCode(v) { base.statusCode = v },
    json(data) { base.body = data; this.body = data; return this },
    headersSent: false,
  })
}

describe('httpLogger', () => {
  let httpLogger
  before(async () => {
    delete process.env.LOG_HTTP
    delete process.env.LOG_FORMAT
    httpLogger = (await import('../src/middleware/logging.js?mode=http-text')).httpLogger
  })

  it('logs method, path, status and duration_ms on finish', () => {
    const req = mockReq({ method: 'GET', path: '/api/requests' })
    const res = finishableRes()
    res.statusCode = 200

    let nextCalled = false
    httpLogger()(req, res, () => { nextCalled = true })
    assert.equal(nextCalled, true, 'calls next synchronously')
    assert.equal(stdout.length, 0, 'nothing logged until response finishes')

    res.emit('finish')

    assert.equal(stdout.length, 1)
    const line = stdout[0]
    assert.ok(line.includes('[info] http'))
    assert.ok(line.includes('"method":"GET"'))
    assert.ok(line.includes('"path":"/api/requests"'))
    assert.ok(line.includes('"status":200'))
    assert.match(line, /"duration_ms":\d+(\.\d+)?/)
    assert.ok(!line.includes('"user"'), 'no user key when request is unauthenticated')
  })

  it('includes authenticated user id when present', () => {
    const req = mockReq({ method: 'POST', path: '/api/requests', user: { userId: 'u-123' } })
    const res = finishableRes()
    res.statusCode = 201
    httpLogger()(req, res, () => {})
    res.emit('finish')
    assert.ok(stdout[0].includes('"user":"u-123"'))
  })

  it('skips /api/health by default', () => {
    const req = mockReq({ method: 'GET', path: '/api/health' })
    const res = finishableRes()
    let nextCalled = false
    httpLogger()(req, res, () => { nextCalled = true })
    res.emit('finish')
    assert.equal(nextCalled, true)
    assert.equal(stdout.length, 0)
  })

  it('honours a custom skip set', () => {
    const req = mockReq({ method: 'GET', path: '/api/ping' })
    const res = finishableRes()
    httpLogger({ skip: new Set(['/api/ping']) })(req, res, () => {})
    res.emit('finish')
    assert.equal(stdout.length, 0)
  })

  it('is disabled when LOG_HTTP=off is in effect at module import', async () => {
    process.env.LOG_HTTP = 'off'
    try {
      const mod = await import('../src/middleware/logging.js?mode=http-off')
      const req = mockReq({ method: 'GET', path: '/api/requests' })
      const res = finishableRes()
      let nextCalled = false
      mod.httpLogger()(req, res, () => { nextCalled = true })
      res.emit('finish')
      assert.equal(nextCalled, true)
      assert.equal(stdout.length, 0)
    } finally {
      delete process.env.LOG_HTTP
    }
  })
})

describe('httpLogger (json mode)', () => {
  it('emits one JSON object per request', async () => {
    process.env.LOG_FORMAT = 'json'
    try {
      const { httpLogger } = await import('../src/middleware/logging.js?mode=http-json')
      const req = mockReq({ method: 'GET', path: '/api/requests' })
      const res = finishableRes()
      res.statusCode = 200
      httpLogger()(req, res, () => {})
      res.emit('finish')
      assert.equal(stdout.length, 1)
      const obj = JSON.parse(stdout[0].trim())
      assert.equal(obj.level, 'info')
      assert.equal(obj.msg, 'http')
      assert.equal(obj.event, 'http_request')
      assert.equal(obj.method, 'GET')
      assert.equal(obj.path, '/api/requests')
      assert.equal(obj.status, 200)
      assert.equal(typeof obj.duration_ms, 'number')
      assert.ok(obj.ts)
    } finally {
      delete process.env.LOG_FORMAT
    }
  })
})

describe('errorLogger', () => {
  let errorLogger
  before(async () => {
    delete process.env.LOG_HTTP
    delete process.env.LOG_FORMAT
    errorLogger = (await import('../src/middleware/logging.js?mode=err-text')).errorLogger
  })

  it('logs the error and returns a JSON 500', () => {
    const err = new Error('boom')
    const req = mockReq({ method: 'POST', path: '/api/requests' })
    const res = finishableRes()
    errorLogger()(err, req, res, () => {})
    assert.equal(stderr.length, 1)
    assert.ok(stderr[0].includes('[error] boom'))
    assert.ok(stderr[0].includes('"event":"http_error"'))
    assert.ok(stderr[0].includes('"method":"POST"'))
    assert.ok(stderr[0].includes('"path":"/api/requests"'))
    assert.equal(res.statusCode, 500)
    assert.deepEqual(res.body, { error: 'internal_error' })
  })

  it('does not touch the response when headers were already sent', () => {
    const err = new Error('late')
    const req = mockReq({ method: 'GET', path: '/api/requests' })
    const res = finishableRes()
    res.headersSent = true
    const originalStatus = res.statusCode
    errorLogger()(err, req, res, () => {})
    assert.equal(res.statusCode, originalStatus)
    assert.equal(res.body, null)
    assert.equal(stderr.length, 1, 'still logs the error')
  })

  it('includes user id when authenticated', () => {
    const err = new Error('boom')
    const req = mockReq({ method: 'GET', path: '/api/me', user: { userId: 'u-9' } })
    const res = finishableRes()
    errorLogger()(err, req, res, () => {})
    assert.ok(stderr[0].includes('"user":"u-9"'))
  })
})
