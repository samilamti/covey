import { useState, useEffect } from 'preact/hooks'
import { useTranslation } from 'react-i18next'
import { ShieldCheck, Shield, Download, Trash2, Save, Award, LogOut } from 'lucide-preact'
import { profileService } from '../services/profile'

export function ProfileView({ user, onLogout }) {
  const { t } = useTranslation()
  const [displayName, setDisplayName] = useState(user?.displayName || user?.name || '')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    profileService.get()
      .then(({ user: profileData }) => {
        setProfile(profileData)
        if (profileData.displayName) {
          setDisplayName(profileData.displayName)
        }
      })
      .catch(() => {})
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)
    try {
      await profileService.update({ displayName })
      setMessage({ type: 'success', text: '✓' })
    } catch {
      setMessage({ type: 'error', text: t('app.error') })
    } finally {
      setSaving(false)
    }
  }

  const handleGdprExport = async () => {
    try {
      const res = await fetch('/api/gdpr/export', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      // Download as JSON file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'covey-data.json'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setMessage({ type: 'error', text: t('app.error') })
    }
  }

  const handleDeleteAccount = async () => {
    if (!confirm(t('profile.deleteConfirm'))) return
    try {
      await profileService.deleteAccount()
      onLogout()
    } catch {
      setMessage({ type: 'error', text: t('app.error') })
    }
  }

  return (
    <div class="space-y-4">
      <h2 class="text-xl font-bold">{t('profile.title')}</h2>

      {/* Identity & standing */}
      <div class="bg-white rounded-lg shadow-sm border border-gray-100 p-4 space-y-3">
        <div class="flex items-center gap-2 text-green-600">
          <ShieldCheck size={20} />
          <span class="text-sm font-medium">{t('profile.verified')}</span>
        </div>

        {profile && (
          <>
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium text-gray-700">{t('profile.safetyScore')}</span>
              <span class={`text-lg font-bold ${profile.safetyScore >= 5 ? 'text-green-600' : 'text-gray-600'}`}>
                {profile.safetyScore}
              </span>
            </div>
            {profile.isGuardian && (
              <div class="flex items-center gap-2 text-amber-600">
                <Shield size={20} />
                <span class="text-sm font-medium">{t('profile.guardian')}</span>
              </div>
            )}
            {profile.badges?.length > 0 && (
              <div class="flex flex-wrap gap-2">
                {profile.badges.filter(b => b.visible).map(b => (
                  <div key={b.badge_key} class="flex items-center gap-1 bg-amber-50 text-amber-700 px-2 py-1 rounded-full text-xs">
                    <Award size={12} />
                    <span>{t(`progress.badge.${b.badge_key}`)}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Display name */}
      <div class="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
        <label class="block text-sm font-medium text-gray-700 mb-1">
          {t('profile.displayName')}
        </label>
        <div class="flex gap-2">
          <input
            type="text"
            value={displayName}
            onInput={(e) => setDisplayName(e.target.value)}
            class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            maxLength={50}
          />
          <button
            onClick={handleSave}
            disabled={saving}
            class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1"
          >
            <Save size={16} />
            {t('profile.save')}
          </button>
        </div>
        {message && (
          <div
            class={`mt-3 p-3 rounded-lg text-sm ${
              message.type === 'success'
                ? 'bg-green-50 text-green-700'
                : 'bg-red-50 text-red-600'
            }`}
          >
            {message.text}
          </div>
        )}
      </div>

      {/* Account actions */}
      <div class="bg-white rounded-lg shadow-sm border border-gray-100 p-4 space-y-3">
        <button
          onClick={handleGdprExport}
          class="w-full flex items-center gap-2 px-4 py-3 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
        >
          <Download size={18} />
          <div class="text-left">
            <div class="font-medium">{t('profile.gdprExport')}</div>
            <div class="text-xs text-gray-500">{t('profile.gdprExportDesc')}</div>
          </div>
        </button>

        <button
          onClick={onLogout}
          class="w-full flex items-center gap-2 px-4 py-3 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
        >
          <LogOut size={18} />
          {t('app.logout')}
        </button>

        <button
          onClick={handleDeleteAccount}
          class="w-full flex items-center gap-2 px-4 py-3 text-red-600 bg-red-50 rounded-lg hover:bg-red-100"
        >
          <Trash2 size={18} />
          {t('profile.deleteAccount')}
        </button>
      </div>
    </div>
  )
}
