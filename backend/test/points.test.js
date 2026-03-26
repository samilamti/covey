/**
 * Points system logic tests.
 *
 * Tests the constants, badge evaluation logic, and canonical pair ordering.
 * These are logic tests that don't require a database.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { HELPER_POINTS, REQUESTER_POINTS, COOLDOWN_HOURS, BADGE_DEFS } from '../src/points-config.js'

describe('Points constants', () => {
  it('helper gets more points than requester', () => {
    assert.ok(HELPER_POINTS > REQUESTER_POINTS)
  })

  it('helper gets 10 points per session', () => {
    assert.equal(HELPER_POINTS, 10)
  })

  it('requester gets 3 points per session', () => {
    assert.equal(REQUESTER_POINTS, 3)
  })

  it('cooldown is 4 hours', () => {
    assert.equal(COOLDOWN_HOURS, 4)
  })
})

describe('Badge definitions', () => {
  it('has 7 badges defined', () => {
    assert.equal(BADGE_DEFS.length, 7)
  })

  it('each badge has a key and a check function', () => {
    for (const badge of BADGE_DEFS) {
      assert.ok(badge.key, `Badge missing key`)
      assert.equal(typeof badge.check, 'function', `Badge ${badge.key} missing check function`)
    }
  })

  it('all badge keys are unique', () => {
    const keys = BADGE_DEFS.map(b => b.key)
    assert.equal(new Set(keys).size, keys.length)
  })
})

describe('Badge evaluation: first_session', () => {
  const badge = BADGE_DEFS.find(b => b.key === 'first_session')

  it('earns with 1 total session', () => {
    assert.ok(badge.check({ totalSessions: 1, helperSessions: 1, totalPoints: 10 }))
  })

  it('does not earn with 0 sessions', () => {
    assert.ok(!badge.check({ totalSessions: 0, helperSessions: 0, totalPoints: 0 }))
  })
})

describe('Badge evaluation: helper milestones', () => {
  const helper5 = BADGE_DEFS.find(b => b.key === 'helper_5')
  const helper20 = BADGE_DEFS.find(b => b.key === 'helper_20')
  const helper50 = BADGE_DEFS.find(b => b.key === 'helper_50')

  it('helper_5 triggers at 5 helper sessions', () => {
    assert.ok(!helper5.check({ totalSessions: 5, helperSessions: 4, totalPoints: 40 }))
    assert.ok(helper5.check({ totalSessions: 5, helperSessions: 5, totalPoints: 50 }))
  })

  it('helper_20 triggers at 20 helper sessions', () => {
    assert.ok(!helper20.check({ totalSessions: 20, helperSessions: 19, totalPoints: 190 }))
    assert.ok(helper20.check({ totalSessions: 20, helperSessions: 20, totalPoints: 200 }))
  })

  it('helper_50 triggers at 50 helper sessions', () => {
    assert.ok(!helper50.check({ totalSessions: 50, helperSessions: 49, totalPoints: 490 }))
    assert.ok(helper50.check({ totalSessions: 50, helperSessions: 50, totalPoints: 500 }))
  })
})

describe('Badge evaluation: points milestones', () => {
  const points50 = BADGE_DEFS.find(b => b.key === 'points_50')
  const points200 = BADGE_DEFS.find(b => b.key === 'points_200')
  const points500 = BADGE_DEFS.find(b => b.key === 'points_500')

  it('points_50 triggers at 50 total points', () => {
    assert.ok(!points50.check({ totalSessions: 5, helperSessions: 5, totalPoints: 49 }))
    assert.ok(points50.check({ totalSessions: 5, helperSessions: 5, totalPoints: 50 }))
  })

  it('points_200 triggers at 200 total points', () => {
    assert.ok(!points200.check({ totalSessions: 20, helperSessions: 20, totalPoints: 199 }))
    assert.ok(points200.check({ totalSessions: 20, helperSessions: 20, totalPoints: 200 }))
  })

  it('points_500 triggers at 500 total points', () => {
    assert.ok(!points500.check({ totalSessions: 50, helperSessions: 50, totalPoints: 499 }))
    assert.ok(points500.check({ totalSessions: 50, helperSessions: 50, totalPoints: 500 }))
  })
})

describe('Points economy scenarios', () => {
  it('5 helper sessions = 50 points = points_50 badge', () => {
    const points = 5 * HELPER_POINTS
    assert.equal(points, 50)
    const badge = BADGE_DEFS.find(b => b.key === 'points_50')
    assert.ok(badge.check({ totalSessions: 5, helperSessions: 5, totalPoints: points }))
  })

  it('20 helper sessions = 200 points = points_200 badge', () => {
    const points = 20 * HELPER_POINTS
    assert.equal(points, 200)
    const badge = BADGE_DEFS.find(b => b.key === 'points_200')
    assert.ok(badge.check({ totalSessions: 20, helperSessions: 20, totalPoints: points }))
  })

  it('mixed sessions: 10 helper + 10 requester = 130 points', () => {
    const points = 10 * HELPER_POINTS + 10 * REQUESTER_POINTS
    assert.equal(points, 130)
  })

  it('requester-only user needs 17 sessions for points_50', () => {
    // 17 * 3 = 51 >= 50
    const points = 17 * REQUESTER_POINTS
    assert.ok(points >= 50)
    const badge = BADGE_DEFS.find(b => b.key === 'points_50')
    assert.ok(badge.check({ totalSessions: 17, helperSessions: 0, totalPoints: points }))
  })
})
