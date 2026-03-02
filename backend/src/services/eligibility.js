/**
 * Eligibility service — determines whether a helper can accept a request
 * based on the request's eligibility tier.
 *
 * Tiers (cumulative):
 *   same_demographics   — same sex, birth year within ±5
 *   verified_guardians  — above OR safety score >= 5
 *   any_member          — no filtering
 */

import * as userRepo from '../repositories/users.js'
import * as ratingRepo from '../repositories/ratings.js'
import { matchesDemographics, GUARDIAN_SCORE_THRESHOLD } from './demographics.js'

// Re-export for consumers that imported from here
export { matchesDemographics }

/**
 * Check whether a helper is eligible to accept a request.
 * @param {object} request - The assistance request (must include eligibility_tier, requester_id)
 * @param {string} helperId - The potential helper's user ID
 * @returns {Promise<boolean>}
 */
export async function checkEligibility(request, helperId) {
  if (request.eligibility_tier === 'any_member') return true

  const [requester, helper] = await Promise.all([
    userRepo.findById(request.requester_id),
    userRepo.findById(helperId),
  ])

  if (!requester || !helper) return false

  if (request.eligibility_tier === 'verified_guardians') {
    if (matchesDemographics(requester, helper)) return true
    const score = await ratingRepo.getSafetyScore(helperId)
    return score >= GUARDIAN_SCORE_THRESHOLD
  }

  // same_demographics
  return matchesDemographics(requester, helper)
}
