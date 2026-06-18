import { API_BASE } from '../config.js'

const API_URL = `${API_BASE}/api/auth`;

export const authService = {
  async login(nin) {
    const res = await fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nin }),
    });
    if (!res.ok) throw new Error('Login failed');
    return res.json();
  },

  async collect(orderRef) {
    const res = await fetch(`${API_URL}/collect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderRef }),
    });
    if (!res.ok) throw new Error('Collect failed');
    return res.json();
  },

  async qr(orderRef) {
    const res = await fetch(`${API_URL}/qr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderRef }),
    });
    if (!res.ok) throw new Error('QR failed');
    return res.json();
  },

  async cancel(orderRef) {
    const res = await fetch(`${API_URL}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderRef }),
    });
    if (!res.ok) throw new Error('Cancel failed');
    return res.json();
  },

  async verify(token) {
    const res = await fetch(`${API_URL}/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) throw new Error('Verification failed');
    return res.json();
  },
};
