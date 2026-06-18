/**
 * Real BankID provider — BankID REST API v6.0 (Secure Start).
 *
 * Implements the same interface as the stub so it drops in behind the router:
 *   initAuth({ endUserIp, requirement?, userVisibleData? })
 *        → Promise<{ orderRef, autoStartToken, qrStartToken, qrStartSecret }>
 *   collect(orderRef)  → Promise<{ status, hintCode?, user? }>
 *   cancel(orderRef)   → Promise<void>
 *   qr(orderRef)       → string | null   (current animated-QR payload)
 *
 * v6 uses Secure Start: the user starts BankID via the autostart token
 * (same device) or an animated QR code (other device). v6 does NOT accept a
 * personal number in /auth — the verified identity arrives in completionData.
 *
 * Transport is mutual TLS with the RP client certificate. Configured via env,
 * with TEST defaults so it runs against the FREE BankID test environment out of
 * the box once the test cert is in backend/certs/ (see docs/bankid-test.md):
 *   BANKID_API_URL          default https://appapi2.test.bankid.com/rp/v6.0
 *   BANKID_CERT_PATH        default backend/certs/test-client-cert.pem
 *   BANKID_KEY_PATH         default backend/certs/test-client-key.pem
 *   BANKID_CA_PATH          default backend/certs/ca_test.crt
 *   BANKID_CERT_PASSPHRASE  default unset (the test key is unencrypted)
 *
 * Activated by AUTH_PROVIDER=bankid + FEATURE_BANKID_AUTH=true (see router.js).
 * Production = point BANKID_API_URL at https://appapi2.bankid.com/rp/v6.0 and
 * supply a real RP certificate (broker or direct-via-bank — see
 * ../../../../ops/tech/bankid-connection-options.md, private ops repo).
 */

import https from 'node:https'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url))
// backend/src/auth/providers → backend/certs
const CERT_DIR = path.resolve(MODULE_DIR, '../../../certs')

/** Resolve runtime config fresh each call so tests/env changes take effect. */
function config() {
  return {
    apiUrl: (process.env.BANKID_API_URL || 'https://appapi2.test.bankid.com/rp/v6.0').replace(/\/+$/, ''),
    certPath: process.env.BANKID_CERT_PATH || path.join(CERT_DIR, 'test-client-cert.pem'),
    keyPath: process.env.BANKID_KEY_PATH || path.join(CERT_DIR, 'test-client-key.pem'),
    caPath: process.env.BANKID_CA_PATH || path.join(CERT_DIR, 'ca_test.crt'),
    passphrase: process.env.BANKID_CERT_PASSPHRASE || undefined,
  }
}

/**
 * Lazily build the mTLS agent. Lazy (not at import) so the module imports
 * cleanly when certs are absent (e.g. the default stub deployment + tests) and
 * only errors if the BankID provider is actually used.
 */
let agent = null
function getAgent() {
  if (agent) return agent
  const { certPath, keyPath, caPath, passphrase } = config()
  let cert, key, ca
  try {
    cert = fs.readFileSync(certPath)
    key = fs.readFileSync(keyPath)
    ca = fs.readFileSync(caPath)
  } catch (err) {
    throw new Error(
      'BankID RP certificate not configured. Expected cert/key/ca at ' +
        `${certPath} | ${keyPath} | ${caPath}. ` +
        'Run scripts/bankid/setup-test-cert.sh for the free test environment, ' +
        'or set BANKID_CERT_PATH / BANKID_KEY_PATH / BANKID_CA_PATH. ' +
        `(${err.code || err.message})`
    )
  }
  agent = new https.Agent({ cert, key, ca, passphrase, keepAlive: true })
  return agent
}

/** For tests/hot config changes — drop the cached agent. */
export function resetAgent() {
  agent = null
}

/** Low-level JSON POST to the BankID REST API over mTLS. */
function apiPost(endpoint, body) {
  const { apiUrl } = config()
  const url = new URL(`${apiUrl}/${endpoint}`)
  const payload = Buffer.from(JSON.stringify(body))
  return new Promise((resolve, reject) => {
    let req
    try {
      req = https.request(
        {
          method: 'POST',
          hostname: url.hostname,
          port: url.port || 443,
          path: url.pathname,
          agent: getAgent(),
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': payload.length,
          },
          timeout: 15_000,
        },
        (res) => {
          const chunks = []
          res.on('data', (c) => chunks.push(c))
          res.on('end', () => {
            const text = Buffer.concat(chunks).toString('utf8')
            let json = {}
            try {
              json = text ? JSON.parse(text) : {}
            } catch {
              /* non-JSON body — leave {} */
            }
            resolve({ status: res.statusCode, json })
          })
        }
      )
    } catch (err) {
      // getAgent() may throw synchronously when certs are missing.
      return reject(err)
    }
    req.on('timeout', () => req.destroy(new Error('BankID request timed out')))
    req.on('error', reject)
    req.write(payload)
    req.end()
  })
}

/**
 * In-memory order store, needed to generate the animated QR (which depends on
 * the per-order secret + elapsed time). orderRef → { orderTime, qrStartToken,
 * qrStartSecret, autoStartToken }.
 */
