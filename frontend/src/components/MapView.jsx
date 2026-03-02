import { useState, useEffect, useRef } from 'preact/hooks'
import { useTranslation } from 'react-i18next'
import { MapPin, Navigation } from 'lucide-preact'
import { useFeatureFlag } from '../context/FeatureFlagContext'

/**
 * MapView — Leaflet map showing requests and live locations.
 *
 * Leaflet is loaded dynamically to keep the initial bundle small.
 * Requires FEATURE_GEOLOCATION for real location sharing.
 */
export function MapView() {
  const { t } = useTranslation()
  const mapRef = useRef(null)
  const mapInstance = useRef(null)
  const geoEnabled = useFeatureFlag('GEOLOCATION')
  const [userPosition, setUserPosition] = useState(null)
  const [mapReady, setMapReady] = useState(false)

  // Initialize Leaflet map
  useEffect(() => {
    let L
    const initMap = async () => {
      try {
        L = await import('leaflet')
        // Import Leaflet CSS
        if (!document.querySelector('link[href*="leaflet"]')) {
          const link = document.createElement('link')
          link.rel = 'stylesheet'
          link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
          document.head.appendChild(link)
        }

        if (mapRef.current && !mapInstance.current) {
          // Default to Stockholm center
          const map = L.map(mapRef.current).setView([59.33, 18.07], 13)

          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>',
            maxZoom: 19,
          }).addTo(map)

          mapInstance.current = map
          setMapReady(true)
        }
      } catch (err) {
        console.error('Failed to load Leaflet:', err.message)
      }
    }

    initMap()

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove()
        mapInstance.current = null
      }
    }
  }, [])

  // Watch user position if geolocation is enabled
  useEffect(() => {
    if (!geoEnabled || !('geolocation' in navigator)) return

    let watchId
    try {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords
          setUserPosition({ lat: latitude, lng: longitude })

          if (mapInstance.current) {
            mapInstance.current.setView([latitude, longitude], 15)
          }
        },
        (err) => console.log('Geolocation error:', err.message),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
      )
    } catch {
      // Geolocation not available
    }

    return () => {
      if (watchId != null) {
        navigator.geolocation.clearWatch(watchId)
      }
    }
  }, [geoEnabled])

  return (
    <div class="relative">
      {/* Map container */}
      <div
        ref={mapRef}
        class="w-full rounded-lg overflow-hidden bg-gray-200"
        style={{ height: 'calc(100vh - 180px)' }}
      />

      {/* Overlay: location status */}
      {!geoEnabled && (
        <div class="absolute top-3 left-3 right-3 bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-sm flex items-center gap-2 text-sm text-gray-600 z-[1000]">
          <MapPin size={16} class="text-indigo-500 flex-shrink-0" />
          <span>{t('map.locationPermission')}</span>
        </div>
      )}

      {/* Recenter button */}
      {userPosition && (
        <button
          onClick={() => {
            if (mapInstance.current) {
              mapInstance.current.setView([userPosition.lat, userPosition.lng], 15)
            }
          }}
          class="absolute bottom-4 right-4 bg-white rounded-full p-3 shadow-lg z-[1000]"
          aria-label={t('map.recenter')}
        >
          <Navigation size={20} class="text-indigo-600" />
        </button>
      )}
    </div>
  )
}
