/**
 * GDPR API client.
 */

import { API_BASE } from '../config.js'

function authHeaders() {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export const gdprService = {
  async exportData() {
    const res = await fetch(`${API_BASE}/api/gdpr/export`, { headers: authHeaders() })
    if (!res.ok) throw new Error('Failed to export data')
    return res.json()
  },
}
