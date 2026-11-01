/**
 * Request visibility tests.
 *
 * Every logged-in socket joins the `requests:open` room, whatever circle a
 * requester chose, so the `request:new` broadcast must not carry the exact
 * pickup, destination or requester id. And GET /api/requests/:id must only
 * answer the two participants.
 *
 * handlers.js and routes/requests.js need a database and a Socket.io server
 * to load, so the wiring is guarded with source assertions alongside the unit
 * tests of the pure helpers.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { openRequestEvent, isParticipant } from '../src/services/request-visibility.js'

const fullRow = {
  id: 'req-1',
  requester_id: 'user-a',
  helper_id: null,
  eligibility_tier: 'same_demographics',
  pickup_lat: 59.3293012,
  pickup_lng: 18.0685808,
  destination_lat: 59.3451234,
  destination_lng: 18.0234567,
  message: 'Går hem från Odenplan',
}

describe('openRequestEvent()', () => {
  it('carries only the request id', () => {
    assert.deepEqual(openRequestEvent(fullRow), { requestId: 'req-1' })
  })

  it('never carries coordinates or the requester id', () => {
    const json = JSON.stringify(openRequestEvent(fullRow))
    for (const leak of ['59.329', '18.068', '59.345', '18.023', 'user-a', 'Odenplan']) {
      assert.ok(!json.includes(leak), `request:new payload leaked ${leak}`)
    }
  })
})

describe('isParticipant()', () => {
  const accepted = { ...fullRow, helper_id: 'user-b' }

  it('allows the requester', () => {
    assert.equal(isParticipant(accepted, 'user-a'), true)
  })

  it('allows the helper', () => {
    assert.equal(isParticipant(accepted, 'user-b'), true)
  })

  it('refuses anyone else', () => {
    assert.equal(isParticipant(accepted, 'user-c'), false)
  })

  it('refuses everyone but the requester while no helper is set', () => {
    assert.equal(isParticipant(fullRow, 'user-c'), false)
    assert.equal(isParticipant(fullRow, null), false)
    assert.equal(isParticipant(fullRow, undefined), false)
  })

  it('refuses a missing request', () => {
    assert.equal(isParticipant(null, 'user-a'), false)
  })
})

describe('wiring (source assertions)', () => {
  const handlers = readFileSync(new URL('../src/handlers.js', import.meta.url), 'utf8')
  const routes = readFileSync(new URL('../src/routes/requests.js', import.meta.url), 'utf8')

  it('every request:new emit goes through openRequestEvent()', () => {
    for (const [name, src] of [['handlers.js', handlers], ['routes/requests.js', routes]]) {
      const emits = src.match(/emit\(\s*'request:new'\s*,[^)]*\)?\)?/g) || []
      assert.ok(emits.length > 0, `${name} no longer emits request:new; update this test`)
      for (const emit of emits) {
        assert.match(emit, /openRequestEvent\(/, `${name} emits request:new without openRequestEvent: ${emit}`)
      }
    }
  })

  it('GET /:id checks isParticipant before answering', () => {
    const start = routes.indexOf("requestRouter.get('/:id',")
    assert.ok(start >= 0, 'GET /:id route not found')
    const body = routes.slice(start, routes.indexOf('\n})', start))
    assert.match(body, /isParticipant\(request, req\.user\.userId\)/)
    assert.match(body, /status\(404\)/)
  })
})
