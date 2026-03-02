/**
 * Greenland flag SVG — white top, red bottom, with an offset circle.
 * @param {{ size?: number }} props
 */
export function GreenlandFlag({ size = 20 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 180 120"
      role="img"
      aria-label="Greenlandic flag"
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
    >
      <rect x="0" y="0" width="180" height="60" fill="#FFF" />
      <rect x="0" y="60" width="180" height="60" fill="#D00C33" />
      {/* Offset circle — top half red on white, bottom half white on red */}
      <circle cx="70" cy="60" r="30" fill="#D00C33" clip-path="url(#gl-top)" />
      <circle cx="70" cy="60" r="30" fill="#FFF" clip-path="url(#gl-bottom)" />
      <defs>
        <clipPath id="gl-top">
          <rect x="0" y="0" width="180" height="60" />
        </clipPath>
        <clipPath id="gl-bottom">
          <rect x="0" y="60" width="180" height="60" />
        </clipPath>
      </defs>
    </svg>
  )
}
