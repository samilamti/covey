import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { authenticate } from '../src/auth/middleware.js'
import { signToken } from '../src/auth/jwt.js'
import { mockReq, mockRes } from './helpers.js'

describe('authenticate middleware', () => {
  it('returns 401 when no Authorization header', async () => {
    const req = mockReq({ headers: {} })
    const res = mockRes()
    await authenticate(req, res, () => {})
    assert.equal(res.statusCode, 401)
    assert.equal(res.body.error, 'Authentication required')
  })

  it('returns 401 when Authorization is not Bearer format', async () => {
    const req = mockReq({ headers: { authorization: 'Basic abc123' } })
    const res = mockRes()
    await authenticate(req, res, () => {})
    assert.equal(res.statusCode, 401)
    assert.equal(res.body.error, 'Authentication required')
  })

  it('returns 401 for malformed token', async () => {
    const req = mockReq({ headers: { authorization: 'Bearer not-a-jwt' } })
    const res = mockRes()
    await authenticate(req, res, () => {})
    assert.equal(res.statusCode, 401)
    assert.equal(res.body.error, 'Invalid or expired token')
  })

  it('returns 401 when token has no userId', async () => {
    const token = await signToken({ sub: 'hash-only' })
    const req = mockReq({ headers: { authorization: `Bearer ${token}` } })
    const res = mockRes()
    await authenticate(req, res, () => {})
    assert.equal(res.statusCode, 401)
    assert.ok(res.body.error.includes('re-login required'))
  })

  it('returns 401 when userId is not a valid UUID', async () => {
    const token = await signToken({ sub: 'hash', userId: 'not-a-uuid' })
    const req = mockReq({ headers: { authorization: `Bearer ${token}` } })
    const res = mockRes()
    await authenticate(req, res, () => {})
    assert.equal(res.statusCode, 401)
    assert.ok(res.body.error.includes('re-login required'))
  })

  it('sets req.user and calls next() for valid token', async () => {
    const userId = '550e8400-e29b-41d4-a716-446655440000'
    const token = await signToken({ sub: 'hash', userId, name: 'Test', provider: 'stub' })
    const req = mockReq({ headers: { authorization: `Bearer ${token}` } })
    const res = mockRes()
    let nextCalled = false
    await authenticate(req, res, () => { nextCalled = true })
    assert.equal(nextCalled, true)
    assert.equal(req.user.userId, userId)
    assert.equal(req.user.name, 'Test')
    assert.equal(req.user.provider, 'stub')
  })
})
