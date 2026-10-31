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
import { assertNinHashKey } from './auth/nin-hash.js'
import * as reqRepo from './repositories/requests.js'
import { log } from './logger.js'
import { httpLogger, errorLogger } from './middleware/logging.js'
import { requestId } from './middleware/request-id.js'
import { db } from './pool.js'
import { readyHandler } from './routes/health.js'
import { getBuildInfo } from './build-info.js'
import { createShutdown } from './shutdown.js'
import { attachProcessErrorHandlers } from './process-errors.js'

// --- Identify this build at startup ---
// Operators grep the log stream to see which version/commit is running
// after a deploy; cheaper and less racy than hitting an endpoint right after
// `docker compose up`. Emitted before any work so it anchors the stream.
log.info('backend_build', { event: 'backend_build', ...getBuildInfo() })

// --- Refuse to run production without the personnummer HMAC key ---
// Without it every login would store a reversible SHA-256 (auth/nin-hash.js).
assertNinHashKey()

// --- Run migrations before anything else ---
// Guarantees all tables exist before the server accepts traffic or workers query the DB.
// Safe to call every startup — uses CREATE TABLE IF NOT EXISTS and tracks applied migrations.
await migrate()

// --- Cleanup terminal requests from previous sessions ---
try {
  const deletedCount = await reqRepo.deleteTerminal()
  if (deletedCount > 0) {
    log.info('startup_cleanup', { event: 'startup_cleanup', deleted: deletedCount })
  }
} catch (err) {
  // Pass the Error instance so the stack is preserved and the event tag is
  // stable for a log aggregator, matching every other error line.
  log.error(err, { event: 'startup_cleanup_failed' })
}

const app = express()
app.set('trust proxy', 1) // Trust Traefik reverse proxy for correct req.ip
const httpServer = createServer(app)

// --- CORS origins ---
// Include Capacitor native origins alongside the configured web origin.
const allowedOrigins = [
  process.env.CORS_ORIGIN || 'http://localhost:5173',
  'capacitor://localhost',  // iOS Capacitor
  'http://localhost',        // Android Capacitor
]

function corsOriginCheck(origin, callback) {
  // Allow requests with no origin (mobile apps, server-to-server)
  if (!origin) return callback(null, true)
  if (allowedOrigins.includes(origin)) return callback(null, true)
  callback(new Error('Not allowed by CORS'))
}

// --- Socket.io ---
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: corsOriginCheck,
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
app.use(cors({ origin: corsOriginCheck }))
// requestId and httpLogger go before the body parser, so a malformed or
// oversized body still gets an id and an access-log line.
app.use(requestId())
app.use(httpLogger())
app.use(express.json())

// --- Routes ---
app.use('/api', apiRouter)

// --- Health checks ---
// `/api/health` is pure liveness: the deploy script byte-compares the body
// against the literal string `{"ok":true}`, so this response must stay
// exactly this shape.
app.get('/api/health', (_req, res) => res.json({ ok: true }))
// `/api/health/ready` is readiness: pings the DB with a short timeout so a
// load balancer can tell when the backend is up but its dependency is gone.
app.get('/api/health/ready', readyHandler({ pool: db }))

// --- Safety-net error handler (routes catch their own with specific events;
// this covers anything that still leaks through so operators see a structured
// line instead of Express's default HTML). ---
app.use(errorLogger())

// --- Start ---
const PORT = process.env.PORT || 3000
httpServer.listen(PORT, () => {
  log.info('backend_listening', { event: 'backend_listening', port: Number(PORT) })
  // Start background workers (tables guaranteed to exist after migrate())
  startExpirationWorker(io)
  startGdprCleanupWorker()
})

// --- Graceful shutdown ---
// Docker sends SIGTERM when a container stops; without a handler, in-flight
// requests are dropped and the browser sees a 502 across a deploy. SIGINT is
// the local Ctrl-C case. See src/shutdown.js for the sequence.
const shutdown = createShutdown({ httpServer, io, log })
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

// --- Fatal error handlers ---
// A sync throw in a worker/timer/socket handler or an unhandled rejection
// would otherwise exit with a bare Node stack trace, bypassing the structured
// `event:` tags the rest of the backend emits. Route both through the shared
// logger with stable tags and reuse the graceful shutdown so in-flight
// requests still get drained.
attachProcessErrorHandlers({ log, shutdown })
