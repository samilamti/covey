/**
 * User repository — database operations for the users table.
 *
 * NIN is NEVER stored raw. Only the SHA-256 hash is kept.
 */

import { db } from '../pool.js'

/**
 * Find a user by their NIN hash.
 * @param {string} hash - SHA-256 hex hash
 * @returns {Promise<object|null>}
 */
export async function findByHash(hash) {
  const { rows } = await db.query(
    `SELECT id, nin_hash, display_name, given_name, surname,
            birth_year, sex, verified, preferred_lang,
            created_at, updated_at, last_login_at
     FROM users
     WHERE nin_hash = $1 AND deleted_at IS NULL`,
    [hash]
  )
  return rows[0] || null
}

/**
 * Find a user by their UUID.
 * @param {string} id - User UUID
 * @returns {Promise<object|null>}
 */
export async function findById(id) {
  const { rows } = await db.query(
    `SELECT id, nin_hash, display_name, given_name, surname,
            birth_year, sex, verified, preferred_lang,
            created_at, updated_at, last_login_at
     FROM users
     WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  )
  return rows[0] || null
}

/**
 * Upsert a user from auth data. Creates on first login, updates last_login_at on subsequent logins.
 * @param {object} authData - { ninHash, givenName, surname }
 * @returns {Promise<object>} The user row
 */
export async function upsertFromAuth({ ninHash, givenName, surname, birthYear, sex }) {
  const { rows } = await db.query(
    `INSERT INTO users (nin_hash, given_name, surname, birth_year, sex, verified, last_login_at)
     VALUES ($1, $2, $3, $4, $5, TRUE, NOW())
     ON CONFLICT (nin_hash)
     DO UPDATE SET
       given_name = EXCLUDED.given_name,
       surname = EXCLUDED.surname,
       birth_year = COALESCE(EXCLUDED.birth_year, users.birth_year),
       sex = COALESCE(EXCLUDED.sex, users.sex),
       verified = TRUE,
       last_login_at = NOW(),
       updated_at = NOW()
     RETURNING id, nin_hash, display_name, given_name, surname,
               birth_year, sex, verified, preferred_lang,
               created_at, updated_at, last_login_at`,
    [ninHash, givenName, surname, birthYear || null, sex || null]
  )
  return rows[0]
}

/**
 * Update a user's profile.
 * @param {string} id - User UUID
 * @param {object} updates - { displayName?, preferredLang? }
 * @returns {Promise<object|null>}
 */
export async function updateProfile(id, { displayName, preferredLang }) {
  const sets = []
  const values = []
  let paramIndex = 1

  if (displayName !== undefined) {
    sets.push(`display_name = $${paramIndex++}`)
    values.push(displayName)
  }
  if (preferredLang !== undefined) {
    sets.push(`preferred_lang = $${paramIndex++}`)
    values.push(preferredLang)
  }

  if (sets.length === 0) return findById(id)

  sets.push(`updated_at = NOW()`)
  values.push(id)

  const { rows } = await db.query(
    `UPDATE users SET ${sets.join(', ')} WHERE id = $${paramIndex} AND deleted_at IS NULL
     RETURNING id, nin_hash, display_name, given_name, surname,
               birth_year, sex, verified, preferred_lang,
               created_at, updated_at, last_login_at`,
    values
  )
  return rows[0] || null
}

/**
 * Soft-delete a user (GDPR). Sets deleted_at, actual data purge happens via worker.
 * @param {string} id - User UUID
 * @returns {Promise<boolean>}
 */
export async function softDelete(id) {
  const { rowCount } = await db.query(
    `UPDATE users SET deleted_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  )
  return rowCount > 0
}
