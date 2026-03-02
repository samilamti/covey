/**
 * Stub BankID provider tests.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { initAuth, collect, cancel } from '../src/auth/providers/stub.js'

describe('Stub BankID provider', () => {
  describe('initAuth', () => {
    it('should return orderRef and autoStartToken', () => {
      const result = initAuth('198501011234')
      assert.ok(result.orderRef, 'has orderRef')
      assert.ok(result.autoStartToken, 'has autoStartToken')
      assert.ok(result.orderRef.startsWith('stub-'), 'orderRef starts with stub-')
      assert.ok(result.autoStartToken.startsWith('stub-ast-'), 'autoStartToken starts with stub-ast-')
    })
  })

  describe('collect — time-based progression', () => {
    it('should return pending/outstandingTransaction immediately', () => {
      const { orderRef } = initAuth('198501011234')
      const result = collect(orderRef)
      assert.equal(result.status, 'pending')
      assert.equal(result.hintCode, 'outstandingTransaction')
    })

    it('should return complete after sufficient delay', async () => {
      const { orderRef } = initAuth('198501011234')

      // Wait 3.1 seconds for the time-based progression
      await new Promise((resolve) => setTimeout(resolve, 3100))

      const result = collect(orderRef)
      assert.equal(result.status, 'complete')
      assert.ok(result.user, 'has user data')
      assert.ok(result.user.name, 'has name')
      assert.ok(result.user.ninHash, 'has ninHash')
      assert.equal(result.user.nin, '198501011234')
    })
  })

  describe('collect — error simulation', () => {
    it('should simulate userCancel for 000* prefix', () => {
      const { orderRef } = initAuth('000001011234')
      const result = collect(orderRef)
      assert.equal(result.status, 'failed')
      assert.equal(result.hintCode, 'userCancel')
    })

    it('should simulate expiredTransaction for 111* prefix', () => {
      const { orderRef } = initAuth('111101011234')
      const result = collect(orderRef)
      assert.equal(result.status, 'failed')
      assert.equal(result.hintCode, 'expiredTransaction')
    })
  })

  describe('collect — invalid orderRef', () => {
    it('should return failed for unknown orderRef', () => {
      const result = collect('nonexistent-order')
      assert.equal(result.status, 'failed')
      assert.equal(result.hintCode, 'invalidParameters')
    })
  })

  describe('cancel', () => {
    it('should remove the order', () => {
      const { orderRef } = initAuth('198501011234')
      cancel(orderRef)

      const result = collect(orderRef)
      assert.equal(result.status, 'failed')
      assert.equal(result.hintCode, 'invalidParameters')
    })

    it('should not throw for unknown orderRef', () => {
      assert.doesNotThrow(() => cancel('nonexistent-order'))
    })
  })
})
