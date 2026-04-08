/**
 * Native push notification registration (Capacitor).
 *
 * Uses @capacitor/push-notifications for FCM (Android) and APNs (iOS).
 * Sends the device token to the backend for server-side push delivery.
 */
import { API_BASE } from '../config.js'

function authHeaders() {
  const token = localStorage.getItem('token')
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

/**
 * Register for native push notifications.
 * Requests permission, gets a device token from FCM/APNs, and sends it
 * to the backend.
 */
export async function registerNativePush() {
  const { PushNotifications } = await import('@capacitor/push-notifications')
  const { Capacitor } = await import('@capacitor/core')

  const permResult = await PushNotifications.requestPermissions()
  if (permResult.receive !== 'granted') {
    throw new Error('Push permission denied')
  }

  // Listen for registration success — sends token to backend
  PushNotifications.addListener('registration', async ({ value: token }) => {
    try {
      await fetch(`${API_BASE}/api/notifications/subscribe-native`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          token,
          platform: Capacitor.getPlatform(), // 'ios' or 'android'
        }),
      })
    } catch (err) {
      console.error('Failed to send native push token:', err.message)
    }
  })

  PushNotifications.addListener('registrationError', (err) => {
    console.error('Native push registration error:', err.error)
  })

  // Handle notification received while app is in foreground
  PushNotifications.addListener('pushNotificationReceived', (notification) => {
    console.log('Push received in foreground:', notification.title)
  })

  // Handle notification tap (app was in background or killed)
  PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    const data = action.notification.data
    if (data?.url) {
      // Navigate within the app — preact-router will handle it
      window.location.hash = data.url
    }
  })

  await PushNotifications.register()
}

/**
 * Unregister native push token from the backend.
 */
export async function unregisterNativePush() {
  await fetch(`${API_BASE}/api/notifications/subscribe-native`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
}
