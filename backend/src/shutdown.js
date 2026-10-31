/**
 * Graceful shutdown handler.
 *
 * Docker sends SIGTERM when it stops a container and waits ~10 s before SIGKILL.
 * Without a handler, in-flight HTTP requests are dropped mid-response and open
 * Socket.io connections just die, so a browser mid-request after a deploy sees
 * a 502. This hooks SIGTERM + SIGINT, stops accepting new HTTP connections,
 * drains Socket.io, and only then exits.
 *
 * A hard timer forces exit if cleanup hangs (an unresponsive upstream dependency
 * or a long-polling socket that never idles), so the container always releases
 * well before Docker's SIGKILL.
 *
 * Exposed as a factory so a test can pass fake `httpServer` / `io` / `exit`
 * callbacks and assert the shutdown sequence without actually killing the
 * process. The real wiring in `index.js` just calls `createShutdown()` and
 * registers the returned function against both signals.
 */

const DEFAULT_FORCE_EXIT_MS = 10_000

/**
 * Build a shutdown function.
 *
 * @param {object} opts
 * @param {object} opts.httpServer  Node http server (needs `.close(cb)`)
 * @param {object} opts.io          Socket.io server (needs `.close(cb)`)
 * @param {object} opts.log         logger with info/warn/error
 * @param {number} [opts.forceExitMs=10000]  ms before force-exit if cleanup hangs
 * @param {function} [opts.exit=process.exit]
 * @returns {(signal: string) => void}
 */
export function createShutdown({
  httpServer,
  io,
  log,
  forceExitMs = DEFAULT_FORCE_EXIT_MS,
  exit = process.exit,
} = {}) {
  if (!httpServer) throw new Error('createShutdown requires httpServer')
  if (!io) throw new Error('createShutdown requires io')
  if (!log) throw new Error('createShutdown requires log')

  // Idempotent: a container often receives SIGTERM once and then SIGINT from
  // an impatient operator; both must coalesce or we race ourselves to exit.
  let started = false

  return function shutdown(signal) {
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

    // Stop accepting new HTTP connections first; then drain Socket.io; then
    // exit. The two closes are serialised so a bad io.close callback can't
    // mask an httpServer.close error.
    httpServer.close((httpErr) => {
      if (httpErr) {
        log.error(httpErr, { event: 'backend_shutdown_http_close_failed' })
      }
      io.close((ioErr) => {
        if (ioErr) {
          log.error(ioErr, { event: 'backend_shutdown_io_close_failed' })
        }
        clearTimeout(forceTimer)
        log.info('backend_shutdown_complete', {
          event: 'backend_shutdown_complete',
        })
        exit(0)
      })
    })
  }
}
