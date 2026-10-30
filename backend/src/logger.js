/**
 * Minimal structured logger.
 *
 * `LOG_FORMAT=json` emits one JSON object per line (12-factor friendly for
 * the hosting platform's log collector). Any other value — the default —
 * stays human-readable, which keeps `docker compose logs` and local `node
 * src/index.js` runs legible.
 *
 * Why not pino: ~zero extra bytes shipped, zero deps, and this is already
 * everything the roadmap item needs. We can swap it later without touching
 * call sites.
 */

const JSON_MODE = process.env.LOG_FORMAT === 'json'

function emit(level, msg, meta) {
  const line = JSON_MODE
    ? JSON.stringify({ ts: new Date().toISOString(), level, msg, ...(meta || {}) })
    : meta && Object.keys(meta).length > 0
      ? `[${level}] ${msg} ${JSON.stringify(meta)}`
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
