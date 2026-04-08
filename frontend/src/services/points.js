/**
 * Points & progress API client.
 */

import { API_BASE } from '../config.js'

const API_URL = `${API_BASE}/api/points`

function authHeaders() {
  const token = localStorage.getItem('token')
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

export const pointsService = {
  async getSummary() {
    const res = await fetch(API_URL, { headers: authHeaders() })
    if (!res.ok) throw new Error('Failed to get points')
    return res.json()
  },

  async getHistory({ limit = 20, offset = 0 } = {}) {
    const res = await fetch(`${API_URL}/history?limit=${limit}&offset=${offset}`, {
      headers: authHeaders(),
    })
    if (!res.ok) throw new Error('Failed to get history')
    return res.json()
  },

  async getBadges() {
    const res = await fetch(`${API_URL}/badges`, { headers: authHeaders() })
    if (!res.ok) throw new Error('Failed to get badges')
    return res.json()
  },

  async setBadgeVisibility(badgeKey, visible) {
    const res = await fetch(`${API_URL}/badges/${badgeKey}/visibility`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ visible }),
    })
    if (!res.ok) throw new Error('Failed to update badge')
    return res.json()
  },
}
