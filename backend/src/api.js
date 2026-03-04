import { Router } from 'express'
import { db } from './pool.js'
import { authRouter, authenticate } from './auth/index.js'
import { getAllFlags } from './features.js'
import { profileRouter } from './routes/profile.js'
import { requestRouter } from './routes/requests.js'
import { notificationRouter } from './routes/notifications.js'
import { gdprRouter } from './routes/gdpr.js'
import { ratingRouter } from './routes/ratings.js'
import { authRateLimit, apiRateLimit } from './middleware/rateLimit.js'

export const apiRouter = Router()

// --- Feature flags (public, no auth required) ---
apiRouter.get('/features', (_req, res) => {
  res.json({ flags: getAllFlags() })
})

// --- Auth routes (login, verify, etc.) — rate limited ---
apiRouter.use('/auth', authRateLimit, authRouter)

// --- Apply API rate limit to all authenticated routes below ---
apiRouter.use(apiRateLimit)

// --- Profile routes ---
apiRouter.use('/profile', profileRouter)

// --- Request routes ---
apiRouter.use('/requests', requestRouter)

// --- Notification routes ---
apiRouter.use('/notifications', notificationRouter)

// --- Rating routes ---
apiRouter.use('/ratings', ratingRouter)

// --- GDPR routes ---
apiRouter.use('/gdpr', gdprRouter)

// --- DB health check ---
apiRouter.get('/ping', async (_req, res) => {
  try {
    await db.query('SELECT 1')
    res.json({ pong: true, db: 'ok' })
  } catch {
    res.status(503).json({ pong: false, db: 'error' })
  }
})

// --- Protected route: current user info ---
apiRouter.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user })
})
