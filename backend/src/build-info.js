/** Build identity (package version, GIT_SHA, Node) for the startup log and /api/version. */

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
