/**
 * Eligibility service tests.
 *
 * Tests the pure matchesDemographics function.
 * The async checkEligibility function requires DB mocking, so we test
 * the core logic via matchesDemographics which covers the demographic rules.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { matchesDemographics } from '../src/services/demographics.js'

describe('matchesDemographics', () => {
  it('should match users with same sex and age within 5 years', () => {
    const requester = { birth_year: 1990, sex: 'M' }
    const helper = { birth_year: 1992, sex: 'M' }
    assert.equal(matchesDemographics(requester, helper), true)
  })

  it('should match users with exact same demographics', () => {
    const requester = { birth_year: 1985, sex: 'F' }
    const helper = { birth_year: 1985, sex: 'F' }
    assert.equal(matchesDemographics(requester, helper), true)
  })

  it('should match at the boundary (exactly 5 years apart)', () => {
    const requester = { birth_year: 1990, sex: 'M' }
    const helper = { birth_year: 1995, sex: 'M' }
    assert.equal(matchesDemographics(requester, helper), true)

    const helper2 = { birth_year: 1985, sex: 'M' }
    assert.equal(matchesDemographics(requester, helper2), true)
  })

  it('should reject when age difference exceeds 5 years', () => {
    const requester = { birth_year: 1990, sex: 'M' }
    const helper = { birth_year: 1984, sex: 'M' }
    assert.equal(matchesDemographics(requester, helper), false)

    const helper2 = { birth_year: 1996, sex: 'M' }
    assert.equal(matchesDemographics(requester, helper2), false)
  })

  it('should reject when sex differs', () => {
    const requester = { birth_year: 1990, sex: 'M' }
    const helper = { birth_year: 1990, sex: 'F' }
    assert.equal(matchesDemographics(requester, helper), false)
  })

  it('should reject when requester has no birth_year', () => {
    const requester = { birth_year: null, sex: 'M' }
    const helper = { birth_year: 1990, sex: 'M' }
    assert.equal(matchesDemographics(requester, helper), false)
  })

  it('should reject when helper has no sex', () => {
    const requester = { birth_year: 1990, sex: 'M' }
    const helper = { birth_year: 1990, sex: null }
    assert.equal(matchesDemographics(requester, helper), false)
  })

  it('should reject when both have missing demographics', () => {
    const requester = { birth_year: null, sex: null }
    const helper = { birth_year: null, sex: null }
    assert.equal(matchesDemographics(requester, helper), false)
  })

  it('should reject when requester has no sex', () => {
    const requester = { birth_year: 1990, sex: null }
    const helper = { birth_year: 1990, sex: 'M' }
    assert.equal(matchesDemographics(requester, helper), false)
  })

  it('should reject when helper has no birth_year', () => {
    const requester = { birth_year: 1990, sex: 'F' }
    const helper = { birth_year: null, sex: 'F' }
    assert.equal(matchesDemographics(requester, helper), false)
  })
})
