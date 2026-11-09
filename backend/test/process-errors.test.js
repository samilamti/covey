import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { attachProcessErrorHandlers } from '../src/process-errors.js'

function makeLog() {
  const entries = []
  const push = (level) => (msg, meta) => entries.push({ level, msg, meta })
  return {
    entries,
    info: push('info'),
    warn: push('warn'),
    error(msg, meta) {
      // Mirror the real logger's `log.error(err)` convenience so the test
      // asserts against the same shape production reads.
      if (msg instanceof Error) {
        entries.push({ level: 'error', msg: msg.message, meta: { ...(meta || {}), stack: msg.stack } })
        return
      }
      entries.push({ level: 'error', msg, meta })
    },
  }
}

function makeShutdown() {
  const calls = []
  return { calls, fn: (reason, code) => calls.push([reason, code]) }
}

describe('attachProcessErrorHandlers', () => {
  let proc, log, shutdown, handle

  beforeEach(() => {
    proc = new EventEmitter()
    log = makeLog()
    shutdown = makeShutdown()
    handle = attachProcessErrorHandlers({ log, shutdown: shutdown.fn, proc })
  })

  it('logs an uncaughtException with stack and triggers shutdown', () => {
    const err = new Error('boom')
    proc.emit('uncaughtException', err, 'uncaughtException')

    const line = log.entries.find((e) => e.meta?.event === 'uncaught_exception')
    assert.ok(line, 'expected an uncaught_exception line')
    assert.equal(line.level, 'error')
    assert.equal(line.msg, 'boom')
    // Stack must survive the log so an operator can read it without reproducing.
    assert.ok(line.meta.stack.includes('boom'))
    assert.equal(line.meta.origin, 'uncaughtException')
    assert.deepEqual(shutdown.calls, [['uncaught_exception', 1]])
  })

  it('normalises a non-Error uncaughtException into a loggable Error', () => {
    proc.emit('uncaughtException', 'string thrown')
    const line = log.entries.find((e) => e.meta?.event === 'uncaught_exception')
    assert.ok(line)
    assert.equal(line.msg, 'string thrown')
    // Shutdown still fires — the process state is suspect regardless of what
    // was thrown.
    assert.deepEqual(shutdown.calls, [['uncaught_exception', 1]])
  })

  it('logs an unhandledRejection carrying an Error with its stack', () => {
    const reason = new Error('bad promise')
    proc.emit('unhandledRejection', reason, Promise.reject(reason).catch(() => {}))

    const line = log.entries.find((e) => e.meta?.event === 'unhandled_rejection')
    assert.ok(line)
    assert.equal(line.msg, 'bad promise')
    assert.equal(line.meta.reason_type, 'error')
    assert.ok(line.meta.stack.includes('bad promise'))
    assert.deepEqual(shutdown.calls, [['unhandled_rejection', 1]])
  })

  it('tags a non-Error rejection reason with reason_type for debuggability', () => {
    proc.emit('unhandledRejection', { code: 'ETIMEDOUT' }, Promise.resolve())
    const line = log.entries.find((e) => e.meta?.event === 'unhandled_rejection')
    assert.ok(line)
    // The reason-type hint says "this stack is synthetic", which matters when
    // someone rejects with a plain object: the stack points at process-errors.js
    // and would otherwise mislead whoever is debugging.
    assert.equal(line.meta.reason_type, 'object')
    assert.deepEqual(shutdown.calls, [['unhandled_rejection', 1]])
  })

  it('does not swallow the handlers of other listeners', () => {
    // The handler is additive — a prior app might also observe these events
    // for its own metrics. Confirm we don't accidentally stop propagation.
    let seenByOther = 0
    proc.on('uncaughtException', () => { seenByOther++ })
    proc.emit('uncaughtException', new Error('x'))
    assert.equal(seenByOther, 1)
  })

  it('detach removes the listeners it added without touching foreign ones', () => {
    let foreignCount = 0
    proc.on('uncaughtException', () => { foreignCount++ })
    handle.detach()
    proc.emit('uncaughtException', new Error('after detach'))
    // Our handler is gone, so no shutdown call and no log line — but the
    // foreign listener still fires.
    assert.equal(shutdown.calls.length, 0)
    assert.equal(log.entries.length, 0)
    assert.equal(foreignCount, 1)
  })

  it('refuses to attach without its required deps', () => {
    assert.throws(() => attachProcessErrorHandlers({ shutdown: shutdown.fn, proc }), /log/)
    assert.throws(() => attachProcessErrorHandlers({ log, proc }), /shutdown/)
    assert.throws(() => attachProcessErrorHandlers({ log, shutdown: shutdown.fn, proc: null }), /proc/)
  })
})
