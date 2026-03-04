/**
 * Push subscription repository.
 */

import { db } from '../pool.js'

/**
 * Save or update a push subscription for a user.
 */
export async function upsert({ userId, endpoint, p256dh, auth }) {
  const { rows } = await db.query(`
    INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (user_id, endpoint) DO UPDATE SET
      p256dh = EXCLUDED.p256dh,
      auth = EXCLUDED.auth
    RETURNING id
  `, [userId, endpoint, p256dh, auth])
  return rows[0]
}

/**
 * Remove a push subscription.
 */
export async function remove(userId, endpoint) {
  const { rowCount } = await db.query(`
    DELETE FROM push_subscriptions
    WHERE user_id = $1 AND endpoint = $2
  `, [userId, endpoint])
  return rowCount > 0
}

/**
 * Get all subscriptions for a user.
 */
export async function findByUser(userId) {
  const { rows } = await db.query(`
    SELECT endpoint, p256dh, auth FROM push_subscriptions
    WHERE user_id = $1
  `, [userId])
  return rows
}

/**
 * Find push subscriptions for all users eligible to respond to a request.
 * Applies the same eligibility tier logic used in request listing queries.
 *
 * @param {object} params
 * @param {string} params.requesterId - UUID of the requester (excluded from results)
 * @param {string} params.eligibilityTier - 'same_demographics' | 'verified_guardians' | 'any_member'
 * @returns {Promise<Array<{endpoint: string, p256dh: string, auth: string, user_id: string, preferred_lang: string}>>}
 */
export async function findEligibleForRequest({ requesterId, eligibilityTier }) {
  const { rows } = await db.query(`
    SELECT ps.endpoint, ps.p256dh, ps.auth, ps.user_id, u.preferred_lang
    FROM push_subscriptions ps
    JOIN users u ON u.id = ps.user_id AND u.deleted_at IS NULL
    CROSS JOIN (SELECT birth_year, sex FROM users WHERE id = $1) AS req
    WHERE ps.user_id != $1
      AND (
        $2 = 'any_member'
        OR ($2 = 'verified_guardians' AND (
          (u.sex = req.sex AND u.birth_year IS NOT NULL AND req.birth_year IS NOT NULL
           AND ABS(u.birth_year - req.birth_year) <= 5)
          OR COALESCE((SELECT SUM(r.value) FROM ratings r WHERE r.rated_id = u.id), 0) >= 5
        ))
        OR ($2 = 'same_demographics'
          AND u.sex = req.sex AND u.birth_year IS NOT NULL AND req.birth_year IS NOT NULL
          AND ABS(u.birth_year - req.birth_year) <= 5)
      )
  `, [requesterId, eligibilityTier])
  return rows
}
