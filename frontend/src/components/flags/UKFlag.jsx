/**
 * United Kingdom flag SVG (simplified Union Jack).
 * @param {{ size?: number }} props
 */
export function UKFlag({ size = 20 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 600 400"
      role="img"
      aria-label="United Kingdom flag"
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
    >
      {/* Blue field */}
      <rect width="600" height="400" fill="#012169" />
      {/* White diagonals */}
      <line x1="0" y1="0" x2="600" y2="400" stroke="#FFF" stroke-width="60" />
      <line x1="600" y1="0" x2="0" y2="400" stroke="#FFF" stroke-width="60" />
      {/* Red diagonals (thinner) */}
      <line x1="0" y1="0" x2="600" y2="400" stroke="#C8102E" stroke-width="28" />
      <line x1="600" y1="0" x2="0" y2="400" stroke="#C8102E" stroke-width="28" />
      {/* White cross */}
      <rect x="0" y="155" width="600" height="90" fill="#FFF" />
      <rect x="240" y="0" width="120" height="400" fill="#FFF" />
      {/* Red cross */}
      <rect x="0" y="170" width="600" height="60" fill="#C8102E" />
      <rect x="255" y="0" width="90" height="400" fill="#C8102E" />
    </svg>
  )
}
