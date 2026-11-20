import { useEffect, useRef } from 'preact/hooks'
import { useTranslation } from 'react-i18next'
import { ArrowLeft } from 'lucide-preact'
import 'leaflet/dist/leaflet.css'
import { useAnnouncer } from '../context/AnnouncerContext'

/**
 * PostCreateMap — shows a Leaflet map centered on the requester's
 * position right after a request has been submitted.
 */
export function PostCreateMap({ position, onBack }) {
  const { t } = useTranslation()
  const { announce } = useAnnouncer()
  const mapRef = useRef(null)
  const mapInstance = useRef(null)

  // Speak the success banner through the always-mounted global announcer.
  // A role="status" region mounted TOGETHER with its text is often skipped
  // by VoiceOver; the announcer already exists in the a11y tree when its
  // content changes, so the polite update is heard. The visible banner below
  // has no live role of its own, so nothing reads it twice.
  useEffect(() => {
    announce(t('requests.waitingForHelp'))
  }, [])

  useEffect(() => {
    const initMap = async () => {
      try {
        const L = await import('leaflet')

        if (mapRef.current && !mapInstance.current) {
          const map = L.map(mapRef.current).setView([position.lat, position.lng], 15)
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>',
            maxZoom: 19,
          }).addTo(map)

          const icon = L.divIcon({
            className: 'post-create-marker',
            html: '<div style="width:16px;height:16px;border-radius:50%;background:#182b56;border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3)"></div>',
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
      {/* Success banner. It is spoken through the announcer (see the
          effect above), so it carries no live role here. WCAG 4.1.3. */}
      <div class="bg-green-50 border border-green-200 rounded-lg p-4 mb-4 text-center">
        <p class="font-semibold text-green-800">{t('requests.waitingForHelp')}</p>
      </div>

      {/* Map. Leaflet puts the container into the tab order (tabindex=0)
          once it initialises, so without role="region" + an accessible
          name a keyboard or screen-reader user tabs onto a nameless
          widget. Labelling it as a region also gives landmark navigation
          a way to find or skip it. The green confirmation above speaks
          for itself, so the map is a supplement rather than the only
          source of truth. */}
      <div
        ref={mapRef}
        role="region"
        aria-label={t('map.title')}
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
