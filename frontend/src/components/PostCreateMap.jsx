import { useEffect, useRef } from 'preact/hooks'
import { useTranslation } from 'react-i18next'
import { ArrowLeft } from 'lucide-preact'

/**
 * PostCreateMap — shows a Leaflet map centered on the requester's
 * position right after a request has been submitted.
 */
export function PostCreateMap({ position, onBack }) {
  const { t } = useTranslation()
  const mapRef = useRef(null)
  const mapInstance = useRef(null)

  useEffect(() => {
    const initMap = async () => {
      try {
        const L = await import('leaflet')
        if (!document.querySelector('link[href*="leaflet"]')) {
          const link = document.createElement('link')
          link.rel = 'stylesheet'
          link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
          document.head.appendChild(link)
        }

        if (mapRef.current && !mapInstance.current) {
          const map = L.map(mapRef.current).setView([position.lat, position.lng], 15)
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>',
            maxZoom: 19,
          }).addTo(map)

          const icon = L.divIcon({
            className: 'post-create-marker',
            html: '<div style="width:16px;height:16px;border-radius:50%;background:#4f46e5;border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3)"></div>',
            iconSize: [16, 16],
            iconAnchor: [8, 8],
          })
          L.marker([position.lat, position.lng], { icon }).addTo(map)

          mapInstance.current = map
        }
      } catch (err) {
        console.error('Map init error:', err.message)
      }
    }

    initMap()

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove()
        mapInstance.current = null
      }
    }
  }, [position])

  return (
    <div>
      {/* Success banner */}
      <div class="bg-green-50 border border-green-200 rounded-lg p-4 mb-4 text-center">
        <p class="font-semibold text-green-800">{t('requests.waitingForHelp')}</p>
      </div>

      {/* Map */}
      <div
        ref={mapRef}
        class="w-full rounded-lg overflow-hidden bg-gray-200"
        style={{ height: '300px' }}
      />

      {/* Back to list */}
      <button
        onClick={onBack}
        class="mt-4 flex items-center gap-2 text-indigo-600 text-sm font-medium"
      >
        <ArrowLeft size={16} />
        {t('requests.backToList')}
      </button>
    </div>
  )
}
