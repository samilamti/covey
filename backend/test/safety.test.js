/**
 * Block and report (migration 012, routes/safety.js, routes/admin.js).
 *
 * A block must hold everywhere two people can meet: the open listing, the
 * accept, push targeting (web and native), the session chat. Report and
 * block must keep working after the session has ended and its request row
 * has been deleted.
 *
 * Needs a real database: DATABASE_URL=... npm test. Skipped without one.
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'

const hasDb = Boolean(process.env.DATABASE_URL)

describe('block and report', { skip: !hasDb && 'DATABASE_URL not set' }, () => {
  let db, safetyRepo, reqRepo, msgRepo, pushRepo, nativeRepo, checkEligibility
  let server, baseUrl, signToken
  const emitted = []

  const mkUser = async (name = 'Test') => {
    const { rows } = await db.query(
      `INSERT INTO users (nin_hash, display_name, sex, birth_year)
       VALUES ($1, $2, 'F', 1990) RETURNING id`,
      [`test-${randomUUID()}`, name]
    )
    const id = rows[0].id
    await db.query(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES ($1, $2, 'k', 'a')`,
      [id, `https://push.example/${id}`]
    )
    await db.query(
      `INSERT INTO native_push_tokens (user_id, token, platform) VALUES ($1, $2, 'android')`,
      [id, `tok-${id}`]
    )
    return id
  }

  /** An active session between two fresh users, via the real accept path. */
  const mkSession = async () => {
    const requester = await mkUser('Requester')
    const helper = await mkUser('Helper')
    const open = await reqRepo.create({ requesterId: requester, eligibilityTier: 'any_member' })
    const request = await reqRepo.acceptAndStart(open.id, helper)
    return { requester, helper, request }
  }

  const api = async (userId, method, path, body) => {
    const token = await signToken({ sub: 'test', userId, provider: 'stub' })
    const res = await fetch(`${baseUrl}/api${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: body ? JSON.stringify(body) : undefined,
    })
    return { status: res.status, body: await res.json() }
  }

  before(async () => {
    process.env.ADMIN_USER_IDS = ''
    const { migrate } = await import('../src/migrate.js')
    await migrate()
    ;({ db } = await import('../src/pool.js'))
    safetyRepo = await import('../src/repositories/safety.js')
    reqRepo = await import('../src/repositories/requests.js')
    msgRepo = await import('../src/repositories/messages.js')
    pushRepo = await import('../src/repositories/push-subscriptions.js')
    nativeRepo = await import('../src/repositories/native-push.js')
    ;({ checkEligibility } = await import('../src/services/eligibility.js'))
    ;({ signToken } = await import('../src/auth/jwt.js'))

    const express = (await import('express')).default
    const { apiRouter } = await import('../src/api.js')
    const app = express()
    app.use(express.json())
    app.set('io', { to: (room) => ({ emit: (event, data) => emitted.push({ room, event, data }) }) })
    app.use('/api', apiRouter)
    server = app.listen(0)
    baseUrl = `http://127.0.0.1:${server.address().port}`
  })

  after(async () => {
    if (server) await new Promise((r) => server.close(r))
    if (db) await db.end()
  })

  it('records both people as session partners when a helper is assigned', async () => {
    const { requester, helper, request } = await mkSession()
    const mine = await safetyRepo.listRecentPartners(requester)
    assert.equal(mine.length, 1)
    assert.equal(mine[0].user_id, helper)
    assert.equal(mine[0].display_name, 'Helper')
    assert.equal(mine[0].request_id, request.id)
    assert.equal(await safetyRepo.isRecentPartner(helper, requester), true)
  })

  it('hides a blocked requester from the open listing, both directions', async () => {
    const a = await mkUser()
    const b = await mkUser()
    const open = await reqRepo.create({ requesterId: a, eligibilityTier: 'any_member' })
    const listFor = async (u) => (await reqRepo.findOpenFreestanding({
      userId: u, sex: 'F', birthYear: 1990, safetyScore: 0,
    })).map((r) => r.id)

    assert.ok((await listFor(b)).includes(open.id))
    await safetyRepo.block(b, a) // the helper blocks the requester
    assert.ok(!(await listFor(b)).includes(open.id))
    await safetyRepo.unblock(b, a)
    await safetyRepo.block(a, b) // the requester blocks the helper
    assert.ok(!(await listFor(b)).includes(open.id))
  })

  it('refuses the accept, in the eligibility check and in the SQL itself', async () => {
    const a = await mkUser()
    const b = await mkUser()
    const open = await reqRepo.create({ requesterId: a, eligibilityTier: 'any_member' })
    await safetyRepo.block(a, b)
    assert.equal(await checkEligibility(open, b), false)
    assert.equal(await reqRepo.accept(open.id, b), null)
    assert.equal((await reqRepo.findById(open.id)).status, 'open')
  })

  for (const [name, repo] of [['web push', () => pushRepo], ['native push', () => nativeRepo]]) {
    it(`leaves blocked users out of ${name} targeting, both directions`, async () => {
      const requester = await mkUser()
      const blocker = await mkUser()
      const blockedByRequester = await mkUser()
      const bystander = await mkUser()
      await safetyRepo.block(blocker, requester)
      await safetyRepo.block(requester, blockedByRequester)

      const ids = (await repo().findEligibleForRequest({
        requesterId: requester, eligibilityTier: 'any_member',
      })).map((r) => r.user_id)

      assert.ok(ids.includes(bystander))
      assert.ok(!ids.includes(blocker))
      assert.ok(!ids.includes(blockedByRequester))
    })
  }

  it('drops a chat message once either side has blocked', async () => {
    const { requester, helper, request } = await mkSession()
    const ok = await msgRepo.create({ requestId: request.id, senderId: helper, content: 'hej' })
    assert.ok(ok)
    await safetyRepo.block(requester, helper)
    const dropped = await msgRepo.create({ requestId: request.id, senderId: helper, content: 'hallå?' })
    assert.equal(dropped, null)
  })

  it('drops a chat message from a non-participant or after the session ended', async () => {
    const { requester, request } = await mkSession()
    const stranger = await mkUser()
    assert.equal(await msgRepo.create({ requestId: request.id, senderId: stranger, content: 'x' }), null)
    await db.query("UPDATE assistance_requests SET status = 'completed' WHERE id = $1", [request.id])
    assert.equal(await msgRepo.create({ requestId: request.id, senderId: requester, content: 'x' }), null)
  })

  it('POST /safety/blocks ends the running session and tells both people', async () => {
    const { requester, helper, request } = await mkSession()
    emitted.length = 0
    const res = await api(requester, 'POST', '/safety/blocks', { userId: helper })
    assert.equal(res.status, 201)
    assert.equal(res.body.endedSessions, 1)
    assert.equal((await reqRepo.findById(request.id)).status, 'cancelled')
    const rooms = emitted.filter((e) => e.event === 'request:cancelled').map((e) => e.room).sort()
    assert.deepEqual(rooms, [`user:${helper}`, `user:${requester}`].sort())

    const blocks = await api(requester, 'GET', '/safety/blocks')
    assert.deepEqual(blocks.body.blocks.map((b) => b.user_id), [helper])
  })

  it('refuses to block or report someone you never shared a session with', async () => {
    const a = await mkUser()
    const b = await mkUser()
    assert.equal((await api(a, 'POST', '/safety/blocks', { userId: b })).status, 404)
    assert.equal((await api(a, 'POST', '/safety/reports', { userId: b, reason: 'spam' })).status, 404)
    assert.equal((await api(a, 'POST', '/safety/blocks', { userId: a })).status, 400)
  })

  it('a report snapshots the chat, can block in the same step, and survives the request row', async () => {
    const { requester, helper, request } = await mkSession()
    await msgRepo.create({ requestId: request.id, senderId: helper, content: 'ge mig ditt nummer' })

    const res = await api(requester, 'POST', '/safety/reports', {
      userId: helper, requestId: request.id, reason: 'harassment', details: 'Obehaglig', block: true,
    })
    assert.equal(res.status, 201)
    assert.equal(res.body.blocked, true)
    assert.equal(await safetyRepo.isBlockedEitherWay(helper, requester), true)

    const { rows } = await db.query('SELECT * FROM user_reports WHERE id = $1', [res.body.report.id])
    assert.equal(rows[0].reason, 'harassment')
    assert.equal(rows[0].details, 'Obehaglig')
    assert.equal(rows[0].messages.length, 1)
    assert.equal(rows[0].messages[0].content, 'ge mig ditt nummer')

    // The session ended with the block; the boot cleanup deletes its row.
    await reqRepo.deleteTerminal()
    assert.equal(await reqRepo.findById(request.id), null)
    const after = await db.query('SELECT request_id FROM user_reports WHERE id = $1', [res.body.report.id])
    assert.equal(after.rows.length, 1)
    assert.equal(after.rows[0].request_id, null)

    // ...and the partner can still be reported afterwards.
    const later = await api(requester, 'POST', '/safety/reports', { userId: helper, reason: 'other' })
    assert.equal(later.status, 201)
    const partners = await api(requester, 'GET', '/safety/partners')
    assert.equal(partners.body.partners[0].user_id, helper)
    assert.equal(partners.body.partners[0].blocked, true)
  })

  it('does not copy another session\'s chat into a report', async () => {
    const one = await mkSession()
    const other = await mkSession()
    await msgRepo.create({ requestId: other.request.id, senderId: other.helper, content: 'privat' })
    const res = await api(one.requester, 'POST', '/safety/reports', {
      userId: one.helper, requestId: other.request.id, reason: 'spam',
    })
    assert.equal(res.status, 201)
    const { rows } = await db.query('SELECT request_id, messages FROM user_reports WHERE id = $1', [res.body.report.id])
    assert.equal(rows[0].request_id, null)
    assert.deepEqual(rows[0].messages, [])
  })

  it('validates reason and details', async () => {
    const { requester, helper } = await mkSession()
    assert.equal((await api(requester, 'POST', '/safety/reports', { userId: helper, reason: 'nope' })).status, 400)
    assert.equal((await api(requester, 'POST', '/safety/reports', {
      userId: helper, reason: 'other', details: 'x'.repeat(1001),
    })).status, 400)
  })

  it('unblock restores matching', async () => {
    const { requester, helper } = await mkSession()
    await api(requester, 'POST', '/safety/blocks', { userId: helper })
    assert.equal((await api(requester, 'DELETE', `/safety/blocks/${helper}`)).status, 200)
    assert.equal(await safetyRepo.isBlockedEitherWay(requester, helper), false)
    // Only the blocker can lift a block
    await api(requester, 'POST', '/safety/blocks', { userId: helper })
    assert.equal((await api(helper, 'DELETE', `/safety/blocks/${requester}`)).status, 404)
  })

  it('admin queue is invisible to non-admins and lists reports for admins', async () => {
    const { requester, helper } = await mkSession()
    await api(requester, 'POST', '/safety/reports', { userId: helper, reason: 'unsafe' })
    assert.equal((await api(requester, 'GET', '/admin/reports')).status, 404)

    const admin = await mkUser('Admin')
    process.env.ADMIN_USER_IDS = admin
    try {
      const list = await api(admin, 'GET', '/admin/reports')
      assert.equal(list.status, 200)
      const mine = list.body.reports.find((r) => r.reported_id === helper)
      assert.equal(mine.reason, 'unsafe')
      assert.equal(mine.reported_name, 'Helper')
      const done = await api(admin, 'PATCH', `/admin/reports/${mine.id}`, { status: 'actioned' })
      assert.equal(done.body.report.status, 'actioned')
    } finally {
      process.env.ADMIN_USER_IDS = ''
    }
  })

  it('admin check needs an exact id from ADMIN_USER_IDS', async () => {
    const { isAdmin } = await import('../src/routes/admin.js')
    assert.equal(isAdmin('a', { ADMIN_USER_IDS: '' }), false)
    assert.equal(isAdmin('a', { ADMIN_USER_IDS: 'b, a' }), true)
    assert.equal(isAdmin('', { ADMIN_USER_IDS: ',' }), false)
  })

  it('the socket message handler drops what the insert refuses', () => {
    const src = readFileSync(new URL('../src/handlers.js', import.meta.url), 'utf8')
    assert.match(src, /const message = await msgRepo\.create\([\s\S]*?\}\)\s*\n\s*\/\/[^\n]*\n\s*if \(!message\) return/)
  })
})

describe('report notification', () => {
  it('emails only when Postmark is configured, and never includes the chat', async () => {
    const { notifyReportFiled } = await import('../src/services/report-notify.js')
    const calls = []
    const fetchImpl = async (url, init) => { calls.push({ url, body: JSON.parse(init.body) }); return { ok: true } }
    const report = { id: 'r1', reason: 'unsafe', reported_id: 'u', message_count: 3 }

    const saved = process.env.POSTMARK_SERVER_TOKEN
    delete process.env.POSTMARK_SERVER_TOKEN
    assert.equal(await notifyReportFiled(report, { fetchImpl }), false)
    assert.equal(calls.length, 0)

    process.env.POSTMARK_SERVER_TOKEN = 'test-token'
    try {
      assert.equal(await notifyReportFiled(report, { fetchImpl }), true)
      assert.equal(calls[0].body.To, 'support@covey.se')
      assert.match(calls[0].body.TextBody, /r1/)
    } finally {
      if (saved === undefined) delete process.env.POSTMARK_SERVER_TOKEN
      else process.env.POSTMARK_SERVER_TOKEN = saved
    }
  })
})

