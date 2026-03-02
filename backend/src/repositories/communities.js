/**
 * Community repository — database operations for communities + members.
 *
 * Security model:
 *   - Member lists are only visible to fellow members
 *   - Nearby discovery returns area_name, NOT coordinates
 *   - Join requires admin approval
 */

import { db } from '../pool.js'

/**
 * List all communities (public view: no coordinates, member count only).
 */
export async function listAll() {
  const { rows } = await db.query(`
    SELECT c.id, c.name, c.description, c.area_name, c.created_at,
           COUNT(cm.user_id) FILTER (WHERE cm.status = 'approved') AS member_count
    FROM communities c
    LEFT JOIN community_members cm ON cm.community_id = c.id
    WHERE c.deleted_at IS NULL
    GROUP BY c.id
    ORDER BY c.created_at DESC
  `)
  return rows
}

/**
 * Find a community by ID (public view).
 */
export async function findById(id) {
  const { rows } = await db.query(`
    SELECT c.id, c.name, c.description, c.area_name, c.created_at, c.created_by,
           COUNT(cm.user_id) FILTER (WHERE cm.status = 'approved') AS member_count
    FROM communities c
    LEFT JOIN community_members cm ON cm.community_id = c.id
    WHERE c.id = $1 AND c.deleted_at IS NULL
    GROUP BY c.id
  `, [id])
  return rows[0] || null
}

/**
 * Discover nearby communities using Haversine formula.
 * Returns area_name, NOT exact coordinates.
 * @param {number} lat - User latitude
 * @param {number} lng - User longitude
 * @param {number} [radiusKm=10] - Search radius in km
 */
export async function findNearby(lat, lng, radiusKm = 10) {
  const { rows } = await db.query(`
    SELECT c.id, c.name, c.description, c.area_name,
           COUNT(cm.user_id) FILTER (WHERE cm.status = 'approved') AS member_count,
           (6371 * acos(
             cos(radians($1)) * cos(radians(c.latitude)) *
             cos(radians(c.longitude) - radians($2)) +
             sin(radians($1)) * sin(radians(c.latitude))
           )) AS distance_km
    FROM communities c
    LEFT JOIN community_members cm ON cm.community_id = c.id
    WHERE c.deleted_at IS NULL
    GROUP BY c.id
    HAVING (6371 * acos(
      cos(radians($1)) * cos(radians(c.latitude)) *
      cos(radians(c.longitude) - radians($2)) +
      sin(radians($1)) * sin(radians(c.latitude))
    )) <= $3
    ORDER BY distance_km
    LIMIT 20
  `, [lat, lng, radiusKm])
  return rows
}

/**
 * Create a community. Creator automatically becomes admin.
 */
export async function create({ name, description, latitude, longitude, areaName, createdBy }) {
  const client = await db.connect()
  try {
    await client.query('BEGIN')

    const { rows } = await client.query(`
      INSERT INTO communities (name, description, latitude, longitude, area_name, created_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, name, description, area_name, created_by, created_at
    `, [name, description || '', latitude, longitude, areaName || '', createdBy])

    const community = rows[0]

    // Creator becomes admin (auto-approved)
    await client.query(`
      INSERT INTO community_members (community_id, user_id, role, status, joined_at)
      VALUES ($1, $2, 'admin', 'approved', NOW())
    `, [community.id, createdBy])

    await client.query('COMMIT')
    return community
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

/**
 * Get members of a community (only for fellow approved members).
 */
export async function getMembers(communityId) {
  const { rows } = await db.query(`
    SELECT u.id AS user_id, u.display_name, u.verified, cm.role, cm.joined_at
    FROM community_members cm
    JOIN users u ON u.id = cm.user_id AND u.deleted_at IS NULL
    WHERE cm.community_id = $1 AND cm.status = 'approved'
    ORDER BY cm.role DESC, cm.joined_at ASC
  `, [communityId])
  return rows
}

/**
 * Get pending join requests (for admins).
 */
export async function getPendingRequests(communityId) {
  const { rows } = await db.query(`
    SELECT u.id AS user_id, u.display_name, u.verified, cm.requested_at
    FROM community_members cm
    JOIN users u ON u.id = cm.user_id AND u.deleted_at IS NULL
    WHERE cm.community_id = $1 AND cm.status = 'pending'
    ORDER BY cm.requested_at ASC
  `, [communityId])
  return rows
}

/**
 * Request to join a community (enters pending state).
 */
export async function requestJoin(communityId, userId) {
  const { rows } = await db.query(`
    INSERT INTO community_members (community_id, user_id, role, status)
    VALUES ($1, $2, 'member', 'pending')
    ON CONFLICT (community_id, user_id) DO NOTHING
    RETURNING community_id, user_id, status, requested_at
  `, [communityId, userId])
  return rows[0] || null
}

/**
 * Approve a pending member.
 */
export async function approveMember(communityId, userId) {
  const { rowCount } = await db.query(`
    UPDATE community_members
    SET status = 'approved', joined_at = NOW()
    WHERE community_id = $1 AND user_id = $2 AND status = 'pending'
  `, [communityId, userId])
  return rowCount > 0
}

/**
 * Reject a pending member.
 */
export async function rejectMember(communityId, userId) {
  const { rowCount } = await db.query(`
    UPDATE community_members
    SET status = 'rejected'
    WHERE community_id = $1 AND user_id = $2 AND status = 'pending'
  `, [communityId, userId])
  return rowCount > 0
}

/**
 * Leave a community (delete membership row).
 */
export async function leave(communityId, userId) {
  const { rowCount } = await db.query(`
    DELETE FROM community_members
    WHERE community_id = $1 AND user_id = $2
  `, [communityId, userId])
  return rowCount > 0
}

/**
 * Check if a user is an approved member of a community.
 */
export async function isMember(communityId, userId) {
  const { rows } = await db.query(`
    SELECT 1 FROM community_members
    WHERE community_id = $1 AND user_id = $2 AND status = 'approved'
  `, [communityId, userId])
  return rows.length > 0
}

/**
 * Check if a user is an admin of a community.
 */
export async function isAdmin(communityId, userId) {
  const { rows } = await db.query(`
    SELECT 1 FROM community_members
    WHERE community_id = $1 AND user_id = $2 AND role = 'admin' AND status = 'approved'
  `, [communityId, userId])
  return rows.length > 0
}

/**
 * Get all communities a user belongs to (approved only).
 */
export async function getUserCommunities(userId) {
  const { rows } = await db.query(`
    SELECT c.id, c.name, c.description, c.area_name, cm.role, cm.joined_at,
           COUNT(cm2.user_id) FILTER (WHERE cm2.status = 'approved') AS member_count
    FROM community_members cm
    JOIN communities c ON c.id = cm.community_id AND c.deleted_at IS NULL
    LEFT JOIN community_members cm2 ON cm2.community_id = c.id
    WHERE cm.user_id = $1 AND cm.status = 'approved'
    GROUP BY c.id, cm.role, cm.joined_at
    ORDER BY cm.joined_at DESC
  `, [userId])
  return rows
}
