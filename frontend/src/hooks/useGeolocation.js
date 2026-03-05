import { useState, useEffect, useCallback, useRef } from 'preact/hooks'

/**
 * useGeolocation — centralised hook for browser geolocation.
 *
 * @param {object} opts
 * @param {boolean} opts.watch  — if true, uses watchPosition (continuous); otherwise getCurrentPosition (once)
 * @param {boolean} opts.enableHighAccuracy — request GPS-level accuracy
 * @returns {{ position: {lat,lng,accuracy}|null, error: string|null, loading: boolean, retry: ()=>void, supported: boolean }}
 */
export function useGeolocation({ watch = false, enableHighAccuracy = false } = {}) {
  const [position, setPosition] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const watchIdRef = useRef(null)
  const mountedRef = useRef(true)

  const supported = typeof navigator !== 'undefined' && !!navigator.geolocation

  const handleSuccess = useCallback((pos) => {
    if (!mountedRef.current) return
    setPosition({
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
    })
    setError(null)
    setLoading(false)
  }, [])

  const handleError = useCallback((err) => {
    if (!mountedRef.current) return
    const errorMap = { 1: 'denied', 2: 'unavailable', 3: 'timeout' }
    setError(errorMap[err.code] || 'unavailable')
    setLoading(false)
  }, [])

  const start = useCallback(() => {
    if (!supported) {
      setError('unavailable')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    if (watch) {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
      watchIdRef.current = navigator.geolocation.watchPosition(
        handleSuccess,
        handleError,
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 },
      )
    } else {
      navigator.geolocation.getCurrentPosition(
        handleSuccess,
        handleError,
        { enableHighAccuracy, timeout: 10000 },
      )
    }
  }, [supported, watch, enableHighAccuracy, handleSuccess, handleError])

  useEffect(() => {
    mountedRef.current = true
    start()

    // Re-acquire position when the page regains visibility.
    // Mobile browsers may pause/stop geolocation when backgrounded.
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && mountedRef.current) {
        start()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      mountedRef.current = false
      document.removeEventListener('visibilitychange', handleVisibility)
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
    }
  }, [start])

  return { position, error, loading, retry: start, supported }
}
