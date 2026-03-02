/**
 * Profile API client.
 */

const API_URL = '/api/profile'

function authHeaders() {
  const token = localStorage.getItem('token')
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

export const profileService = {
  async get() {
    const res = await fetch(API_URL, { headers: authHeaders() })
    if (!res.ok) throw new Error('Failed to get profile')
    return res.json()
  },

  async update({ displayName, preferredLang }) {
    const res = await fetch(API_URL, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ displayName, preferredLang }),
    })
    if (!res.ok) throw new Error('Failed to update profile')
    return res.json()
  },

  async deleteAccount() {
    const res = await fetch(API_URL, {
      method: 'DELETE',
      headers: authHeaders(),
    })
    if (!res.ok) throw new Error('Failed to delete account')
    return res.json()
  },

  async getPublicProfile(userId) {
    const res = await fetch(`${API_URL}/${userId}`, { headers: authHeaders() })
    if (!res.ok) throw new Error('Failed to get public profile')
    return res.json()
  },
}
