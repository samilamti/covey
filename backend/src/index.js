import express from 'express'
import { createServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import helmet from 'helmet'
import cors from 'cors'
import { apiRouter } from './api.js'
import { registerSocketHandlers } from './handlers.js'
import { startExpirationWorker } from './workers/expiration.js'
import { startGdprCleanupWorker } from './workers/gdpr-cleanup.js'
import { migrate } from './migrate.js'

// --- Run migrations before anything else ---
// Guarantees all tables exist before the server accepts traffic or workers query the DB.
// Safe to call every startup — uses CREATE TABLE IF NOT EXISTS and tracks applied migrations.
await migrate()

const app = express()
app.set('trust proxy', 1) // Trust Traefik reverse proxy for correct req.ip
const httpServer = createServer(app)

// --- Socket.io ---
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
  // Start on long-polling, upgrade to WebSocket — handles old Android browsers
  transports: ['polling', 'websocket'],
})

registerSocketHandlers(io)

// Share io with Express route handlers (accessible via req.app.get('io'))
app.set('io', io)

// --- Middleware ---
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "https://*.tile.openstreetmap.org", "data:"],
      connectSrc: ["'self'", "wss:", "ws:"],
      fontSrc: ["'self'"],
      workerSrc: ["'self'"],
    },
  },
}))
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }))
app.use(express.json())

// --- Routes ---
app.use('/api', apiRouter)

// --- Health check (used by docker-compose and load balancers) ---
app.get('/api/health', (_req, res) => res.json({ ok: true }))

// --- Start ---
const PORT = process.env.PORT || 3000
httpServer.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`)
  // Start background workers (tables guaranteed to exist after migrate())
  startExpirationWorker(io)
  startGdprCleanupWorker()
})
