/**
 * Push notification subscription client.
 */

import { API_BASE } from '../config.js'

const API_URL = `${API_BASE}/api/notifications`

function authHeaders() {
  const token = localStorage.getItem('token')
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

/**
 * Subscribe to push notifications.
 * Requests permission, gets a PushSubscription, and sends it to the backend.
 */
export async function subscribeToPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('Push notifications not supported')
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error('Permission denied')
  }

  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(
      // VAPID public key — set via env in production
      import.meta.env.VITE_VAPID_PUBLIC_KEY || ''
    ),
  })

  const { endpoint, keys } = subscription.toJSON()

  const res = await fetch(`${API_URL}/subscribe`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
    }),
  })

  if (!res.ok) throw new Error('Failed to subscribe')
  return res.json()
}

/**
 * Unsubscribe from push notifications.
 */
export async function unsubscribeFromPush() {
  const res = await fetch(`${API_URL}/subscribe`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to unsubscribe')
  return res.json()
}

/**
 * Convert a base64url VAPID key to Uint8Array.
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}
