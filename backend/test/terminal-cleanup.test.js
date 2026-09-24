/**
 * Startup cleanup must not reset safety scores or points.
 *
 * index.js calls reqRepo.deleteTerminal() on every boot. Ratings and the
 * points ledger used to reference assistance_requests with ON DELETE CASCADE,
 * so each restart wiped every user's Trygghetspoäng (and with it the
 * verified_guardians tier). Migration 010 switched both FKs to SET NULL.
 *
 * Needs a real database: DATABASE_URL=... npm test. Skipped without one,
 * because importing pool.js exits the process when no DB is reachable.
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

const hasDb = Boolean(process.env.DATABASE_URL)

describe('deleteTerminal() keeps ratings and points', { skip: !hasDb && 'DATABASE_URL not set' }, () => {
  let db, reqRepo, ratingsRepo, migrate
  let requester, helper, requestId

  before(async () => {
    ;({ migrate } = await import('../src/migrate.js'))
    await migrate()
    // Second run exercises the boot-time "verify" re-execution of 010.
    await migrate()
    ;({ db } = await import('../src/pool.js'))
    reqRepo = await import('../src/repositories/requests.js')
    ratingsRepo = await import('../src/repositories/ratings.js')

    const mkUser = async () => {
      const { rows } = await db.query(
        'INSERT INTO users (nin_hash, verified) VALUES ($1, TRUE) RETURNING id',
        [`test-${randomUUID()}`]
      )
      return rows[0].id
    }
    requester = await mkUser()
    helper = await mkUser()

    const { rows } = await db.query(
      `INSERT INTO assistance_requests (requester_id, helper_id, status)
       VALUES ($1, $2, 'safety_confirmed') RETURNING id`,
      [requester, helper]
    )
    requestId = rows[0].id

    await ratingsRepo.submitRating({ requestId, raterId: requester, ratedId: helper, value: 1 })
    await ratingsRepo.submitRating({ requestId, raterId: helper, ratedId: requester, value: 1 })
    await db.query(
      `INSERT INTO points_ledger (user_id, request_id, role, points)
       VALUES ($1, $3, 'helper', 10), ($2, $3, 'requester', 5)`,
      [helper, requester, requestId]
    )
  })

  after(async () => {
    if (!db) return
    await db.query('DELETE FROM users WHERE id = ANY($1)', [[requester, helper].filter(Boolean)])
    await db.end()
  })

  it('deletes the finished request itself', async () => {
    assert.equal(await ratingsRepo.getSafetyScore(helper), 1)
    const deleted = await reqRepo.deleteTerminal()
    assert.ok(deleted >= 1)
    const { rowCount } = await db.query('SELECT 1 FROM assistance_requests WHERE id = $1', [requestId])
    assert.equal(rowCount, 0)
  })

  it('keeps both users\' safety scores', async () => {
    assert.equal(await ratingsRepo.getSafetyScore(helper), 1)
    assert.equal(await ratingsRepo.getSafetyScore(requester), 1)
  })

  it('keeps the points ledger, unlinked from the deleted request', async () => {
    const { rows } = await db.query(
      'SELECT user_id, request_id, points FROM points_ledger WHERE user_id = ANY($1)',
      [[requester, helper]]
    )
    assert.equal(rows.length, 2)
    assert.ok(rows.every(r => r.request_id === null))
  })

  it('still removes ratings when the rated account is purged', async () => {
    await db.query('DELETE FROM users WHERE id = $1', [helper])
    const { rowCount } = await db.query('SELECT 1 FROM ratings WHERE rated_id = $1', [helper])
    assert.equal(rowCount, 0)
  })
})
