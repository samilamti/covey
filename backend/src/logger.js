/**
 * Minimal structured logger.
 *
 * `LOG_FORMAT=json` emits one JSON object per line (12-factor friendly for
 * the hosting platform's log collector). Any other value — the default —
 * stays human-readable, which keeps `docker compose logs` and local `node
 * src/index.js` runs legible.
 *
 * Also peeks at the per-request AsyncLocalStorage store so every line
 * emitted during an HTTP request carries the same `request_id` without
 * every call site having to thread the id in. An explicit `meta.request_id`
 * still wins, which lets a background job set its own correlation id.
 *
 * Why not pino: ~zero extra bytes shipped, zero deps, and this is already
 * everything the roadmap item needs. We can swap it later without touching
 * call sites.
 */

import { currentContext } from './request-context.js'

function emit(level, msg, meta) {
  // Read the env every call so a middleware mounted via a cached import
  // still respects a test's local LOG_FORMAT override. Cost is one string
  // compare per log line, which is noise next to the JSON.stringify.
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
