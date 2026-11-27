// Per-request AsyncLocalStorage store, opened by request-id.js and read by the logger.
// Outside a request (startup, workers) currentContext() is undefined.

import { AsyncLocalStorage } from 'node:async_hooks'

export const requestContext = new AsyncLocalStorage()

export function currentContext() {
  return requestContext.getStore()
}
