/**
 * Denmark flag SVG — red field with white Nordic cross (Dannebrog).
 * @param {{ size?: number }} props
 */
export function DenmarkFlag({ size = 20 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 370 280"
      role="img"
      aria-label="Danish flag"
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
    >
      <rect width="370" height="280" fill="#C8102E" />
      <rect x="0" y="120" width="370" height="40" fill="#FFF" />
      <rect x="100" y="0" width="40" height="280" fill="#FFF" />
    </svg>
  )
}
