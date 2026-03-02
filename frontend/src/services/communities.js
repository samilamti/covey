/**
 * Community API client.
 */

const API_URL = '/api/communities'

function authHeaders() {
  const token = localStorage.getItem('token')
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

export const communityService = {
  async list() {
    const res = await fetch(API_URL, { headers: authHeaders() })
    if (!res.ok) throw new Error('Failed to list communities')
    return res.json()
  },

  async get(id) {
    const res = await fetch(`${API_URL}/${id}`, { headers: authHeaders() })
    if (!res.ok) throw new Error('Failed to get community')
    return res.json()
  },

  async nearby(lat, lng) {
    const res = await fetch(`${API_URL}/nearby?lat=${lat}&lng=${lng}`, {
      headers: authHeaders(),
    })
    if (!res.ok) throw new Error('Failed to discover nearby')
    return res.json()
  },

  async create({ name, description, latitude, longitude, areaName }) {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ name, description, latitude, longitude, areaName }),
    })
    if (!res.ok) throw new Error('Failed to create community')
    return res.json()
  },

  async requestJoin(id) {
    const res = await fetch(`${API_URL}/${id}/request-join`, {
      method: 'POST',
      headers: authHeaders(),
    })
    if (!res.ok) throw new Error('Failed to request join')
    return res.json()
  },

  async leave(id) {
    const res = await fetch(`${API_URL}/${id}/leave`, {
      method: 'POST',
      headers: authHeaders(),
    })
    if (!res.ok) throw new Error('Failed to leave community')
    return res.json()
  },

  async getMembers(id) {
    const res = await fetch(`${API_URL}/${id}/members`, { headers: authHeaders() })
    if (!res.ok) throw new Error('Failed to get members')
    return res.json()
  },

  async getPending(id) {
    const res = await fetch(`${API_URL}/${id}/pending`, { headers: authHeaders() })
    if (!res.ok) throw new Error('Failed to get pending')
    return res.json()
  },

  async approve(communityId, userId) {
    const res = await fetch(`${API_URL}/${communityId}/approve/${userId}`, {
      method: 'POST',
      headers: authHeaders(),
    })
    if (!res.ok) throw new Error('Failed to approve')
    return res.json()
  },

  async reject(communityId, userId) {
    const res = await fetch(`${API_URL}/${communityId}/reject/${userId}`, {
      method: 'POST',
      headers: authHeaders(),
    })
    if (!res.ok) throw new Error('Failed to reject')
    return res.json()
  },
}
