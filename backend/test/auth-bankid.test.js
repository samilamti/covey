/**
 * Real BankID provider — unit tests for the pure, network-free helpers.
 *
 * The mTLS transport is validated separately against the live test environment
 * (a real /auth → /collect → /cancel round-trip; see docs/bankid-test.md). Here
 * we lock down the deterministic logic: the animated-QR algorithm (against
 * BankID's own documented vectors), the completionData → user mapping, and the
 * /collect response mapping.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import {
  generateQrData,
  buildUserFromCompletion,
  mapCollect,
} from '../src/auth/providers/bankid.js'

describe('BankID provider — generateQrData (animated QR)', () => {
  // BankID's documented example values.
  const token = '67df3917-fa0d-44e5-b327-edcc928297f8'
  const secret = 'd28db9a7-4cde-429e-a983-359be676944c'

  it('matches the official BankID vectors for t=0,1,2', () => {
    assert.equal(
      generateQrData(token, secret, 0),
      'bankid.67df3917-fa0d-44e5-b327-edcc928297f8.0.dc69358e712458a66a7525beef148ae8526b1c71610eff2c16cdffb4cdac9bf8'
    )
    assert.equal(
      generateQrData(token, secret, 1),
      'bankid.67df3917-fa0d-44e5-b327-edcc928297f8.1.949d559bf23403952a94d103e67743126381eda00f0b3cbddbf7c96b1adcbce2'
    )
    assert.equal(
      generateQrData(token, secret, 2),
      'bankid.67df3917-fa0d-44e5-b327-edcc928297f8.2.a9e5ec59cb4eee4ef4117150abc58fad7a85439a6a96ccbecc3668b41795b3f3'
    )
  })

  it('floors fractional seconds', () => {
    assert.equal(generateQrData(token, secret, 1.9), generateQrData(token, secret, 1))
  })

  it('produces the bankid.<token>.<sec>.<hmac> shape', () => {
    const parts = generateQrData(token, secret, 5).split('.')
    assert.equal(parts[0], 'bankid')
    assert.equal(parts[1], token)
    assert.equal(parts[2], '5')
    assert.match(parts[3], /^[0-9a-f]{64}$/) // SHA-256 hex
  })
})

describe('BankID provider — buildUserFromCompletion', () => {
  it('maps personalNumber → nin + SHA-256 ninHash, and names', () => {
    const completionData = {
      user: {
        personalNumber: '199008189999',
        name: 'Anna Andersson',
        givenName: 'Anna',
        surname: 'Andersson',
      },
    }
    const user = buildUserFromCompletion(completionData)
    assert.equal(user.nin, '199008189999')
    assert.equal(user.givenName, 'Anna')
    assert.equal(user.surname, 'Andersson')
    assert.equal(user.name, 'Anna Andersson')
    assert.equal(
      user.ninHash,
      crypto.createHash('sha256').update('199008189999').digest('hex')
    )
    // The raw NIN is hashed, never the plaintext as the stored identifier.
    assert.notEqual(user.ninHash, user.nin)
  })

  it('derives name from givenName + surname when name is absent', () => {
    const user = buildUserFromCompletion({
      user: { personalNumber: '199008189999', givenName: 'Anna', surname: 'Andersson' },
    })
    assert.equal(user.name, 'Anna Andersson')
  })
})

describe('BankID provider — mapCollect', () => {
  it('maps pending with its hintCode', () => {
    assert.deepEqual(
      mapCollect({ orderRef: 'x', status: 'pending', hintCode: 'userSign' }),
      { status: 'pending', hintCode: 'userSign' }
    )
  })

  it('maps failed with its hintCode', () => {
    assert.deepEqual(
      mapCollect({ orderRef: 'x', status: 'failed', hintCode: 'userCancel' }),
      { status: 'failed', hintCode: 'userCancel' }
    )
  })

  it('maps complete with a built user object', () => {
    const result = mapCollect({
      orderRef: 'x',
      status: 'complete',
      completionData: { user: { personalNumber: '199008189999', name: 'Anna Andersson' } },
    })
    assert.equal(result.status, 'complete')
    assert.equal(result.user.nin, '199008189999')
    assert.ok(result.user.ninHash)
  })

  it('treats a body with no status as failed/invalidParameters', () => {
    assert.deepEqual(mapCollect({}), { status: 'failed', hintCode: 'invalidParameters' })
    assert.deepEqual(mapCollect(null), { status: 'failed', hintCode: 'invalidParameters' })
  })
})
