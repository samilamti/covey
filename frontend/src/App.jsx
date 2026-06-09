import { useEffect, useState } from 'preact/hooks'
import { useTranslation } from 'react-i18next'
import { Capacitor } from '@capacitor/core'
import { LandingPage } from './components/LandingPage'
import { MainLayout } from './components/MainLayout'
import { FeatureFlagProvider } from './context/FeatureFlagContext'
import { socket } from './socket'
import { authService } from './services/auth'
import { subscribeToPush } from './services/notifications'
import { registerNativePush } from './services/push'

function trySubscribePush() {
  if (Capacitor.isNativePlatform()) {
    registerNativePush().catch((err) => {
      console.log('Native push registration skipped:', err.message)
    })
  } else {
    subscribeToPush().catch((err) => {
      console.log('Push subscription skipped:', err.message)
    })
  }
}

async function initNativePlugins() {
  if (!Capacitor.isNativePlatform()) return
  try {
    const { SplashScreen } = await import('@capacitor/splash-screen')
    const { StatusBar, Style } = await import('@capacitor/status-bar')
    // Dark status bar to match #1e293b theme
    await StatusBar.setStyle({ style: Style.Dark })
    if (Capacitor.getPlatform() === 'android') {
      await StatusBar.setBackgroundColor({ color: '#1e293b' })
    }
    await SplashScreen.hide()
  } catch (err) {
    console.log('Native plugin init skipped:', err.message)
  }
}

/**
 * Restore the mint-green demo theme on boot if it was previously activated
 * via the LandingPage easter egg. Persists until the user logs out.
 */
function restoreDemoTheme() {
  try {
    if (localStorage.getItem('demoMode') === '1') {
      document.body.classList.add('mint-theme')
    }
  } catch {}
}

function AppContent() {
  const { t } = useTranslation()
  const [connected, setConnected] = useState(false)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    initNativePlugins()
    restoreDemoTheme()

    // Socket connection events
    socket.on('connect', () => setConnected(true))
    socket.on('disconnect', () => setConnected(false))

    // Restore session from stored token
    const restoreSession = async () => {
      const token = localStorage.getItem('token')
      if (token) {
        try {
          const { user } = await authService.verify(token)
          setUser(user)
          // Connect socket with the stored token
          socket.auth = { token }
          socket.connect()
          trySubscribePush()
        } catch {
          localStorage.removeItem('token')
        }
      }
      setLoading(false)
    }

    restoreSession()

    return () => {
      socket.off('connect')
      socket.off('disconnect')
    }
  }, [])

  const handleLogin = (userData, token) => {
    localStorage.setItem('token', token)
    setUser(userData)
    // Connect socket with the new token
    socket.auth = { token }
    socket.connect()
    trySubscribePush()
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    // Clear the demo easter-egg theme so the next user starts fresh
    try { localStorage.removeItem('demoMode') } catch {}
    document.body.classList.remove('mint-theme')
    setUser(null)
    socket.disconnect()
  }

  if (loading) {
    return (
      <div class="min-h-screen flex items-center justify-center">
        {t('app.loading')}
      </div>
    )
  }

  if (!user) {
    return <LandingPage onLogin={handleLogin} />
  }

  return <MainLayout user={user} onLogout={handleLogout} />
}

export function App() {
  return (
    <FeatureFlagProvider>
      <AppContent />
    </FeatureFlagProvider>
  )
}
