// Minimal mock of the Tillsammans backend for screenshot capture — no
// Docker/Postgres needed. Serves just enough of the API for the logged-in
// web UI to render: stub auth, feature flags, open requests, points/badges,
// profile, socket.io. Reuses express + socket.io from backend/node_modules.
// Gotcha that cost a debug round: every endpoint a view touches must return
// the REAL response shape — a `{}` catch-all made `pendingRatings` undefined
// and crashed RequestList's render mid-commit (blank list, no error shown).
// Usage: see capture.mjs header.
import { createRequire } from 'module'
import http from 'http'
const require = createRequire(new URL('../../backend/package.json', import.meta.url))
const express = require('express')
const { Server } = require('socket.io')

const DEMO_USER = {
  userId: '2b6f8a1e-4c3d-4e5f-9a7b-1c2d3e4f5a6b',
  id: '2b6f8a1e-4c3d-4e5f-9a7b-1c2d3e4f5a6b',
  name: 'Kim Andersson',
  givenName: 'Kim',
  surname: 'Andersson',
  displayName: 'Kim',
  sex: 'female',
  birthYear: 1995,
  safetyScore: 7,
}

// Stockholm City centre-ish; requests ~400-900m away
const REQUESTS = [
  {
    id: 'a1111111-1111-4111-8111-111111111111',
    requester_id: 'b2222222-2222-4222-8222-222222222222',
    helper_id: null,
    community_id: null,
    status: 'open',
    type: 'walk',
    message: 'Går hem från T-centralen vid 22:30, sällskap sista biten?',
    eligibility_tier: 'same_demographics',
    pickup_lat: 59.3320,
    pickup_lng: 18.0640,
    created_at: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
    requester_display_name: 'Elin',
    display_name: 'Elin',
  },
  {
    id: 'c3333333-3333-4333-8333-333333333333',
    requester_id: 'd4444444-4444-4444-8444-444444444444',
    helper_id: null,
    community_id: null,
    status: 'open',
    type: 'wait',
    message: 'Sen kväll på jobbet, promenad mot Södermalm ihop?',
    eligibility_tier: 'same_demographics',
    pickup_lat: 59.3240,
    pickup_lng: 18.0720,
    created_at: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
    requester_display_name: 'Sara',
    display_name: 'Sara',
  },
]

const BADGES = [
  { key: 'first_session', earned: true, visible: true },
  { key: 'helper_5', earned: true, visible: true },
  { key: 'helper_20', earned: false, visible: false },
  { key: 'helper_50', earned: false, visible: false },
  { key: 'points_50', earned: true, visible: false },
  { key: 'points_200', earned: false, visible: false },
  { key: 'points_500', earned: false, visible: false },
]

const HISTORY = [
  { id: 'h1', role: 'helper', points: 10, created_at: new Date(Date.now() - 1 * 864e5).toISOString() },
  { id: 'h2', role: 'helper', points: 10, created_at: new Date(Date.now() - 3 * 864e5).toISOString() },
  { id: 'h3', role: 'requester', points: 3, created_at: new Date(Date.now() - 5 * 864e5).toISOString() },
  { id: 'h4', role: 'helper', points: 10, created_at: new Date(Date.now() - 9 * 864e5).toISOString() },
  { id: 'h5', role: 'helper', points: 10, created_at: new Date(Date.now() - 12 * 864e5).toISOString() },
]

const app = express()
app.use(express.json())

app.post('/api/auth/login', (req, res) => res.json({ orderRef: 'demo-order' }))
app.post('/api/auth/collect', (req, res) =>
  res.json({ status: 'complete', completionData: { user: DEMO_USER, token: 'demo-token' } }))
app.post('/api/auth/verify', (req, res) => res.json({ user: DEMO_USER }))
app.post('/api/auth/cancel', (req, res) => res.json({ ok: true }))
app.post('/api/auth/logout', (req, res) => res.json({ ok: true }))

app.get('/api/features', (req, res) =>
  res.json({ flags: { GEOLOCATION: true, POINTS_SYSTEM: true, BANKID_AUTH: false } }))

app.get('/api/requests/open', (req, res) => res.json({ requests: REQUESTS }))
app.get('/api/requests', (req, res) => res.json({ requests: [] }))

app.get('/api/points', (req, res) =>
  res.json({ totalPoints: 63, helperSessions: 6, requesterSessions: 1, totalSessions: 7, badgesEarned: 3, badgesTotal: 7 }))
app.get('/api/points/badges', (req, res) => res.json({ badges: BADGES }))
app.get('/api/points/history', (req, res) => res.json({ history: HISTORY }))

app.get('/api/ratings/pending', (req, res) => res.json({ pending: [] }))

app.get('/api/profile', (req, res) => res.json({ user: DEMO_USER }))

app.post('/api/notifications/subscribe', (req, res) => res.json({ ok: true }))
app.get('/api/notifications/vapid-public-key', (req, res) => res.json({ publicKey: '' }))

// Catch-all so unexpected calls don't 404-crash a view
app.use('/api', (req, res) => res.json({}))

const httpServer = http.createServer(app)
const io = new Server(httpServer, { transports: ['polling', 'websocket'] })
io.on('connection', () => { /* accept anything, emit nothing */ })

httpServer.listen(3000, () => console.log('mock backend on :3000'))
