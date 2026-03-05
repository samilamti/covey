import { useState, useEffect } from 'preact/hooks'
import { useTranslation } from 'react-i18next'
import { Download, X } from 'lucide-preact'

export function InstallPrompt() {
  const { t } = useTranslation()
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [showIOSHint, setShowIOSHint] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Don't show if already installed (standalone mode)
    if (window.matchMedia('(display-mode: standalone)').matches) return
    if (navigator.standalone === true) return

    const handleBeforeInstall = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstall)

    // iOS detection: Safari on iOS, not already standalone
    const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent)
    const isSafari = /Safari/.test(navigator.userAgent) && !/CriOS|FxiOS/.test(navigator.userAgent)
    if (isIOS && isSafari) {
      setShowIOSHint(true)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    await deferredPrompt.userChoice
    setDeferredPrompt(null)
    setDismissed(true)
  }

  const handleDismiss = () => {
    setDismissed(true)
  }

  if (dismissed) return null
  if (!deferredPrompt && !showIOSHint) return null

  return (
    <div class="bg-indigo-50 border border-indigo-200 rounded-lg p-3 mx-4 mt-2 flex items-start gap-3">
      <Download size={20} class="text-indigo-600 flex-shrink-0 mt-0.5" />
      <div class="flex-1">
        <p class="text-sm font-medium text-indigo-900">
          {t('install.title')}
        </p>
        <p class="text-xs text-indigo-700 mt-1">
          {deferredPrompt ? t('install.description') : t('install.iosHint')}
        </p>
        {deferredPrompt && (
          <button
            onClick={handleInstall}
            class="mt-2 bg-indigo-600 text-white text-sm px-3 py-1.5 rounded-lg font-medium"
          >
            {t('install.button')}
          </button>
        )}
      </div>
      <button onClick={handleDismiss} class="text-indigo-400 hover:text-indigo-600">
        <X size={16} />
      </button>
    </div>
  )
}
