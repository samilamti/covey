import { useEffect, useId, useState } from 'preact/hooks'
import { useTranslation } from 'react-i18next'
import { ShieldCheck, Shield, Download, Trash2, Save, Award, LogOut } from 'lucide-preact'
import { profileService } from '../services/profile'
import { gdprService } from '../services/gdpr'
import { LanguageSelector } from './LanguageSelector'
import { SafetyPartners } from './SafetyPartners'
import { useAnnouncer } from '../context/AnnouncerContext'

export function ProfileView({ user, onLogout }) {
  const { t } = useTranslation()
  const { announce } = useAnnouncer()
  const [displayName, setDisplayName] = useState(user?.displayName || user?.name || '')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [profile, setProfile] = useState(null)

  // Show the message inline (the visible receipt) and speak it through the
  // global announcer. An inline region mounted together with its text is
  // often skipped by VoiceOver, so the block carries no live role: the
  // announcer is the only channel, and nothing is read twice.
  const showMessage = (type, text) => {
    setMessage({ type, text })
    announce(text, { assertive: type === 'error' })
  }
  // The display-name label sits next to the input, not around it, so without
  // an explicit htmlFor/id pair assistive tech reads the input as unnamed.
  const displayNameId = useId()

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
      // The original success text was a bare "✓" glyph — visible to sighted
      // users and silent for assistive tech, which reads it as a decorative
      // check mark (or nothing at all, depending on the voice). A translated
      // word is spoken through the announcer.
      showMessage('success', t('profile.saved'))
    } catch {
      showMessage('error', t('app.error'))
    } finally {
      setSaving(false)
    }
  }

  const handleGdprExport = async () => {
    try {
      const data = await gdprService.exportData()
      // Download as JSON file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'covey-data.json'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      showMessage('error', t('app.error'))
    }
  }

  const handleDeleteAccount = async () => {
    if (!confirm(t('profile.deleteConfirm'))) return
    try {
      await profileService.deleteAccount()
      onLogout()
    } catch {
      showMessage('error', t('app.error'))
    }
  }

  return (
    <div class="space-y-4">
      <h2 class="text-xl font-bold">{t('profile.title')}</h2>

      {/* Identity & standing */}
      <div class="bg-white rounded-lg shadow-sm border border-gray-100 p-4 space-y-3">
        {/* Only a real BankID login is verified; the backend reports false for stub logins */}
        {profile?.verified === true && (
          <div class="flex items-center gap-2 text-green-600">
            <ShieldCheck size={20} />
            <span class="text-sm font-medium">{t('profile.verified')}</span>
          </div>
        )}

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
              // The visible pills are a collection of named, discrete items
              // (a short honour-roll of this user's public badges), so give
              // them list semantics: a screen reader then announces a count
              // and lets the user step between entries with its list
              // shortcuts, the same affordance SafetyPartners, RequestList
              // and ProgressDashboard already carry. No visible heading sits
              // directly above this row, so the list takes its name from an
              // aria-label pointing at the already-translated "badges"
              // string instead of an invented id-tied element. list-none
              // p-0 m-0 keep the wrap layout identical. WCAG 1.3.1.
              <ul
                role="list"
                aria-label={t('progress.badges')}
                class="list-none p-0 m-0 flex flex-wrap gap-2"
              >
                {profile.badges.filter(b => b.visible).map(b => (
                  <li key={b.badge_key} class="flex items-center gap-1 bg-amber-50 text-amber-700 px-2 py-1 rounded-full text-xs">
                    <Award size={12} />
                    <span>{t(`progress.badge.${b.badge_key}`)}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      {/* Display name */}
      <div class="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
        <label for={displayNameId} class="block text-sm font-medium text-gray-700 mb-1">
          {t('profile.displayName')}
        </label>
        <div class="flex gap-2">
          <input
            id={displayNameId}
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
        {/* Visible receipt only. showMessage() speaks it: assertively for a
            failed save (the user just tried to act), politely for success. */}
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

      {/* Language — the visible section heading was a bare <label> without
          a `for` attribute, i.e. a dangling label that no screen reader
          attaches to the LanguageSelector button. Render it as a <div>
          with the same visual class: the picker component now carries its
          own accessible name ("Choose language …"), so we keep the visible
          heading as a styling element rather than a broken form semantic. */}
      <div class="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
        <div class="block text-sm font-medium text-gray-700 mb-2">{t('profile.language')}</div>
        <LanguageSelector />
      </div>

      {/* Report and block people from past sessions */}
      <SafetyPartners />

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
