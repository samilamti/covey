/**
 * Identity verification status.
 *
 * Only a login through the real BankID provider verifies an identity. The
 * stub provider accepts any personnummer typed into the form, so a stub
 * login must never be shown as "BankID-verifierad".
 */

/**
 * The `verified` value to store for a completed login.
 * @param {boolean} viaBankId - true when the real BankID provider completed the login
 * @returns {boolean}
 */
export function verifiedForLogin(viaBankId) {
  return viaBankId === true
}

/**
 * The `verified` value to show to clients.
 *
 * Also requires BankID to be enabled right now, so rows written before the
 * stub stopped setting `verified` (or a server that later falls back to the
 * stub) never show a verified badge.
 *
 * @param {{ verified?: boolean }} user
 * @param {boolean} bankIdEnabled - isEnabled('BANKID_AUTH')
 * @returns {boolean}
 */
export function displayedVerified(user, bankIdEnabled) {
  return Boolean(bankIdEnabled) && user?.verified === true
}
