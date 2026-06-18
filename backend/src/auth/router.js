/**
 * Auth Express router.
 *
 * Routes: /login, /collect, /cancel, /qr, /verify, /logout, /bankid/dev
 *
 * Provider selection:
 *   AUTH_PROVIDER=stub              → always stub
 *   AUTH_PROVIDER=bankid + flag on  → real BankID (v6 Secure Start)
 *   AUTH_PROVIDER=bankid + flag off → stub (with warning)
 *
 * Rate limiting is applied per-route here (not as a blanket on /auth) so that
 * status polling (/collect, /qr) — which a real BankID auth hits many times
 * over 30+ seconds — uses the looser apiRateLimit, while /login and /verify
 * keep the strict authRateLimit.
 */

import { Router } from 'express'
import { isEnabled } from '../features.js'
import { signToken, verifyToken } from './jwt.js'
import { authenticate } from './middleware.js'
import { authRateLimit, apiRateLimit } from '../middleware/rateLimit.js'
import * as stubProvider from './providers/stub.js'
import * as bankidProvider from './providers/bankid.js'
import * as userRepo from '../repositories/users.js'
import { setScoreOverride } from '../repositories/ratings.js'
import { parseBirthYear, parseSex } from './nin.js'
import { devLoginPage } from './bankid-dev-page.js'

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
 * Normalize req.ip into a value BankID's endUserIp accepts.
 * Strips the IPv4-mapped IPv6 prefix and maps IPv6 loopback to 127.0.0.1.
 */
function normalizeIp(ip) {
  if (!ip) return '127.0.0.1'
  if (ip === '::1') return '127.0.0.1'
  return ip.replace(/^::ffff:/, '')
}

/**
 * POST /api/auth/login
 * Body: { nin?: "198501011234" }   (nin required for stub; ignored for BankID v6)
 * Returns: { orderRef, autoStartToken }
 */
authRouter.post('/login', authRateLimit, async (req, res) => {
  const provider = getProvider()
  const usingBankid = provider === bankidProvider
  const { nin } = req.body

  // The stub derives the simulated identity (and error prefixes) from the NIN.
  // Real BankID v6 uses Secure Start (QR / autostart) — no personal number.
  if (!usingBankid) {
    if (!nin || typeof nin !== 'string') {
      return res.status(400).json({ error: 'nin is required' })
    }
    if (!/^\d{10,12}$/.test(nin)) {
      return res.status(400).json({ error: 'nin must be 10-12 digits' })
    }
  }

  try {
    const { orderRef, autoStartToken } = await provider.initAuth({
      nin,
      endUserIp: normalizeIp(req.ip),
    })
    res.json({ orderRef, autoStartToken })
  } catch (err) {
    console.error('Login error:', err.message)
    res.status(500).json({ error: 'Authentication service unavailable' })
  }
})

/**
 * POST /api/auth/collect
 * Body: { orderRef }
 * Returns: { status, hintCode?, completionData? }
 */
authRouter.post('/collect', apiRateLimit, async (req, res) => {
  const { orderRef } = req.body

  if (!orderRef) {
    return res.status(400).json({ error: 'orderRef is required' })
  }

  try {
    const provider = getProvider()
    const result = await provider.collect(orderRef)

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
 * Body: { orderRef }
 */
authRouter.post('/cancel', apiRateLimit, async (req, res) => {
  const { orderRef } = req.body

  if (!orderRef) {
    return res.status(400).json({ error: 'orderRef is required' })
  }

  try {
    const provider = getProvider()
    await provider.cancel(orderRef)
    res.json({ ok: true })
  } catch (err) {
    console.error('Cancel error:', err.message)
    res.status(500).json({ error: 'Authentication service unavailable' })
  }
})

/**
 * POST /api/auth/qr
 * Body: { orderRef }
 * Returns: { qr: string|null } — the current animated-QR payload (BankID only).
 * Poll once per second while the order is pending; render the value as a QR code.
 */
authRouter.post('/qr', apiRateLimit, (req, res) => {
  const { orderRef } = req.body
  if (!orderRef) {
    return res.status(400).json({ error: 'orderRef is required' })
  }
  const provider = getProvider()
  const qr = typeof provider.qr === 'function' ? provider.qr(orderRef) : null
  res.json({ qr })
})

/**
 * POST /api/auth/verify
 * Headers: Authorization: Bearer <token>
 * Returns: { valid: true, user: {...} }
 */
authRouter.post('/verify', authRateLimit, async (req, res) => {
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
authRouter.post('/logout', authRateLimit, authenticate, (_req, res) => {
  res.json({ ok: true })
})

/**
 * GET /api/auth/bankid/dev
 * Dev-only validation page for the real BankID flow (Secure Start QR + autostart).
 * Lets you scan with a test BankID and watch the order complete — without
 * rebuilding the production login UX. Disabled in production.
 * Requires AUTH_PROVIDER=bankid to exercise the real flow (see docs/bankid-test.md).
 */
authRouter.get('/bankid/dev', (_req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).end()
  }
  // The page needs an inline script + an external QR image; relax CSP for this
  // dev-only response (Helmet's strict policy would otherwise block them).
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; " +
      "style-src 'self' 'unsafe-inline'; img-src 'self' data: https://api.qrserver.com; " +
      "connect-src 'self'"
  )
  res.type('html').send(devLoginPage())
})
