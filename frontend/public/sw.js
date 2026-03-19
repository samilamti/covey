/**
 * Covey Service Worker.
 *
 * Handles push notifications and offline caching of the app shell.
 */

const CACHE_NAME = 'covey-__SW_VERSION__'
const MAX_CACHE_ENTRIES = 100
const APP_SHELL = [
  '/',
  '/index.html',
]

// --- Install: pre-cache app shell (per-URL so one failure doesn't block install) ---
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        APP_SHELL.map((url) =>
          cache.add(url).catch((err) => {
            console.error('[SW] precache failed for', url, err)
          })
        )
      )
    )
  )
  self.skipWaiting()
})

// --- Activate: clean up old caches ---
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => {
      console.log('[SW] activated version:', CACHE_NAME)
    })
  )
  self.clients.claim()
})

// --- Fetch: network-first for navigation + API, cache-first for static assets ---
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Only handle GET requests
  if (request.method !== 'GET') return

  // Network-first for API calls and Socket.io
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io/')) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    )
    return
  }

  // Network-first for navigation requests (HTML pages like index.html)
  // Ensures users always get the latest index.html with current asset hashes
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          }
          return response
        })
        .catch(() => caches.match('/index.html'))
    )
    return
  }

  // Cache-first for static assets (JS, CSS, images — fingerprinted by Vite)
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached

      return fetch(request).then((response) => {
        // Only cache successful same-origin responses
        if (response.ok && url.origin === self.location.origin) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, clone)
            // Evict oldest entries when cache exceeds limit
            cache.keys().then((keys) => {
              while (keys.length > MAX_CACHE_ENTRIES) {
                cache.delete(keys.shift())
              }
            })
          })
        }
        return response
      })
    })
  )
})

// --- Push notification handler ---
self.addEventListener('push', (event) => {
  let data = { title: 'Covey', body: 'New notification' }

  try {
    if (event.data) {
      data = event.data.json()
    }
  } catch {
    // Use default
  }

  const options = {
    body: data.body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
    data: {
      url: data.url || '/',
      requestId: data.requestId,
    },
    actions: data.actions || [],
  }

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  )
})

// --- Notification click handler ---
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const url = event.notification.data?.url || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Focus existing window if available
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus()
          client.navigate(url)
          return
        }
      }

      // Open new window
      return self.clients.openWindow(url)
    })
  )
})
