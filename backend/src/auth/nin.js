/**
 * NIN (National Identity Number) demographic extraction.
 *
 * Format: YYYYMMDD-XXXX (12 digits) or YYMMDD-XXXX (10 digits).
 * The second-to-last digit indicates sex: odd = male, even = female.
 */

/**
 * Extract birth year from a NIN.
 * @param {string} pn - 10 or 12-digit NIN (may include hyphen)
 * @returns {number|null}
 */
export function parseBirthYear(pn) {
  const digits = pn.replace(/\D/g, '')
  if (digits.length === 12) {
    return parseInt(digits.substring(0, 4), 10)
  }
  if (digits.length === 10) {
    const yy = parseInt(digits.substring(0, 2), 10)
    return yy > 30 ? 1900 + yy : 2000 + yy
  }
  return null
}

/**
 * Extract sex from a NIN.
 * The second-to-last digit: odd = 'M', even = 'F'.
 * @param {string} pn
 * @returns {'M'|'F'|null}
 */
export function parseSex(pn) {
  const digits = pn.replace(/\D/g, '')
  if (digits.length >= 10) {
    const sexDigit = parseInt(digits[digits.length - 2], 10)
    return sexDigit % 2 === 0 ? 'F' : 'M'
  }
  return null
}
