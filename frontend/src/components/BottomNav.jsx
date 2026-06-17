import { useTranslation } from 'react-i18next'
import { HelpCircle, User, Trophy } from 'lucide-preact'
import { useFeatureFlag } from '../context/FeatureFlagContext'

export function BottomNav({ currentPath, onNavigate }) {
  const { t } = useTranslation()
  const pointsEnabled = useFeatureFlag('POINTS_SYSTEM')

  const tabs = [
    { path: '/requests', icon: HelpCircle, labelKey: 'nav.requests' },
    ...(pointsEnabled ? [{ path: '/progress', icon: Trophy, labelKey: 'nav.progress' }] : []),
    { path: '/profile', icon: User, labelKey: 'nav.profile' },
  ]

  return (
    <nav class="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 h-16 z-50 safe-area-bottom">
      <div class="max-w-md mx-auto h-full flex justify-around items-center">
      {tabs.map((tab) => {
        const isActive = currentPath === tab.path || currentPath.startsWith(tab.path + '/')
        const Icon = tab.icon
        return (
          <button
            key={tab.path}
            onClick={() => onNavigate(tab.path)}
            class={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
              isActive ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <Icon size={22} />
            <span class="text-xs mt-1">{t(tab.labelKey)}</span>
          </button>
        )
      })}
      </div>
    </nav>
  )
}
