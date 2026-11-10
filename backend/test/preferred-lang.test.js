/**
 * The language push notifications are written in (users.preferred_lang).
 *
 * It defaults to 'sv' and until 2026-11-10 the app never changed it, so every
 * push arrived in Swedish. Now sign-in and session restore report the stored
 * value, and the app saves the language on screen through PUT /api/profile
 * (frontend/src/language-sync.js). This file checks that path end to end:
 * the save lands where the push queries read it, a bad code is refused, and
 * signing in again neither resets it nor hides it.
 *
 * Needs a real database: DATABASE_URL=... npm test. Skipped without one.
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID, randomInt } from 'node:crypto'

const hasDb = Boolean(process.env.DATABASE_URL)

describe('preferred language', { skip: !hasDb && 'DATABASE_URL not set' }, () => {
  let db, pushRepo, nativeRepo, signToken, hashNin
  let server, baseUrl

  const mkUser = async ({ lang = 'sv', ninHash = `test-${randomUUID()}` } = {}) => {
    const { rows } = await db.query(
      `INSERT INTO users (nin_hash, display_name, sex, birth_year, preferred_lang)
       VALUES ($1, 'Kept name', 'F', 1990, $2) RETURNING id`,
      [ninHash, lang]
    )
    return rows[0].id
  }

  const storedLang = async (id) =>
    (await db.query('SELECT preferred_lang FROM users WHERE id = $1', [id])).rows[0].preferred_lang

  const call = async (method, path, { token, body } = {}) => {
    const res = await fetch(`${baseUrl}/api${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    return { status: res.status, body: await res.json() }
  }

  const tokenFor = (userId) => signToken({ sub: 'test', userId, provider: 'stub' })

  before(async () => {
    const { migrate } = await import('../src/migrate.js')
    await migrate()
    ;({ db } = await import('../src/pool.js'))
    pushRepo = await import('../src/repositories/push-subscriptions.js')
    nativeRepo = await import('../src/repositories/native-push.js')
    ;({ signToken } = await import('../src/auth/jwt.js'))
    ;({ hashNin } = await import('../src/auth/nin-hash.js'))

    const express = (await import('express')).default
    const { apiRouter } = await import('../src/api.js')
    const app = express()
    app.use(express.json())
    app.use('/api', apiRouter)
    server = app.listen(0)
    baseUrl = `http://127.0.0.1:${server.address().port}`
  })

  after(async () => {
    if (server) await new Promise((r) => server.close(r))
    if (db) await db.end()
  })

  it('a saved language is what both push queries read', async () => {
    const id = await mkUser()
    await db.query(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES ($1, $2, 'k', 'a')`,
      [id, `https://push.example/${id}`]
    )
    await db.query(
      `INSERT INTO native_push_tokens (user_id, token, platform) VALUES ($1, $2, 'ios')`,
      [id, `tok-${id}`]
    )

    const res = await call('PUT', '/profile', { token: await tokenFor(id), body: { preferredLang: 'uk' } })

    assert.equal(res.status, 200)
    assert.equal(res.body.user.preferredLang, 'uk')
    const [web] = await pushRepo.findByUserWithLang(id)
    const [native] = await nativeRepo.findByUserWithLang(id)
    assert.equal(web.preferred_lang, 'uk')
    assert.equal(native.preferred_lang, 'uk')
  })

  it('saving only the language leaves the display name alone', async () => {
    // The app sends { preferredLang } with no displayName; JSON drops the
    // undefined key, so the update must touch the language column only.
    const id = await mkUser()
    const res = await call('PUT', '/profile', { token: await tokenFor(id), body: { preferredLang: 'en' } })
    assert.equal(res.status, 200)
    assert.equal(res.body.user.displayName, 'Kept name')
  })

  it('refuses a region subtag and keeps the stored language', async () => {
    const id = await mkUser({ lang: 'fi' })
    const res = await call('PUT', '/profile', { token: await tokenFor(id), body: { preferredLang: 'en-US' } })
    assert.equal(res.status, 400)
    assert.equal(await storedLang(id), 'fi')
  })

  it('session restore (POST /auth/verify) reports the stored language', async () => {
    const id = await mkUser({ lang: 'pl' })
    const res = await call('POST', '/auth/verify', { token: await tokenFor(id) })
    assert.equal(res.status, 200)
    assert.equal(res.body.user.preferredLang, 'pl')
  })

  it('signing in again reports the stored language and does not reset it', async () => {
    // A returning stub user: the row exists before the login, keyed the way
    // the stub provider will key it. 12 random digits starting with 19 avoid
    // the stub's error prefixes (000, 111) and other tests' fixed numbers.
    const nin = `19${String(randomInt(0, 1e10)).padStart(10, '0')}`
    const id = await mkUser({ lang: 'ar', ninHash: hashNin(nin) })

    const login = await call('POST', '/auth/login', { body: { nin } })
    assert.equal(login.status, 200)
    // The stub completes an order once it is three seconds old.
    await new Promise((r) => setTimeout(r, 3100))
    const res = await call('POST', '/auth/collect', { body: { orderRef: login.body.orderRef } })

    assert.equal(res.status, 200)
    assert.equal(res.body.status, 'complete')
    assert.equal(res.body.completionData.user.userId, id)
    assert.equal(res.body.completionData.user.preferredLang, 'ar')
    assert.equal(await storedLang(id), 'ar')
  })
})
