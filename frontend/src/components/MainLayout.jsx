import { useState, useEffect, useRef } from 'preact/hooks'
import { useTranslation } from 'react-i18next'
import { BottomNav } from './BottomNav'
import { ProfileView } from './ProfileView'
import { RequestList } from './RequestList'
import { InstallPrompt } from './InstallPrompt'
import { ProgressDashboard } from './ProgressDashboard'
import { socket } from '../socket'

export function MainLayout({ user, onLogout }) {
  const { t } = useTranslation()
  const [currentPath, setCurrentPath] = useState('/requests')
  const [refreshKey, setRefreshKey] = useState(0)
  const currentPathRef = useRef(currentPath)
  currentPathRef.current = currentPath

  // Refresh RequestList on visibility change and socket reconnect
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        setRefreshKey((k) => k + 1)
      }
    }
    const handleReconnect = () => {
      setRefreshKey((k) => k + 1)
    }

    document.addEventListener('visibilitychange', handleVisibility)
    socket.on('connect', handleReconnect)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      socket.off('connect', handleReconnect)
    }
  }, [])

  // Persistent listeners for critical request lifecycle events.
  // When user is on Profile tab, auto-navigate to Requests.
  useEffect(() => {
    const handleLifecycleEvent = () => {
      if (currentPathRef.current !== '/requests') {
        setRefreshKey((k) => k + 1)
      }
      setCurrentPath('/requests')
    }

    socket.on('request:done-initiated', handleLifecycleEvent)
    socket.on('request:accepted', handleLifecycleEvent)

    return () => {
      socket.off('request:done-initiated', handleLifecycleEvent)
      socket.off('request:accepted', handleLifecycleEvent)
    }
  }, [])

  const renderContent = () => {
    switch (currentPath) {
      case '/requests':
        return <RequestList currentUserId={user?.userId} key={refreshKey} />
      case '/progress':
        return <ProgressDashboard />
      case '/profile':
        return <ProfileView user={user} onLogout={onLogout} />
      default:
        return <RequestList currentUserId={user?.userId} key={refreshKey} />
    }
  }

  return (
    <div class="min-h-screen bg-gray-50 pb-20 safe-area-x safe-area-top">
      <InstallPrompt />

      {/* Main content area — capped + centred so cards don't stretch on tablets/large screens.
          The chrome header (name + language) was removed to reclaim space; language now
          lives in the profile/settings tab. */}
      <main class="p-4 max-w-md mx-auto w-full">
        {renderContent()}
      </main>

      {/* Bottom navigation */}
      <BottomNav currentPath={currentPath} onNavigate={setCurrentPath} />
    </div>
  )
}
