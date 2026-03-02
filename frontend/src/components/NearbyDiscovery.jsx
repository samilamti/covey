import { useState, useEffect } from 'preact/hooks'
import { useTranslation } from 'react-i18next'
import { Compass, MapPin, Users, Loader } from 'lucide-preact'
import { communityService } from '../services/communities'

/**
 * NearbyDiscovery — discover safety communities near the user's location.
 *
 * Uses the browser's Geolocation API to find nearby communities.
 * Only shows community name, area_name, and member count (no coordinates).
 */
export function NearbyDiscovery({ onSelect }) {
  const { t } = useTranslation()
  const [communities, setCommunities] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [searched, setSearched] = useState(false)

  const discoverNearby = () => {
    if (!('geolocation' in navigator)) {
      setError(t('map.locationPermission'))
      return
    }

    setLoading(true)
    setError(null)

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { communities: nearby } = await communityService.nearby(
            pos.coords.latitude,
            pos.coords.longitude
          )
          setCommunities(nearby)
          setSearched(true)
        } catch (err) {
          setError(err.message || t('app.error'))
        } finally {
          setLoading(false)
        }
      },
      (err) => {
        setError(t('map.locationPermission'))
        setLoading(false)
      },
      { enableHighAccuracy: false, timeout: 10000 }
    )
  }

  return (
    <div>
      {/* Discover button */}
      {!searched && !loading && (
        <button
          onClick={discoverNearby}
          class="w-full flex items-center justify-center gap-2 bg-indigo-50 text-indigo-700 border border-indigo-200 px-4 py-4 rounded-lg font-medium hover:bg-indigo-100 transition-colors"
        >
          <Compass size={20} />
          {t('communities.discoverNearby')}
        </button>
      )}

      {/* Loading */}
      {loading && (
        <div class="flex items-center justify-center gap-2 py-8 text-gray-400">
          <Loader size={20} class="animate-spin" />
          <span>{t('app.loading')}</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div class="text-center py-4 text-red-500 text-sm">
          <p>{error}</p>
          <button
            onClick={discoverNearby}
            class="mt-2 text-indigo-600 font-medium"
          >
            {t('communities.tryAgain')}
          </button>
        </div>
      )}

      {/* Results */}
      {searched && !loading && (
        <div>
          <h3 class="text-sm font-semibold text-gray-700 mb-3">
            {communities.length > 0
              ? t('communities.nearbyResults', { count: communities.length })
              : t('communities.noNearby')}
          </h3>

          <div class="space-y-3">
            {communities.map((c) => (
              <button
                key={c.id}
                onClick={() => onSelect && onSelect(c.id)}
                class="w-full text-left bg-white rounded-lg shadow-sm border border-gray-100 p-4 hover:bg-gray-50 transition-colors"
              >
                <h4 class="font-semibold text-gray-900">{c.name}</h4>
                {c.description && (
                  <p class="text-sm text-gray-500 mt-1 line-clamp-2">{c.description}</p>
                )}
                <div class="flex items-center gap-4 mt-2 text-xs text-gray-400">
                  {c.area_name && (
                    <span class="flex items-center gap-1">
                      <MapPin size={12} />
                      {c.area_name}
                    </span>
                  )}
                  <span class="flex items-center gap-1">
                    <Users size={12} />
                    {t('communities.memberCount', { count: parseInt(c.member_count) || 0 })}
                  </span>
                </div>
              </button>
            ))}
          </div>

          {/* Search again */}
          <button
            onClick={discoverNearby}
            class="w-full mt-4 text-sm text-indigo-600 font-medium py-2"
          >
            {t('communities.searchAgain')}
          </button>
        </div>
      )}
    </div>
  )
}
