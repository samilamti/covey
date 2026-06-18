import { useState, useRef, useEffect } from 'preact/hooks'
import { useTranslation } from 'react-i18next'
import { ShieldCheck, Loader2, ExternalLink } from 'lucide-preact'
import { LanguageSelector } from './LanguageSelector'
import { CoveyMark } from './CoveyMark'
import { authService } from '../services/auth'
import { useFeatureFlag } from '../context/FeatureFlagContext'
import { BankIDLogin } from './BankIDLogin'

/** Generate a random valid 12-digit NIN for unique test users. */
function generateTestNin() {
  const year = 1960 + Math.floor(Math.random() * 40)
  const month = String(1 + Math.floor(Math.random() * 12)).padStart(2, '0')
  const day = String(1 + Math.floor(Math.random() * 28)).padStart(2, '0')
  const suffix = String(Math.floor(Math.random() * 10000)).padStart(4, '0')
  return `${year}${month}${day}${suffix}`
}

/**
 * Built-in demo persona — signs in as a deterministic, pre-computed user
 * via the easter egg (double-tap the logo, then tap login). Same NIN every
 * time so the demo identity is stable for screenshots and walkthroughs.
 *
 * The mint-green theme persists for the session via localStorage and is
 * applied as a class on <body> in App.jsx during boot.
 */
const DEMO_NIN = '199001011234'

export function LandingPage({ onLogin }) {
  const { t } = useTranslation()
  // Real BankID v6 (Secure Start, QR + autostart) when the flag is on;
  // the personnummer/stub flow below stays for local dev (flag off).
  const bankidEnabled = useFeatureFlag('BANKID_AUTH')
  const [nin, setNin] = useState('')
  const [status, setStatus] = useState('idle') // idle, loading, pending, error
  const [hintCode, setHintCode] = useState(null)
  const [error, setError] = useState(null)
  const pollRef = useRef(null)
  const [inputFocused, setInputFocused] = useState(false)

  // --- Demo easter egg ---
  // Sequence to activate: tap logo, tap logo, tap Login.
  // Both logo taps just increment a counter — no timing constraint, so the
  // user can take their time. The actual demo login is triggered on the
  // Login button press (handleLogin checks the counter), not on the second
  // logo tap. This matches the "activate on login" requirement.
  const [demoArmed, setDemoArmed] = useState(false)
  const logoTapCountRef = useRef(0)

  const handleLogoTap = () => {
    logoTapCountRef.current += 1
    if (logoTapCountRef.current >= 2 && !demoArmed) {
      // Quietly mark armed; actual activation happens on the next Login tap.
      // We do not flip the theme yet — that happens at login time so the
      // user gets a clean "before / after" reveal.
      setDemoArmed(true)
    }
  }

  // Clean up polling interval on unmount (e.g. user navigates away mid-login)
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  const handleLogin = async () => {
    // Two paths into the easter egg:
    //   1. demoArmed (set by double-tapping the logo) — the discoverable, gestural way
    //   2. typing the magic NIN '999999999999' — script-friendly, used for App Store
    //      screenshot automation where cliclick into a single text field is far
    //      more reliable than driving a coordinate-based double-tap on a 64px icon.
    const enteredNin = nin.replace(/\D/g, '')
    const triggerDemo = demoArmed || enteredNin === '999999999999'
    let pn
    if (triggerDemo) {
      pn = DEMO_NIN
      try { localStorage.setItem('demoMode', '1') } catch {}
      document.body.classList.add('mint-theme')
      setDemoArmed(true)  // reflect armed state in UI even if it came via the NIN path
    } else {
      pn = enteredNin || generateTestNin()
    }

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
    <div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex flex-col safe-area-top safe-area-bottom safe-area-x relative">
      <header class="p-4 flex justify-end">
        <LanguageSelector />
      </header>

      <main class="flex-grow flex flex-col items-center justify-center p-4 text-center">
        <div class="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full transition-transform hover:scale-[1.01] duration-300">
          <button
            type="button"
            onClick={handleLogoTap}
            aria-label="Covey"
            class="block mx-auto mb-4 cursor-pointer focus:outline-none"
            style="touch-action: manipulation; -webkit-user-select: none; user-select: none;"
          >
            <CoveyMark size={76} />
          </button>

          <h1 class="text-3xl font-bold text-gray-900 mb-2">
            {t('landing.title')}
          </h1>

          <div class={`transition-all duration-300 overflow-hidden ${inputFocused ? 'opacity-0 max-h-0' : 'opacity-100 max-h-40'}`}>
            <p class="text-sm text-gray-500 italic mb-4">
              {t('landing.nameMeaning')}
            </p>
          </div>

          <div class={`transition-all duration-300 overflow-hidden ${inputFocused ? 'opacity-0 max-h-0' : 'opacity-100 max-h-40'}`}>
            <p class="text-gray-600 mb-4 leading-relaxed">
              {t('landing.description')}
            </p>
          </div>

          <div class={`flex flex-wrap items-center justify-center gap-x-5 gap-y-1 mb-8 transition-all duration-300 ${inputFocused ? 'opacity-0 max-h-0 !mb-0 overflow-hidden' : 'opacity-100 max-h-40'}`}>
            <a
              href={`${location.protocol}//docs.${location.hostname}`}
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800"
            >
              {t('landing.learnMore')}
              <ExternalLink size={14} />
            </a>

            <a
              href={`${location.protocol}//docs.${location.hostname}/sv/trygghetspartners/`}
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800"
            >
              {t('landing.partnersLink')}
              <ExternalLink size={14} />
            </a>
          </div>

          {bankidEnabled ? (
            <BankIDLogin onLogin={onLogin} />
          ) : (
            <>
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
                onFocus={(e) => { setInputFocused(true); setTimeout(() => e.target.scrollIntoView({ block: 'center', behavior: 'smooth' }), 350) }}
                onBlur={() => setInputFocused(false)}
                placeholder="ÅÅÅÅMMDDXXXX"
                class={`w-full mb-4 px-4 py-3 border rounded-lg text-center text-lg tracking-widest focus:outline-none transition-shadow duration-300 ${inputFocused ? 'border-amber-400 ring-4 ring-amber-300' : 'border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'}`}
                aria-label="Personnummer"
              />

              <button
                type="submit"
                disabled={status === 'loading'}
                class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg shadow-md transition-colors duration-200 flex items-center justify-center gap-2 group disabled:opacity-70"
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
            </>
          )}
        </div>
      </main>

      <footer class="p-4 text-center text-gray-400 text-sm">
        &copy; {new Date().getFullYear()} Covey
      </footer>
    </div>
  )
}
