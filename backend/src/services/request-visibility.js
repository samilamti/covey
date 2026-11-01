/**
 * Request visibility — who may see what about an assistance request.
 *
 * The full request row holds the exact pickup and destination and the
 * requester's id. Only the two participants may see it. Everyone else gets
 * the open listing (rounded pickup, no destination, filtered by the
 * requester's chosen eligibility circle) from GET /api/requests/open.
 */

/**
 * Payload for the `request:new` broadcast to the `requests:open` room.
 *
 * Every logged-in socket is in that room, whatever circle the requester
 * chose, so the event carries only the id. Clients reload the open listing,
 * which applies the eligibility filter and coordinate rounding.
 *
 * @param {{ id: string }} request
 * @returns {{ requestId: string }}
 */
export function openRequestEvent(request) {
  return { requestId: request.id }
}

/**
 * Whether a user is the requester or the helper of a request.
 * @param {{ requester_id: string, helper_id?: string|null }} request
 * @param {string} userId
 * @returns {boolean}
 */
export function isParticipant(request, userId) {
  if (!request || !userId) return false
  return request.requester_id === userId || request.helper_id === userId
}
