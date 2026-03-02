/**
 * Auth Express router.
 *
 * Routes: /login, /collect, /cancel, /verify, /logout
 *
 * Provider selection:
 *   AUTH_PROVIDER=stub              → always stub
 *   AUTH_PROVIDER=bankid + flag on  → real BankID
 *   AUTH_PROVIDER=bankid + flag off → stub (with warning)
 */

import { Router } from 'express'
import { isEnabled } from '../features.js'
import { signToken, verifyToken } from './jwt.js'
import { authenticate } from './middleware.js'
import * as stubProvider from './providers/stub.js'
import * as bankidProvider from './providers/bankid.js'
import * as userRepo from '../repositories/users.js'
import { setScoreOverride } from '../repositories/ratings.js'
import { parseBirthYear, parseSex } from './nin.js'

/**
 * Stub safety score overrides from STUB_SAFETY_SCORES env var.
 * Format: "nin:score,nin:score"
 * Example: "199505051234:10,198001010000:5"
 */
const stubScores = new Map(
  (process.env.STUB_SAFETY_SCORES || '')
    .split(',')
    .filter(Boolean)
    .map((pair) => {
      const [pn, score] = pair.split(':')
      return [pn.trim(), parseInt(score, 10)]
    })
)

export const authRouter = Router()

/**
 * Select the active auth provider based on config + feature flag.
 */
function getProvider() {
  const setting = process.env.AUTH_PROVIDER || 'stub'

  if (setting === 'bankid') {
    if (isEnabled('BANKID_AUTH')) {
      return bankidProvider
    }
    console.warn(
      'AUTH_PROVIDER=bankid but FEATURE_BANKID_AUTH is disabled — falling back to stub'
    )
  }

  return stubProvider
}

/**
 * POST /api/auth/login
 * Body: { nin: "198501011234" }
 * Returns: { orderRef, autoStartToken }
 */
authRouter.post('/login', async (req, res) => {
  const { nin } = req.body

  if (!nin || typeof nin !== 'string') {
    return res.status(400).json({ error: 'nin is required' })
  }

  // Basic validation: 10 or 12 digits
  if (!/^\d{10,12}$/.test(nin)) {
    return res.status(400).json({ error: 'nin must be 10-12 digits' })
  }

  try {
    const provider = getProvider()
    const { orderRef, autoStartToken } = provider.initAuth(nin)
    res.json({ orderRef, autoStartToken })
  } catch (err) {
    console.error('Login error:', err.message)
    res.status(500).json({ error: 'Authentication service unavailable' })
  }
})

/**
 * POST /api/auth/collect
 * Body: { orderRef: "stub-..." }
 * Returns: { status, hintCode?, completionData? }
 */
authRouter.post('/collect', async (req, res) => {
  const { orderRef } = req.body

  if (!orderRef) {
    return res.status(400).json({ error: 'orderRef is required' })
  }

  try {
    const provider = getProvider()
    const result = provider.collect(orderRef)

    if (result.status === 'complete' && result.user) {
      // Extract demographics from NIN before it's discarded
      const birthYear = parseBirthYear(result.user.nin)
      const sex = parseSex(result.user.nin)

      // Upsert user into database — get real UUID
      const dbUser = await userRepo.upsertFromAuth({
        ninHash: result.user.ninHash,
        givenName: result.user.givenName,
        surname: result.user.surname,
        birthYear,
        sex,
      })

      // Apply stub safety score override if configured
      if (provider === stubProvider && stubScores.has(result.user.nin)) {
        setScoreOverride(dbUser.id, stubScores.get(result.user.nin))
      }

      // Issue a JWT with the real database UUID as userId
      const token = await signToken({
        sub: result.user.ninHash,
        name: result.user.name,
        userId: dbUser.id,
        provider: process.env.AUTH_PROVIDER || 'stub',
      })

      return res.json({
        status: 'complete',
        completionData: {
          user: {
            userId: dbUser.id,
            name: result.user.name,
            givenName: result.user.givenName,
            surname: result.user.surname,
          },
          token,
        },
      })
    }

    // Pending or failed
    res.json(result)
  } catch (err) {
    console.error('Collect error:', err.message)
    res.status(500).json({ error: 'Authentication service unavailable' })
  }
})

/**
 * POST /api/auth/cancel
 * Body: { orderRef: "stub-..." }
 */
authRouter.post('/cancel', async (req, res) => {
  const { orderRef } = req.body

  if (!orderRef) {
    return res.status(400).json({ error: 'orderRef is required' })
  }

  try {
    const provider = getProvider()
    provider.cancel(orderRef)
    res.json({ ok: true })
  } catch (err) {
    console.error('Cancel error:', err.message)
    res.status(500).json({ error: 'Authentication service unavailable' })
  }
})

/**
 * POST /api/auth/verify
 * Headers: Authorization: Bearer <token>
 * Returns: { valid: true, user: {...} }
 */
authRouter.post('/verify', async (req, res) => {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ valid: false, error: 'No token provided' })
  }

  try {
    const token = header.slice(7)
    const payload = await verifyToken(token)

    // Validate that userId is a proper UUID and user exists in DB
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!payload.userId || !UUID_RE.test(payload.userId)) {
      return res.status(401).json({ valid: false, error: 'Invalid token (bad userId)' })
    }

    const dbUser = await userRepo.findById(payload.userId)
    if (!dbUser) {
      return res.status(401).json({ valid: false, error: 'User not found' })
    }

    res.json({
      valid: true,
      user: {
        userId: payload.userId,
        name: payload.name,
        provider: payload.provider,
      },
    })
  } catch {
    res.status(401).json({ valid: false, error: 'Invalid or expired token' })
  }
})

/**
 * POST /api/auth/logout
 * Headers: Authorization: Bearer <token>
 *
 * JWT tokens are stateless — we simply acknowledge the logout.
 * The frontend should clear localStorage.
 */
authRouter.post('/logout', authenticate, (_req, res) => {
  res.json({ ok: true })
})
