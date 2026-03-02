/**
 * Finland flag SVG — white field with blue Nordic cross.
 * @param {{ size?: number }} props
 */
export function FinlandFlag({ size = 20 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 360 220"
      role="img"
      aria-label="Finnish flag"
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
    >
      <rect width="360" height="220" fill="#FFF" />
      <rect x="0" y="80" width="360" height="60" fill="#003580" />
      <rect x="100" y="0" width="60" height="220" fill="#003580" />
    </svg>
  )
}
