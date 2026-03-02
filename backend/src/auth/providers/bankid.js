/**
 * Real BankID provider.
 *
 * This is a placeholder for the real BankID integration. It requires:
 *   1. A Relying Party agreement with BankID
 *   2. An RP certificate (.p12 file)
 *   3. FEATURE_BANKID_AUTH=true
 *
 * The provider implements the same interface as the stub:
 *   initAuth(nin) → { orderRef, autoStartToken }
 *   collect(orderRef)        → { status, hintCode?, user? }
 *   cancel(orderRef)         → void
 *
 * Until certificates are configured, this module throws clear errors.
 */

export function initAuth(/* nin */) {
  throw new Error(
    'Real BankID provider is not yet configured. ' +
    'Set FEATURE_BANKID_AUTH=false or configure RP certificates.'
  )
}

export function collect(/* orderRef */) {
  throw new Error('Real BankID provider is not yet configured.')
}

export function cancel(/* orderRef */) {
  throw new Error('Real BankID provider is not yet configured.')
}
