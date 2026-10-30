import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { getBuildInfo } from '../src/build-info.js'

describe('getBuildInfo', () => {
  const originalSha = process.env.GIT_SHA

  beforeEach(() => { delete process.env.GIT_SHA })
  afterEach(() => {
    if (originalSha === undefined) delete process.env.GIT_SHA
    else process.env.GIT_SHA = originalSha
  })

  it('reports the backend version from package.json', () => {
    const info = getBuildInfo()
    // Semver x.y.z — asserting on exact value couples the test to every bump,
    // asserting on shape proves package.json was actually read.
    assert.match(info.version, /^\d+\.\d+\.\d+/)
  })

  it('reports the running Node version', () => {
    const info = getBuildInfo()
    assert.match(info.node, /^v\d+\.\d+\.\d+/)
  })

  it('returns commit null when GIT_SHA is unset', () => {
    const info = getBuildInfo()
    assert.equal(info.commit, null)
  })

  it('surfaces GIT_SHA as commit when the deploy pipeline injected it', () => {
    process.env.GIT_SHA = 'abc1234'
    const info = getBuildInfo()
    assert.equal(info.commit, 'abc1234')
  })
})
