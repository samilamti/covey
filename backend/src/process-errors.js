/**
 * Process-level fatal error handlers.
 *
 * Everything the backend logs goes through the shared logger with a stable
 * `event:` tag so an aggregator can group on one field. The gap this file
 * closes is the two error paths that live OUTSIDE Express middleware:
 *   - `uncaughtException` — a sync throw in a timer/worker/socket handler
 *     that no `try` catches. Node's default is to print a bare stack trace
 *     to stderr and exit 1, which skips the aggregator entirely.
 *   - `unhandledRejection` — a promise with no `.catch()`. Node 15+ defaults
 *     to crashing here too, same bare-stack-trace problem.
 *
 * Both are symptoms of a bug, and the process may be in an undefined state
 * (half-written DB rows, torn connection state), so the right response is a
 * graceful shutdown — stop accepting new work, drain in-flight requests,
 * then exit. We delegate to the existing shutdown factory so the drain
 * timeout and the exit path stay in one place.
 *
 * Exposed as a factory so a test can inject fakes for `log`, `shutdown`, and
 * the `process` object itself and assert the full sequence without hooking
 * real signals or killing the test runner.
 */

/**
 * Register fatal-error handlers on the given process-like object.
 *
 * @param {object} opts
 * @param {object} opts.log       logger with info/warn/error
 * @param {function} opts.shutdown  shutdown function (receives a reason string)
 * @param {object} [opts.proc=process]  process-like with `on(event, cb)`
 * @returns {{detach: () => void}}  for tests — removes the listeners it added
 */
export function attachProcessErrorHandlers({ log, shutdown, proc = process } = {}) {
  if (!log) throw new Error('attachProcessErrorHandlers requires log')
  if (!shutdown) throw new Error('attachProcessErrorHandlers requires shutdown')
  if (!proc) throw new Error('attachProcessErrorHandlers requires proc')

  function onUncaught(err, origin) {
    // Pass the Error instance so the stack is preserved. The `origin` arg
    // tells uncaught-exception apart from uncaught-exception-monitor; we only
    // register the former, but include it for debuggability if the shape ever
    // widens.
    log.error(err instanceof Error ? err : new Error(String(err)), {
      event: 'uncaught_exception',
      origin: origin || null,
    })
    shutdown('uncaught_exception', 1)
  }

  function onUnhandled(reason, promise) {
    // A rejection reason can be anything — Error, string, object. Normalise
    // to an Error so the stack field in the log line is never absent for a
    // thrown Error, while a non-Error reason still lands as a readable
    // message. Including `promise` here would just serialise `[object Object]`.
    const err = reason instanceof Error ? reason : new Error(String(reason))
    log.error(err, {
      event: 'unhandled_rejection',
      // Keep a hint about the reason's original type for the (rare) case where
      // somebody rejected with a plain object or a string, so a reader can
      // tell "this stack is synthetic" from the shape.
      reason_type: reason instanceof Error ? 'error' : typeof reason,
    })
    shutdown('unhandled_rejection', 1)
    // Silence the "promise" lint warning without consuming it — the handle
    // isn't useful once we've logged the reason.
    void promise
  }

  proc.on('uncaughtException', onUncaught)
  proc.on('unhandledRejection', onUnhandled)

  return {
    detach() {
      if (typeof proc.off === 'function') {
        proc.off('uncaughtException', onUncaught)
        proc.off('unhandledRejection', onUnhandled)
      } else if (typeof proc.removeListener === 'function') {
        proc.removeListener('uncaughtException', onUncaught)
        proc.removeListener('unhandledRejection', onUnhandled)
      }
    },
  }
}
