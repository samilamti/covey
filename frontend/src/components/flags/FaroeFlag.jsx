/**
 * Faroe Islands flag SVG — white field with red-blue Nordic cross.
 * @param {{ size?: number }} props
 */
export function FaroeFlag({ size = 20 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 220 160"
      role="img"
      aria-label="Faroese flag"
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
    >
      <rect width="220" height="160" fill="#FFF" />
      {/* Red cross */}
      <rect x="0" y="56" width="220" height="48" fill="#ED2939" />
      <rect x="56" y="0" width="48" height="160" fill="#ED2939" />
      {/* Blue cross */}
      <rect x="0" y="64" width="220" height="32" fill="#003897" />
      <rect x="64" y="0" width="32" height="160" fill="#003897" />
    </svg>
  )
}
