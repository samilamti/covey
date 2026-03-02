/**
 * Lightweight input validation middleware.
 *
 * No heavy library — just simple regex/range checks.
 */

/**
 * Validate that body fields match the given schema.
 * @param {Record<string, { type?: string, required?: boolean, pattern?: RegExp, min?: number, max?: number, maxLength?: number }>} schema
 */
export function validate(schema) {
  return (req, res, next) => {
    const errors = []

    for (const [field, rules] of Object.entries(schema)) {
      const value = req.body[field]

      // Required check
      if (rules.required && (value === undefined || value === null || value === '')) {
        errors.push(`${field} is required`)
        continue
      }

      // Skip optional fields that are not provided
      if (value === undefined || value === null) continue

      // Type check
      if (rules.type === 'string' && typeof value !== 'string') {
        errors.push(`${field} must be a string`)
        continue
      }
      if (rules.type === 'number' && typeof value !== 'number') {
        errors.push(`${field} must be a number`)
        continue
      }

      // Pattern check
      if (rules.pattern && typeof value === 'string' && !rules.pattern.test(value)) {
        errors.push(`${field} has invalid format`)
      }

      // Max length
      if (rules.maxLength && typeof value === 'string' && value.length > rules.maxLength) {
        errors.push(`${field} must be at most ${rules.maxLength} characters`)
      }

      // Range check
      if (rules.min !== undefined && typeof value === 'number' && value < rules.min) {
        errors.push(`${field} must be at least ${rules.min}`)
      }
      if (rules.max !== undefined && typeof value === 'number' && value > rules.max) {
        errors.push(`${field} must be at most ${rules.max}`)
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join(', ') })
    }

    next()
  }
}

/**
 * Validate UUID format.
 */
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Validate NIN (10 or 12 digits).
 */
export const NIN_PATTERN = /^\d{10,12}$/
