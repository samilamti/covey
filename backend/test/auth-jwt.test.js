/**
 * JWT sign/verify tests.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { signToken, verifyToken } from '../src/auth/jwt.js'

describe('JWT', () => {
  it('should sign and verify a token', async () => {
    const payload = {
      sub: 'test-hash-123',
      name: 'Test User',
      userId: 'user-uuid',
      provider: 'stub',
    }

    const token = await signToken(payload)
    assert.equal(typeof token, 'string')
    assert.ok(token.split('.').length === 3, 'JWT has 3 parts')

    const decoded = await verifyToken(token)
    assert.equal(decoded.sub, 'test-hash-123')
    assert.equal(decoded.name, 'Test User')
    assert.equal(decoded.userId, 'user-uuid')
    assert.equal(decoded.provider, 'stub')
  })

  it('should include iat and exp claims', async () => {
    const token = await signToken({ sub: 'test' })
    const decoded = await verifyToken(token)

    assert.ok(decoded.iat, 'has iat')
    assert.ok(decoded.exp, 'has exp')
    assert.ok(decoded.exp > decoded.iat, 'exp is after iat')
  })

  it('should reject tampered tokens', async () => {
    const token = await signToken({ sub: 'test' })
    // Tamper with the payload
    const parts = token.split('.')
    parts[1] = parts[1] + 'x'
    const tampered = parts.join('.')

    await assert.rejects(
      () => verifyToken(tampered),
      'Should reject tampered token'
    )
  })

  it('should reject malformed tokens', async () => {
    await assert.rejects(
      () => verifyToken('not-a-jwt'),
      'Should reject malformed token'
    )
  })
})
