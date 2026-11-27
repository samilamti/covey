// Minimal structured logger: LOG_FORMAT=json emits one JSON object per line, anything
// else stays human-readable. Adds the current request_id from request-context.js.

import { currentContext } from './request-context.js'

function emit(level, msg, meta) {
  // Read per call so a test's LOG_FORMAT override applies to cached imports.
  const jsonMode = process.env.LOG_FORMAT === 'json'
  const ctx = currentContext()
  const ctxMeta = ctx?.requestId ? { request_id: ctx.requestId } : null
  const combined = ctxMeta || meta
    ? { ...(ctxMeta || {}), ...(meta || {}) }
    : null
  const line = jsonMode
    ? JSON.stringify({ ts: new Date().toISOString(), level, msg, ...(combined || {}) })
    : combined && Object.keys(combined).length > 0
      ? `[${level}] ${msg} ${JSON.stringify(combined)}`
      : `[${level}] ${msg}`
  const stream = level === 'error' || level === 'warn' ? process.stderr : process.stdout
  stream.write(line + '\n')
}

export const log = {
  info(msg, meta) { emit('info', msg, meta) },
  warn(msg, meta) { emit('warn', msg, meta) },
  error(msg, meta) {
    // Accept `log.error(err)` as a convenience.
    if (msg instanceof Error) {
      emit('error', msg.message, { ...(meta || {}), stack: msg.stack })
      return
    }
    emit('error', msg, meta)
  },
}
