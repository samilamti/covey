// Public build identity (version, commit) plus uptime_s, so one curl shows whether a
// deploy restarted the process. Node's exact version stays in the log, not here.

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
