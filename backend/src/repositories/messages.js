/**
 * Session message repository.
 */

import { db } from '../pool.js'

/**
 * Create a new session message.
 */
export async function create({ requestId, senderId, content, isQuick = false }) {
  const { rows } = await db.query(`
    INSERT INTO session_messages (request_id, sender_id, content, is_quick)
    VALUES ($1, $2, $3, $4)
    RETURNING *
  `, [requestId, senderId, content, isQuick])
  return rows[0]
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
