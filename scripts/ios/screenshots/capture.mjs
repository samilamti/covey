#!/usr/bin/env node
/**
 * Seed a local Covey backend with Swedish demo content, then direct a
 * screenshot-mode build of the app through the App Store scenes and capture them.
 *
 * Run by scripts/ios/08-screenshots.sh, which has already started the backend,
 * built the app with VITE_SCREENSHOT_MODE=1 and installed it on the simulator.
 * Usage:
 *   node capture.mjs --api http://localhost:3000 --db <DATABASE_URL> \
 *        --director-port 3999 --udid <sim udid> --bundle se.covey.app --out <dir>
 *
 * How the app is driven: this script serves GET /scene and POST /ready on
 * --director-port. The screenshot build (frontend/src/screenshot-mode.js) polls
 * /scene, applies the session token, runs the scene's DOM steps and reports
 * back. No taps, no window coordinates, so it runs unattended.
 *
 * Content rules worth keeping:
 *   - Swedish text goes in through the API. The simulator's text input is
 *     printable ASCII only and silently drops å/ä/ö.
 *   - Everyone is male, born within ±5 years of the persona (1990), so the
 *     default same_demographics tier lets the persona see and accept their
 *     requests. In a NIN the second-to-last digit is odd for men.
 *   - The persona signs in with its real NIN, never the 999999999999 easter egg,
 *     which switches on the mint DEMO theme.
 *   - The helper's live position reaches the map only over Socket.io
 *     (request:locationUpdate), so a socket client emits location:update.
 */
import http from 'node:http'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkShot } from './png-check.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const APP = resolve(HERE, '../../..')
const pg = createRequire(join(APP, 'backend/package.json'))('pg')
const { io } = createRequire(join(APP, 'frontend/package.json'))('socket.io-client')

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  if (i !== -1) return process.argv[i + 1]
  if (fallback === undefined) throw new Error(`--${name} is required`)
  return fallback
}
const API = arg('api')
const DB_URL = arg('db')
const PORT = Number(arg('director-port', '3999'))
const UDID = arg('udid')
const OUT = arg('out')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const log = (m) => console.log(`▶ ${m}`)

// --- People and places ---------------------------------------------------

const HOME = { lat: 59.3430, lng: 18.0490 } // Odenplan

const PERSONA = { nin: '199001011234', name: 'Sami' }
const PEOPLE = {
  erik: { nin: '198804223451', name: 'Erik' },
  oskar: { nin: '199106155513', name: 'Oskar' },
  linus: { nin: '198911027877', name: 'Linus' },
  anton: { nin: '198712304191', name: 'Anton' },
  johan: { nin: '199203089836', name: 'Johan' },
}

// Open requests from other people, shown on the persona's list. Order matters:
// newest first is how the list sorts them.
const OPEN_REQUESTS = [
  // Open listings round coordinates to ~111 m (3 decimals), so an offset smaller
  // than that reads "~0m bort". 0.001° of longitude here is ~57 m.
  { who: 'erik', type: 'walk', minutesAgo: 4, at: { lat: 59.3430, lng: 18.0500 },
    message: 'Kommer med sista bussen till Odenplan och vill inte gå sista biten hem ensam.' },
  { who: 'oskar', type: 'wait', minutesAgo: 12, at: { lat: 59.3322, lng: 18.0296 },
    message: 'Väntar på nattbussen vid Fridhemsplan. Känns tryggare att inte stå här själv.' },
  { who: 'linus', type: 'walk', minutesAgo: 25, at: { lat: 59.3396, lng: 18.0371 },
    message: 'Slutar jobbet sent vid Sankt Eriksplan. Någon som går åt Vasastan-hållet?' },
  { who: 'anton', type: 'walk', minutesAgo: 38, at: { lat: 59.3405, lng: 18.0585 },
    message: 'Ska gå från tunnelbanan hem, ungefär tio minuter. Sällskap uppskattas.' },
]

const CREATE_MESSAGE = 'Kommer med sista bussen till Odenplan om tio minuter. Vill inte promenera hem ensam.'
const HELPER_AT = { lat: 59.34325, lng: 18.0494 } // ~35 m away, close enough for name tooltips

// --- API helpers -----------------------------------------------------------

