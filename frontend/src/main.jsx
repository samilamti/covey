import { render } from 'preact'
import { App } from './App'
import './i18n'
import './index.css'

render(<App />, document.getElementById('app'))

// --- Register Service Worker + update detection ---
if ('serviceWorker' in navigator) {
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

    // When a new SW takes control (skipWaiting + clients.claim), reload to
    // pick up the new version. sessionStorage guard prevents reload loops.
    let refreshing = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return
      if (sessionStorage.getItem('sw-reloaded')) return
      refreshing = true
      sessionStorage.setItem('sw-reloaded', '1')
      window.location.reload()
    })
  })
}
