import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { Server } from 'socket.io'
import { createShutdown } from '../src/shutdown.js'

/**
 * Minimal fake with the shape createShutdown touches: `io.close(cb)`, whose
 * callback is called optionally with an Error. Deferred so a test controls
 * WHEN the callback fires and a hang is directly testable.
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
  let io, log, exit, shutdown

  beforeEach(() => {
    io = makeDeferred()
    log = makeLog()
    exit = makeExit()
    shutdown = createShutdown({ io, log, forceExitMs: 10_000, exit: exit.fn })
  })

  it('closes io once and exits 0 when it settles', () => {
    shutdown('SIGTERM')

    // The starting event lands first and carries the signal.
    const start = log.entries.find((e) => e.msg === 'backend_shutdown_starting')
    assert.equal(start.meta.event, 'backend_shutdown_starting')
    assert.equal(start.meta.signal, 'SIGTERM')

    assert.equal(io.calls.length, 1)
    assert.equal(exit.calls.length, 0)

    io.settle()
    assert.deepEqual(exit.calls, [0])
    const done = log.entries.find((e) => e.msg === 'backend_shutdown_complete')
    assert.equal(done.meta.event, 'backend_shutdown_complete')
    // A clean drain logs no error line.
    assert.equal(log.entries.filter((e) => e.level === 'error').length, 0)
  })

  it('exits with the code it was given, so a crash-triggered drain still reads as a failure', () => {
    shutdown('uncaught_exception', 1)
    io.settle()
    assert.deepEqual(exit.calls, [1])
  })

  it('is idempotent — a second signal is a no-op', () => {
    shutdown('SIGTERM')
    shutdown('SIGINT')
    assert.equal(io.calls.length, 1)
    const starts = log.entries.filter((e) => e.msg === 'backend_shutdown_starting')
    assert.equal(starts.length, 1)
  })

  it('logs when the close errors but still exits with the requested code', () => {
    shutdown('SIGTERM')
    io.settle(new Error('close boom'))
    const errLines = log.entries.filter((e) => e.level === 'error')
    assert.equal(errLines[0].meta.event, 'backend_shutdown_close_failed')
    assert.deepEqual(exit.calls, [0])
  })

  it('force-exits 1 when cleanup hangs past forceExitMs', (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] })
    const fastExit = makeExit()
    const fastShutdown = createShutdown({
      io, log,
      forceExitMs: 500,
      exit: fastExit.fn,
    })
    fastShutdown('SIGTERM')
    // The close callback is never called — a stuck upstream.
    t.mock.timers.tick(500)
    assert.deepEqual(fastExit.calls, [1])
    const warn = log.entries.find((e) => e.msg === 'backend_shutdown_timeout_force_exit')
    assert.equal(warn.meta.event, 'backend_shutdown_timeout_force_exit')
    assert.equal(warn.meta.force_exit_ms, 500)
  })

  it('force-exits before Docker would SIGKILL by default', () => {
    // compose's default stop_grace_period is 10 s; our own exit must land first.
    let timer
    const realSetTimeout = globalThis.setTimeout
    globalThis.setTimeout = (fn, ms) => { timer = ms; return realSetTimeout(() => {}, 0) }
    try {
      createShutdown({ io, log, exit: exit.fn })('SIGTERM')
    } finally {
      globalThis.setTimeout = realSetTimeout
    }
    assert.ok(timer < 10_000, `force-exit at ${timer} ms races Docker's SIGKILL at 10 000 ms`)
  })

  it('refuses to construct without the required deps', () => {
    assert.throws(() => createShutdown({ log }), /io/)
    assert.throws(() => createShutdown({ io }), /log/)
  })
})

describe('createShutdown against a real server', () => {
  // The fakes above cannot see how the real pieces interact: http.Server.close
  // waits for every open connection, and an upgraded WebSocket only ends when
  // Socket.io closes it. An app holds a WebSocket for as long as it is open, so
  // this is the normal production shape, not an edge case.
  it('drains a server with a live WebSocket client and exits 0 long before the force timer', async () => {
    const httpServer = createServer()
    const io = new Server(httpServer)
    await new Promise((resolve) => httpServer.listen(0, '127.0.0.1', resolve))
    const { port } = httpServer.address()

    const ws = new WebSocket(`ws://127.0.0.1:${port}/socket.io/?EIO=4&transport=websocket`)
    await new Promise((resolve, reject) => {
      ws.onopen = resolve
      ws.onerror = reject
    })

    const log = makeLog()
    const forceExitMs = 3_000
    const t0 = Date.now()
    const code = await new Promise((resolve) => {
      createShutdown({ io, log, forceExitMs, exit: resolve })('SIGTERM')
    })
    const elapsed = Date.now() - t0

    assert.equal(code, 0)
    assert.ok(elapsed < forceExitMs / 2, `drain took ${elapsed} ms; the force timer is ${forceExitMs} ms`)
    assert.equal(log.entries.filter((e) => e.level === 'error').length, 0,
      `unexpected error lines: ${JSON.stringify(log.entries.filter((e) => e.level === 'error'))}`)
    assert.equal(httpServer.listening, false)
  })
})
