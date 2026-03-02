import { useState, useEffect } from 'preact/hooks'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Users, MapPin, Shield, UserPlus, LogOut } from 'lucide-preact'
import { communityService } from '../services/communities'
import { AdminPanel } from './AdminPanel'

/**
 * CommunityDetail — shows community info and members (for approved members).
 *
 * Non-members see: name, description, area_name, member count, and a "request join" button.
 * Approved members see: full member list + admin panel (if admin).
 */
export function CommunityDetail({ communityId, currentUserId, onBack }) {
  const { t } = useTranslation()
  const [community, setCommunity] = useState(null)
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [isMember, setIsMember] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [showAdmin, setShowAdmin] = useState(false)
  const [joinStatus, setJoinStatus] = useState(null) // null | 'pending' | 'approved' | 'rejected'
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    loadCommunity()
  }, [communityId])

  const loadCommunity = async () => {
    try {
      const { community: data } = await communityService.getById(communityId)
      setCommunity(data)

      // Try to load members (will 403 if not a member)
      try {
        const { members: memberList } = await communityService.getMembers(communityId)
        setMembers(memberList)
        setIsMember(true)

        // Check if current user is admin
        const me = memberList.find((m) => m.user_id === currentUserId)
        setIsAdmin(me?.role === 'admin')
      } catch {
        setIsMember(false)
      }
    } catch (err) {
      console.error('Load community error:', err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleRequestJoin = async () => {
    setActionLoading(true)
    try {
      await communityService.requestJoin(communityId)
      setJoinStatus('pending')
    } catch (err) {
      if (err.message?.includes('409')) {
        setJoinStatus('pending')
      }
      console.error('Join request error:', err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleLeave = async () => {
    setActionLoading(true)
    try {
      await communityService.leave(communityId)
      setIsMember(false)
      setMembers([])
      setIsAdmin(false)
    } catch (err) {
      console.error('Leave error:', err.message)
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return <div class="text-center py-8 text-gray-400">{t('app.loading')}</div>
  }

  if (!community) {
    return (
      <div class="text-center py-8 text-red-500">
        <p>{t('communities.notFound')}</p>
        <button onClick={onBack} class="mt-4 text-indigo-600 text-sm">{t('communities.backToList')}</button>
      </div>
    )
  }

  if (showAdmin && isAdmin) {
    return (
      <AdminPanel
        communityId={communityId}
        onBack={() => { setShowAdmin(false); loadCommunity() }}
      />
    )
  }

  return (
    <div>
      {/* Header */}
      <button onClick={onBack} class="flex items-center gap-1 text-indigo-600 text-sm mb-4">
        <ArrowLeft size={16} />
        {t('communities.backToList')}
      </button>

      {/* Community info */}
      <div class="bg-white rounded-lg shadow-sm border border-gray-100 p-5 mb-4">
        <h2 class="text-xl font-bold text-gray-900 mb-1">{community.name}</h2>
        {community.description && (
          <p class="text-sm text-gray-600 mb-3">{community.description}</p>
        )}

        <div class="flex items-center gap-4 text-sm text-gray-500">
          {community.area_name && (
            <span class="flex items-center gap-1">
              <MapPin size={14} />
              {community.area_name}
            </span>
          )}
          <span class="flex items-center gap-1">
            <Users size={14} />
            {t('communities.memberCount', { count: parseInt(community.member_count) || 0 })}
          </span>
        </div>
      </div>

      {/* Actions for non-members */}
      {!isMember && (
        <div class="bg-white rounded-lg shadow-sm border border-gray-100 p-5 mb-4">
          {joinStatus === 'pending' ? (
            <div class="text-center">
              <p class="text-sm text-yellow-600 font-medium">{t('communities.joinPending')}</p>
              <p class="text-xs text-gray-400 mt-1">{t('communities.joinPendingDesc')}</p>
            </div>
          ) : (
            <button
              onClick={handleRequestJoin}
              disabled={actionLoading}
              class="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-3 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              <UserPlus size={16} />
              {actionLoading ? t('app.loading') : t('communities.join')}
            </button>
          )}
        </div>
      )}

      {/* Member list (approved members only) */}
      {isMember && (
        <>
          <div class="bg-white rounded-lg shadow-sm border border-gray-100 p-5 mb-4">
            <div class="flex items-center justify-between mb-3">
              <h3 class="font-semibold text-gray-900">{t('communities.members')}</h3>
              {isAdmin && (
                <button
                  onClick={() => setShowAdmin(true)}
                  class="flex items-center gap-1 text-indigo-600 text-sm font-medium"
                >
                  <Shield size={14} />
                  {t('admin.title')}
                </button>
              )}
            </div>

            <div class="space-y-2">
              {members.map((member) => (
                <div key={member.user_id} class="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div class="flex items-center gap-2">
                    <div class="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-sm font-medium">
                      {(member.display_name || '?')[0].toUpperCase()}
                    </div>
                    <div>
                      <p class="text-sm font-medium text-gray-900">{member.display_name || t('profile.anonymous')}</p>
                      {member.role === 'admin' && (
                        <span class="text-xs text-indigo-600 font-medium">{t('admin.role')}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Leave button */}
          <button
            onClick={handleLeave}
            disabled={actionLoading}
            class="w-full flex items-center justify-center gap-2 text-red-600 border border-red-200 px-4 py-3 rounded-lg font-medium hover:bg-red-50 disabled:opacity-50 transition-colors"
          >
            <LogOut size={16} />
            {actionLoading ? t('app.loading') : t('communities.leave')}
          </button>
        </>
      )}
    </div>
  )
}
