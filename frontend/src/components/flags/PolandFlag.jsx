/**
 * Poland flag SVG — white top half, red bottom half.
 * @param {{ size?: number }} props
 */
export function PolandFlag({ size = 20 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 320 200"
      role="img"
      aria-label="Polish flag"
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
    >
      <rect x="0" y="0" width="320" height="100" fill="#FFF" />
      <rect x="0" y="100" width="320" height="100" fill="#DC143C" />
    </svg>
  )
}
