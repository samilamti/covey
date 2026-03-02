/**
 * Authentication middleware.
 *
 * Verifies the JWT from the Authorization header and sets req.user.
 */

import { verifyToken } from './jwt.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Express middleware: verifies Bearer token and sets req.user.
 *
 * Usage:
 *   router.get('/protected', authenticate, (req, res) => {
 *     res.json({ user: req.user })
 *   })
 */
export async function authenticate(req, res, next) {
  const token = extractToken(req)
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' })
  }

  try {
    const payload = await verifyToken(token)

    if (!payload.userId || !UUID_RE.test(payload.userId)) {
      return res.status(401).json({ error: 'Invalid token (re-login required)' })
    }

    req.user = {
      userId: payload.userId,
      sub: payload.sub,
      name: payload.name,
      provider: payload.provider,
    }
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}

/**
 * Extract Bearer token from Authorization header.
 * @param {import('express').Request} req
 * @returns {string|null}
 */
function extractToken(req) {
  const header = req.headers.authorization
  if (header && header.startsWith('Bearer ')) {
    return header.slice(7)
  }
  return null
}
