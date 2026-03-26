import { useState, useRef, useEffect } from 'preact/hooks'
import { useTranslation } from 'react-i18next'
import { ShieldCheck, Users, Loader2, ExternalLink } from 'lucide-preact'
import { LanguageSelector } from './LanguageSelector'
import { BetaBanner } from './BetaBanner'
import { authService } from '../services/auth'

/** Generate a random valid 12-digit NIN for unique test users. */
function generateTestNin() {
  const year = 1960 + Math.floor(Math.random() * 40)
  const month = String(1 + Math.floor(Math.random() * 12)).padStart(2, '0')
  const day = String(1 + Math.floor(Math.random() * 28)).padStart(2, '0')
  const suffix = String(Math.floor(Math.random() * 10000)).padStart(4, '0')
  return `${year}${month}${day}${suffix}`
}

export function LandingPage({ onLogin }) {
  const { t } = useTranslation()
  const [nin, setNin] = useState('')
  const [status, setStatus] = useState('idle') // idle, loading, pending, error
  const [hintCode, setHintCode] = useState(null)
  const [error, setError] = useState(null)
  const pollRef = useRef(null)

  // Clean up polling interval on unmount (e.g. user navigates away mid-login)
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  const handleLogin = async () => {
    // Use entered NIN, or fall back to test number
    const pn = nin.replace(/\D/g, '') || generateTestNin()

    setStatus('loading')
    setError(null)
    setHintCode(null)

    try {
      const { orderRef } = await authService.login(pn)
      setStatus('pending')

      // Poll for status every second
      pollRef.current = setInterval(async () => {
        try {
          const res = await authService.collect(orderRef)

          if (res.status === 'complete') {
            clearInterval(pollRef.current)
            onLogin(res.completionData.user, res.completionData.token)
          } else if (res.status === 'failed') {
            clearInterval(pollRef.current)
            setStatus('error')

            // Map BankID hint codes to i18n keys
            if (res.hintCode === 'userCancel') {
              setError(t('landing.bankidCancel'))
            } else if (res.hintCode === 'expiredTransaction') {
              setError(t('landing.bankidExpired'))
            } else {
              setError(t('landing.bankidError'))
            }
          } else if (res.status === 'pending') {
            setHintCode(res.hintCode)
          }
        } catch {
          clearInterval(pollRef.current)
          setStatus('error')
          setError(t('landing.bankidError'))
        }
      }, 1000)
    } catch {
      setStatus('error')
      setError(t('landing.bankidError'))
    }
  }

  /** Text to show during BankID pending state */
  const pendingText = hintCode === 'userSign'
    ? t('landing.bankidUserSign')
    : t('landing.bankidPending')

  return (
    <div class="fixed inset-0 bg-gradient-to-br from-blue-50 to-indigo-50 flex flex-col overflow-y-auto safe-area-top safe-area-bottom safe-area-x">
      <BetaBanner />
      <header class="p-4 flex justify-end">
        <LanguageSelector />
      </header>

      <main class="flex-grow flex flex-col items-center justify-center p-4 text-center">
        <div class="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full transition-transform hover:scale-[1.01] duration-300">
          <div class="flex justify-center mb-6 text-indigo-600">
            <Users size={64} />
          </div>

          <h1 class="text-3xl font-bold text-gray-900 mb-2">
            {t('landing.title')}
          </h1>

          <p class="text-lg text-indigo-600 font-medium mb-4">
            {t('landing.subtitle')}
          </p>

          <p class="text-sm text-gray-500 italic mb-6">
            {t('landing.nameMeaning')}
          </p>

          <p class="text-gray-600 mb-4 leading-relaxed">
            {t('landing.description')}
          </p>

          <a
            href={`${location.protocol}//docs.${location.hostname}`}
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 mb-2"
          >
            {t('landing.learnMore')}
            <ExternalLink size={14} />
          </a>

          <a
            href={`${location.protocol}//docs.${location.hostname}/sv/trygghetspartners/`}
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 mb-8"
          >
            {t('landing.partnersLink')}
            <ExternalLink size={14} />
          </a>

          {error && (
            <div class="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}

          {status === 'pending' ? (
            <div class="bg-blue-50 text-blue-800 p-4 rounded-lg flex flex-col items-center animate-pulse">
              <Loader2 size={32} class="animate-spin mb-2" />
              <p class="font-medium">{pendingText}</p>
            </div>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }}>
              {/* NIN input (optional — empty uses test number) */}
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={12}
                value={nin}
                onInput={(e) => setNin(e.target.value)}
                placeholder="ÅÅÅÅMMDDXXXX"
                class="w-full mb-4 px-4 py-3 border border-gray-300 rounded-lg text-center text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                aria-label="Personnummer"
              />

              <button
                type="submit"
                disabled={status === 'loading'}
                class="w-full bg-[#182B56] hover:bg-[#203a72] text-white font-bold py-3 px-4 rounded-lg shadow-md transition-colors duration-200 flex items-center justify-center gap-2 group disabled:opacity-70"
              >
                {status === 'loading' ? (
                  <Loader2 size={20} class="animate-spin" />
                ) : (
                  <ShieldCheck size={20} class="group-hover:stroke-2" />
                )}
                <span>{t('landing.loginButton')}</span>
              </button>
            </form>
          )}
        </div>
      </main>

      <footer class="p-4 text-center text-gray-400 text-sm">
        &copy; {new Date().getFullYear()} Covey
      </footer>
    </div>
  )
}
