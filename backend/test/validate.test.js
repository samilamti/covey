import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { validate, UUID_PATTERN, NIN_PATTERN } from '../src/middleware/validate.js'
import { mockReq, mockRes } from './helpers.js'

describe('validate middleware', () => {
  it('passes when all required fields are present', () => {
    const mw = validate({ name: { required: true, type: 'string' } })
    const req = mockReq({ body: { name: 'test' } })
    const res = mockRes()
    let called = false
    mw(req, res, () => { called = true })
    assert.equal(called, true)
  })

  it('returns 400 when required field is missing', () => {
    const mw = validate({ name: { required: true } })
    const req = mockReq({ body: {} })
    const res = mockRes()
    mw(req, res, () => {})
    assert.equal(res.statusCode, 400)
    assert.ok(res.body.error.includes('name is required'))
  })

  it('returns 400 when required field is empty string', () => {
    const mw = validate({ name: { required: true } })
    const req = mockReq({ body: { name: '' } })
    const res = mockRes()
    mw(req, res, () => {})
    assert.equal(res.statusCode, 400)
  })

  it('passes when optional field is omitted', () => {
    const mw = validate({ name: { type: 'string' } })
    const req = mockReq({ body: {} })
    const res = mockRes()
    let called = false
    mw(req, res, () => { called = true })
    assert.equal(called, true)
  })

  it('returns 400 for wrong type (string expected, number given)', () => {
    const mw = validate({ name: { type: 'string' } })
    const req = mockReq({ body: { name: 123 } })
    const res = mockRes()
    mw(req, res, () => {})
    assert.equal(res.statusCode, 400)
    assert.ok(res.body.error.includes('must be a string'))
  })

  it('returns 400 for wrong type (number expected, string given)', () => {
    const mw = validate({ age: { type: 'number' } })
    const req = mockReq({ body: { age: 'ten' } })
    const res = mockRes()
    mw(req, res, () => {})
    assert.equal(res.statusCode, 400)
    assert.ok(res.body.error.includes('must be a number'))
  })

  it('returns 400 when pattern does not match', () => {
    const mw = validate({ id: { pattern: UUID_PATTERN } })
    const req = mockReq({ body: { id: 'not-a-uuid' } })
    const res = mockRes()
    mw(req, res, () => {})
    assert.equal(res.statusCode, 400)
    assert.ok(res.body.error.includes('invalid format'))
  })

  it('passes when pattern matches', () => {
    const mw = validate({ id: { pattern: UUID_PATTERN } })
    const req = mockReq({ body: { id: '550e8400-e29b-41d4-a716-446655440000' } })
    const res = mockRes()
    let called = false
    mw(req, res, () => { called = true })
    assert.equal(called, true)
  })

  it('returns 400 when maxLength exceeded', () => {
    const mw = validate({ msg: { type: 'string', maxLength: 5 } })
    const req = mockReq({ body: { msg: 'toolong' } })
    const res = mockRes()
    mw(req, res, () => {})
    assert.equal(res.statusCode, 400)
    assert.ok(res.body.error.includes('at most 5'))
  })

  it('returns 400 when number below min', () => {
    const mw = validate({ age: { type: 'number', min: 0 } })
    const req = mockReq({ body: { age: -1 } })
    const res = mockRes()
    mw(req, res, () => {})
    assert.equal(res.statusCode, 400)
    assert.ok(res.body.error.includes('at least 0'))
  })

  it('returns 400 when number above max', () => {
    const mw = validate({ age: { type: 'number', max: 120 } })
    const req = mockReq({ body: { age: 200 } })
    const res = mockRes()
    mw(req, res, () => {})
    assert.equal(res.statusCode, 400)
    assert.ok(res.body.error.includes('at most 120'))
  })
})

describe('patterns', () => {
  it('UUID_PATTERN matches valid UUIDs', () => {
    assert.ok(UUID_PATTERN.test('550e8400-e29b-41d4-a716-446655440000'))
    assert.ok(!UUID_PATTERN.test('not-a-uuid'))
    assert.ok(!UUID_PATTERN.test('550e8400e29b41d4a716446655440000'))
  })

  it('NIN_PATTERN matches valid NINs', () => {
    assert.ok(NIN_PATTERN.test('199001011234'))
    assert.ok(NIN_PATTERN.test('9001011234'))
    assert.ok(!NIN_PATTERN.test('123'))
    assert.ok(!NIN_PATTERN.test('abcdefghijkl'))
  })
})
