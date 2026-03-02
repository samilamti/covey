import { render } from 'preact'
import { App } from './App'
import './i18n'
import './index.css'

render(<App />, document.getElementById('app'))

// --- Register Service Worker ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.log('SW registered:', reg.scope)
      })
      .catch((err) => {
        console.log('SW registration failed:', err.message)
      })
  })
}
