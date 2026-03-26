/**
 * Points system constants and badge definitions.
 *
 * Separated from the repository module so tests can import
 * without triggering a database connection.
 */

export const HELPER_POINTS = 10
export const REQUESTER_POINTS = 3
export const COOLDOWN_HOURS = 4

export const BADGE_DEFS = [
  { key: 'first_session', check: (s) => s.totalSessions >= 1 },
  { key: 'helper_5', check: (s) => s.helperSessions >= 5 },
  { key: 'helper_20', check: (s) => s.helperSessions >= 20 },
  { key: 'helper_50', check: (s) => s.helperSessions >= 50 },
  { key: 'points_50', check: (s) => s.totalPoints >= 50 },
  { key: 'points_200', check: (s) => s.totalPoints >= 200 },
  { key: 'points_500', check: (s) => s.totalPoints >= 500 },
]