const orders = new Map()

// ── Pure, testable helpers (no network, no cert loading) ────────────────────

/**
 * Animated QR payload, per the BankID specification:
 *   qrAuthCode = HMAC_SHA256(qrStartSecret, ascii(elapsedSeconds))   // hex
 *   qrData     = "bankid." + qrStartToken + "." + elapsedSeconds + "." + qrAuthCode
 * Render this as a QR code, refreshed once per second while the order is pending.
 * @param {string} qrStartToken
 * @param {string} qrStartSecret
 * @param {number} elapsedSeconds - whole seconds since the /auth response
 * @returns {string}
 */
export function generateQrData(qrStartToken, qrStartSecret, elapsedSeconds) {
  const sec = Math.max(0, Math.floor(elapsedSeconds))
  const qrAuthCode = crypto
    .createHmac('sha256', qrStartSecret)
    .update(String(sec))
    .digest('hex')
  return `bankid.${qrStartToken}.${sec}.${qrAuthCode}`
}

/**
 * Build the router's expected user object from BankID completionData.
 * The verified personal number is hashed (SHA-256) — the raw NIN is never
 * persisted, matching the GDPR model used everywhere else.
 * @param {object} completionData
 * @returns {{ nin: string, ninHash: string, givenName: string, surname: string, name: string }}
 */
export function buildUserFromCompletion(completionData) {
  const u = (completionData && completionData.user) || {}
  const nin = u.personalNumber
  const givenName = u.givenName || ''
  const surname = u.surname || ''
  const name = u.name || `${givenName} ${surname}`.trim()
  return {
    nin,
    ninHash: crypto.createHash('sha256').update(String(nin)).digest('hex'),
    givenName,
    surname,
    name,
  }
}

/**
 * Map a raw /collect response body onto the provider's collect result shape.
 * @param {object} json - BankID /collect body
 * @returns {{ status: string, hintCode?: string, user?: object }}
 */
export function mapCollect(json) {
  if (!json || !json.status) {
    return { status: 'failed', hintCode: 'invalidParameters' }
  }
  if (json.status === 'complete') {
    return { status: 'complete', user: buildUserFromCompletion(json.completionData) }
  }
  // 'pending' | 'failed'
  return { status: json.status, hintCode: json.hintCode }
}

// ── Provider interface ───────────────────────────────────────────────────────

/**
 * Initiate a BankID authentication order (Secure Start).
 * @param {{ endUserIp: string, requirement?: object, userVisibleData?: string }} params
 * @returns {Promise<{ orderRef, autoStartToken, qrStartToken, qrStartSecret }>}
 */
export async function initAuth({ endUserIp, requirement, userVisibleData } = {}) {
  if (!endUserIp) throw new Error('BankID initAuth requires endUserIp')

  const body = { endUserIp }
  if (requirement) body.requirement = requirement
  if (userVisibleData) {
    body.userVisibleData = Buffer.from(userVisibleData, 'utf8').toString('base64')
  }

  const { status, json } = await apiPost('auth', body)
  if (status !== 200 || !json.orderRef) {
    const detail = json.errorCode
      ? `${json.errorCode}: ${json.details || ''}`.trim()
      : `HTTP ${status}`
    throw new Error(`BankID /auth failed (${detail})`)
  }

  orders.set(json.orderRef, {
    orderTime: Date.now(),
    qrStartToken: json.qrStartToken,
    qrStartSecret: json.qrStartSecret,
    autoStartToken: json.autoStartToken,
  })

  return {
    orderRef: json.orderRef,
    autoStartToken: json.autoStartToken,
    qrStartToken: json.qrStartToken,
    qrStartSecret: json.qrStartSecret,
  }
}

/**
 * Poll the status of an ongoing order.
 * @param {string} orderRef
 * @returns {Promise<{ status: string, hintCode?: string, user?: object }>}
 */
export async function collect(orderRef) {
  const { status, json } = await apiPost('collect', { orderRef })

  if (status !== 200) {
    // e.g. 400 invalidParameters (unknown/expired orderRef) → terminal failure
    orders.delete(orderRef)
    return { status: 'failed', hintCode: json.errorCode || 'invalidParameters' }
  }

  const result = mapCollect(json)
  if (result.status === 'complete' || result.status === 'failed') {
    orders.delete(orderRef)
  }
  return result
}

/**
 * Cancel an ongoing order (best-effort — local cleanup always happens).
 * @param {string} orderRef
 * @returns {Promise<void>}
 */
export async function cancel(orderRef) {
  orders.delete(orderRef)
  try {
    await apiPost('cancel', { orderRef })
  } catch {
    /* best-effort: the local order is already gone */
  }
}

/**
 * Current animated-QR payload for an order, or null if unknown/cleaned up.
 * @param {string} orderRef
 * @returns {string|null}
 */
export function qr(orderRef) {
  const o = orders.get(orderRef)
  if (!o || !o.qrStartToken || !o.qrStartSecret) return null
  const elapsed = (Date.now() - o.orderTime) / 1000
  return generateQrData(o.qrStartToken, o.qrStartSecret, elapsed)
}
