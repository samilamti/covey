/**
 * Geolocation API wrapper.
 *
 * Provides a clean interface for watching the user's position
 * with error handling and cleanup.
 */

/**
 * Start watching the user's position.
 * @param {function} onPosition - Called with { latitude, longitude, accuracy }
 * @param {function} onError - Called with error message
 * @returns {number} watchId — pass to stopWatching()
 */
export function startWatching(onPosition, onError) {
  if (!navigator.geolocation) {
    onError('Geolocation is not supported')
    return null
  }

  return navigator.geolocation.watchPosition(
    (pos) => {
      onPosition({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      })
    },
    (err) => {
      onError(err.message)
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 5000,
    }
  )
}

/**
 * Stop watching position.
 * @param {number} watchId
 */
export function stopWatching(watchId) {
  if (watchId !== null && watchId !== undefined) {
    navigator.geolocation.clearWatch(watchId)
  }
}

/**
 * Get current position once.
 * @returns {Promise<{ latitude: number, longitude: number, accuracy: number }>}
 */
export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        })
      },
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  })
}
