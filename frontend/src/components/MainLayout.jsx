import { useState } from 'preact/hooks'
import { useTranslation } from 'react-i18next'
import { BottomNav } from './BottomNav'
import { ProfileView } from './ProfileView'
import { RequestList } from './RequestList'
import { LanguageSelector } from './LanguageSelector'

function BetaBanner() {
  const { t } = useTranslation()
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem('beta-dismissed') === '1'
  )

  if (dismissed) return null

  const dismiss = () => {
    sessionStorage.setItem('beta-dismissed', '1')
    setDismissed(true)
  }

  return (
    <div class="bg-amber-100 border-b border-amber-300 px-4 py-2 flex items-center justify-between text-sm text-amber-900">
      <span>{t('beta.notice')}</span>
      <button
        onClick={dismiss}
        class="ml-3 shrink-0 font-medium underline hover:no-underline"
      >
        {t('beta.dismiss')}
      </button>
    </div>
  )
}

export function MainLayout({ user, onLogout }) {
  const { t } = useTranslation()
  const [currentPath, setCurrentPath] = useState('/requests')

  const renderContent = () => {
    switch (currentPath) {
      case '/requests':
        return <RequestList currentUserId={user?.userId} />
      case '/profile':
        return <ProfileView user={user} onLogout={onLogout} />
      default:
        return <RequestList currentUserId={user?.userId} />
    }
  }

  return (
    <div class="min-h-screen bg-gray-50 pb-16">
      <BetaBanner />
      {/* Top bar */}
      <header class="bg-white border-b border-gray-200 px-4 py-3 flex justify-between items-center sticky top-0 z-[1001]">
        <h1 class="text-lg font-bold text-gray-900">Tillsammans</h1>
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
