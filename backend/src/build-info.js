/**
 * Build-info helper.
 *
 * Returns the backend's self-reported identity: the package.json version,
 * the git SHA when the deploy pipeline injected one via GIT_SHA, and the
 * Node runtime. Used at startup so an operator reading the log stream can
 * tell which build is running without hitting an endpoint, and so a future
 * version endpoint can share one source of truth.
 *
 * Reading package.json is a one-shot sync fs call at module import time —
 * cheaper than reading on every call and the value does not change while
 * the process is alive.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const PKG_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json')

function readVersion() {
  try {
    const raw = readFileSync(PKG_PATH, 'utf8')
    const parsed = JSON.parse(raw)
    return typeof parsed.version === 'string' ? parsed.version : 'unknown'
  } catch {
    return 'unknown'
  }
}

const VERSION = readVersion()

export function getBuildInfo() {
  return {
    version: VERSION,
    commit: process.env.GIT_SHA || null,
    node: process.version,
  }
}
