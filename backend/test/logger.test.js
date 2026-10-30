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
