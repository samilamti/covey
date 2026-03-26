import { useState, useEffect } from 'preact/hooks'
import { useTranslation } from 'react-i18next'
import { Trophy, Star, Award, Lock, Eye, EyeOff, HelpCircle, Heart } from 'lucide-preact'
import { pointsService } from '../services/points'

const BADGE_ICONS = {
  first_session: Star,
  helper_5: Heart,
  helper_20: Heart,
  helper_50: Heart,
  points_50: Trophy,
  points_200: Trophy,
  points_500: Trophy,
}

export function ProgressDashboard() {
  const { t } = useTranslation()
  const [summary, setSummary] = useState(null)
  const [badges, setBadges] = useState([])
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      pointsService.getSummary(),
      pointsService.getBadges(),
      pointsService.getHistory({ limit: 10 }),
    ])
      .then(([s, b, h]) => {
        setSummary(s)
        setBadges(b.badges)
        setHistory(h.history)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleToggleVisibility = async (badgeKey, currentVisible) => {
    try {
      await pointsService.setBadgeVisibility(badgeKey, !currentVisible)
      setBadges((prev) =>
        prev.map((b) => (b.key === badgeKey ? { ...b, visible: !currentVisible } : b))
      )
    } catch {
      // ignore
    }
  }

  if (loading) {
    return (
      <div class="flex justify-center py-12">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    )
  }

  return (
    <div>
      <h2 class="text-xl font-bold mb-4">{t('progress.title')}</h2>

      {/* Points summary */}
      {summary && (
        <div class="bg-white rounded-lg shadow-sm border border-gray-100 p-4 mb-4">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
              <Trophy size={24} class="text-amber-600" />
            </div>
            <div>
              <div class="text-2xl font-bold text-amber-600">{summary.totalPoints}</div>
              <div class="text-sm text-gray-500">{t('progress.totalPoints')}</div>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div class="bg-green-50 rounded-lg p-3">
              <div class="flex items-center gap-1 mb-1">
                <Heart size={14} class="text-green-600" />
                <span class="text-xs text-green-700">{t('progress.sessionsHelped')}</span>
              </div>
              <div class="text-lg font-bold text-green-700">{summary.helperSessions}</div>
            </div>
            <div class="bg-indigo-50 rounded-lg p-3">
              <div class="flex items-center gap-1 mb-1">
                <HelpCircle size={14} class="text-indigo-600" />
                <span class="text-xs text-indigo-700">{t('progress.sessionsRequested')}</span>
              </div>
              <div class="text-lg font-bold text-indigo-700">{summary.requesterSessions}</div>
            </div>
          </div>
        </div>
      )}

      {/* Badges */}
      <div class="bg-white rounded-lg shadow-sm border border-gray-100 p-4 mb-4">
        <div class="flex items-center justify-between mb-3">
          <h3 class="font-semibold text-gray-900">{t('progress.badges')}</h3>
          {summary && (
            <span class="text-xs text-gray-500">
              {t('progress.badgesEarned', { earned: summary.badgesEarned, total: summary.badgesTotal })}
            </span>
          )}
        </div>

        <div class="grid grid-cols-3 gap-3">
          {badges.map((badge) => {
            const Icon = BADGE_ICONS[badge.key] || Award
            return (
              <div
                key={badge.key}
                class={`relative flex flex-col items-center p-3 rounded-lg ${
                  badge.earned ? 'bg-amber-50' : 'bg-gray-50'
                }`}
              >
                <div
                  class={`w-10 h-10 rounded-full flex items-center justify-center mb-1 ${
                    badge.earned ? 'bg-amber-200 text-amber-700' : 'bg-gray-200 text-gray-400'
                  }`}
                >
                  {badge.earned ? <Icon size={20} /> : <Lock size={16} />}
                </div>
                <span
                  class={`text-xs text-center leading-tight ${
                    badge.earned ? 'text-gray-800' : 'text-gray-400'
                  }`}
                >
                  {t(`progress.badge.${badge.key}`)}
                </span>
                {badge.earned && (
                  <button
                    onClick={() => handleToggleVisibility(badge.key, badge.visible)}
                    class="mt-1 p-1 rounded hover:bg-amber-100"
                    title={badge.visible ? t('progress.hideFromProfile') : t('progress.showOnProfile')}
                  >
                    {badge.visible ? (
                      <Eye size={12} class="text-amber-600" />
                    ) : (
                      <EyeOff size={12} class="text-gray-400" />
                    )}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Recent activity */}
      <div class="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
        <h3 class="font-semibold text-gray-900 mb-3">{t('progress.recentActivity')}</h3>

        {history.length === 0 ? (
          <p class="text-sm text-gray-500 text-center py-4">{t('progress.noActivity')}</p>
        ) : (
          <div class="space-y-2">
            {history.map((entry) => (
              <div key={entry.id} class="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div class="flex items-center gap-2">
                  <div
                    class={`w-6 h-6 rounded-full flex items-center justify-center ${
                      entry.role === 'helper' ? 'bg-green-100' : 'bg-indigo-100'
                    }`}
                  >
                    {entry.role === 'helper' ? (
                      <Heart size={12} class="text-green-600" />
                    ) : (
                      <HelpCircle size={12} class="text-indigo-600" />
                    )}
                  </div>
                  <span class="text-sm text-gray-700">
                    {entry.role === 'helper' ? t('progress.asHelper') : t('progress.asRequester')}
                  </span>
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-sm font-medium text-amber-600">
                    {t('progress.pointsEarned', { points: entry.points })}
                  </span>
                  <span class="text-xs text-gray-400">
                    {new Date(entry.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
