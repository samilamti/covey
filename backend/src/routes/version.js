/**
 * Version endpoint.
 *
 * Reports the same build identity that is already logged at startup
 * (version, commit, Node runtime). Public so a client or operator can read
 * which build is live without shell access to the box — useful when a bug
 * report needs tying to a specific release, or when a load balancer wants
 * to detect a rolling deploy.
 *
 * Keeps the same shape as `getBuildInfo()` so there is one source of truth.
 */

import { getBuildInfo } from '../build-info.js'

export function versionHandler() {
  return function version(_req, res) {
    res.json(getBuildInfo())
  }
}
