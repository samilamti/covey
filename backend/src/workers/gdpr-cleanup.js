/**
 * GDPR cleanup worker.
 *
 * Runs daily. Finds users soft-deleted more than 30 days ago
 * and permanently removes their data.
 */

import { db } from '../pool.js'

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

    console.log(`GDPR cleanup: purging ${users.length} user(s)`)

    for (const user of users) {
      const userId = user.id

      // Delete in order (respecting foreign keys)
      await db.query('DELETE FROM push_subscriptions WHERE user_id = $1', [userId])
      await db.query('DELETE FROM community_members WHERE user_id = $1', [userId])

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

      console.log(`  Purged user: ${userId}`)
    }
  } catch (err) {
    console.error('GDPR cleanup error:', err.message)
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
  console.log('GDPR cleanup worker started (daily, first run in 5s)')
}
