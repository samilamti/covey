/**
 * Notification provider (real + mock).
 *
 * Feature-flagged: FEATURE_PUSH_NOTIFICATIONS
 *   true  → real Web Push (web-push library)
 *   false → mock provider (records in memory)
 */

import webPush from 'web-push'
import { isEnabled } from '../features.js'
import * as pushRepo from '../repositories/push-subscriptions.js'

/** In-memory store for mock-sent notifications */
const sentNotifications = []

const mockProvider = {
  async send(subscription, payload) {
    const entry = { subscription, payload, sentAt: new Date().toISOString() }
    sentNotifications.push(entry)
    console.log(`[mock-push] Notification sent to ${subscription.endpoint}:`, payload.title || payload)
  },
  getSentNotifications() {
    return [...sentNotifications]
  },
  clearSentNotifications() {
    sentNotifications.length = 0
  },
}

let realProvider = null

function getRealProvider() {
  if (!realProvider) {
    const vapidPublic = process.env.VAPID_PUBLIC_KEY
    const vapidPrivate = process.env.VAPID_PRIVATE_KEY
    const vapidContact = process.env.VAPID_CONTACT || 'mailto:sentinel@covey.se'

    if (!vapidPublic || !vapidPrivate) {
      console.warn('VAPID keys not configured, falling back to mock provider')
      realProvider = mockProvider
      return realProvider
    }

    webPush.setVapidDetails(vapidContact, vapidPublic, vapidPrivate)

    realProvider = {
      async send(subscription, payload) {
        await webPush.sendNotification(
          { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
          JSON.stringify(payload),
          { TTL: 60 * 60 }
        )
      },
    }
  }
  return realProvider
}

/**
 * Get the active notification provider.
 */
export function getNotificationProvider() {
  if (isEnabled('PUSH_NOTIFICATIONS')) {
    return getRealProvider()
  }
  return mockProvider
}

/**
 * Send a notification to a subscription.
 */
export async function sendNotification(subscription, payload) {
  const provider = getNotificationProvider()
  return provider.send(subscription, payload)
}

/**
 * Get mock-sent notifications (for testing).
 */
export function getSentNotifications() {
  return mockProvider.getSentNotifications()
}

/**
 * Clear mock-sent notifications (for testing).
 */
export function clearSentNotifications() {
  mockProvider.clearSentNotifications()
}

// --- Push notification bodies per language (push runs outside browser, no i18next) ---

const NOTIFY_BODY = {
  sv: 'Någon behöver hjälp! Kan du gå tillsammans?',
  en: 'Someone needs help! Can you walk together?',
  nb: 'Noen trenger hjelp! Kan du gå sammen?',
  da: 'Nogen har brug for hjælp! Kan du gå sammen?',
  fi: 'Joku tarvitsee apua! Voitko kävellä yhdessä?',
  ar: 'شخص ما يحتاج مساعدة! هل يمكنك المشي معًا؟',
  is: 'Einhver þarf hjálp! Geturðu gengið saman?',
  pl: 'Ktoś potrzebuje pomocy! Możesz iść razem?',
  fo: 'Onkur tørvar hjálp! Kanst tú ganga saman?',
  kl: 'Inuit ikinngunnaarpusi! Katillutit pisinnaaviuk?',
  se: 'Muhtun dárbbaša veahki! Sáhtátgo vázzit ovttas?',
}

/**
 * Send push notifications to all users eligible to respond to a new request.
 * Fire-and-forget: errors are logged, never thrown.
 *
 * @param {object} request - The newly created request row from DB
 */
export async function notifyNewRequest(request) {
  try {
    const subscriptions = await pushRepo.findEligibleForRequest({
      requesterId: request.requester_id,
      communityId: request.community_id,
      eligibilityTier: request.eligibility_tier,
    })

    if (subscriptions.length === 0) return

    const results = await Promise.allSettled(
      subscriptions.map((sub) => {
        const lang = sub.preferred_lang || 'sv'
        const payload = {
          title: 'Tillsammans',
          body: NOTIFY_BODY[lang] || NOTIFY_BODY.sv,
          url: '/requests',
          requestId: request.id,
        }
        return sendNotification(
          { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
          payload
        )
      })
    )

    const failed = results.filter((r) => r.status === 'rejected')
    if (failed.length > 0) {
      console.warn(`[push] ${failed.length}/${subscriptions.length} notifications failed`)
    }
  } catch (err) {
    console.error('[push] notifyNewRequest error:', err.message)
  }
}
