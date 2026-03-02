import { useState, useEffect, useRef } from 'preact/hooks'
import { useTranslation } from 'react-i18next'
import { Users, MapPin, Plus, X, Navigation, Loader2 } from 'lucide-preact'
import { communityService } from '../services/communities'
import { CommunityDetail } from './CommunityDetail'
import { NearbyDiscovery } from './NearbyDiscovery'

export function CommunityList({ currentUserId }) {
  const { t } = useTranslation()
  const [communities, setCommunities] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => {
    loadCommunities()
  }, [])

  const loadCommunities = () => {
    communityService.list()
      .then(({ communities }) => setCommunities(communities))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }

  // Show detail view
  if (selectedId) {
    return (
      <CommunityDetail
        communityId={selectedId}
        currentUserId={currentUserId}
        onBack={() => { setSelectedId(null); loadCommunities() }}
      />
    )
  }

  if (loading) {
    return <div class="text-center py-8 text-gray-400">{t('app.loading')}</div>
  }

  if (error) {
    return <div class="text-center py-8 text-red-500">{t('app.error')}</div>
  }

  return (
    <div>
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-xl font-bold">{t('communities.title')}</h2>
        <button
          onClick={() => setShowCreate(!showCreate)}
          class="flex items-center gap-1 text-indigo-600 text-sm font-medium"
        >
          <Plus size={16} />
          {t('communities.create')}
        </button>
      </div>

      {/* Create community form */}
      {showCreate && (
        <div class="mb-4">
          <CreateCommunityForm
            onCreated={(community) => {
              setShowCreate(false)
              loadCommunities()
              setSelectedId(community.id)
            }}
            onClose={() => setShowCreate(false)}
          />
        </div>
      )}

      {/* Nearby discovery */}
      <div class="mb-4">
        <NearbyDiscovery onSelect={(id) => setSelectedId(id)} />
      </div>

      {communities.length === 0 ? (
        <div class="flex flex-col items-center justify-center py-12 text-gray-400">
          <Users size={48} class="mb-4" />
          <p>{t('communities.noCommunities')}</p>
        </div>
      ) : (
        <div class="space-y-3">
          {communities.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              class="w-full text-left bg-white rounded-lg shadow-sm p-4 border border-gray-100 hover:bg-gray-50 transition-colors"
            >
              <h3 class="font-semibold text-gray-900">{c.name}</h3>
              {c.description && (
                <p class="text-sm text-gray-500 mt-1">{c.description}</p>
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
      )}
    </div>
  )
}

/**
 * Inline form for creating a new community.
 *
 * Auto-detects location, reverse-geocodes to get area name,
 * and pre-fills the community name from a localized template.
 */
function CreateCommunityForm({ onCreated, onClose }) {
  const { t, i18n } = useTranslation()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [areaName, setAreaName] = useState('')
  const [coords, setCoords] = useState(null)
  const [geoStatus, setGeoStatus] = useState('detecting') // detecting | found | error
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const mountedRef = useRef(true)

  /**
   * Reverse-geocode coordinates via Nominatim and auto-fill area + name.
   */
  const reverseGeocode = async (lat, lng) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=${i18n.language}`,
        { headers: { 'User-Agent': 'Tillsammans/1.0 (covey.se)' } }
      )
      const data = await res.json()
      const area =
        data.address?.suburb ||
        data.address?.city_district ||
        data.address?.town ||
        data.address?.city ||
        data.address?.municipality ||
        ''
      if (area) {
        setAreaName(area)
        setName(t('communities.autoName', { area }))
      }
    } catch {
      // Geocoding is best-effort — user can still type manually
    }
  }

  /**
   * Detect position and reverse-geocode.
   */
  const detectLocation = () => {
    setGeoStatus('detecting')
    setError(null)

    if (!('geolocation' in navigator)) {
      setGeoStatus('error')
      setError(t('map.locationPermission'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!mountedRef.current) return
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        setCoords({ lat, lng })
        setGeoStatus('found')
        reverseGeocode(lat, lng)
      },
      () => {
        if (!mountedRef.current) return
        setGeoStatus('error')
        setError(t('map.locationPermission'))
      },
      { enableHighAccuracy: false, timeout: 10000 }
    )
  }

  // Auto-detect location when form opens
  useEffect(() => {
    detectLocation()
    return () => { mountedRef.current = false }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim() || !coords) {
      setError(t('communities.createRequiredFields'))
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { community } = await communityService.create({
        name: name.trim(),
        description: description.trim(),
        latitude: coords.lat,
        longitude: coords.lng,
        areaName: areaName.trim(),
      })
      if (onCreated) onCreated(community)
    } catch (err) {
      setError(err.message || t('app.error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div class="bg-white rounded-xl shadow-lg border border-gray-200 p-5">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-bold text-gray-900">{t('communities.create')}</h3>
        {onClose && (
          <button onClick={onClose} class="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} class="space-y-4">
        {/* Location status indicator */}
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            {t('communities.createLocation')}
          </label>

          {geoStatus === 'detecting' && (
            <div class="flex items-center gap-2 text-sm text-indigo-600 bg-indigo-50 rounded-lg px-3 py-2">
              <Loader2 size={14} class="animate-spin" />
              {t('communities.detectingLocation')}
            </div>
          )}

          {geoStatus === 'found' && (
            <div class="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">
              <MapPin size={14} />
              {areaName
                ? t('communities.locationDetected', { area: areaName })
                : t('communities.locationDetected', { area: `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}` })}
            </div>
          )}

          {geoStatus === 'error' && (
            <div class="flex items-center justify-between bg-red-50 rounded-lg px-3 py-2">
              <span class="text-sm text-red-600">{t('map.locationPermission')}</span>
              <button
                type="button"
                onClick={detectLocation}
                class="flex items-center gap-1 text-indigo-600 text-xs font-medium"
              >
                <Navigation size={12} />
                {t('communities.useMyLocation')}
              </button>
            </div>
          )}
        </div>

        {/* Community name (pre-filled from geocoding) */}
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            {t('communities.createName')}
          </label>
          <input
            type="text"
            value={name}
            onInput={(e) => setName(e.target.value)}
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            maxLength={100}
            required
          />
        </div>

        {/* Area name (pre-filled from geocoding) */}
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            {t('communities.createAreaName')}
          </label>
          <input
            type="text"
            value={areaName}
            onInput={(e) => setAreaName(e.target.value)}
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            maxLength={100}
          />
        </div>

        {/* Description */}
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            {t('communities.createDescription')}
          </label>
          <textarea
            value={description}
            onInput={(e) => setDescription(e.target.value)}
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
            rows={2}
            maxLength={500}
          />
        </div>

        {error && <p class="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading || !name.trim() || !coords}
          class="w-full bg-indigo-600 text-white px-4 py-3 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? t('app.loading') : t('communities.createSubmit')}
        </button>
      </form>
    </div>
  )
}
