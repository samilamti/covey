// Readiness: pings Postgres with a timeout and returns 503 when it fails. /api/health
// stays bare liveness because the deploy script byte-compares its body.

import { log } from '../logger.js'

const DEFAULT_TIMEOUT_MS = 500

export function readyHandler({ pool, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  if (!pool) throw new Error('readyHandler requires a pool')
  return async function readinessProbe(_req, res) {
    let timeoutHandle
    const timer = new Promise((_, reject) => {
      timeoutHandle = setTimeout(
        () => reject(new Error('db_ping_timeout')),
        timeoutMs,
      )
    })
    try {
      await Promise.race([pool.query('SELECT 1'), timer])
      res.json({ ok: true, db: 'ok' })
    } catch (err) {
      log.error(err, { event: 'readiness_db_ping_failed' })
      res.status(503).json({ ok: false, db: 'error' })
    } finally {
      clearTimeout(timeoutHandle)
    }
  }
}
