/**
 * Notification service tests.
 *
 * Verifies that notifyNewRequest:
 * - Deduplicates subscriptions per user (1 notification per user, not per endpoint)
 * - Excludes the requester as defense-in-depth
 * - Sends localized notification bodies
 * - Is resilient to repository errors
 */

import { describe, it, mock, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

// --- Mock dependencies before importing the module under test ---

const findEligibleForRequest = mock.fn()

mock.module('../src/repositories/push-subscriptions.js', {
  namedExports: {
    findEligibleForRequest,
    upsert: mock.fn(),
    remove: mock.fn(),
    findByUser: mock.fn(),
  },
})

mock.module('../src/features.js', {
  namedExports: {
    isEnabled: mock.fn(() => false),
    getAllFlags: mock.fn(() => ({})),
  },
})

const {
  notifyNewRequest,
  getSentNotifications,
  clearSentNotifications,
} = await import('../src/services/notifications.js')

// --- Helpers ---

function makeSub(userId, endpoint, lang = 'sv') {
  return {
    user_id: userId,
    endpoint,
    p256dh: 'p256dh-' + endpoint,
    auth: 'auth-' + endpoint,
    preferred_lang: lang,
  }
}

const REQUESTER_ID = 'requester-aaa'

function makeRequest(overrides = {}) {
  return {
    id: 'req-001',
    requester_id: REQUESTER_ID,
    eligibility_tier: 'any_member',
    ...overrides,
  }
}

// --- Tests ---

describe('notifyNewRequest', () => {
  beforeEach(() => {
    clearSentNotifications()
    findEligibleForRequest.mock.resetCalls()
  })

  it('should send at most 1 notification per eligible user', async () => {
    // Same user with 5 different endpoints (PWA refreshes, multiple browsers)
    findEligibleForRequest.mock.mockImplementation(async () => [
      makeSub('user-A', 'https://push.example.com/1'),
      makeSub('user-A', 'https://push.example.com/2'),
      makeSub('user-A', 'https://push.example.com/3'),
      makeSub('user-A', 'https://push.example.com/4'),
      makeSub('user-A', 'https://push.example.com/5'),
    ])

    await notifyNewRequest(makeRequest())

    const sent = getSentNotifications()
    assert.equal(sent.length, 1, 'Expected exactly 1 notification for 1 user with 5 endpoints')
  })

  it('should not notify the requester even if returned by the repository', async () => {
    // Repo returns requester's subscription (simulating a filter bypass)
    findEligibleForRequest.mock.mockImplementation(async () => [
      makeSub(REQUESTER_ID, 'https://push.example.com/requester'),
      makeSub('user-B', 'https://push.example.com/b'),
    ])

    await notifyNewRequest(makeRequest())

    const sent = getSentNotifications()
    assert.equal(sent.length, 1, 'Expected 1 notification (requester excluded)')
    assert.equal(sent[0].subscription.endpoint, 'https://push.example.com/b')
  })

  it('should send 1 notification to each distinct eligible user', async () => {
    findEligibleForRequest.mock.mockImplementation(async () => [
      makeSub('user-A', 'https://push.example.com/a'),
      makeSub('user-B', 'https://push.example.com/b'),
      makeSub('user-C', 'https://push.example.com/c'),
    ])

    await notifyNewRequest(makeRequest())

    const sent = getSentNotifications()
    assert.equal(sent.length, 3)
  })

  it('should use preferred_lang for notification body', async () => {
    findEligibleForRequest.mock.mockImplementation(async () => [
      makeSub('user-A', 'https://push.example.com/a', 'en'),
    ])

    await notifyNewRequest(makeRequest())

    const sent = getSentNotifications()
    assert.equal(sent.length, 1)
    assert.equal(sent[0].payload.body, 'Someone needs help! Can you walk together?')
  })

  it('should not send any notifications when no eligible users found', async () => {
    findEligibleForRequest.mock.mockImplementation(async () => [])

    await notifyNewRequest(makeRequest())

    const sent = getSentNotifications()
    assert.equal(sent.length, 0)
  })

  it('should not throw when findEligibleForRequest fails', async () => {
    findEligibleForRequest.mock.mockImplementation(async () => {
      throw new Error('DB connection failed')
    })

    // Should resolve without throwing
    await assert.doesNotReject(() => notifyNewRequest(makeRequest()))
  })
})
