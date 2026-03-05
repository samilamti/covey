import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/preact'
import { useGeolocation } from '../src/hooks/useGeolocation'

describe('useGeolocation', () => {
  let originalGeolocation
  let consoleErrorSpy

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    originalGeolocation = navigator.geolocation
  })

  afterEach(() => {
    expect(consoleErrorSpy).not.toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
    Object.defineProperty(navigator, 'geolocation', {
      value: originalGeolocation,
      configurable: true,
    })
  })

  function mockGeolocation({ getCurrentPosition, watchPosition, clearWatch } = {}) {
    Object.defineProperty(navigator, 'geolocation', {
      value: {
        getCurrentPosition: getCurrentPosition || vi.fn(),
        watchPosition: watchPosition || vi.fn(() => 42),
        clearWatch: clearWatch || vi.fn(),
      },
      configurable: true,
    })
  }

  it('returns position on successful getCurrentPosition', async () => {
    mockGeolocation({
      getCurrentPosition: vi.fn((success) => {
        success({ coords: { latitude: 59.33, longitude: 18.07, accuracy: 10 } })
      }),
    })

    const { result } = renderHook(() => useGeolocation())

    expect(result.current.position).toEqual({ lat: 59.33, lng: 18.07, accuracy: 10 })
    expect(result.current.error).toBeNull()
    expect(result.current.loading).toBe(false)
    expect(result.current.supported).toBe(true)
  })

  it('returns error "denied" when permission denied (code 1)', async () => {
    mockGeolocation({
      getCurrentPosition: vi.fn((_success, error) => {
        error({ code: 1 })
      }),
    })

    const { result } = renderHook(() => useGeolocation())

    expect(result.current.position).toBeNull()
    expect(result.current.error).toBe('denied')
    expect(result.current.loading).toBe(false)
  })

  it('returns error "unavailable" when position unavailable (code 2)', async () => {
    mockGeolocation({
      getCurrentPosition: vi.fn((_success, error) => {
        error({ code: 2 })
      }),
    })

    const { result } = renderHook(() => useGeolocation())
    expect(result.current.error).toBe('unavailable')
  })

  it('returns error "timeout" when timed out (code 3)', async () => {
    mockGeolocation({
      getCurrentPosition: vi.fn((_success, error) => {
        error({ code: 3 })
      }),
    })

    const { result } = renderHook(() => useGeolocation())
    expect(result.current.error).toBe('timeout')
  })

  it('retry re-invokes geolocation API', async () => {
    let callCount = 0
    mockGeolocation({
      getCurrentPosition: vi.fn((_success, error) => {
        callCount++
        if (callCount === 1) {
          error({ code: 1 })
        } else {
          _success({ coords: { latitude: 59.33, longitude: 18.07, accuracy: 5 } })
        }
      }),
    })

    const { result } = renderHook(() => useGeolocation())
    expect(result.current.error).toBe('denied')

    act(() => {
      result.current.retry()
    })

    expect(result.current.position).toEqual({ lat: 59.33, lng: 18.07, accuracy: 5 })
    expect(result.current.error).toBeNull()
  })

  it('uses watchPosition when watch=true', async () => {
    const clearWatch = vi.fn()
    const watchPosition = vi.fn((success) => {
      success({ coords: { latitude: 60.0, longitude: 19.0, accuracy: 15 } })
      return 7
    })

    mockGeolocation({ watchPosition, clearWatch })

    const { result, unmount } = renderHook(() => useGeolocation({ watch: true }))

    expect(watchPosition).toHaveBeenCalled()
    expect(result.current.position).toEqual({ lat: 60.0, lng: 19.0, accuracy: 15 })

    unmount()
    expect(clearWatch).toHaveBeenCalled()
  })

  it('returns supported=false when navigator.geolocation is missing', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      value: undefined,
      configurable: true,
    })

    const { result } = renderHook(() => useGeolocation())

    expect(result.current.supported).toBe(false)
    expect(result.current.error).toBe('unavailable')
    expect(result.current.loading).toBe(false)
  })

  it('includes accuracy in position', async () => {
    mockGeolocation({
      getCurrentPosition: vi.fn((success) => {
        success({ coords: { latitude: 59.33, longitude: 18.07, accuracy: 42.5 } })
      }),
    })

    const { result } = renderHook(() => useGeolocation())
    expect(result.current.position.accuracy).toBe(42.5)
  })

  /* ── Visibility change handling ── */

  it('re-calls getCurrentPosition when page becomes visible (one-shot mode)', async () => {
    const getCurrentPosition = vi.fn((success) => {
      success({ coords: { latitude: 59.33, longitude: 18.07, accuracy: 10 } })
    })
    mockGeolocation({ getCurrentPosition })

    renderHook(() => useGeolocation())
    expect(getCurrentPosition).toHaveBeenCalledTimes(1)

    // Simulate page becoming visible
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    expect(getCurrentPosition).toHaveBeenCalledTimes(2)
  })

  it('restarts watchPosition when page becomes visible (watch mode)', async () => {
    const clearWatch = vi.fn()
    let watchId = 0
    const watchPosition = vi.fn((success) => {
      watchId++
      success({ coords: { latitude: 60.0, longitude: 19.0, accuracy: 15 } })
      return watchId
    })
    mockGeolocation({ watchPosition, clearWatch })

    const { unmount } = renderHook(() => useGeolocation({ watch: true }))
    expect(watchPosition).toHaveBeenCalledTimes(1)

    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    // Old watcher cleared, new one started
    expect(clearWatch).toHaveBeenCalled()
    expect(watchPosition).toHaveBeenCalledTimes(2)

    // Unmount before afterEach restores navigator.geolocation
    unmount()
  })

  it('does not re-acquire when page becomes hidden', async () => {
    const getCurrentPosition = vi.fn((success) => {
      success({ coords: { latitude: 59.33, longitude: 18.07, accuracy: 10 } })
    })
    mockGeolocation({ getCurrentPosition })

    renderHook(() => useGeolocation())
    expect(getCurrentPosition).toHaveBeenCalledTimes(1)

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    expect(getCurrentPosition).toHaveBeenCalledTimes(1)
  })

  it('does not re-acquire after unmount', async () => {
    const getCurrentPosition = vi.fn((success) => {
      success({ coords: { latitude: 59.33, longitude: 18.07, accuracy: 10 } })
    })
    mockGeolocation({ getCurrentPosition })

    const { unmount } = renderHook(() => useGeolocation())
    expect(getCurrentPosition).toHaveBeenCalledTimes(1)

    unmount()

    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))

    expect(getCurrentPosition).toHaveBeenCalledTimes(1)
  })

  it('cleans up visibilitychange listener on unmount', async () => {
    mockGeolocation({
      getCurrentPosition: vi.fn((success) => {
        success({ coords: { latitude: 59.33, longitude: 18.07, accuracy: 10 } })
      }),
    })

    const removeListenerSpy = vi.spyOn(document, 'removeEventListener')

    const { unmount } = renderHook(() => useGeolocation())
    unmount()

    const visibilityCalls = removeListenerSpy.mock.calls.filter(
      ([event]) => event === 'visibilitychange'
    )
    expect(visibilityCalls.length).toBeGreaterThan(0)
    removeListenerSpy.mockRestore()
  })
})
