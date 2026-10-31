import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { versionHandler } from '../src/routes/version.js'
import { mockReq, mockRes } from './helpers.js'

describe('versionHandler', () => {
  const originalSha = process.env.GIT_SHA

  beforeEach(() => { delete process.env.GIT_SHA })
  afterEach(() => {
    if (originalSha === undefined) delete process.env.GIT_SHA
    else process.env.GIT_SHA = originalSha
  })

  it('returns the build info shape with version, commit, node, uptime_s', () => {
    const req = mockReq({ method: 'GET', path: '/api/version' })
    const res = mockRes()
    versionHandler()(req, res)
    assert.equal(res.statusCode, 200)
    assert.ok(res.body, 'response body present')
    assert.match(res.body.version, /^\d+\.\d+\.\d+/)
    assert.match(res.body.node, /^v\d+\.\d+\.\d+/)
    assert.equal(res.body.commit, null)
    // uptime_s is a whole non-negative integer when read from the real process.
    assert.equal(typeof res.body.uptime_s, 'number')
    assert.ok(Number.isInteger(res.body.uptime_s))
    assert.ok(res.body.uptime_s >= 0)
  })

  it('rounds uptime_s DOWN to a whole second from the injected clock', () => {
    // A real `process.uptime()` returns a float like 12.734. We expose it
    // as a whole second so operators comparing "did it just restart" don't
    // have to think about sub-second noise. floor() rather than round() so
    // the number can only go up as the process ages — monotonic.
    const req = mockReq({ method: 'GET', path: '/api/version' })
    const res = mockRes()
    versionHandler({ uptimeFn: () => 12.9 })(req, res)
    assert.equal(res.body.uptime_s, 12)
  })

  it('reflects a growing uptime across successive calls (one source per call)', () => {
    // Guards against caching uptime once at module load; the whole point of
    // this field is that it changes.
    const clock = { t: 0 }
    const handler = versionHandler({ uptimeFn: () => clock.t })
    const res1 = mockRes()
    clock.t = 3
    handler(mockReq(), res1)
    const res2 = mockRes()
    clock.t = 42
    handler(mockReq(), res2)
    assert.equal(res1.body.uptime_s, 3)
    assert.equal(res2.body.uptime_s, 42)
  })

  it('surfaces GIT_SHA as commit when the deploy pipeline injected it', () => {
    process.env.GIT_SHA = 'deadbeef'
    const req = mockReq({ method: 'GET', path: '/api/version' })
    const res = mockRes()
    versionHandler()(req, res)
    assert.equal(res.body.commit, 'deadbeef')
  })

  it('ignores the request — the response does not vary by caller', () => {
    // Pin the clock so the deepEqual isn't racing a tick boundary: the
    // response's identity-plus-uptime content must not depend on who asked.
    const handler = versionHandler({ uptimeFn: () => 7 })
    const res1 = mockRes()
    const res2 = mockRes()
    handler(mockReq(), res1)
    handler(mockReq({ headers: { 'x-weird': 'yes' } }), res2)
    assert.deepEqual(res1.body, res2.body)
  })
})
