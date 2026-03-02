/**
 * Demographic matching — pure function, no DB dependencies.
 */

export const GUARDIAN_SCORE_THRESHOLD = 5

/**
 * Check whether two users match on demographics (same sex, age ±5 years).
 * Returns false if either user lacks demographic data.
 */
export function matchesDemographics(requester, helper) {
  if (!requester.birth_year || !requester.sex || !helper.birth_year || !helper.sex) {
    return false
  }
  if (requester.sex !== helper.sex) return false
  if (Math.abs(requester.birth_year - helper.birth_year) > 5) return false
  return true
}
