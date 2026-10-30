/**
 * Per-request context, propagated across async boundaries.
 *
 * The request-id middleware opens a store at the top of each HTTP request;
 * the logger reads from it inside `emit()` so every `log.*` call made during
 * that request's lifetime — including from repositories, workers triggered
 * by the request, and the error-handling middleware — carries the same
 * `request_id` without any call-site change.
 *
 * Background work (startup, interval workers) runs outside any store, in
 * which case `currentContext()` returns `undefined` and the logger emits
 * exactly as before.
 */

import { AsyncLocalStorage } from 'node:async_hooks'

export const requestContext = new AsyncLocalStorage()

export function currentContext() {
  return requestContext.getStore()
}
