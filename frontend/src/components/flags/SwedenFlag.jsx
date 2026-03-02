/**
 * Sweden flag SVG — blue field with yellow Nordic cross.
 * @param {{ size?: number }} props
 */
export function SwedenFlag({ size = 20 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 160 100"
      role="img"
      aria-label="Swedish flag"
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
    >
      <rect width="160" height="100" fill="#006AA7" />
      <rect x="0" y="40" width="160" height="20" fill="#FECC02" />
      <rect x="50" y="0" width="20" height="100" fill="#FECC02" />
    </svg>
  )
}
