import { useState, useEffect, useRef } from 'preact/hooks'
import { useTranslation } from 'react-i18next'
import { HelpCircle, Plus, List } from 'lucide-preact'
import { requestService } from '../services/requests'
import { ratingService } from '../services/ratings'
import { RequestCard } from './RequestCard'
import { CreateRequest } from './CreateRequest'
import { ActiveSession } from './ActiveSession'
import { PostCreateMap } from './PostCreateMap'
import { RatingBanner } from './RatingBanner'
import { LocationBanner } from './LocationBanner'
import { useGeolocation } from '../hooks/useGeolocation'
import { socket } from '../socket'

/**
 * RequestList — shows the user's assistance requests, open freestanding
 * requests from others, and allows creating new ones.
 */
export function RequestList({ currentUserId }) {
  const { t } = useTranslation()
  const [requests, setRequests] = useState([])
  const [openRequests, setOpenRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const { position: viewerPosition, error: geoError, retry: retryGeo } = useGeolocation()
  const [showCreate, setShowCreate] = useState(null)
  const [activeSession, setActiveSession] = useState(null)
  const [createdPosition, setCreatedPosition] = useState(null)
  const [pendingRatings, setPendingRatings] = useState([])
  const initialViewDecided = useRef(false)

  const loadRequests = async () => {
    try {
      const { requests: data } = await requestService.list()
      setRequests(data)
      return data
    } catch (err) {
      console.error('Load requests error:', err.message)
      return []
    } finally {
      setLoading(false)
    }
  }

  const loadOpenRequests = async () => {
    try {
      const { requests: data } = await requestService.listOpen()
      // Filter out the current user's own requests
      const filtered = currentUserId
        ? data.filter((r) => r.requester_id !== currentUserId && r.helper_id !== currentUserId)
        : []
      setOpenRequests(filtered)
      return filtered
    } catch (err) {
      console.error('Load open requests error:', err.message)
      return []
    }
  }

  const loadPendingRatings = async () => {
    try {
      const { pending } = await ratingService.getPending()
      setPendingRatings(pending)
    } catch (err) {
      console.error('Load pending ratings error:', err.message)
    }
  }

  const handleRated = (requestId) => {
    setPendingRatings((prev) => prev.filter((r) => r.request_id !== requestId))
  }

  const loadAll = async () => {
    const [requestsResult, openResult] = await Promise.all([
      loadRequests(),
      loadOpenRequests(),
      loadPendingRatings(),
    ])
    if (!initialViewDecided.current) {
      initialViewDecided.current = true
      const active = requestsResult.find(
        (r) => ['active', 'accepted', 'done_pending'].includes(r.status) &&
               (r.requester_id === currentUserId || r.helper_id === currentUserId)
      )
      if (active) {
        setActiveSession(active)
      } else {
        setShowCreate(openResult.length === 0)
      }
    }
  }

  useEffect(() => {
    loadAll()

    // Listen for real-time updates
    const handleNew = () => loadAll()
    const handleAccepted = ({ request: requestData } = {}) => {
      if (requestData && requestData.requester_id === currentUserId) {
        setActiveSession(requestData)
        return
      }
      loadAll()
    }
    const handleCompleted = () => loadAll()
    const handleCancelled = () => loadAll()
    const handleExpired = () => loadAll()
    const handleDoneInitiated = () => loadAll()
    const handleDoneRejected = () => loadAll()

    socket.on('request:new', handleNew)
    socket.on('request:accepted', handleAccepted)
    socket.on('request:completed', handleCompleted)
    socket.on('request:cancelled', handleCancelled)
    socket.on('request:expired', handleExpired)
    socket.on('request:done-initiated', handleDoneInitiated)
    socket.on('request:done-rejected', handleDoneRejected)

    return () => {
      socket.off('request:new', handleNew)
      socket.off('request:accepted', handleAccepted)
      socket.off('request:completed', handleCompleted)
      socket.off('request:cancelled', handleCancelled)
      socket.off('request:expired', handleExpired)
      socket.off('request:done-initiated', handleDoneInitiated)
      socket.off('request:done-rejected', handleDoneRejected)
    }
  }, [])

  const handleAccept = async (requestId) => {
    try {
      const { request } = await requestService.accept(requestId)
      setActiveSession(request)
    } catch (err) {
      console.error('Accept error:', err.message)
    }
  }

  const handleCancel = async (requestId) => {
    try {
      await requestService.cancel(requestId)
      loadAll()
    } catch (err) {
      console.error('Cancel error:', err.message)
    }
  }

  const handleComplete = async (requestId) => {
    try {
      await requestService.initiateDone(requestId)
      loadAll()
    } catch (err) {
      console.error('Initiate done error:', err.message)
    }
  }

  const handleConfirmSafety = async (requestId) => {
    try {
      await requestService.confirmSafety(requestId)
      loadAll()
    } catch (err) {
      console.error('Confirm safety error:', err.message)
    }
  }

  const handleCreated = (request) => {
    setShowCreate(false)
    if (request.pickup_lat && request.pickup_lng) {
      setCreatedPosition({
        lat: parseFloat(request.pickup_lat),
        lng: parseFloat(request.pickup_lng),
      })
    }
    loadAll()
  }

  // Check for active sessions
  const activeRequest = requests.find(
    (r) => ['active', 'accepted', 'done_pending'].includes(r.status) && (r.requester_id === currentUserId || r.helper_id === currentUserId)
  )

  if (activeSession) {
    return (
      <ActiveSession
        request={activeSession}
        currentUserId={currentUserId}
        onClose={() => {
          setActiveSession(null)
          loadAll()
        }}
      />
    )
  }

  if (createdPosition) {
    return (
      <PostCreateMap
        position={createdPosition}
        onBack={() => setCreatedPosition(null)}
      />
    )
  }

  if (loading) {
    return <div class="text-center py-8 text-gray-400">{t('app.loading')}</div>
  }

  return (
    <div>
      {/* Pending ratings — above the heading for prominence */}
      {pendingRatings.map((pr) => (
        <RatingBanner key={pr.request_id} pendingRating={pr} onRated={handleRated} />
      ))}

      {/* Header + create button */}
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-xl font-bold">{t('requests.title')}</h2>
        {showCreate ? (
          <button
            onClick={() => setShowCreate(false)}
            class="flex items-center gap-1 text-indigo-600 text-sm font-medium"
          >
            <List size={16} />
            {t('requests.viewRequests')}
          </button>
        ) : (
          <button
            onClick={() => setShowCreate(true)}
            class="flex items-center gap-1 text-indigo-600 text-sm font-medium"
          >
            <Plus size={16} />
            {t('requests.create')}
          </button>
        )}
      </div>

      {/* Create request form */}
      {showCreate === true && (
        <div class="mb-4">
          <CreateRequest
            onCreated={handleCreated}
            onClose={() => setShowCreate(false)}
          />
        </div>
      )}

      {/* Location banner */}
      <LocationBanner error={geoError} onRetry={retryGeo} />

      {/* Active session banner */}
      {activeRequest && (
        <button
          onClick={() => setActiveSession(activeRequest)}
          class="w-full mb-4 bg-green-50 border border-green-200 rounded-lg p-4 text-left"
        >
          <p class="font-semibold text-green-800">{t('requests.activeSession')}</p>
          <p class="text-sm text-green-600">{t('requests.tapToView')}</p>
        </button>
      )}

      {/* Request lists (visible when create form is hidden) */}
      {showCreate === false && (
        <>
          {requests.length > 0 && (
            <div class="space-y-3">
              {requests.map((request) => (
                <RequestCard
                  key={request.id}
                  request={request}
                  currentUserId={currentUserId}
                  viewerPosition={viewerPosition}
                  onAccept={handleAccept}
                  onCancel={handleCancel}
                  onComplete={handleComplete}
                  onConfirmSafety={handleConfirmSafety}
                />
              ))}
            </div>
          )}

          {/* Open freestanding requests from others */}
          {openRequests.length > 0 && (
            <div class="mt-6">
              <h3 class="text-lg font-semibold text-gray-700 mb-3">{t('requests.openRequests')}</h3>
              <div class="space-y-3">
                {openRequests.map((request) => (
                  <RequestCard
                    key={request.id}
                    request={request}
                    currentUserId={currentUserId}
                    viewerPosition={viewerPosition}
                    onAccept={handleAccept}
                  />
                ))}
              </div>
            </div>
          )}

          {requests.length === 0 && openRequests.length === 0 && (
            <div class="text-center py-8 text-gray-400">
              {t('requests.empty')}
            </div>
          )}
        </>
      )}
    </div>
  )
}
