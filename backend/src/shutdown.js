/**
 * Graceful shutdown handler.
 *
 * Docker sends SIGTERM when it stops a container and waits 10 s (compose's
 * default stop_grace_period) before SIGKILL. Without a handler, in-flight HTTP
 * requests are dropped mid-response and open Socket.io connections just die,
 * so a browser mid-request after a deploy sees a 502. This hooks SIGTERM +
 * SIGINT, disconnects Socket.io clients, lets in-flight HTTP requests finish,
 * and only then exits.
 *
 * One call does all of it: `io.close()` disconnects every Socket.io client and
 * then closes the underlying http server itself, handing that close's error to
 * its callback. Do not close `httpServer` first. Its callback waits for every
 * open connection to end, and an upgraded WebSocket only ends when `io.close()`
 * runs, so with any app connected the drain sat until the force-exit timer.
 *
 * A hard timer forces exit if cleanup hangs (an unresponsive upstream dependency
 * or a request that never finishes). It fires at 8 s so our own exit lands
 * before Docker's SIGKILL at 10 s.
 *
 * Exposed as a factory so a test can pass a fake `io` / `exit` and assert the
 * shutdown sequence without actually killing the process. The real wiring in
 * `index.js` just calls `createShutdown()` and registers the returned function
 * against both signals.
 */

const DEFAULT_FORCE_EXIT_MS = 8_000

/**
 * Build a shutdown function.
 *
 * @param {object} opts
 * @param {object} opts.io          Socket.io server attached to the http server (needs `.close(cb)`)
 * @param {object} opts.log         logger with info/warn/error
 * @param {number} [opts.forceExitMs=8000]  ms before force-exit if cleanup hangs
 * @param {function} [opts.exit=process.exit]
 * @returns {(signal: string, exitCode?: number) => void}
 *   `exitCode` is what a clean drain exits with: 0 for a signal, 1 when the
 *   shutdown was triggered by a crash, so `docker ps` and the restart count
 *   still say the process failed.
 */
export function createShutdown({
  io,
  log,
  forceExitMs = DEFAULT_FORCE_EXIT_MS,
  exit = process.exit,
} = {}) {
  if (!io) throw new Error('createShutdown requires io')
  if (!log) throw new Error('createShutdown requires log')

  // Idempotent: a container often receives SIGTERM once and then SIGINT from
  // an impatient operator; both must coalesce or we race ourselves to exit.
  let started = false

  return function shutdown(signal, exitCode = 0) {
    if (started) return
    started = true

    log.info('backend_shutdown_starting', {
      event: 'backend_shutdown_starting',
      signal: signal || null,
    })

    const forceTimer = setTimeout(() => {
      log.warn('backend_shutdown_timeout_force_exit', {
        event: 'backend_shutdown_timeout_force_exit',
        force_exit_ms: forceExitMs,
      })
      exit(1)
    }, forceExitMs)
    // Don't let this timer itself keep the process alive — if everything else
    // has already settled, the event loop should drain regardless.
    if (typeof forceTimer.unref === 'function') forceTimer.unref()

    io.close((err) => {
      if (err) {
        log.error(err, { event: 'backend_shutdown_close_failed' })
      }
      clearTimeout(forceTimer)
      log.info('backend_shutdown_complete', {
        event: 'backend_shutdown_complete',
      })
      exit(exitCode)
    })
  }
}
