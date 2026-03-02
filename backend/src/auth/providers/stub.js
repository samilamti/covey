/**
 * Stub BankID provider.
 *
 * Simulates realistic BankID behavior for end-to-end testing.
 *
 * Time-based state progression:
 *   0–1.5s → pending / outstandingTransaction
 *   1.5–3s → pending / userSign
 *   >3s    → complete (returns user data)
 *
 * Error simulation by NIN prefix:
 *   000* → userCancel  (user cancelled in BankID app)
 *   111* → expiredTransaction (order timed out)
 *   (other) → normal flow → complete
 */

import crypto from 'node:crypto'

/** In-memory order store. Orders are cleaned up on terminal states. */
const orders = new Map()

/**
 * Initiate a BankID authentication order.
 * @param {string} nin - 12-digit NIN
 * @returns {{ orderRef: string, autoStartToken: string }}
 */
export function initAuth(nin) {
  const orderRef = `stub-${crypto.randomUUID()}`
  const autoStartToken = `stub-ast-${crypto.randomUUID()}`

  orders.set(orderRef, {
    nin,
    createdAt: Date.now(),
    status: 'pending',
  })

  return { orderRef, autoStartToken }
}

/**
 * Collect (poll) the status of an ongoing order.
 * @param {string} orderRef
 * @returns {{ status: string, hintCode?: string, user?: object }}
 */
export function collect(orderRef) {
  const order = orders.get(orderRef)
  if (!order) {
    return { status: 'failed', hintCode: 'invalidParameters' }
  }

  const elapsed = Date.now() - order.createdAt
  const pn = order.nin

  // Error simulation: prefix-based
  if (pn.startsWith('000')) {
    orders.delete(orderRef)
    return { status: 'failed', hintCode: 'userCancel' }
  }
  if (pn.startsWith('111')) {
    orders.delete(orderRef)
    return { status: 'failed', hintCode: 'expiredTransaction' }
  }

  // Time-based progression
  if (elapsed < 1500) {
    return { status: 'pending', hintCode: 'outstandingTransaction' }
  }
  if (elapsed < 3000) {
    return { status: 'pending', hintCode: 'userSign' }
  }

  // Complete — generate user data
  orders.delete(orderRef)

  // Hash the NIN for database lookup (SHA-256)
  const ninHash = crypto
    .createHash('sha256')
    .update(pn)
    .digest('hex')

  // Generate stub names from the NIN
  const givenName = 'Test'
  const surname = `User-${pn.slice(-4)}`

  return {
    status: 'complete',
    user: {
      nin: pn,
      ninHash,
      givenName,
      surname,
      name: `${givenName} ${surname}`,
    },
  }
}

/**
 * Cancel an ongoing order.
 * @param {string} orderRef
 */
export function cancel(orderRef) {
  orders.delete(orderRef)
}
