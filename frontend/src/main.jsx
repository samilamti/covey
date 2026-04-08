import { render } from 'preact'
import { Capacitor } from '@capacitor/core'
import { App } from './App'
import './i18n'
import './index.css'

render(<App />, document.getElementById('app'))

// --- Register Service Worker + update detection ---
// Skip SW in Capacitor native — WKWebView has unreliable SW support and
// the native shell handles caching, offline, and push.
if ('serviceWorker' in navigator && !Capacitor.isNativePlatform()) {
  window.addEventListener('load', () => {
    // Clear reload guard from previous update cycle
    sessionStorage.removeItem('sw-reloaded')

    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.log('SW registered:', reg.scope)
        // Check for updates every 5 min (safety app — updates must propagate quickly)
        setInterval(() => reg.update().catch(() => {}), 5 * 60 * 1000)
      })
      .catch((err) => {
        console.log('SW registration failed:', err.message)
      })

    // When a new SW takes control (skipWaiting + clients.claim), show a brief
    // toast and reload. sessionStorage guard prevents reload loops.
    let refreshing = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return
      if (sessionStorage.getItem('sw-reloaded')) return
      refreshing = true
      sessionStorage.setItem('sw-reloaded', '1')

      const toast = document.createElement('div')
      toast.textContent = 'Updating...'
      toast.setAttribute('role', 'status')
      toast.setAttribute('aria-live', 'polite')
      Object.assign(toast.style, {
        position: 'fixed',
        bottom: '80px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: '#1e293b',
        color: '#fff',
        padding: '12px 24px',
        borderRadius: '8px',
        fontSize: '14px',
        zIndex: '9999',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
      })
      document.body.appendChild(toast)

      setTimeout(() => window.location.reload(), 300)
    })
  })
}
