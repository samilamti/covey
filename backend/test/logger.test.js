import { describe, it, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

// Preserve the original stdout/stderr writers so the test framework's
// own output isn't affected while we swap them in and out.
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

describe('logger (text mode, default)', () => {
  let log
  before(async () => {
    delete process.env.LOG_FORMAT
    // Fresh module graph so JSON_MODE re-reads the env.
    log = (await import(`../src/logger.js?mode=text`)).log
  })

  it('writes info to stdout as human-readable line', () => {
    log.info('hello')
    assert.equal(stdout.length, 1)
    assert.equal(stdout[0], '[info] hello\n')
  })

  it('writes warn and error to stderr', () => {
    log.warn('careful')
    log.error('boom')
    assert.equal(stdout.length, 0)
    assert.equal(stderr.length, 2)
    assert.ok(stderr[0].includes('[warn] careful'))
    assert.ok(stderr[1].includes('[error] boom'))
  })

  it('appends meta object when provided', () => {
    log.info('started', { port: 3000 })
    assert.equal(stdout[0], '[info] started {"port":3000}\n')
  })

  it('unwraps Error instances into message + stack', () => {
    log.error(new Error('nope'))
    assert.ok(stderr[0].startsWith('[error] nope '))
    assert.ok(stderr[0].includes('"stack"'))
  })
})

describe('logger (json mode)', () => {
  let log
  before(async () => {
    process.env.LOG_FORMAT = 'json'
    log = (await import(`../src/logger.js?mode=json`)).log
  })
  after(() => { delete process.env.LOG_FORMAT })

  it('emits one JSON object per line with ts, level, msg', () => {
    log.info('started', { port: 3000 })
    assert.equal(stdout.length, 1)
    const parsed = JSON.parse(stdout[0])
    assert.equal(parsed.level, 'info')
    assert.equal(parsed.msg, 'started')
    assert.equal(parsed.port, 3000)
    assert.match(parsed.ts, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
  })

  it('routes error through stderr with stack', () => {
    log.error(new Error('kapow'))
    assert.equal(stdout.length, 0)
    const parsed = JSON.parse(stderr[0])
    assert.equal(parsed.level, 'error')
    assert.equal(parsed.msg, 'kapow')
    assert.ok(parsed.stack.includes('Error: kapow'))
  })
})

describe('logger (request context propagation)', () => {
  let log
  let requestContext
  before(async () => {
    delete process.env.LOG_FORMAT
    // Fresh module graph again, but IMPORTANT: both the logger and the
    // context module must come from the same import so they share one
    // AsyncLocalStorage instance. Using a query-string tag only on the
    // logger does that — logger.js resolves `../request-context.js` once.
    log = (await import('../src/logger.js?mode=ctx')).log
    requestContext = (await import('../src/request-context.js')).requestContext
  })

  it('merges request_id from the active store into every line', () => {
    requestContext.run({ requestId: 'r-1' }, () => {
      log.info('hello')
      log.info('started', { port: 3000 })
    })
    assert.equal(stdout[0], '[info] hello {"request_id":"r-1"}\n')
    assert.equal(stdout[1], '[info] started {"request_id":"r-1","port":3000}\n')
  })

  it('lets an explicit meta.request_id override the context', () => {
    requestContext.run({ requestId: 'from-ctx' }, () => {
      log.info('explicit', { request_id: 'override' })
    })
    assert.ok(stdout[0].includes('"request_id":"override"'))
    assert.ok(!stdout[0].includes('from-ctx'))
  })

  it('still works when there is no active store', () => {
    log.info('bare')
    assert.equal(stdout[0], '[info] bare\n')
  })

  it('attaches request_id when log.error unwraps an Error', () => {
    requestContext.run({ requestId: 'r-err' }, () => {
      log.error(new Error('nope'))
    })
    assert.ok(stderr[0].includes('"request_id":"r-err"'))
    assert.ok(stderr[0].includes('"stack"'))
  })
})

describe('logger (request context + json mode)', () => {
  let log
  let requestContext
  before(async () => {
    process.env.LOG_FORMAT = 'json'
    log = (await import('../src/logger.js?mode=ctx-json')).log
    requestContext = (await import('../src/request-context.js')).requestContext
  })
  after(() => { delete process.env.LOG_FORMAT })

  it('includes request_id as a top-level field', () => {
    requestContext.run({ requestId: 'r-json' }, () => {
      log.info('x', { foo: 1 })
    })
    const parsed = JSON.parse(stdout[0])
    assert.equal(parsed.request_id, 'r-json')
    assert.equal(parsed.foo, 1)
  })
})
