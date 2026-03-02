import { useEffect, useState } from 'preact/hooks'
import { useTranslation } from 'react-i18next'
import { LandingPage } from './components/LandingPage'
import { MainLayout } from './components/MainLayout'
import { FeatureFlagProvider } from './context/FeatureFlagContext'
import { socket } from './socket'
import { authService } from './services/auth'

function AppContent() {
  const { t } = useTranslation()
  const [connected, setConnected] = useState(false)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
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
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
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
