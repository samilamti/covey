import { useTranslation } from 'react-i18next'
import { Trophy, CircleUser } from 'lucide-preact'
import { FlockIcon } from './icons/FlockIcon'
import { useFeatureFlag } from '../context/FeatureFlagContext'

export function BottomNav({ currentPath, onNavigate }) {
  const { t } = useTranslation()
  const pointsEnabled = useFeatureFlag('POINTS_SYSTEM')

  const tabs = [
    { path: '/requests', Icon: FlockIcon, labelKey: 'nav.requests' },
    ...(pointsEnabled ? [{ path: '/progress', Icon: Trophy, labelKey: 'nav.progress' }] : []),
    { path: '/profile', Icon: CircleUser, labelKey: 'nav.profile' },
  ]

  return (
    <nav class="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 h-20 z-50 safe-area-bottom shadow-[0_-1px_10px_rgba(0,0,0,0.05)]">
      <div class="max-w-md mx-auto h-full flex justify-around items-center px-2">
        {tabs.map((tab) => {
          const isActive = currentPath === tab.path || currentPath.startsWith(tab.path + '/')
          const Icon = tab.Icon
          return (
            <button
              key={tab.path}
              onClick={() => onNavigate(tab.path)}
              aria-current={isActive ? 'page' : undefined}
              class="group flex flex-col items-center justify-center flex-1 h-full gap-1"
            >
              <span
                class={`flex items-center justify-center rounded-full px-5 py-1.5 transition-colors ${
                  isActive ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 group-hover:text-gray-600'
                }`}
              >
                <Icon size={26} />
              </span>
              <span
                class={`text-xs font-medium transition-colors ${
                  isActive ? 'text-indigo-600' : 'text-gray-400 group-hover:text-gray-600'
                }`}
              >
                {t(tab.labelKey)}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
