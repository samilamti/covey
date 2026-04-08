/**
 * Notification provider (real + mock).
 *
 * Feature-flagged: FEATURE_PUSH_NOTIFICATIONS
 *   true  → real Web Push (web-push library) + FCM/APNs (firebase-admin)
 *   false → mock provider (records in memory)
 */

import webPush from 'web-push'
import { isEnabled } from '../features.js'
import * as pushRepo from '../repositories/push-subscriptions.js'
import * as nativePushRepo from '../repositories/native-push.js'

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
 * Send a notification to a Web Push subscription.
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

// --- FCM/APNs native push via firebase-admin ---

let fcmMessaging = null

/**
 * Lazily initialize Firebase Admin SDK for FCM.
 * Only loaded when native push tokens exist and FIREBASE_SERVICE_ACCOUNT is set.
 */
async function getFcmMessaging() {
  if (fcmMessaging) return fcmMessaging
  if (fcmMessaging === false) return null // Already tried and failed

  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!serviceAccount) {
    console.warn('[push] FIREBASE_SERVICE_ACCOUNT not set, native push disabled')
    fcmMessaging = false
    return null
  }

  try {
    const admin = await import('firebase-admin')
    const credential = JSON.parse(serviceAccount)
    admin.default.initializeApp({
      credential: admin.default.credential.cert(credential),
    })
    fcmMessaging = admin.default.messaging()
    return fcmMessaging
  } catch (err) {
    console.error('[push] Firebase init failed:', err.message)
    fcmMessaging = false
    return null
  }
}

/**
 * Send a push notification to a native device via FCM.
 */
async function sendNativeNotification(token, payload) {
  const messaging = await getFcmMessaging()
  if (!messaging) return

  await messaging.send({
    token,
    notification: {
      title: payload.title,
      body: payload.body,
    },
    data: {
      url: payload.url || '/requests',
      ...(payload.requestId ? { requestId: payload.requestId } : {}),
    },
    apns: {
      payload: { aps: { sound: 'default', badge: 1 } },
    },
    android: {
      priority: 'high',
      notification: { sound: 'default' },
    },
  })
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
  uk: 'Комусь потрібна допомога! Чи можете ви піти разом?',
}

const ACCEPTED_BODY = {
  sv: 'Någon har accepterat din förfrågan! Öppna appen.',
  en: 'Someone accepted your request! Open the app.',
  nb: 'Noen har akseptert forespørselen din! Åpne appen.',
  da: 'Nogen har accepteret din anmodning! Åbn appen.',
  fi: 'Joku hyväksyi pyyntösi! Avaa sovellus.',
  ar: 'شخص ما قبل طلبك! افتح التطبيق.',
  is: 'Einhver samþykkti beiðni þína! Opnaðu appið.',
  pl: 'Ktoś zaakceptował Twoje zgłoszenie! Otwórz aplikację.',
  fo: 'Onkur hevur góðtikið umbøn tína! Lat appina upp.',
  kl: 'Inuit qinnuteqaat akuerissimavaat! App-i ammaruk.',
  se: 'Muhtin lea dohkkehan du jearaldaga! Rahpa app.',
  uk: 'Хтось прийняв ваш запит! Відкрийте додаток.',
}

/**
 * Send a push notification to the requester when their request is accepted.
 * Sends to both Web Push and native push channels.
 * Fire-and-forget: errors are logged, never thrown.
 *
 * @param {object} request - The accepted request row from DB
 */
export async function notifyRequestAccepted(request) {
  try {
    // Fetch both web and native subscriptions in parallel
    const [webSubs, nativeTokens] = await Promise.all([
      pushRepo.findByUserWithLang(request.requester_id),
      nativePushRepo.findByUserWithLang(request.requester_id),
    ])

    if (webSubs.length === 0 && nativeTokens.length === 0) return

    const lang = (webSubs[0]?.preferred_lang || nativeTokens[0]?.preferred_lang) || 'sv'
    const payload = {
      title: 'Covey',
      body: ACCEPTED_BODY[lang] || ACCEPTED_BODY.sv,
      url: '/requests',
      requestId: request.id,
    }

    const promises = [
      // Web Push
      ...webSubs.map((sub) => sendNotification(
        { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
        payload
      )),
      // Native push (FCM/APNs)
      ...nativeTokens.map((t) => sendNativeNotification(t.token, payload)),
    ]

    const results = await Promise.allSettled(promises)
    const failed = results.filter((r) => r.status === 'rejected')
    if (failed.length > 0) {
      console.warn(`[push] ${failed.length}/${promises.length} accept notifications failed`)
    }
  } catch (err) {
    console.error('[push] notifyRequestAccepted error:', err.message)
  }
}

/**
 * Send push notifications to all users eligible to respond to a new request.
 * Sends to both Web Push and native push channels.
 * Fire-and-forget: errors are logged, never thrown.
 *
 * @param {object} request - The newly created request row from DB
 */
export async function notifyNewRequest(request) {
  try {
    // Fetch both web and native eligible subscriptions in parallel
    const [webSubs, nativeTokens] = await Promise.all([
      pushRepo.findEligibleForRequest({
        requesterId: request.requester_id,
        eligibilityTier: request.eligibility_tier,
      }),
      nativePushRepo.findEligibleForRequest({
        requesterId: request.requester_id,
        eligibilityTier: request.eligibility_tier,
      }),
    ])

    // Defense-in-depth: exclude requester and deduplicate by user across both channels
    const seen = new Set()

    const uniqueWebSubs = webSubs.filter((sub) => {
      if (sub.user_id === request.requester_id) return false
      if (seen.has(sub.user_id)) return false
      seen.add(sub.user_id)
      return true
    })

    const uniqueNativeTokens = nativeTokens.filter((t) => {
      if (t.user_id === request.requester_id) return false
      // Native tokens for users already getting web push are still sent —
      // users may have both a browser and native app open.
      return true
    })

    if (uniqueWebSubs.length === 0 && uniqueNativeTokens.length === 0) return

    const promises = [
      // Web Push
      ...uniqueWebSubs.map((sub) => {
        const lang = sub.preferred_lang || 'sv'
        return sendNotification(
          { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
          {
            title: 'Covey',
            body: NOTIFY_BODY[lang] || NOTIFY_BODY.sv,
            url: '/requests',
            requestId: request.id,
          }
        )
      }),
      // Native push (FCM/APNs)
      ...uniqueNativeTokens.map((t) => {
        const lang = t.preferred_lang || 'sv'
        return sendNativeNotification(t.token, {
          title: 'Covey',
          body: NOTIFY_BODY[lang] || NOTIFY_BODY.sv,
          url: '/requests',
          requestId: request.id,
        })
      }),
    ]

    const results = await Promise.allSettled(promises)
    const failed = results.filter((r) => r.status === 'rejected')
    if (failed.length > 0) {
      console.warn(`[push] ${failed.length}/${promises.length} notifications failed`)
    }
  } catch (err) {
    console.error('[push] notifyNewRequest error:', err.message)
  }
}
