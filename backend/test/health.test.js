import { describe, it, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { readyHandler } from '../src/routes/health.js'
import { mockReq, mockRes } from './helpers.js'

// Silence the logger during these tests so error paths don't leak lines
// into the test runner's output stream.
let origStderr
const stderr = []
before(() => {
  origStderr = process.stderr.write.bind(process.stderr)
  process.stderr.write = (chunk) => { stderr.push(String(chunk)); return true }
})
after(() => { process.stderr.write = origStderr })
beforeEach(() => { stderr.length = 0 })

describe('readyHandler', () => {
  it('returns 200 {ok,true,db:"ok"} when the ping succeeds', async () => {
    const pool = { query: async () => ({ rows: [{ '?column?': 1 }] }) }
    const req = mockReq({ method: 'GET', path: '/api/health/ready' })
    const res = mockRes()
    await readyHandler({ pool })(req, res)
    assert.equal(res.statusCode, 200)
    assert.deepEqual(res.body, { ok: true, db: 'ok' })
  })

  it('returns 503 {ok,false,db:"error"} when the DB rejects', async () => {
    const pool = { query: async () => { throw new Error('connection refused') } }
    const req = mockReq({ method: 'GET', path: '/api/health/ready' })
    const res = mockRes()
    await readyHandler({ pool })(req, res)
    assert.equal(res.statusCode, 503)
    assert.deepEqual(res.body, { ok: false, db: 'error' })
    assert.ok(stderr.some((s) => s.includes('readiness_db_ping_failed')), 'logs the failure')
  })

  it('returns 503 when the DB ping hangs longer than the timeout', async () => {
    // A query that never resolves; the handler's internal timer must win.
    const pool = { query: () => new Promise(() => {}) }
    const req = mockReq({ method: 'GET', path: '/api/health/ready' })
    const res = mockRes()
    await readyHandler({ pool, timeoutMs: 20 })(req, res)
    assert.equal(res.statusCode, 503)
    assert.deepEqual(res.body, { ok: false, db: 'error' })
  })

  it('throws if no pool is supplied — the wiring bug has to fail loudly', () => {
    assert.throws(() => readyHandler({}), /requires a pool/)
    assert.throws(() => readyHandler(), /requires a pool/)
  })

  it('does not leak a dangling timer when the ping resolves first', async () => {
    // Spy on setTimeout/clearTimeout so we can assert the finally block
    // tidied up. Guards against future refactors that forget to clear.
    const timers = { set: 0, cleared: 0 }
    const origSetTimeout = global.setTimeout
    const origClearTimeout = global.clearTimeout
    global.setTimeout = (fn, ms) => {
      timers.set += 1
      return origSetTimeout(fn, ms)
    }
    global.clearTimeout = (h) => {
      timers.cleared += 1
      return origClearTimeout(h)
    }
    try {
      const pool = { query: async () => ({ rows: [{ ok: 1 }] }) }
      await readyHandler({ pool })(mockReq(), mockRes())
      assert.equal(timers.set, 1)
      assert.equal(timers.cleared, 1)
    } finally {
      global.setTimeout = origSetTimeout
      global.clearTimeout = origClearTimeout
    }
  })
})
