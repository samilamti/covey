/**
 * Geodesic utilities for distance and ETA calculations.
 */

/**
 * Haversine distance between two lat/lng points in kilometers.
 */
export function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Format a distance in km to a human-readable Swedish string.
 * @param {number} km - Distance in kilometers
 * @param {Function} t - i18next translate function
 * @returns {string}
 */
export function formatDistance(km, t) {
  if (km < 1) {
    const meters = Math.round(km * 1000 / 50) * 50 // round to nearest 50m
    return t('requests.distanceAway', { distance: `${meters}m` })
  }
  const rounded = Math.round(km * 10) / 10
  return t('requests.distanceAway', { distance: `${rounded}km` })
}
