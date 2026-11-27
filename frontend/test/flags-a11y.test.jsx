// Flags sit next to their language name, so every flag SVG must be aria-hidden with no
// role or aria-label. Driven by the flags index, so a new flag is checked automatically.

import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/preact'
import { h } from 'preact'
import * as flags from '../src/components/flags'

const flagEntries = Object.entries(flags)

describe('flag SVG accessibility', () => {
  it('exports a component for every registered flag', () => {
    expect(flagEntries.length).toBeGreaterThanOrEqual(12)
    for (const [name, Component] of flagEntries) {
      expect(typeof Component, `flags.${name} should be a component`).toBe('function')
    }
  })

  for (const [name, FlagComponent] of flagEntries) {
    describe(name, () => {
      it('is hidden from assistive tech via aria-hidden', () => {
        const { container } = render(<FlagComponent size={20} />)
        const svg = container.querySelector('svg')
        expect(svg, 'flag must render an <svg> root').toBeTruthy()
        expect(svg.getAttribute('aria-hidden')).toBe('true')
      })

      it('carries no role or aria-label that would re-expose it', () => {
        // An explicit role or label would override aria-hidden in most screen readers.
        const { container } = render(<FlagComponent size={20} />)
        const svg = container.querySelector('svg')
        expect(svg.getAttribute('role')).toBeNull()
        expect(svg.getAttribute('aria-label')).toBeNull()
        expect(svg.getAttribute('aria-labelledby')).toBeNull()
      })

      it('respects the size prop (regression against hardcoded dimensions)', () => {
        const { container } = render(<FlagComponent size={32} />)
        const svg = container.querySelector('svg')
        expect(svg.getAttribute('width')).toBe('32')
        // UkraineFlag renders at size * 0.667 height to keep 3:2.
        const h = svg.getAttribute('height')
        expect(h).toBeTruthy()
        expect(Number(h)).toBeGreaterThan(0)
      })
    })
  }
})
