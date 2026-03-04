import { useTranslation } from 'react-i18next'
import { HelpCircle, User } from 'lucide-preact'

const tabs = [
  { path: '/requests', icon: HelpCircle, labelKey: 'nav.requests' },
  { path: '/profile', icon: User, labelKey: 'nav.profile' },
]

export function BottomNav({ currentPath, onNavigate }) {
  const { t } = useTranslation()

  return (
    <nav class="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around items-center h-16 z-50 safe-area-bottom">
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
    </nav>
  )
}
