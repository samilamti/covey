/**
 * Readiness probe.
 *
 * `/api/health` is a bare liveness check that the deploy script byte-compares
 * against the string `{"ok":true}` — do not change its shape. This file adds
 * a sibling readiness endpoint that actually verifies the backend can still
 * reach Postgres, since a Node process can keep answering `health` long after
 * the DB has dropped away.
 *
 * The DB ping races against a short timer so a hung connection can't hang the
 * endpoint itself. Failures return 503 with `db: 'error'`; a load balancer or
 * Compose healthcheck can then route traffic away or recycle the container.
 */

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
