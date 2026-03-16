import { useState, useEffect, useRef } from 'preact/hooks'
import { useTranslation } from 'react-i18next'
import { BottomNav } from './BottomNav'
import { ProfileView } from './ProfileView'
import { RequestList } from './RequestList'
import { LanguageSelector } from './LanguageSelector'
import { BetaBanner } from './BetaBanner'
import { InstallPrompt } from './InstallPrompt'
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
      case '/profile':
        return <ProfileView user={user} onLogout={onLogout} />
      default:
        return <RequestList currentUserId={user?.userId} key={refreshKey} />
    }
  }

  return (
    <div class="min-h-screen bg-gray-50 pb-16 safe-area-x">
      <BetaBanner />
      <InstallPrompt />
      {/* Top bar */}
      <header class="bg-white border-b border-gray-200 px-4 py-3 flex justify-between items-center sticky top-0 z-[1001] safe-area-top">
        <h1 class="text-lg font-bold text-gray-900">Covey</h1>
        <div class="flex items-center gap-2">
          <LanguageSelector />
        </div>
      </header>

      {/* Main content area */}
      <main class="p-4">
        {renderContent()}
      </main>

      {/* Bottom navigation */}
      <BottomNav currentPath={currentPath} onNavigate={setCurrentPath} />
    </div>
  )
}
