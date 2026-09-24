/**
 * Assistance request repository.
 */

import { db } from '../pool.js'

/**
 * Create a new assistance request.
 */
export async function create({
  requesterId, type, message, eligibilityTier,
  pickupLat, pickupLng, destinationLat, destinationLng,
}) {
  const { rows } = await db.query(`
    INSERT INTO assistance_requests
      (requester_id, type, message, eligibility_tier,
       pickup_lat, pickup_lng, destination_lat, destination_lng)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
  `, [requesterId, type || 'walk', message || '',
      eligibilityTier || 'same_demographics',
      pickupLat, pickupLng, destinationLat, destinationLng])
  return rows[0]
}

/**
 * Find a request by ID.
 */
export async function findById(id) {
  const { rows } = await db.query('SELECT * FROM assistance_requests WHERE id = $1', [id])
  return rows[0] || null
}

/**
 * Get requests for the current user (as requester or helper).
 */
export async function findByUser(userId) {
  const { rows } = await db.query(`
    SELECT * FROM assistance_requests
    WHERE (requester_id = $1 OR helper_id = $1)
      AND status NOT IN ('expired', 'cancelled')
    ORDER BY created_at DESC
    LIMIT 50
  `, [userId])
  return rows
}

/**
 * Get open requests eligible for a user.
 */
export async function findOpenFreestanding({ userId, sex, birthYear, safetyScore }) {
  const { rows } = await db.query(`
    SELECT ar.id, ar.type, ar.message, ar.status, ar.eligibility_tier,
           ar.requester_id, ar.helper_id,
           ROUND(ar.pickup_lat, 3) AS pickup_lat,
           ROUND(ar.pickup_lng, 3) AS pickup_lng,
           NULL::numeric AS destination_lat,
           NULL::numeric AS destination_lng,
           ar.accepted_at, ar.expires_at, ar.completed_at, ar.cancelled_at,
           ar.created_at, ar.updated_at
    FROM assistance_requests ar
    JOIN users u ON u.id = ar.requester_id
    WHERE ar.status = 'open'
      AND ar.requester_id != $1
      AND (
        ar.eligibility_tier = 'any_member'
        OR (ar.eligibility_tier = 'verified_guardians' AND (
          (u.sex = $2 AND u.birth_year IS NOT NULL AND $3::int IS NOT NULL
           AND ABS(u.birth_year - $3::int) <= 5)
          OR $4::int >= 5
        ))
        OR (ar.eligibility_tier = 'same_demographics'
          AND u.sex = $2 AND u.birth_year IS NOT NULL AND $3::int IS NOT NULL
          AND ABS(u.birth_year - $3::int) <= 5
        )
      )
    ORDER BY ar.created_at DESC
    LIMIT 50
  `, [userId, sex, birthYear, safetyScore])
  return rows
}

/**
 * Accept a request (become helper).
 */
export async function accept(requestId, helperId) {
  const { rows } = await db.query(`
    UPDATE assistance_requests
    SET status = 'accepted', helper_id = $2, accepted_at = NOW(), updated_at = NOW()
    WHERE id = $1 AND status = 'open'
    RETURNING *
  `, [requestId, helperId])
  return rows[0] || null
}

/**
 * Start an active session.
 */
export async function start(requestId) {
  const { rows } = await db.query(`
    UPDATE assistance_requests
    SET status = 'active', updated_at = NOW()
    WHERE id = $1 AND status = 'accepted'
    RETURNING *
  `, [requestId])
  return rows[0] || null
}

/**
 * Accept and immediately start a request (atomic accept-to-active transition).
 * Returns the active request, or null if accept failed.
 */
export async function acceptAndStart(requestId, helperId) {
  const accepted = await accept(requestId, helperId)
  if (!accepted) return null
  const started = await start(requestId)
  return started || accepted
}

/**
 * Mark as completed (legacy — kept for backward compat).
 */
export async function complete(requestId) {
  const { rows } = await db.query(`
    UPDATE assistance_requests
    SET status = 'completed', completed_at = NOW(), updated_at = NOW()
    WHERE id = $1 AND status = 'active'
    RETURNING *
  `, [requestId])
  return rows[0] || null
}

/**
 * Initiate a "done" proposal — either party can call this from active status.
 */
export async function initiateDone(requestId, initiatorId) {
  const { rows } = await db.query(`
    UPDATE assistance_requests
    SET status = 'done_pending',
        done_initiated_by = $2,
        done_initiated_at = NOW(),
        updated_at = NOW()
    WHERE id = $1 AND status = 'active'
    RETURNING *
  `, [requestId, initiatorId])
  return rows[0] || null
}

/**
 * Accept a pending "done" proposal — transitions to completed.
 */
export async function acceptDone(requestId) {
  const { rows } = await db.query(`
    UPDATE assistance_requests
    SET status = 'completed',
        completed_at = NOW(),
        updated_at = NOW()
    WHERE id = $1 AND status = 'done_pending'
    RETURNING *
  `, [requestId])
  return rows[0] || null
}

/**
 * Reject a pending "done" proposal — returns to active.
 */
export async function rejectDone(requestId) {
  const { rows } = await db.query(`
    UPDATE assistance_requests
    SET status = 'active',
        done_initiated_by = NULL,
        done_initiated_at = NULL,
        updated_at = NOW()
    WHERE id = $1 AND status = 'done_pending'
    RETURNING *
  `, [requestId])
  return rows[0] || null
}

/**
 * Confirm safe arrival.
 */
export async function confirmSafety(requestId) {
  const { rows } = await db.query(`
    UPDATE assistance_requests
    SET status = 'safety_confirmed', updated_at = NOW()
    WHERE id = $1 AND status = 'completed'
    RETURNING *
  `, [requestId])
  return rows[0] || null
}

/**
 * Cancel a request.
 */
export async function cancel(requestId) {
  const { rows } = await db.query(`
    UPDATE assistance_requests
    SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW()
    WHERE id = $1 AND status IN ('open', 'accepted', 'active', 'done_pending')
    RETURNING *
  `, [requestId])
  return rows[0] || null
}

/**
 * Expire non-terminal requests past their expires_at. Called by the expiration worker.
 * Covers open, accepted, active, and done_pending statuses (2-hour hard limit).
 * @returns {Array} Expired requests with id, requester_id, helper_id, status (previous)
 */
export async function expireOldRequests() {
  const { rows } = await db.query(`
    UPDATE assistance_requests
    SET status = 'expired', updated_at = NOW()
    WHERE status IN ('open', 'accepted', 'active', 'done_pending')
      AND expires_at < NOW()
    RETURNING id, requester_id, helper_id
  `)
  return rows
}

/**
 * Delete all requests in terminal statuses.
 * Safe for startup cleanup — CASCADE removes session_messages; ratings and
 * points_ledger rows survive with request_id set to NULL (migration 010), so
 * safety scores and points are not reset.
 * Location updates already auto-deleted by DB trigger on terminal status.
 * @returns {Promise<number>} Number of deleted requests
 */
export async function deleteTerminal() {
  const { rowCount } = await db.query(`
    DELETE FROM assistance_requests
    WHERE status IN ('completed', 'safety_confirmed', 'cancelled', 'expired')
  `)
  return rowCount
}

/**
 * Save a location update.
 */
export async function saveLocationUpdate({ requestId, userId, latitude, longitude, accuracyM }) {
  const { rows } = await db.query(`
    INSERT INTO location_updates (request_id, user_id, latitude, longitude, accuracy_m)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `, [requestId, userId, latitude, longitude, accuracyM])
  return rows[0]
}
