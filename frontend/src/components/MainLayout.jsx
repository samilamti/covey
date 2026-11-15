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

  // Skip link — WCAG 2.4.1 Bypass Blocks. Every keyboard-only user currently
  // has to tab past the InstallPrompt banner (and any transient dismiss / Install
  // buttons it mounts) before reaching the main content; a screen-reader user
  // navigating by landmark can skip ahead, but a sighted keyboard user who does
  // not know that shortcut cannot. The link stays visually hidden until it takes
  // focus, which is the moment it matters: a Tab from the top of the page.
  //
  // The onClick handler is belt-and-braces: anchor jumps DO move focus in
  // modern browsers once the target has tabindex=-1, but older Android
  // builds still vary, and a focus() call costs nothing. z-[1300] keeps it
  // above the safety report modal (z-1200), the ActiveSession takeover
  // (z-1100) and the app header (z-1001) so a "where am I?" refocus during
  // a dialog still shows.
  const skipToMain = (e) => {
    e.preventDefault()
    const main = document.getElementById('main-content')
    if (main) {
      main.focus()
      main.scrollIntoView({ block: 'start' })
    }
  }

  return (
    <div class="min-h-screen bg-gray-50 pb-20 safe-area-x safe-area-top">
      <a
        href="#main-content"
        onClick={skipToMain}
        class="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[1300] focus:bg-indigo-600 focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
      >
        {t('nav.skipToContent')}
      </a>

      <InstallPrompt />

      {/* Main content area — capped + centred so cards don't stretch on tablets/large screens.
          The chrome header (name + language) was removed to reclaim space; language now
          lives in the profile/settings tab.
          tabIndex={-1} makes the <main> programmatically focusable so the skip
          link can land on it; the focus ring is suppressed because the landing
          is driven by a skip link, not by a Tab onto an interactive control. */}
      <main
        id="main-content"
        tabIndex={-1}
        class="p-4 max-w-md mx-auto w-full focus:outline-none"
      >
        {renderContent()}
      </main>

      {/* Bottom navigation */}
      <BottomNav currentPath={currentPath} onNavigate={setCurrentPath} />
    </div>
  )
}
