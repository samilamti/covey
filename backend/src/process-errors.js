// uncaughtException/unhandledRejection otherwise print a bare stack and exit; log them
// with event tags and drain through the shared graceful shutdown instead.

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
    log.error(err instanceof Error ? err : new Error(String(err)), {
      event: 'uncaught_exception',
      origin: origin || null,
    })
    shutdown('uncaught_exception', 1)
  }

  function onUnhandled(reason, promise) {
    // A rejection reason can be anything; normalise to an Error so the log line has a stack.
    const err = reason instanceof Error ? reason : new Error(String(reason))
    log.error(err, {
      event: 'unhandled_rejection',
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
