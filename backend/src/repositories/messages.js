/**
 * Session message repository.
 */

import { db } from '../pool.js'
import { blockedBetweenSql } from './safety.js'

/**
 * Create a new session message.
 *
 * The insert itself checks that the session is still running and that
 * neither party has blocked the other, so a message racing a block or the
 * end of the session is dropped (returns null) instead of outliving it.
 */
export async function create({ requestId, senderId, content, isQuick = false }) {
  const { rows } = await db.query(`
    INSERT INTO session_messages (request_id, sender_id, content, is_quick)
    SELECT ar.id, $2, $3, $4
    FROM assistance_requests ar
    WHERE ar.id = $1
      AND ar.status IN ('accepted', 'active', 'done_pending')
      AND $2 IN (ar.requester_id, ar.helper_id)
      AND NOT ${blockedBetweenSql('ar.requester_id', 'ar.helper_id')}
    RETURNING *
  `, [requestId, senderId, content, isQuick])
  return rows[0] || null
}

/**
 * Get messages for a request, ordered chronologically.
 */
export async function findByRequest(requestId, limit = 100) {
  const { rows } = await db.query(`
    SELECT * FROM session_messages
    WHERE request_id = $1
    ORDER BY created_at ASC
    LIMIT $2
  `, [requestId, limit])
  return rows
}

/**
 * Get all messages sent by a user (for GDPR export).
 */
export async function findByUser(userId) {
  const { rows } = await db.query(`
    SELECT request_id, content, is_quick, created_at
    FROM session_messages
    WHERE sender_id = $1
    ORDER BY created_at DESC
    LIMIT 200
  `, [userId])
  return rows
}
