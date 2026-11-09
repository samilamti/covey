/**
 * Version endpoint.
 *
 * Reports the build identity that is already logged at startup (version,
 * commit), plus the process `uptime_s` so an
 * operator can tell a running process apart from one that just restarted:
 * a successful rolling deploy shortens uptime back to a few seconds, which
 * is observable with one curl. Public so a client or operator can read
 * which build is live without shell access to the box — useful when a bug
 * report needs tying to a specific release.
 *
 * Build identity comes from `getBuildInfo()` (one source of truth for the
 * startup log line and this response), minus the exact Node version: that
 * stays in the startup log, because on a public endpoint it tells a scanner
 * which Node CVEs to try. Uptime is computed per call because
 * it changes between calls — rounded to a whole second since the field is
 * for human-scale checks, not benchmarking.
 *
 * `uptimeFn` is injected so a test can pin a value and assert the shape
 * without racing a real clock.
 */

import { getBuildInfo } from '../build-info.js'

export function versionHandler({ uptimeFn = () => process.uptime() } = {}) {
  return function version(_req, res) {
    const { node: _node, ...publicInfo } = getBuildInfo()
    res.json({
      ...publicInfo,
      uptime_s: Math.floor(uptimeFn()),
    })
  }
}
