/**
 * Norway flag SVG — red field with blue-white Nordic cross.
 * @param {{ size?: number }} props
 */
export function NorwayFlag({ size = 20 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 220 160"
      role="img"
      aria-label="Norwegian flag"
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
    >
      <rect width="220" height="160" fill="#BA0C2F" />
      {/* White cross */}
      <rect x="0" y="60" width="220" height="40" fill="#FFF" />
      <rect x="60" y="0" width="40" height="160" fill="#FFF" />
      {/* Blue cross */}
      <rect x="0" y="68" width="220" height="24" fill="#00205B" />
      <rect x="68" y="0" width="24" height="160" fill="#00205B" />
    </svg>
  )
}
