/**
 * Block and report repository.
 *
 * A block is stored once (blocker → blocked) but enforced both ways. Every
 * query that matches, notifies or relays between two people uses
 * blockedBetweenSql() so the rule lives in one place.
 */

import { db } from '../pool.js'

export const REPORT_REASONS = ['harassment', 'inappropriate', 'unsafe', 'spam', 'other']
export const REPORT_STATUSES = ['open', 'reviewed', 'actioned', 'dismissed']

/** How long a past session partner stays listed (and reportable). */
export const PARTNER_WINDOW_DAYS = 90

/**
 * SQL fragment: true when either user has blocked the other.
 * @param {string} a - SQL expression for one user id
 * @param {string} b - SQL expression for the other
 */
export function blockedBetweenSql(a, b) {
  return `EXISTS (SELECT 1 FROM user_blocks ub
    WHERE (ub.blocker_id = ${a} AND ub.blocked_id = ${b})
       OR (ub.blocker_id = ${b} AND ub.blocked_id = ${a}))`
}

/**
 * Whether either user has blocked the other.
 */
export async function isBlockedEitherWay(userA, userB) {
  if (!userA || !userB) return false
  const { rows } = await db.query(
    `SELECT ${blockedBetweenSql('$1::uuid', '$2::uuid')} AS blocked`,
    [userA, userB]
  )
  return rows[0].blocked
}

/**
 * Block a user. Idempotent.
 */
export async function block(blockerId, blockedId) {
  await db.query(`
    INSERT INTO user_blocks (blocker_id, blocked_id)
    VALUES ($1, $2)
    ON CONFLICT DO NOTHING
  `, [blockerId, blockedId])
}

/**
 * Remove a block the user created. Returns true if one existed.
 */
export async function unblock(blockerId, blockedId) {
  const { rowCount } = await db.query(
    'DELETE FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2',
    [blockerId, blockedId]
  )
  return rowCount > 0
}

/**
 * Users this user has blocked, with their pseudonyms.
 */
export async function listBlocked(blockerId) {
  const { rows } = await db.query(`
    SELECT ub.blocked_id AS user_id, u.display_name, ub.created_at
    FROM user_blocks ub
    JOIN users u ON u.id = ub.blocked_id
    WHERE ub.blocker_id = $1
    ORDER BY ub.created_at DESC
  `, [blockerId])
  return rows
}

/**
 * Whether two users have shared a session within the partner window.
 * Report and block are limited to people you have actually met, so ids
 * cannot be probed or mass-reported.
 */
export async function isRecentPartner(userId, partnerId) {
  const { rows } = await db.query(`
    SELECT 1 FROM session_partners
    WHERE user_id = $1 AND partner_id = $2
      AND met_at > NOW() - make_interval(days => $3)
  `, [userId, partnerId, PARTNER_WINDOW_DAYS])
  return rows.length > 0
}

/**
 * Recent session partners, newest first, with whether this user blocked them.
 */
export async function listRecentPartners(userId) {
  const { rows } = await db.query(`
    SELECT sp.partner_id AS user_id, u.display_name, sp.request_id, sp.met_at,
           EXISTS (SELECT 1 FROM user_blocks ub
                   WHERE ub.blocker_id = $1 AND ub.blocked_id = sp.partner_id) AS blocked
    FROM session_partners sp
    JOIN users u ON u.id = sp.partner_id AND u.deleted_at IS NULL
    WHERE sp.user_id = $1
      AND sp.met_at > NOW() - make_interval(days => $2)
    ORDER BY sp.met_at DESC
    LIMIT 50
  `, [userId, PARTNER_WINDOW_DAYS])
  return rows
}

/**
 * File a report. When requestId names a session both users were in, the
 * chat as it stands is copied into the report.
 */
export async function createReport({ reporterId, reportedId, requestId = null, reason, details = '' }) {
  const { rows } = await db.query(`
    INSERT INTO user_reports (reporter_id, reported_id, request_id, reason, details, messages)
    SELECT $1, $2, ar.id, $4, $5,
           COALESCE((
             SELECT jsonb_agg(jsonb_build_object(
                      'senderId', sm.sender_id, 'content', sm.content,
                      'createdAt', sm.created_at) ORDER BY sm.created_at)
             FROM session_messages sm WHERE sm.request_id = ar.id
           ), '[]'::jsonb)
    FROM (SELECT 1) one
    LEFT JOIN assistance_requests ar
      ON ar.id = $3::uuid
     AND ((ar.requester_id = $1 AND ar.helper_id = $2)
       OR (ar.requester_id = $2 AND ar.helper_id = $1))
    RETURNING id, reporter_id, reported_id, request_id, reason, details,
              jsonb_array_length(messages) AS message_count, status, created_at
  `, [reporterId, reportedId, requestId, reason, details])
  return rows[0]
}

/**
 * Reports a user has filed (for GDPR export).
 */
export async function findReportsByReporter(userId) {
  const { rows } = await db.query(`
    SELECT id, reported_id, request_id, reason, details, status, created_at
    FROM user_reports WHERE reporter_id = $1
    ORDER BY created_at DESC
  `, [userId])
  return rows
}

/**
 * Admin: list reports, newest first, with pseudonyms and how often the
 * reported user has been reported in total.
 */
export async function listReports({ status = 'open', limit = 100 } = {}) {
  const { rows } = await db.query(`
    SELECT r.*, reporter.display_name AS reporter_name,
           reported.display_name AS reported_name,
           (SELECT count(*)::int FROM user_reports r2
             WHERE r2.reported_id = r.reported_id) AS reported_total
    FROM user_reports r
    LEFT JOIN users reporter ON reporter.id = r.reporter_id
    LEFT JOIN users reported ON reported.id = r.reported_id
    WHERE ($1::text IS NULL OR r.status = $1)
    ORDER BY r.created_at DESC
    LIMIT $2
  `, [status, limit])
  return rows
}

/**
 * Admin: set a report's status.
 */
export async function setReportStatus(id, status) {
  const { rows } = await db.query(`
    UPDATE user_reports SET status = $2, reviewed_at = NOW()
    WHERE id = $1
    RETURNING *
  `, [id, status])
  return rows[0] || null
}

/**
 * Drop partner rows past the window. Called by the daily GDPR worker.
 */
export async function pruneOldPartners() {
  const { rowCount } = await db.query(
    'DELETE FROM session_partners WHERE met_at < NOW() - make_interval(days => $1)',
    [PARTNER_WINDOW_DAYS]
  )
  return rowCount
}
