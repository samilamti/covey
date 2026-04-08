import { io } from 'socket.io-client'
import { API_BASE } from './config.js'

/**
 * Singleton Socket.io client.
 *
 * autoConnect is false — the App component connects after login
 * by calling socket.auth = { token } then socket.connect().
 *
 * In dev, Vite proxies /socket.io → localhost:3000.
 * In production, the request goes to the same origin (Traefik routes it).
 * In Capacitor native, API_BASE provides the full server URL.
 */
export const socket = io(API_BASE || undefined, {
  path: '/socket.io',
  // Upgrade to WebSocket once connected; fall back to polling on old Android
  transports: ['polling', 'websocket'],
  autoConnect: false,
})
