/**
 * Block and report API client.
 */

import { API_BASE } from '../config.js'

const API_URL = `${API_BASE}/api/safety`

function authHeaders() {
  const token = localStorage.getItem('token')
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

export const safetyService = {
  async getPartners() {
    const res = await fetch(`${API_URL}/partners`, { headers: authHeaders() })
    if (!res.ok) throw new Error('Failed to get partners')
    return res.json()
  },

  async block(userId) {
    const res = await fetch(`${API_URL}/blocks`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ userId }),
    })
    if (!res.ok) throw new Error('Failed to block')
    return res.json()
  },

  async unblock(userId) {
    const res = await fetch(`${API_URL}/blocks/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
      headers: authHeaders(),
    })
    if (!res.ok) throw new Error('Failed to unblock')
    return res.json()
  },

  async report({ userId, reason, details, requestId, block }) {
    const res = await fetch(`${API_URL}/reports`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ userId, reason, details, requestId, block }),
    })
    if (!res.ok) throw new Error('Failed to report')
    return res.json()
  },
}
