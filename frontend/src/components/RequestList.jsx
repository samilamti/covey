import { useState, useEffect } from 'preact/hooks'
import { useTranslation } from 'react-i18next'
import { HelpCircle, Plus } from 'lucide-preact'
import { requestService } from '../services/requests'
import { ratingService } from '../services/ratings'
import { RequestCard } from './RequestCard'
import { CreateRequest } from './CreateRequest'
import { ActiveSession } from './ActiveSession'
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
  const [showCreate, setShowCreate] = useState(false)
  const [activeSession, setActiveSession] = useState(null)
  const [pendingRatings, setPendingRatings] = useState([])

  const loadRequests = async () => {
    try {
      const { requests: data } = await requestService.list()
      setRequests(data)
    } catch (err) {
      console.error('Load requests error:', err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadOpenRequests = async () => {
    try {
      const { requests: data } = await requestService.listOpen()
      // Filter out the current user's own requests
      setOpenRequests(
        currentUserId
          ? data.filter((r) => r.requester_id !== currentUserId && r.helper_id !== currentUserId)
          : []
      )
    } catch (err) {
      console.error('Load open requests error:', err.message)
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

  const loadAll = () => {
    loadRequests()
    loadOpenRequests()
    loadPendingRatings()
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

  if (loading) {
    return <div class="text-center py-8 text-gray-400">{t('app.loading')}</div>
  }

  return (
    <div>
      {/* Header + create button */}
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-xl font-bold">{t('requests.title')}</h2>
        <button
          onClick={() => setShowCreate(!showCreate)}
          class="flex items-center gap-1 text-indigo-600 text-sm font-medium"
        >
          <Plus size={16} />
          {t('requests.create')}
        </button>
      </div>

      {/* Create request form */}
      {showCreate && (
        <div class="mb-4">
          <CreateRequest
            onCreated={handleCreated}
            onClose={() => setShowCreate(false)}
          />
        </div>
      )}

      {/* Location banner */}
      <LocationBanner error={geoError} onRetry={retryGeo} />

      {/* Pending ratings */}
      {pendingRatings.map((pr) => (
        <RatingBanner key={pr.request_id} pendingRating={pr} onRated={handleRated} />
      ))}

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

      {/* My requests — show create form by default when user has nothing */}
      {requests.length === 0 && openRequests.length === 0 ? (
        <div class="mb-4">
          <CreateRequest
            onCreated={handleCreated}
            onClose={() => setShowCreate(false)}
          />
        </div>
      ) : (
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
        </>
      )}
    </div>
  )
}
