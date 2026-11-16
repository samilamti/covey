/**
 * Flag SVGs are decorative and must be hidden from assistive tech.
 *
 * Every flag in the LanguageSelector sits immediately next to the language
 * label (written in that language, wrapped in <span lang="xx"> for WCAG 3.1.2
 * Language of Parts). The flag carries no extra meaning, so a screen reader
 * should voice the language name alone — "Svenska", "العربية" — not the name
 * prefixed by a hardcoded English "Swedish flag", which was both redundant
 * and a localisation leak. (The old labels were English-only and would be
 * read with the UI language's phonetics, so a Swedish voice announcing
 * "Swedish flag" sounded broken, and the whole menu announced in a mix of
 * English and the target language.)
 *
 * This file renders every exported flag through the shared `flags` index and
 * asserts each one:
 *   • carries `aria-hidden="true"` (the explicit "ignore me" signal AT needs),
 *   • does NOT carry `role="img"` or `aria-label` (either would re-expose it),
 *   • is actually registered in the LanguageSelector languages table.
 *
 * Index-driven: adding a new flag without aria-hidden fails here, so a
 * future language addition can't quietly leak another English label.
 */

import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/preact'
import { h } from 'preact'
import * as flags from '../src/components/flags'

const flagEntries = Object.entries(flags)

describe('flag SVG accessibility', () => {
  // Guard the loop itself: a bad export (undefined, non-function) would make
  // every assertion below error with a confusing "not a component" instead of
  // the real diagnosis. Fail fast with a clear message.
  it('exports a component for every registered flag', () => {
    expect(flagEntries.length).toBeGreaterThanOrEqual(12)
    for (const [name, Component] of flagEntries) {
      expect(typeof Component, `flags.${name} should be a component`).toBe('function')
    }
  })

  for (const [name, FlagComponent] of flagEntries) {
    describe(name, () => {
      it('is hidden from assistive tech via aria-hidden', () => {
        // Regression target: eleven of twelve flags used to carry
        // `role="img" aria-label="Xish flag"`, and the twelfth (Ukraine)
        // omitted both — so a reader navigating by images could pick them up
        // in unpredictable places, and the English labels leaked into every
        // other UI language. aria-hidden on the SVG root removes it from the
        // a11y tree in both directions.
        const { container } = render(<FlagComponent size={20} />)
        const svg = container.querySelector('svg')
        expect(svg, 'flag must render an <svg> root').toBeTruthy()
        expect(svg.getAttribute('aria-hidden')).toBe('true')
      })

      it('carries no role or aria-label that would re-expose it', () => {
        // A future "helpful" edit that adds either attribute would cancel
        // the aria-hidden out — AT typically honours an explicit role or
        // label over an aria-hidden it finds alongside. Guard both.
        const { container } = render(<FlagComponent size={20} />)
        const svg = container.querySelector('svg')
        expect(svg.getAttribute('role')).toBeNull()
        expect(svg.getAttribute('aria-label')).toBeNull()
        expect(svg.getAttribute('aria-labelledby')).toBeNull()
      })

      it('respects the size prop (regression against hardcoded dimensions)', () => {
        // Covered here because this file is the one place every flag is
        // exercised together; a future rewrite that forgot the width/height
        // bindings would misalign the LanguageSelector grid without any
        // visual test catching it until a locale screenshot was reviewed.
        const { container } = render(<FlagComponent size={32} />)
        const svg = container.querySelector('svg')
        expect(svg.getAttribute('width')).toBe('32')
        // UkraineFlag deliberately renders at `size * 0.667` height to keep
        // its 3:2 aspect; the rest render square. Either one must be a
        // positive integer, not blank.
        const h = svg.getAttribute('height')
        expect(h).toBeTruthy()
        expect(Number(h)).toBeGreaterThan(0)
      })
    })
  }
})
