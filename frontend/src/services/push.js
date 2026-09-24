/**
 * Native push notification registration (Capacitor).
 *
 * Uses @capacitor-firebase/messaging so BOTH platforms return an FCM
 * registration token (on iOS, Firebase bridges to APNs under the hood).
 * The backend (firebase-admin) sends to these FCM tokens for both iOS and
 * Android — one delivery path, one token type.
 *
 * The token is sent to the backend via POST /api/notifications/subscribe-native.
 */
import { API_BASE } from '../config.js'

function authHeaders() {
  const token = localStorage.getItem('token')
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function sendTokenToBackend(token, platform) {
  try {
    await fetch(`${API_BASE}/api/notifications/subscribe-native`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ token, platform }),
    })
  } catch (err) {
    console.error('Failed to send native push token:', err.message)
  }
}

/**
 * Register for native push notifications.
 * Requests permission, obtains an FCM token, and sends it to the backend.
 * Listeners are attached before getToken() so a token delivered asynchronously
 * (iOS waits for APNs registration) is never missed.
 */
export async function registerNativePush() {
  // Screenshot builds must not raise the notification prompt over the shots,
  // or register a device token with a throwaway local backend.
  if (import.meta.env.VITE_SCREENSHOT_MODE === '1') return
  const { FirebaseMessaging } = await import('@capacitor-firebase/messaging')
  const { Capacitor } = await import('@capacitor/core')
  const platform = Capacitor.getPlatform() // 'ios' | 'android'

  const perm = await FirebaseMessaging.requestPermissions()
  if (perm.receive !== 'granted') {
    throw new Error('Push permission denied')
  }

  // Fires on first registration AND on every token refresh — keeps the
  // backend's stored token current. On iOS this is the reliable path because
  // the FCM token is only available after APNs registration completes.
  await FirebaseMessaging.addListener('tokenReceived', ({ token }) => {
    if (token) sendTokenToBackend(token, platform)
  })

  // Notification tapped while app was backgrounded/killed → deep link.
  await FirebaseMessaging.addListener('notificationActionPerformed', ({ notification }) => {
    const url = notification?.data?.url
    if (url) {
      // preact-router reads the hash
      window.location.hash = url
    }
  })

  // Notification arriving while the app is in the foreground.
  await FirebaseMessaging.addListener('notificationReceived', ({ notification }) => {
    console.log('Push received in foreground:', notification?.title)
  })

  // Also request the token directly. On Android this returns immediately; on
  // iOS it may throw if APNs isn't ready yet — in that case the tokenReceived
  // listener above delivers it once registration completes, so swallow the error.
  try {
    const { token } = await FirebaseMessaging.getToken()
    if (token) sendTokenToBackend(token, platform)
  } catch (err) {
    console.log('getToken deferred to tokenReceived listener:', err.message)
  }
}

/**
 * Unregister native push: delete the FCM token locally and tell the backend.
 */
export async function unregisterNativePush() {
  try {
    const { FirebaseMessaging } = await import('@capacitor-firebase/messaging')
    await FirebaseMessaging.removeAllListeners()
    await FirebaseMessaging.deleteToken()
  } catch (err) {
    console.error('Failed to delete native push token:', err.message)
  }
  try {
    await fetch(`${API_BASE}/api/notifications/subscribe-native`, {
      method: 'DELETE',
      headers: authHeaders(),
    })
  } catch (err) {
    console.error('Failed to unsubscribe native push on backend:', err.message)
  }
}
