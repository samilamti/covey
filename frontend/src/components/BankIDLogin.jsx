import { useState, useRef, useEffect } from 'preact/hooks'
import { useTranslation } from 'react-i18next'
import { ShieldCheck, Loader2, Smartphone } from 'lucide-preact'
import qrcode from 'qrcode-generator'
import { authService } from '../services/auth'
import { useAnnouncer } from '../context/AnnouncerContext'

/**
 * BankIDLogin — the real BankID v6 "Secure Start" login flow.
 *
 * Shown by LandingPage when the BANKID_AUTH feature flag is on. Unlike the
 * stub's personnummer entry, v6 has no personal-number field: the user starts
 * BankID via the animated QR code (other device) or the autostart link (same
 * device). We poll /collect for the result and /qr for the refreshing code.
 *
 * The QR is rendered client-side (no third party ever sees the BankID token).
 *
 * Poll intervals are props so tests can run fast; defaults match BankID's
 * guidance (QR refresh ~1s, collect ~2s).
 */
export function BankIDLogin({ onLogin, pollMs = 2000, qrMs = 1000 }) {
  const { t } = useTranslation()
  const { announce } = useAnnouncer()
  const [status, setStatus] = useState('idle') // idle | starting | pending | error
  const [hintCode, setHintCode] = useState(null)
  const [qrDataUrl, setQrDataUrl] = useState(null)
  const [autoStartToken, setAutoStartToken] = useState(null)
  const [error, setError] = useState(null)

  const pendingText = hintCode === 'userSign'
    ? t('landing.bankidUserSign')
    : t('landing.bankidPending')

  // Speak a failed BankID flow through the global announcer. An inline role="alert"
  // mounted together with its text is often skipped by VoiceOver, so the
  // visible error has no live role of its own. Assertive: the user just
  // tried to sign in and the flow failed (cancelled, expired or errored).
  useEffect(() => {
    if (error) announce(error, { assertive: true })
  }, [error])

  // Speak the pending instruction when the flow starts and again whenever it
  // changes ("open BankID" → "enter your code"). The announcer is the only
  // channel; the visible text below has no live role, so a screen reader that
  // would also pick up an inline region does not read it twice. Polite — the
  // user started this themselves.
  useEffect(() => {
    if (status !== 'pending') return
    announce(pendingText)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, pendingText])

  const orderRef = useRef(null)
  const collectTimer = useRef(null)
  const qrTimer = useRef(null)

  const stop = () => {
    if (collectTimer.current) clearInterval(collectTimer.current)
    if (qrTimer.current) clearInterval(qrTimer.current)
    collectTimer.current = null
    qrTimer.current = null
  }

  // Clean up timers if the user navigates away mid-login.
  useEffect(() => () => stop(), [])

  const renderQr = (payload) => {
    try {
      const qr = qrcode(0, 'M')
      qr.addData(payload)
      qr.make()
      setQrDataUrl(qr.createDataURL(6, 8))
    } catch {
      /* transient encode failure — next tick refreshes */
    }
  }

  const fail = (hint) => {
    stop()
    setStatus('error')
    if (hint === 'userCancel') setError(t('landing.bankidCancel'))
    else if (hint === 'expiredTransaction') setError(t('landing.bankidExpired'))
    else setError(t('landing.bankidError'))
  }

  const start = async () => {
    setStatus('starting')
    setError(null)
    setHintCode(null)
    setQrDataUrl(null)

    try {
      const { orderRef: ref, autoStartToken: ast } = await authService.login()
      orderRef.current = ref
      setAutoStartToken(ast)
      setStatus('pending')

      // Animated QR — refresh immediately, then once per second.
      const refreshQr = async () => {
        try {
          const { qr } = await authService.qr(ref)
          if (qr) renderQr(qr)
        } catch {
          /* ignore — QR is best-effort; collect still drives the result */
        }
      }
      refreshQr()
      qrTimer.current = setInterval(refreshQr, qrMs)

      // Collect — poll immediately, then every couple of seconds.
      const poll = async () => {
        try {
          const res = await authService.collect(ref)
          if (res.status === 'complete') {
            stop()
            onLogin(res.completionData.user, res.completionData.token)
          } else if (res.status === 'failed') {
            fail(res.hintCode)
          } else {
            setHintCode(res.hintCode)
          }
        } catch {
          fail()
        }
      }
      poll()
      collectTimer.current = setInterval(poll, pollMs)
    } catch {
      setStatus('error')
      setError(t('landing.bankidError'))
    }
  }

  const cancel = async () => {
    stop()
    const ref = orderRef.current
    orderRef.current = null
    if (ref) {
      try { await authService.cancel(ref) } catch { /* best-effort */ }
    }
    setStatus('idle')
    setQrDataUrl(null)
    setHintCode(null)
  }


  if (status === 'pending') {
    return (
      <div class="flex flex-col items-center">
        {/* The paragraph below names the QR in the user's language, and a
            screen-reader user cannot point a camera at it anyway — the
            autostart link below is the inclusive path. Empty alt marks it
            decorative so the content isn't duplicated on each tick. */}
        {qrDataUrl ? (
          <img
            src={qrDataUrl}
            alt=""
            width="200"
            height="200"
            class="rounded-lg border border-gray-200 mb-3"
          />
        ) : (
          // The spinner that stands in for the QR before the first frame
          // arrives had nothing to say, so a screen-reader user on the login
          // screen was left guessing whether BankID was working. A status
          // region reads out its text, not an aria-label, so the words go in
          // as visually hidden content.
          <div
            role="status"
            class="w-[200px] h-[200px] rounded-lg border border-gray-200 mb-3 flex items-center justify-center"
          >
            <Loader2 size={28} class="animate-spin text-gray-300" />
            <span class="sr-only">{t('landing.bankidQrLoading')}</span>
          </div>
        )}

        <p class="text-sm text-gray-600 mb-4">{t('landing.bankidScan')}</p>

        {autoStartToken && (
          <a
            href={`bankid:///?autostarttoken=${autoStartToken}&redirect=null`}
            class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg shadow-md transition-colors duration-200 flex items-center justify-center gap-2 mb-3"
          >
            <Smartphone size={20} />
            {t('landing.bankidOpenHere')}
          </a>
        )}

        {/* The pending text flips from "Open BankID app" to "Enter your
            security code" when the user opens BankID. The effect at the top
            speaks each version through the announcer. */}
        <div class="text-blue-700 text-sm flex items-center gap-2 mb-3">
          <Loader2 size={16} class="animate-spin" aria-hidden="true" />
          {pendingText}
        </div>

        {/* Cancel is the only escape from a pending BankID order — a
            user who meant to sign in later, or who opened the wrong
            app, has no other way out of the QR-polling loop. The text
            had been rendered in `text-gray-400` (~2.6:1 on white),
            below WCAG 1.4.3's 4.5:1 AA bar for a visible button
            label at the 14 px (text-sm) size. `text-gray-600` clears
            ~7.5:1 on the same surface and matches the strong-signal
            treatment an auth-flow escape calls for. */}
        <button onClick={cancel} class="text-gray-600 text-sm hover:text-gray-800">
          {t('requests.cancel')}
        </button>
      </div>
    )
  }

  return (
    <div>
      {error && (
        <div class="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">
          {error}
        </div>
      )}
      <button
        onClick={start}
        disabled={status === 'starting'}
        class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg shadow-md transition-colors duration-200 flex items-center justify-center gap-2 group disabled:opacity-70"
      >
        {status === 'starting' ? (
          <Loader2 size={20} class="animate-spin" />
        ) : (
          <ShieldCheck size={20} class="group-hover:stroke-2" />
        )}
        <span>{t('landing.loginButton')}</span>
      </button>
    </div>
  )
}
