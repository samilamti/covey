/**
 * Notification routes.
 */

import { Router } from 'express'
import { authenticate } from '../auth/index.js'
import { isEnabled } from '../features.js'
import * as pushRepo from '../repositories/push-subscriptions.js'
import { sendNotification, getSentNotifications } from '../services/notifications.js'

export const notificationRouter = Router()

notificationRouter.use(authenticate)

/**
 * POST /api/notifications/subscribe — Register push subscription
 */
notificationRouter.post('/subscribe', async (req, res) => {
  const { endpoint, p256dh, auth } = req.body

  if (!endpoint || !p256dh || !auth) {
    return res.status(400).json({ error: 'endpoint, p256dh, and auth are required' })
  }

  try {
    await pushRepo.upsert({
      userId: req.user.userId,
      endpoint,
      p256dh,
      auth,
    })
    res.json({ ok: true })
  } catch (err) {
    console.error('Subscribe error:', err.message)
    res.status(500).json({ error: 'Failed to subscribe' })
  }
})

/**
 * DELETE /api/notifications/subscribe — Unregister push subscription
 */
notificationRouter.delete('/subscribe', async (req, res) => {
  const { endpoint } = req.body

  if (!endpoint) {
    return res.status(400).json({ error: 'endpoint is required' })
  }

  try {
    await pushRepo.remove(req.user.userId, endpoint)
    res.json({ ok: true })
  } catch (err) {
    console.error('Unsubscribe error:', err.message)
    res.status(500).json({ error: 'Failed to unsubscribe' })
  }
})

/**
 * POST /api/notifications/test — Send a test notification
 */
notificationRouter.post('/test', async (req, res) => {
  try {
    const subs = await pushRepo.findByUser(req.user.userId)
    if (subs.length === 0) {
      return res.json({ sent: 0, message: 'No subscriptions found' })
    }

    const payload = { title: 'Tillsammans', body: 'Test notification!' }
    for (const sub of subs) {
      await sendNotification(sub, payload)
    }
    res.json({ sent: subs.length })
  } catch (err) {
    console.error('Test notification error:', err.message)
    res.status(500).json({ error: 'Failed to send test notification' })
  }
})

/**
 * GET /api/notifications/sent — Get mock-sent notifications (mock only)
 */
notificationRouter.get('/sent', (_req, res) => {
  if (isEnabled('PUSH_NOTIFICATIONS')) {
    return res.status(404).json({ error: 'Only available when PUSH_NOTIFICATIONS is disabled' })
  }
  res.json({ notifications: getSentNotifications() })
})
