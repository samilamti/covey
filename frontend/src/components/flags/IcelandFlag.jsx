/**
 * Iceland flag SVG — blue field with red-white Nordic cross.
 * @param {{ size?: number }} props
 */
export function IcelandFlag({ size = 20 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 250 180"
      role="img"
      aria-label="Icelandic flag"
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
    >
      <rect width="250" height="180" fill="#003897" />
      {/* White cross */}
      <rect x="0" y="68" width="250" height="44" fill="#FFF" />
      <rect x="64" y="0" width="44" height="180" fill="#FFF" />
      {/* Red cross */}
      <rect x="0" y="76" width="250" height="28" fill="#D72828" />
      <rect x="72" y="0" width="28" height="180" fill="#D72828" />
    </svg>
  )
}
