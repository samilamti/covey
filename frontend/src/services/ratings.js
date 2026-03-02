/**
 * Rating API client.
 */

const API_URL = '/api/ratings'

function authHeaders() {
  const token = localStorage.getItem('token')
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

export const ratingService = {
  async getPending() {
    const res = await fetch(`${API_URL}/pending`, { headers: authHeaders() })
    if (!res.ok) throw new Error('Failed to get pending ratings')
    return res.json()
  },

  async submit({ requestId, value }) {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ requestId, value }),
    })
    if (!res.ok) throw new Error('Failed to submit rating')
    return res.json()
  },
}
