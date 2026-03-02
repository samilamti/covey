/**
 * Sami flag SVG component.
 *
 * Renders the Sami people's flag as an inline SVG. The flag features
 * horizontal stripes of red, blue, green, and yellow with a circle
 * (half blue, half red) in the center.
 *
 * Used in the LanguageSelector as a replacement for emoji flags
 * (no Unicode emoji exists for the Sami flag).
 *
 * @param {object} props
 * @param {number} [props.size=20] - Width and height in pixels
 */
export function SamiFlag({ size = 20 }) {
  // Aspect ratio is approximately 3:2, but we render as square to match emoji sizing
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 240 160"
      role="img"
      aria-label="Sami flag"
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
    >
      {/* Background stripes */}
      <rect x="0" y="0" width="240" height="40" fill="#D21034" />
      <rect x="0" y="40" width="240" height="40" fill="#003DA5" />
      <rect x="0" y="80" width="240" height="40" fill="#009A44" />
      <rect x="0" y="120" width="240" height="40" fill="#FECC02" />
      {/* Center circle */}
      <circle cx="100" cy="80" r="35" fill="#003DA5" />
      <circle cx="100" cy="80" r="35" fill="#D21034" clip-path="url(#sami-clip)" />
      {/* Clip path for half-circle */}
      <defs>
        <clipPath id="sami-clip">
          <rect x="100" y="0" width="140" height="160" />
        </clipPath>
      </defs>
      {/* Circle outline */}
      <circle cx="100" cy="80" r="35" fill="none" stroke="#FECC02" stroke-width="3" />
    </svg>
  )
}
