/**
 * Request API client.
 */

const API_URL = '/api/requests'

function authHeaders() {
  const token = localStorage.getItem('token')
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

export const requestService = {
  async create({ communityId, type, message, pickupLat, pickupLng, destinationLat, destinationLng, eligibilityTier }) {
    const body = { type, message, pickupLat, pickupLng, destinationLat, destinationLng }
    if (communityId) body.communityId = communityId
    if (eligibilityTier) body.eligibilityTier = eligibilityTier
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error('Failed to create request')
    return res.json()
  },

  async list() {
    const res = await fetch(API_URL, { headers: authHeaders() })
    if (!res.ok) throw new Error('Failed to list requests')
    return res.json()
  },

  async get(id) {
    const res = await fetch(`${API_URL}/${id}`, { headers: authHeaders() })
    if (!res.ok) throw new Error('Failed to get request')
    return res.json()
  },

  async listOpen() {
    const res = await fetch(`${API_URL}/open`, { headers: authHeaders() })
    if (!res.ok) throw new Error('Failed to list open requests')
    return res.json()
  },

  async listByCommunity(communityId) {
    const res = await fetch(`${API_URL}/community/${communityId}`, { headers: authHeaders() })
    if (!res.ok) throw new Error('Failed to list community requests')
    return res.json()
  },

  async accept(id) {
    const res = await fetch(`${API_URL}/${id}/accept`, {
      method: 'POST',
      headers: authHeaders(),
    })
    if (!res.ok) throw new Error('Failed to accept request')
    return res.json()
  },

  async start(id) {
    const res = await fetch(`${API_URL}/${id}/start`, {
      method: 'POST',
      headers: authHeaders(),
    })
    if (!res.ok) throw new Error('Failed to start session')
    return res.json()
  },

  async complete(id) {
    const res = await fetch(`${API_URL}/${id}/complete`, {
      method: 'POST',
      headers: authHeaders(),
    })
    if (!res.ok) throw new Error('Failed to complete session')
    return res.json()
  },

  async confirmSafety(id) {
    const res = await fetch(`${API_URL}/${id}/confirm-safety`, {
      method: 'POST',
      headers: authHeaders(),
    })
    if (!res.ok) throw new Error('Failed to confirm safety')
    return res.json()
  },

  async getMessages(id) {
    const res = await fetch(`${API_URL}/${id}/messages`, { headers: authHeaders() })
    if (!res.ok) throw new Error('Failed to load messages')
    return res.json()
  },

  async initiateDone(id) {
    const res = await fetch(`${API_URL}/${id}/done`, {
      method: 'POST',
      headers: authHeaders(),
    })
    if (!res.ok) throw new Error('Failed to initiate done')
    return res.json()
  },

  async acceptDone(id) {
    const res = await fetch(`${API_URL}/${id}/done/accept`, {
      method: 'POST',
      headers: authHeaders(),
    })
    if (!res.ok) throw new Error('Failed to accept done')
    return res.json()
  },

  async rejectDone(id) {
    const res = await fetch(`${API_URL}/${id}/done/reject`, {
      method: 'POST',
      headers: authHeaders(),
    })
    if (!res.ok) throw new Error('Failed to reject done')
    return res.json()
  },

  async cancel(id) {
    const res = await fetch(`${API_URL}/${id}/cancel`, {
      method: 'POST',
      headers: authHeaders(),
    })
    if (!res.ok) throw new Error('Failed to cancel request')
    return res.json()
  },
}
