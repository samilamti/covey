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

/**
 * Guards the "every log line carries an `event:` tag" convention end to end.
 *
 * A grep over `src/` is the only way to prove this at build time: a single
 * drifted call site leaves one group empty in a log aggregator without any
 * test going red, which is exactly how five calls had slipped by the time
 * this test was added (admin_report_status, user_blocked, user_report_filed,
 * report_email_failed, nin_hash_rekeyed). The regression this catches is
 * silent and operational, not functional.
 *
 * `sockMeta(event)` (socket handlers) wraps the tag internally, so a call
 * that passes it is considered compliant.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

describe('wiring (source assertions): every log.* call carries event:', () => {
  const srcDir = fileURLToPath(new URL('../src', import.meta.url))

  function walk(dir, files = []) {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name)
      const stats = statSync(full)
      if (stats.isDirectory()) walk(full, files)
      else if (full.endsWith('.js')) files.push(full)
    }
    return files
  }

  // Extract every top-level log.info/warn/error(…) call with balanced parens.
  function findLogCalls(src) {
    const calls = []
    const re = /log\.(info|warn|error)\s*\(/g
    let m
    while ((m = re.exec(src)) !== null) {
      const start = m.index
      let depth = 1
      let i = start + m[0].length
      while (i < src.length && depth > 0) {
        const c = src[i]
        if (c === '(') depth += 1
        else if (c === ')') depth -= 1
        i += 1
      }
      calls.push({
        text: src.slice(start, i),
        line: src.slice(0, start).split('\n').length,
      })
    }
    return calls
  }

  it('all log.info/warn/error calls in src/ carry an event: key (or wrap sockMeta)', () => {
    const files = walk(srcDir).filter((f) => !f.endsWith('logger.js'))
    const missing = []
    for (const file of files) {
      const src = readFileSync(file, 'utf8')
      for (const { text, line } of findLogCalls(src)) {
        // Match `event:`, shorthand `event,`, and the terminal `event)` form.
        const hasEvent = /\bevent\s*[,:)]/.test(text)
        const viaHelper = /sockMeta\(/.test(text)
        if (!hasEvent && !viaHelper) {
          missing.push(`${file}:${line} — ${text.split('\n')[0]}`)
        }
      }
    }
    assert.equal(
      missing.length,
      0,
      `log calls without an event: tag:\n${missing.join('\n')}`,
    )
  })
})
