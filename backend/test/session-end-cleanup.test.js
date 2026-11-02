/**
 * Data that must end with a session, and accounts that must survive re-keying.
 *
 * 1. Migration 011: session messages are deleted when a request reaches a
 *    terminal status, not at the next server start.
 * 2. rekeyLegacyNinHash(): an account written with the old unkeyed SHA-256 is
 *    moved onto the keyed HMAC at login, so the person keeps their account.
 *
 * Needs a real database: DATABASE_URL=... npm test. Skipped without one,
 * because importing pool.js exits the process when no DB is reachable.
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

const hasDb = Boolean(process.env.DATABASE_URL)

describe('session end and re-keying', { skip: !hasDb && 'DATABASE_URL not set' }, () => {
  let db, usersRepo

  const mkUser = async (ninHash = `test-${randomUUID()}`) => {
    const { rows } = await db.query(
      'INSERT INTO users (nin_hash) VALUES ($1) RETURNING id',
      [ninHash]
    )
    return rows[0].id
  }

  const mkSession = async (status) => {
    const requester = await mkUser()
    const helper = await mkUser()
    const { rows } = await db.query(
      `INSERT INTO assistance_requests (requester_id, helper_id, status)
       VALUES ($1, $2, $3) RETURNING id`,
      [requester, helper, status]
    )
    const id = rows[0].id
    await db.query(
      `INSERT INTO session_messages (request_id, sender_id, content)
       VALUES ($1, $2, 'på väg'), ($1, $3, 'ser dig')`,
      [id, requester, helper]
    )
    return id
  }

  const messageCount = async (id) =>
    Number((await db.query('SELECT count(*) FROM session_messages WHERE request_id = $1', [id])).rows[0].count)

  before(async () => {
    const { migrate } = await import('../src/migrate.js')
    await migrate()
    // Second run exercises the boot-time "verify" re-execution of 011.
    await migrate()
    ;({ db } = await import('../src/pool.js'))
    usersRepo = await import('../src/repositories/users.js')
  })

  // Close the pool, or node:test waits on its open sockets forever.
  after(async () => {
    if (db) await db.end()
  })

  for (const terminal of ['completed', 'cancelled', 'expired']) {
    it(`deletes the messages when a session becomes ${terminal}`, async () => {
      const id = await mkSession('active')
      assert.equal(await messageCount(id), 2)
      await db.query('UPDATE assistance_requests SET status = $2 WHERE id = $1', [id, terminal])
      assert.equal(await messageCount(id), 0)
    })
  }

  it('keeps the messages while the session is still running', async () => {
    const id = await mkSession('accepted')
    await db.query("UPDATE assistance_requests SET status = 'active' WHERE id = $1", [id])
    await db.query("UPDATE assistance_requests SET status = 'done_pending' WHERE id = $1", [id])
    assert.equal(await messageCount(id), 2)
  })

  it('keeps the request row itself (ratings still need it)', async () => {
    const id = await mkSession('active')
    await db.query("UPDATE assistance_requests SET status = 'completed' WHERE id = $1", [id])
    const { rows } = await db.query('SELECT status FROM assistance_requests WHERE id = $1', [id])
    assert.equal(rows[0]?.status, 'completed')
  })

  it('re-keys a legacy account onto the new hash', async () => {
    const legacyHash = `legacy-${randomUUID()}`
    const ninHash = `hmac-${randomUUID()}`
    const id = await mkUser(legacyHash)
    assert.equal(await usersRepo.rekeyLegacyNinHash({ legacyHash, ninHash }), true)
    const { rows } = await db.query('SELECT nin_hash FROM users WHERE id = $1', [id])
    assert.equal(rows[0].nin_hash, ninHash)
  })

  it('does nothing when the account already has the new hash', async () => {
    const legacyHash = `legacy-${randomUUID()}`
    const ninHash = `hmac-${randomUUID()}`
    const legacyId = await mkUser(legacyHash)
    await mkUser(ninHash)
    assert.equal(await usersRepo.rekeyLegacyNinHash({ legacyHash, ninHash }), false)
    const { rows } = await db.query('SELECT nin_hash FROM users WHERE id = $1', [legacyId])
    assert.equal(rows[0].nin_hash, legacyHash)
  })

  it('does nothing when no key is configured (hashes equal)', async () => {
    const same = `same-${randomUUID()}`
    await mkUser(same)
    assert.equal(await usersRepo.rekeyLegacyNinHash({ legacyHash: same, ninHash: same }), false)
  })
})
