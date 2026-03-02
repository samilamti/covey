/**
 * NIN parsing tests.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseBirthYear, parseSex } from '../src/auth/nin.js'

describe('parseBirthYear', () => {
  it('should parse 12-digit NIN', () => {
    assert.equal(parseBirthYear('198501011234'), 1985)
    assert.equal(parseBirthYear('200103052345'), 2001)
    assert.equal(parseBirthYear('195512240987'), 1955)
  })

  it('should parse 10-digit NIN (2000s for yy <= 30)', () => {
    assert.equal(parseBirthYear('0103052345'), 2001)
    assert.equal(parseBirthYear('2506151234'), 2025)
    assert.equal(parseBirthYear('3012311234'), 2030)
  })

  it('should parse 10-digit NIN (1900s for yy > 30)', () => {
    assert.equal(parseBirthYear('8501011234'), 1985)
    assert.equal(parseBirthYear('5512240987'), 1955)
    assert.equal(parseBirthYear('3112311234'), 1931)
  })

  it('should handle NIN with hyphen', () => {
    assert.equal(parseBirthYear('19850101-1234'), 1985)
    assert.equal(parseBirthYear('850101-1234'), 1985)
  })

  it('should return null for invalid input', () => {
    assert.equal(parseBirthYear('123'), null)
    assert.equal(parseBirthYear('abc'), null)
    assert.equal(parseBirthYear(''), null)
  })
})

describe('parseSex', () => {
  it('should return M for odd second-to-last digit', () => {
    // digit 3 (odd) → M
    assert.equal(parseSex('198501011234'), 'M')
    // digit 7 (odd) → M
    assert.equal(parseSex('199001011274'), 'M')
    // digit 1 (odd) → M
    assert.equal(parseSex('198501011214'), 'M')
  })

  it('should return F for even second-to-last digit', () => {
    // digit 8 (even) → F
    assert.equal(parseSex('199001012280'), 'F')
    // digit 4 (even) → F
    assert.equal(parseSex('198501011240'), 'F')
    // digit 0 (even) → F
    assert.equal(parseSex('198501011200'), 'F')
  })

  it('should handle 10-digit NIN', () => {
    assert.equal(parseSex('8501011234'), 'M')
    assert.equal(parseSex('9001012280'), 'F')
  })

  it('should handle NIN with hyphen', () => {
    assert.equal(parseSex('19850101-1234'), 'M')
    assert.equal(parseSex('850101-2280'), 'F')
  })

  it('should return null for invalid input', () => {
    assert.equal(parseSex('123'), null)
    assert.equal(parseSex(''), null)
  })
})
