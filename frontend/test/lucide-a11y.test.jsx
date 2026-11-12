import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/preact'
import { Clock, X } from 'lucide-preact'

// Covey's decorative icons carry no aria-hidden of their own: lucide-preact
// adds aria-hidden="true" to any icon given no aria-*, role or title prop
// (0.575.0, src/Icon.js + shared/src/utils/hasA11yProp.js). Most component
// tests replace lucide with a stub <span>, so they cannot see this. This file
// renders the real library, so an upgrade that drops the default fails here
// instead of quietly exposing every icon's English name to screen readers.
describe('lucide-preact accessibility default', () => {
  it('hides an icon that has no accessibility props', () => {
    const { container } = render(<Clock size={12} />)
    expect(container.querySelector('svg').getAttribute('aria-hidden')).toBe('true')
  })

  it('leaves an icon exposed once it is given a name', () => {
    const { container } = render(<X aria-label="Stäng" />)
    const svg = container.querySelector('svg')
    expect(svg.getAttribute('aria-hidden')).toBeNull()
    expect(svg.getAttribute('aria-label')).toBe('Stäng')
  })
})
