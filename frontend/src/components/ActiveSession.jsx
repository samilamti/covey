import { useState, useEffect, useRef } from 'preact/hooks'
import { useTranslation } from 'react-i18next'
import { CheckCircle, Phone, MapPin, X, Clock, MessageCircle, Send } from 'lucide-preact'
import { socket } from '../socket'
import { requestService } from '../services/requests'
import { haversineKm } from '../utils/geo'
import { LocationBanner } from './LocationBanner'
import { useGeolocation } from '../hooks/useGeolocation'

/**
 * ActiveSession — live map showing both parties' locations during an active assistance session.
 *
 * Sends and receives location updates via Socket.io.
 * Shows a "complete" or "cancel" button depending on user role.
 */
export function ActiveSession({ request, currentUserId, onClose }) {
  const { t } = useTranslation()
  const mapRef = useRef(null)
  const mapInstance = useRef(null)
  const markersRef = useRef({})
  const leafletRef = useRef(null)
  const [otherLocation, setOtherLocation] = useState(null)
  const { position: myLocation, error: geoError, retry: retryGeo } = useGeolocation({ watch: true, enableHighAccuracy: true })
  const [status, setStatus] = useState(request.status)
  const [doneInitiatedBy, setDoneInitiatedBy] = useState(request.done_initiated_by || null)
  const [messages, setMessages] = useState([])
  const [messageText, setMessageText] = useState('')
  const [showMessages, setShowMessages] = useState(false)
  const showMessagesRef = useRef(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const messagesEndRef = useRef(null)

  const isRequester = request.requester_id === currentUserId
  const isHelper = request.helper_id === currentUserId

  // Self-heal: if entered with 'accepted' status, auto-start to transition to 'active'
  useEffect(() => {
    if (status === 'accepted') {
      requestService.start(request.id)
        .then(({ request: updated }) => setStatus(updated.status))
        .catch((err) => console.error('Auto-start error:', err.message))
    }
  }, [])

  // Initialize map
  useEffect(() => {
    const initMap = async () => {
      try {
        const L = await import('leaflet')
        leafletRef.current = L
        if (!document.querySelector('link[href*="leaflet"]')) {
          const link = document.createElement('link')
          link.rel = 'stylesheet'
          link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
          document.head.appendChild(link)
        }

        if (mapRef.current && !mapInstance.current) {
          const center = request.pickup_lat && request.pickup_lng
            ? [parseFloat(request.pickup_lat), parseFloat(request.pickup_lng)]
            : [59.33, 18.07]

          const map = L.map(mapRef.current).setView(center, 15)
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap',
            maxZoom: 19,
          }).addTo(map)

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
  }, [])

  // Relay own position to the other party via Socket.io
  useEffect(() => {
    if (myLocation) {
      socket.emit('location:update', {
        requestId: request.id,
        lat: myLocation.lat,
        lng: myLocation.lng,
        accuracy: myLocation.accuracy ?? null,
      })
    }
  }, [myLocation, request.id])

  // Listen for location updates from the other party
  useEffect(() => {
    const handleLocationUpdate = ({ requestId, userId, lat, lng }) => {
      if (requestId !== request.id) return
      if (userId !== currentUserId) {
        setOtherLocation({ lat, lng })
      }
    }

    const handleStatusChange = ({ requestId }) => {
      if (requestId === request.id) {
        // Re-fetch to get updated status
        requestService.get(request.id)
          .then(({ request: updated }) => {
            setStatus(updated.status)
            setDoneInitiatedBy(updated.done_initiated_by || null)
          })
          .catch(() => {})
      }
    }

    const handleDoneInitiated = ({ requestId, initiatedBy }) => {
      if (requestId === request.id) {
        setStatus('done_pending')
        setDoneInitiatedBy(initiatedBy)
      }
    }

    const handleDoneRejected = ({ requestId }) => {
      if (requestId === request.id) {
        setStatus('active')
        setDoneInitiatedBy(null)
      }
    }

    const handleExpired = ({ requestId }) => {
      if (requestId === request.id) {
        setStatus('expired')
      }
    }

    socket.on('request:locationUpdate', handleLocationUpdate)
    socket.on('request:completed', handleStatusChange)
    socket.on('request:cancelled', handleStatusChange)
    socket.on('request:done-initiated', handleDoneInitiated)
    socket.on('request:done-rejected', handleDoneRejected)
    socket.on('request:expired', handleExpired)

    return () => {
      socket.off('request:locationUpdate', handleLocationUpdate)
      socket.off('request:completed', handleStatusChange)
      socket.off('request:cancelled', handleStatusChange)
      socket.off('request:done-initiated', handleDoneInitiated)
      socket.off('request:done-rejected', handleDoneRejected)
      socket.off('request:expired', handleExpired)
    }
  }, [request.id, currentUserId])

  // Re-sync request state on reconnect and visibility change.
  // Catches missed socket events during disconnect or background.
  useEffect(() => {
    const refreshState = () => {
      requestService.get(request.id)
        .then(({ request: updated }) => {
          setStatus(updated.status)
          setDoneInitiatedBy(updated.done_initiated_by || null)
        })
        .catch(() => {})
    }

    socket.on('connect', refreshState)

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshState()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      socket.off('connect', refreshState)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [request.id])

  // Update map markers when positions change
  useEffect(() => {
    const L = leafletRef.current
    if (!mapInstance.current || !L) return

    const updateMarker = (id, pos, color) => {
      if (!pos) return
      if (markersRef.current[id]) {
        markersRef.current[id].setLatLng([pos.lat, pos.lng])
      } else {
        const icon = L.divIcon({
          className: 'custom-marker',
          html: `<div style="width:16px;height:16px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3)"></div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        })
        markersRef.current[id] = L.marker([pos.lat, pos.lng], { icon }).addTo(mapInstance.current)
      }
    }

    updateMarker('me', myLocation, '#4f46e5')
    updateMarker('other', otherLocation, '#059669')
  }, [myLocation, otherLocation])

  // Load message history on mount
  useEffect(() => {
    requestService.getMessages(request.id)
      .then(({ messages: msgs }) => setMessages(msgs))
      .catch(() => {})
  }, [request.id])

  // Keep showMessagesRef in sync to avoid re-registering socket listeners on toggle
  useEffect(() => { showMessagesRef.current = showMessages }, [showMessages])

  // Listen for message events
  useEffect(() => {
    const handleReceived = ({ requestId, message }) => {
      if (requestId !== request.id) return
      setMessages((prev) => [...prev, message])
      if (!showMessagesRef.current) setUnreadCount((prev) => prev + 1)
    }
    const handleSent = ({ requestId, message }) => {
      if (requestId !== request.id) return
      setMessages((prev) => [...prev, message])
    }

    socket.on('message:received', handleReceived)
    socket.on('message:sent', handleSent)

    return () => {
      socket.off('message:received', handleReceived)
      socket.off('message:sent', handleSent)
    }
  }, [request.id])

  // Auto-scroll messages to bottom
  useEffect(() => {
    if (showMessages && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, showMessages])

  const sendMessage = (content, isQuick = false) => {
    if (!content.trim()) return
    socket.emit('message:send', {
      requestId: request.id,
      content: content.trim(),
      isQuick,
    })
    setMessageText('')
  }

  const quickMessages = [
    { key: 'onMyWay', text: t('messages.quick.onMyWay') },
    { key: 'almostThere', text: t('messages.quick.almostThere') },
    { key: 'iCanSeeYou', text: t('messages.quick.iCanSeeYou') },
    { key: 'waitingOutside', text: t('messages.quick.waitingOutside') },
    { key: 'delayed', text: t('messages.quick.delayed') },
    { key: 'stayThere', text: t('messages.quick.stayThere') },
  ]

  const handleInitiateDone = async () => {
    try {
      const { request: updated } = await requestService.initiateDone(request.id)
      setStatus(updated.status)
      setDoneInitiatedBy(updated.done_initiated_by)
    } catch (err) {
      console.error('Initiate done error:', err.message)
    }
  }

  const handleAcceptDone = async () => {
    try {
      const { request: updated } = await requestService.acceptDone(request.id)
      setStatus(updated.status)
    } catch (err) {
      console.error('Accept done error:', err.message)
    }
  }

  const handleRejectDone = async () => {
    try {
      const { request: updated } = await requestService.rejectDone(request.id)
      setStatus(updated.status)
      setDoneInitiatedBy(null)
    } catch (err) {
      console.error('Reject done error:', err.message)
    }
  }

  const handleConfirmSafety = async () => {
    try {
      await requestService.confirmSafety(request.id)
      setStatus('safety_confirmed')
    } catch (err) {
      console.error('Confirm safety error:', err.message)
    }
  }

  const handleCancel = async () => {
    try {
      await requestService.cancel(request.id)
      setStatus('cancelled')
    } catch (err) {
      console.error('Cancel error:', err.message)
    }
  }

  // Compute ETA based on straight-line distance at walking speed (5 km/h)
  const eta = (() => {
    if (!myLocation || !otherLocation) return null
    const distKm = haversineKm(myLocation.lat, myLocation.lng, otherLocation.lat, otherLocation.lng)
    const minutes = Math.round((distKm / 5) * 60)
    return minutes < 1 ? 1 : minutes
  })()

  const isTerminal = ['completed', 'safety_confirmed', 'cancelled', 'expired'].includes(status)

  return (
    <div class="fixed inset-0 bg-white z-50 flex flex-col">
      {/* Header */}
      <div class="bg-indigo-600 text-white px-4 py-3 flex items-center justify-between">
        <div>
          <h3 class="font-semibold">{t(`requests.types.${request.type}`)}</h3>
          <p class="text-xs text-indigo-200">
            {isRequester ? t('requests.youRequested') : t('requests.youAreHelper')}
          </p>
        </div>
        <button onClick={onClose} class="p-1">
          <X size={20} />
        </button>
      </div>

      {/* Map */}
      <div ref={mapRef} class="flex-1" />

      {/* Status bar + actions */}
      <div class="bg-white border-t border-gray-200 p-4 safe-area-bottom">
        {/* Location error — safety-critical warning */}
        {geoError && (
          <LocationBanner error={geoError} onRetry={retryGeo} severity="warning" />
        )}
        {geoError && (
          <div class="bg-red-50 border border-red-200 rounded-lg p-3 mb-3 text-center">
            <p class="text-sm font-medium text-red-800">{t('location.sessionWarning')}</p>
          </div>
        )}

        {/* Location indicators */}
        <div class="flex items-center gap-4 text-xs text-gray-500 mb-3">
          <span class="flex items-center gap-1">
            <span class="w-3 h-3 rounded-full bg-indigo-600 inline-block" />
            {t('requests.you')}
          </span>
          <span class="flex items-center gap-1">
            <span class="w-3 h-3 rounded-full bg-emerald-600 inline-block" />
            {isRequester ? t('requests.helper') : t('requests.requester')}
          </span>
          {!otherLocation && (
            <span class="text-gray-400">{t('requests.waitingLocation')}</span>
          )}
        </div>

        {/* ETA */}
        {eta !== null && !isTerminal && (
          <div class="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
            <Clock size={14} />
            <span>{eta <= 1 ? t('requests.etaArriving') : t('requests.eta', { minutes: eta })}</span>
          </div>
        )}

        {/* Message toggle */}
        {!isTerminal && (
          <button
            onClick={() => { setShowMessages(!showMessages); if (!showMessages) setUnreadCount(0) }}
            class="flex items-center gap-2 text-sm text-indigo-600 mb-3"
          >
            <MessageCircle size={16} />
            {t('messages.title')}
            {unreadCount > 0 && (
              <span class="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>
        )}

        {/* Message panel */}
        {showMessages && !isTerminal && (
          <div class="bg-gray-50 rounded-lg border border-gray-200 mb-3 flex flex-col" style="max-height:16rem">
            {/* Message list */}
            <div class="flex-1 overflow-y-auto p-3 space-y-2">
              {messages.length === 0 && (
                <p class="text-xs text-gray-400 text-center py-2">{t('messages.placeholder')}</p>
              )}
              {messages.map((msg) => (
                <div key={msg.id} class={`flex ${msg.senderId === currentUserId ? 'justify-end' : 'justify-start'}`}>
                  <div class={`max-w-3/4 rounded-lg px-3 py-2 text-sm ${
                    msg.senderId === currentUserId
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white text-gray-800 border border-gray-200'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick messages */}
            <div class="px-3 py-2 border-t border-gray-200 flex gap-2 overflow-x-auto flex-shrink-0">
              {quickMessages.map((qm) => (
                <button
                  key={qm.key}
                  onClick={() => sendMessage(qm.text, true)}
                  class="flex-shrink-0 text-xs bg-white border border-gray-200 rounded-full px-3 py-1 text-gray-600 hover:bg-gray-50"
                >
                  {qm.text}
                </button>
              ))}
            </div>

            {/* Text input */}
            <div class="px-3 py-2 border-t border-gray-200 flex gap-2 flex-shrink-0">
              <input
                type="text"
                value={messageText}
                onInput={(e) => setMessageText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') sendMessage(messageText) }}
                placeholder={t('messages.placeholder')}
                maxLength={200}
                class="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <button
                onClick={() => sendMessage(messageText)}
                disabled={!messageText.trim()}
                class="bg-indigo-600 text-white rounded-lg px-3 py-2 disabled:opacity-50"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div class="flex flex-col gap-2">
          {status === 'active' && (
            <button
              onClick={handleInitiateDone}
              class="w-full bg-green-600 text-white px-4 py-3 rounded-lg font-medium flex items-center justify-center gap-2"
            >
              <CheckCircle size={18} />
              {t('requests.done')}
            </button>
          )}

          {status === 'done_pending' && doneInitiatedBy === currentUserId && (
            <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-center">
              <p class="text-sm text-yellow-800 font-medium">{t('requests.doneWaiting')}</p>
            </div>
          )}

          {status === 'done_pending' && doneInitiatedBy && doneInitiatedBy !== currentUserId && (
            <div class="space-y-2">
              <p class="text-sm text-gray-700 font-medium text-center">{t('requests.doneProposal')}</p>
              <div class="flex gap-2">
                <button
                  onClick={handleAcceptDone}
                  class="flex-1 bg-green-600 text-white px-4 py-3 rounded-lg font-medium flex items-center justify-center gap-2"
                >
                  <CheckCircle size={18} />
                  {t('requests.doneAccept')}
                </button>
                <button
                  onClick={handleRejectDone}
                  class="flex-1 bg-gray-100 text-gray-700 px-4 py-3 rounded-lg font-medium"
                >
                  {t('requests.doneReject')}
                </button>
              </div>
            </div>
          )}

          {status === 'expired' && (
            <div class="bg-gray-100 border border-gray-300 rounded-lg p-3 text-center">
              <p class="text-sm text-gray-600 font-medium">{t('requests.expired')}</p>
            </div>
          )}

          {status === 'completed' && isRequester && (
            <button
              onClick={handleConfirmSafety}
              class="w-full bg-emerald-600 text-white px-4 py-3 rounded-lg font-medium flex items-center justify-center gap-2"
            >
              <CheckCircle size={18} />
              {t('requests.confirmSafety')}
            </button>
          )}

          <div class="flex gap-2">
            {!isTerminal && (
              <button
                onClick={handleCancel}
                class="flex-1 px-4 py-3 rounded-lg font-medium text-red-600 border border-red-200"
              >
                {t('requests.cancel')}
              </button>
            )}

            {isTerminal && (
              <button
                onClick={onClose}
                class="flex-1 bg-gray-100 text-gray-700 px-4 py-3 rounded-lg font-medium"
              >
                {t('requests.close')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
