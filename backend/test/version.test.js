import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { versionHandler } from '../src/routes/version.js'
import { mockReq, mockRes } from './helpers.js'

describe('versionHandler', () => {
  const originalSha = process.env.GIT_SHA

  beforeEach(() => { delete process.env.GIT_SHA })
  afterEach(() => {
    if (originalSha === undefined) delete process.env.GIT_SHA
    else process.env.GIT_SHA = originalSha
  })

  it('returns the build info shape with version, commit, node', () => {
    const req = mockReq({ method: 'GET', path: '/api/version' })
    const res = mockRes()
    versionHandler()(req, res)
    assert.equal(res.statusCode, 200)
    assert.ok(res.body, 'response body present')
    assert.match(res.body.version, /^\d+\.\d+\.\d+/)
    assert.match(res.body.node, /^v\d+\.\d+\.\d+/)
    assert.equal(res.body.commit, null)
  })

  it('surfaces GIT_SHA as commit when the deploy pipeline injected it', () => {
    process.env.GIT_SHA = 'deadbeef'
    const req = mockReq({ method: 'GET', path: '/api/version' })
    const res = mockRes()
    versionHandler()(req, res)
    assert.equal(res.body.commit, 'deadbeef')
  })

  it('ignores the request — the response does not vary by caller', () => {
    const res1 = mockRes()
    const res2 = mockRes()
    versionHandler()(mockReq(), res1)
    versionHandler()(mockReq({ headers: { 'x-weird': 'yes' } }), res2)
    assert.deepEqual(res1.body, res2.body)
  })
})
