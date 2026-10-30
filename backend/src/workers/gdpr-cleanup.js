/**
 * GDPR cleanup worker.
 *
 * Runs daily. Finds users soft-deleted more than 30 days ago
 * and permanently removes their data.
 */

import { db } from '../pool.js'
import { log } from '../logger.js'

const INTERVAL_MS = 24 * 60 * 60 * 1000 // 24 hours

/**
 * Hard-delete users who were soft-deleted more than 30 days ago.
 */
async function cleanup() {
  try {
    // Find users to purge
    const { rows: users } = await db.query(`
      SELECT id FROM users
      WHERE deleted_at IS NOT NULL
        AND deleted_at < NOW() - INTERVAL '30 days'
    `)

    if (users.length === 0) return

    log.info('gdpr_cleanup_purging', { count: users.length })

    for (const user of users) {
      const userId = user.id

      // Delete in order (respecting foreign keys)
      await db.query('DELETE FROM push_subscriptions WHERE user_id = $1', [userId])

      // Anonymize assistance requests (keep for audit trail but remove identity)
      await db.query(`
        UPDATE assistance_requests SET requester_id = NULL
        WHERE requester_id = $1
      `, [userId])
      await db.query(`
        UPDATE assistance_requests SET helper_id = NULL
        WHERE helper_id = $1
      `, [userId])

      // Delete location updates
      await db.query(`
        DELETE FROM location_updates WHERE user_id = $1
      `, [userId])

      // Finally, permanently delete the user
      await db.query('DELETE FROM users WHERE id = $1', [userId])

      log.info('gdpr_cleanup_user_purged', { user_id: userId })
    }
  } catch (err) {
    log.error('gdpr_cleanup_error', { error: err.message })
  }
}

/**
 * Start the GDPR cleanup worker.
 * Migrations are guaranteed complete before this is called (index.js runs
 * migrate() before listen()). The short delay is just for pool warm-up.
 */
export function startGdprCleanupWorker() {
  setTimeout(() => {
    cleanup()
    setInterval(cleanup, INTERVAL_MS)
  }, 5_000)
  log.info('gdpr_cleanup_worker_started', { interval_ms: INTERVAL_MS, first_run_delay_ms: 5000 })
}
