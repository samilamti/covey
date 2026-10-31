import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { createShutdown } from '../src/shutdown.js'

/**
 * Minimal fakes with the same shape createShutdown touches:
 * `httpServer.close(cb)` and `io.close(cb)` — one callback each, called
 * optionally with an Error. The queue lets a test control WHEN each callback
 * fires so a hang on either side is directly testable.
 */
function makeDeferred() {
  const calls = []
  return {
    calls,
    close(cb) { calls.push(cb) },
    settle(err) { calls.shift()?.(err) },
  }
}

function makeLog() {
  const entries = []
  const push = (level) => (msg, meta) => entries.push({ level, msg, meta })
  return {
    entries,
    info: push('info'),
    warn: push('warn'),
    error: push('error'),
  }
}

function makeExit() {
  const calls = []
  const fn = (code) => calls.push(code)
  return { calls, fn }
}

describe('createShutdown', () => {
  let httpServer, io, log, exit, shutdown

  beforeEach(() => {
    httpServer = makeDeferred()
    io = makeDeferred()
    log = makeLog()
    exit = makeExit()
    shutdown = createShutdown({ httpServer, io, log, forceExitMs: 10_000, exit: exit.fn })
  })

  it('closes http then io then exits 0 in sequence', () => {
    shutdown('SIGTERM')

    // The starting event lands first and carries the signal.
    const start = log.entries.find((e) => e.msg === 'backend_shutdown_starting')
    assert.equal(start.meta.event, 'backend_shutdown_starting')
    assert.equal(start.meta.signal, 'SIGTERM')

    // httpServer.close has been invoked but io.close has NOT yet — the
    // sequence is strict so an http error isn't masked by io.
    assert.equal(httpServer.calls.length, 1)
    assert.equal(io.calls.length, 0)
    assert.equal(exit.calls.length, 0)

    httpServer.settle()
    assert.equal(io.calls.length, 1)
    assert.equal(exit.calls.length, 0)

    io.settle()
    assert.deepEqual(exit.calls, [0])
    const done = log.entries.find((e) => e.msg === 'backend_shutdown_complete')
    assert.equal(done.meta.event, 'backend_shutdown_complete')
  })

  it('is idempotent — a second signal is a no-op', () => {
    shutdown('SIGTERM')
    shutdown('SIGINT')
    assert.equal(httpServer.calls.length, 1)
    const starts = log.entries.filter((e) => e.msg === 'backend_shutdown_starting')
    assert.equal(starts.length, 1)
  })

  it('still proceeds through io.close when http.close errors', () => {
    shutdown('SIGTERM')
    httpServer.settle(new Error('http boom'))
    assert.equal(io.calls.length, 1)
    const errLines = log.entries.filter((e) => e.level === 'error')
    assert.equal(errLines[0].meta.event, 'backend_shutdown_http_close_failed')
    io.settle()
    assert.deepEqual(exit.calls, [0])
  })

  it('logs when io.close errors but still exits 0', () => {
    shutdown('SIGTERM')
    httpServer.settle()
    io.settle(new Error('io boom'))
    const errLines = log.entries.filter((e) => e.level === 'error')
    assert.equal(errLines[0].meta.event, 'backend_shutdown_io_close_failed')
    assert.deepEqual(exit.calls, [0])
  })

  it('force-exits 1 when cleanup hangs past forceExitMs', (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] })
    const fastExit = makeExit()
    const fastShutdown = createShutdown({
      httpServer, io, log,
      forceExitMs: 500,
      exit: fastExit.fn,
    })
    fastShutdown('SIGTERM')
    // Neither close callback is ever called — a stuck upstream.
    t.mock.timers.tick(500)
    assert.deepEqual(fastExit.calls, [1])
    const warn = log.entries.find((e) => e.msg === 'backend_shutdown_timeout_force_exit')
    assert.equal(warn.meta.event, 'backend_shutdown_timeout_force_exit')
    assert.equal(warn.meta.force_exit_ms, 500)
  })

  it('refuses to construct without the required deps', () => {
    assert.throws(() => createShutdown({ io, log }), /httpServer/)
    assert.throws(() => createShutdown({ httpServer, log }), /io/)
    assert.throws(() => createShutdown({ httpServer, io }), /log/)
  })
})