async function api(method, path, { token, body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${text.slice(0, 300)}`)
  return text ? JSON.parse(text) : {}
}

// /login and /verify share one 10-per-minute bucket per IP, and the app calls
// /verify on every boot with a token. Keep our own count and wait rather than 429.
const authCalls = []
async function spendAuth() {
  for (;;) {
    const now = Date.now()
    while (authCalls.length && now - authCalls[0] > 61000) authCalls.shift()
    if (authCalls.length < 9) { authCalls.push(now); return }
    const wait = 61000 - (now - authCalls[0])
    log(`auth rate limit: waiting ${Math.ceil(wait / 1000)}s`)
    await sleep(wait)
  }
}

async function signIn(person) {
  await spendAuth()
  const { orderRef } = await api('POST', '/api/auth/login', { body: { nin: person.nin } })
  for (let i = 0; i < 20; i++) {
    await sleep(800)
    const r = await api('POST', '/api/auth/collect', { body: { orderRef } })
    if (r.status === 'complete') {
      person.token = r.completionData.token
      person.id = r.completionData.user.userId
      await api('PUT', '/api/profile', { token: person.token, body: { displayName: person.name } })
      return person
    }
    if (r.status === 'failed') throw new Error(`stub login failed for ${person.name}: ${r.hintCode}`)
  }
  throw new Error(`stub login for ${person.name} never completed`)
}

async function createRequest(person, { type, message, at, eligibilityTier = 'same_demographics' }) {
  const { request } = await api('POST', '/api/requests', {
    token: person.token,
    body: { type, message, pickupLat: at.lat, pickupLng: at.lng, eligibilityTier },
  })
  return request
}

// --- Director server ------------------------------------------------------

let scene = { seq: 0, token: null, position: HOME, steps: [] }
let waiting = null

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 'no-store')
  if (req.method === 'GET' && req.url.startsWith('/scene')) {
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(scene))
    return
  }
  if (req.method === 'POST' && req.url.startsWith('/ready')) {
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      res.end('ok')
      try {
        const report = JSON.parse(body)
        if (waiting && report.seq === waiting.seq) waiting.resolve(report)
      } catch {}
    })
    return
  }
  res.statusCode = 404
  res.end()
})

async function play(next, timeoutMs = 60000) {
  // A token change or reload makes the app call /verify once.
  if (next.token && (next.reload || next.token !== scene.token)) await spendAuth()
  scene = { position: HOME, steps: [], ...next, seq: scene.seq + 1 }
  let timer
  const report = await new Promise((resolve, reject) => {
    waiting = { seq: scene.seq, resolve }
    timer = setTimeout(() => reject(new Error(`scene "${next.name}" got no report in ${timeoutMs / 1000}s — is the app running a screenshot build?`)), timeoutMs)
  }).finally(() => clearTimeout(timer))
  waiting = null
  if (!report.ok) throw new Error(`scene "${next.name}": ${report.error}`)
  return report
}

// --- Scenes -----------------------------------------------------------------

const FORBIDDEN = ['Laddar', 'Något gick fel', 'DEMO']

async function shoot(file, next, expect) {
  log(`scene ${next.name}`)
  const report = await play(next)
  if (report.mint) throw new Error(`scene "${next.name}": mint demo theme is on`)
  for (const t of expect) if (!report.text.includes(t)) throw new Error(`scene "${next.name}": expected "${t}" on screen`)
  for (const t of FORBIDDEN) if (report.text.includes(t)) throw new Error(`scene "${next.name}": "${t}" on screen`)
  await sleep(next.settleMs ?? 1200)
  const path = join(OUT, file)
  execFileSync('xcrun', ['simctl', 'io', UDID, 'screenshot', '--type=png', path], { stdio: 'ignore' })
  const { width, height, ink, mint } = checkShot(path)
  console.log(`✓ ${file}  ${width}x${height}  status-bar ink ${ink}px  mint-ish ${mint}px`)
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  await new Promise((r) => server.listen(PORT, '127.0.0.1', r))
  log(`director on http://localhost:${PORT}`)

  // Seed
  log('seeding people')
  const persona = await signIn({ ...PERSONA })
  const people = {}
  for (const [key, p] of Object.entries(PEOPLE)) people[key] = await signIn({ ...p })

  log('seeding open requests')
  const db = new pg.Client({ connectionString: DB_URL })
  await db.connect()
  for (const r of OPEN_REQUESTS) {
    const req = await createRequest(people[r.who], r)
    await db.query(
      `UPDATE assistance_requests SET created_at = NOW() - make_interval(mins => $2) WHERE id = $1`,
      [req.id, r.minutesAgo],
    )
  }

  // 1. Landing, signed out
  await shoot('01-landing.png', {
    name: 'landing', token: null,
    steps: [{ waitFor: 'body', text: 'Välkommen till Covey' }],
  }, ['Välkommen till Covey'])

  // 2. The persona's list of open requests nearby
  await shoot('02-requests.png', {
    name: 'requests', token: persona.token,
    steps: [{ waitFor: 'button', text: 'Jag hjälper till!' }],
  }, ['Öppna förfrågningar', OPEN_REQUESTS[0].message])

  // 4. Create-request form, message filled in (captured before the session exists)
  await shoot('04-create.png', {
    name: 'create', token: persona.token, reload: true,
    steps: [
      { waitFor: 'button', text: 'Jag hjälper till!' },
      { click: 'button', text: 'Ny förfrågan' },
      { fill: 'textarea', value: CREATE_MESSAGE },
      { sleep: 300 },
    ],
  }, ['Skicka förfrågan'])

  // 5. Profile
  await shoot('05-profile.png', {
    name: 'profile', token: persona.token,
    steps: [
      { click: 'nav button', text: 'Profil' },
      { waitFor: 'body', text: 'Trygghetspoäng' },
      { sleep: 500 },
    ],
  }, ['Min profil', 'BankID-verifierad'])

  // 3. Active session: the persona asked, Johan accepted and is walking over
  log('seeding the active session')
  const mine = await createRequest(persona, { type: 'walk', message: CREATE_MESSAGE, at: HOME })
  await api('POST', `/api/requests/${mine.id}/accept`, { token: people.johan.token })
  const helper = io(API, { auth: { token: people.johan.token }, transports: ['websocket'] })
  await new Promise((r, j) => { helper.on('connect', r); helper.on('connect_error', j) })
  const emit = () => helper.emit('location:update', { requestId: mine.id, lat: HELPER_AT.lat, lng: HELPER_AT.lng, accuracy: 8 })
  emit()
  const beat = setInterval(emit, 2000)
  try {
    await shoot('03-active-map.png', {
      name: 'active', token: persona.token, reload: true, settleMs: 4000, // map tiles
      steps: [
        { waitFor: '.leaflet-container' },
        { waitFor: '.leaflet-tooltip', text: 'Johan' },
        { sleep: 1500 },
      ],
    }, ['Markera som klar'])
  } finally {
    clearInterval(beat)
    helper.close()
  }

  await db.end()
  server.close()
  log(`done: ${OUT}`)
}

main().catch((err) => {
  console.error(`✗ ${err.message}`)
  process.exit(1)
})
