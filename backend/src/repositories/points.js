/**
 * Points & badges repository — personal progress tracking.
 */

import { db } from '../pool.js'
import { HELPER_POINTS, REQUESTER_POINTS, COOLDOWN_HOURS, BADGE_DEFS } from '../points-config.js'

export { HELPER_POINTS, REQUESTER_POINTS, COOLDOWN_HOURS, BADGE_DEFS }

/**
 * Canonical pair key — smaller UUID first.
 */
function canonicalPair(a, b) {
  return a < b ? [a, b] : [b, a]
}

/**
 * Check if the pair is within the cooldown window.
 * Returns true if cooldown is active (should NOT award).
 */
export async function checkCooldown(userA, userB) {
  const [a, b] = canonicalPair(userA, userB)
  const { rows } = await db.query(
    `SELECT last_completed_at FROM pair_cooldowns
     WHERE user_a = $1 AND user_b = $2`,
    [a, b]
  )
  if (rows.length === 0) return false
  const elapsed = Date.now() - new Date(rows[0].last_completed_at).getTime()
  return elapsed < COOLDOWN_HOURS * 3600_000
}

/**
 * Upsert the pair cooldown timestamp.
 */
async function updateCooldown(userA, userB) {
  const [a, b] = canonicalPair(userA, userB)
  await db.query(
    `INSERT INTO pair_cooldowns (user_a, user_b, last_completed_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (user_a, user_b)
     DO UPDATE SET last_completed_at = NOW()`,
    [a, b]
  )
}

/**
 * Award points for a completed session to both participants.
 * Idempotent via UNIQUE(user_id, request_id). Checks pair cooldown.
 * Returns { awarded, cooldown, newBadges }.
 */
export async function awardSessionPoints({ requestId, requesterId, helperId }) {
  const onCooldown = await checkCooldown(requesterId, helperId)
  if (onCooldown) {
    return { awarded: false, cooldown: true, newBadges: [] }
  }

  // Insert for helper (ON CONFLICT = idempotent)
  await db.query(
    `INSERT INTO points_ledger (user_id, request_id, role, points)
     VALUES ($1, $2, 'helper', $3)
     ON CONFLICT (user_id, request_id) DO NOTHING`,
    [helperId, requestId, HELPER_POINTS]
  )

  // Insert for requester
  await db.query(
    `INSERT INTO points_ledger (user_id, request_id, role, points)
     VALUES ($1, $2, 'requester', $3)
     ON CONFLICT (user_id, request_id) DO NOTHING`,
    [requesterId, requestId, REQUESTER_POINTS]
  )

  await updateCooldown(requesterId, helperId)

  const helperBadges = await evaluateBadges(helperId)
  const requesterBadges = await evaluateBadges(requesterId)

  return {
    awarded: true,
    cooldown: false,
    newBadges: [
      ...helperBadges.map(b => ({ userId: helperId, badge: b })),
      ...requesterBadges.map(b => ({ userId: requesterId, badge: b })),
    ],
  }
}

/**
 * Get summary stats for a user.
 */
export async function getStats(userId) {
  const { rows } = await db.query(`
    SELECT
      COALESCE(SUM(points), 0)::int AS total_points,
      COUNT(*)::int AS total_sessions,
      COUNT(*) FILTER (WHERE role = 'helper')::int AS helper_sessions,
      COUNT(*) FILTER (WHERE role = 'requester')::int AS requester_sessions
    FROM points_ledger
    WHERE user_id = $1
  `, [userId])
  return {
    totalPoints: rows[0].total_points,
    totalSessions: rows[0].total_sessions,
    helperSessions: rows[0].helper_sessions,
    requesterSessions: rows[0].requester_sessions,
  }
}

/**
 * Get total points for a user.
 */
export async function getTotalPoints(userId) {
  const { rows } = await db.query(
    'SELECT COALESCE(SUM(points), 0)::int AS total FROM points_ledger WHERE user_id = $1',
    [userId]
  )
  return rows[0].total
}

/**
 * Get paginated points history.
 */
export async function getPointsHistory(userId, { limit = 20, offset = 0 } = {}) {
  const { rows } = await db.query(`
    SELECT id, request_id, role, points, reason, created_at
    FROM points_ledger
    WHERE user_id = $1
    ORDER BY created_at DESC
    LIMIT $2 OFFSET $3
  `, [userId, limit, offset])
  return rows
}

/**
 * Evaluate and award newly-earned badges. Returns array of new badge keys.
 */
export async function evaluateBadges(userId) {
  const stats = await getStats(userId)
  const newBadges = []

  for (const def of BADGE_DEFS) {
    if (!def.check(stats)) continue
    const { rowCount } = await db.query(
      `INSERT INTO badges (user_id, badge_key)
       VALUES ($1, $2)
       ON CONFLICT (user_id, badge_key) DO NOTHING`,
      [userId, def.key]
    )
    if (rowCount > 0) newBadges.push(def.key)
  }

  return newBadges
}

/**
 * Get all badges for a user.
 */
export async function getBadges(userId) {
  const { rows } = await db.query(
    'SELECT badge_key, earned_at, visible FROM badges WHERE user_id = $1 ORDER BY earned_at',
    [userId]
  )
  return rows
}

/**
 * Toggle badge visibility (opt-in profile display).
 */
export async function setBadgeVisibility(userId, badgeKey, visible) {
  const { rowCount } = await db.query(
    'UPDATE badges SET visible = $3 WHERE user_id = $1 AND badge_key = $2',
    [userId, badgeKey, visible]
  )
  return rowCount > 0
}

/**
 * Get all points data for GDPR export.
 */
export async function getExportData(userId) {
  const [ledger, badges] = await Promise.all([
    db.query(
      'SELECT request_id, role, points, reason, created_at FROM points_ledger WHERE user_id = $1 ORDER BY created_at',
      [userId]
    ),
    db.query(
      'SELECT badge_key, earned_at, visible FROM badges WHERE user_id = $1 ORDER BY earned_at',
      [userId]
    ),
  ])
  return {
    points: ledger.rows,
    badges: badges.rows,
  }
}
