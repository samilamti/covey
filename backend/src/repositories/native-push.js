/**
 * Native push token repository (Capacitor iOS/Android).
 *
 * Stores FCM/APNs device tokens. Separate from push_subscriptions
 * which stores Web Push (VAPID) subscription data.
 */

import { db } from '../pool.js'

/**
 * Save or update a native push token for a user.
 */
export async function upsert({ userId, token, platform, language = 'sv' }) {
  const { rows } = await db.query(`
    INSERT INTO native_push_tokens (user_id, token, platform, language)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (user_id, token) DO UPDATE SET
      platform = EXCLUDED.platform,
      language = EXCLUDED.language
    RETURNING id
  `, [userId, token, platform, language])
  return rows[0]
}

/**
 * Remove a native push token.
 */
export async function remove(userId, token) {
  const { rowCount } = await db.query(`
    DELETE FROM native_push_tokens
    WHERE user_id = $1 AND token = $2
  `, [userId, token])
  return rowCount > 0
}

/**
 * Get all native push tokens for a user, including preferred language.
 */
export async function findByUserWithLang(userId) {
  const { rows } = await db.query(`
    SELECT npt.token, npt.platform, u.preferred_lang
    FROM native_push_tokens npt
    JOIN users u ON u.id = npt.user_id
    WHERE npt.user_id = $1
    ORDER BY npt.created_at DESC
  `, [userId])
  return rows
}

/**
 * Find native push tokens for all users eligible to respond to a request.
 * Mirrors the eligibility logic in push-subscriptions.js findEligibleForRequest.
 */
export async function findEligibleForRequest({ requesterId, eligibilityTier }) {
  const { rows } = await db.query(`
    SELECT DISTINCT ON (npt.user_id)
      npt.token, npt.platform, npt.user_id, u.preferred_lang
    FROM native_push_tokens npt
    JOIN users u ON u.id = npt.user_id AND u.deleted_at IS NULL
    CROSS JOIN (SELECT birth_year, sex FROM users WHERE id = $1) AS req
    WHERE npt.user_id != $1
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
    ORDER BY npt.user_id, npt.created_at DESC
  `, [requesterId, eligibilityTier])
  return rows
}

/**
 * Find all native push tokens for a specific user (for GDPR export).
 */
export async function findByUser(userId) {
  const { rows } = await db.query(`
    SELECT token, platform, language, created_at
    FROM native_push_tokens
    WHERE user_id = $1
    ORDER BY created_at DESC
  `, [userId])
  return rows
}
