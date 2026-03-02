/**
 * Ratings repository — post-session safety ratings.
 */

import { db } from '../pool.js'

/**
 * In-memory score overrides for stub/testing mode.
 * Populated by auth router when STUB_SAFETY_SCORES env var is set.
 */
const scoreOverrides = new Map()

/**
 * Set a safety score override for a user (testing only).
 */
export function setScoreOverride(userId, score) {
  scoreOverrides.set(userId, score)
}

/**
 * Submit a rating (upsert — one rating per rater per request).
 */
export async function submitRating({ requestId, raterId, ratedId, value }) {
  const { rows } = await db.query(`
    INSERT INTO ratings (request_id, rater_id, rated_id, value)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (request_id, rater_id)
    DO UPDATE SET value = EXCLUDED.value, created_at = NOW()
    RETURNING *
  `, [requestId, raterId, ratedId, value])
  return rows[0]
}

/**
 * Get the cumulative safety score for a user.
 */
export async function getSafetyScore(userId) {
  if (scoreOverrides.has(userId)) return scoreOverrides.get(userId)
  const { rows } = await db.query(
    'SELECT COALESCE(SUM(value), 0)::int AS score FROM ratings WHERE rated_id = $1',
    [userId]
  )
  return rows[0].score
}

/**
 * Get requests awaiting rating by this user.
 * Returns safety_confirmed requests where the user participated but hasn't rated yet.
 */
export async function findPendingRatings(userId) {
  const { rows } = await db.query(`
    SELECT ar.id AS request_id, ar.type, ar.message,
           ar.requester_id, ar.helper_id, ar.updated_at AS confirmed_at
    FROM assistance_requests ar
    WHERE ar.status = 'safety_confirmed'
      AND (ar.requester_id = $1 OR ar.helper_id = $1)
      AND NOT EXISTS (
        SELECT 1 FROM ratings r
        WHERE r.request_id = ar.id AND r.rater_id = $1
      )
    ORDER BY ar.updated_at DESC
    LIMIT 10
  `, [userId])
  return rows
}

/**
 * Get all ratings for a user (received).
 */
export async function findByUser(userId) {
  const { rows } = await db.query(
    'SELECT * FROM ratings WHERE rated_id = $1 ORDER BY created_at DESC',
    [userId]
  )
  return rows
}
