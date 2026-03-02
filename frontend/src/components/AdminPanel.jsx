import { useState, useEffect } from 'preact/hooks'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, CheckCircle, XCircle, Clock, User } from 'lucide-preact'
import { communityService } from '../services/communities'

/**
 * AdminPanel — community admin interface for approving/rejecting join requests.
 */
export function AdminPanel({ communityId, onBack }) {
  const { t } = useTranslation()
  const [pending, setPending] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(null)

  useEffect(() => {
    loadPending()
  }, [communityId])

  const loadPending = async () => {
    try {
      const { pending: data } = await communityService.getPending(communityId)
      setPending(data)
    } catch (err) {
      console.error('Load pending error:', err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (userId) => {
    setActionLoading(userId)
    try {
      await communityService.approve(communityId, userId)
      setPending((prev) => prev.filter((p) => p.user_id !== userId))
    } catch (err) {
      console.error('Approve error:', err.message)
    } finally {
      setActionLoading(null)
    }
  }

  const handleReject = async (userId) => {
    setActionLoading(userId)
    try {
      await communityService.reject(communityId, userId)
      setPending((prev) => prev.filter((p) => p.user_id !== userId))
    } catch (err) {
      console.error('Reject error:', err.message)
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return <div class="text-center py-8 text-gray-400">{t('app.loading')}</div>
  }

  return (
    <div>
      {/* Header */}
      <button onClick={onBack} class="flex items-center gap-1 text-indigo-600 text-sm mb-4">
        <ArrowLeft size={16} />
        {t('admin.backToCommunity')}
      </button>

      <h2 class="text-xl font-bold mb-4">{t('admin.title')}</h2>

      {/* Pending requests */}
      <div class="mb-6">
        <h3 class="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1">
          <Clock size={14} />
          {t('admin.pendingRequests')} ({pending.length})
        </h3>

        {pending.length === 0 ? (
          <div class="text-center py-8 text-gray-400">
            <p>{t('admin.noPending')}</p>
          </div>
        ) : (
          <div class="space-y-3">
            {pending.map((request) => (
              <div
                key={request.user_id}
                class="bg-white rounded-lg shadow-sm border border-gray-100 p-4 flex items-center justify-between"
              >
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                    <User size={18} class="text-gray-500" />
                  </div>
                  <div>
                    <p class="font-medium text-gray-900">
                      {request.display_name || t('profile.anonymous')}
                    </p>
                    <p class="text-xs text-gray-400">
                      {new Date(request.requested_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div class="flex items-center gap-2">
                  <button
                    onClick={() => handleApprove(request.user_id)}
                    disabled={actionLoading === request.user_id}
                    class="p-2 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 disabled:opacity-50 transition-colors"
                    title={t('admin.approve')}
                  >
                    <CheckCircle size={20} />
                  </button>
                  <button
                    onClick={() => handleReject(request.user_id)}
                    disabled={actionLoading === request.user_id}
                    class="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50 transition-colors"
                    title={t('admin.reject')}
                  >
                    <XCircle size={20} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
