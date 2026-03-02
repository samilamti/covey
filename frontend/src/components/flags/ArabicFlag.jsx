/**
 * Saudi Arabia flag SVG (simplified) — green field with white stripe and crescent.
 * Used for Arabic language since Arabic is the official language of Saudi Arabia.
 * @param {{ size?: number }} props
 */
export function ArabicFlag({ size = 20 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 300 200"
      role="img"
      aria-label="Saudi Arabian flag"
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
    >
      <rect width="300" height="200" fill="#006C35" />
      {/* Simplified shahada representation — horizontal white bar */}
      <rect x="40" y="55" width="220" height="8" rx="4" fill="#FFF" />
      <rect x="60" y="45" width="8" height="25" rx="4" fill="#FFF" />
      <rect x="90" y="48" width="8" height="22" rx="4" fill="#FFF" />
      <rect x="120" y="45" width="8" height="25" rx="4" fill="#FFF" />
      <rect x="150" y="48" width="8" height="22" rx="4" fill="#FFF" />
      <rect x="180" y="45" width="8" height="25" rx="4" fill="#FFF" />
      <rect x="210" y="48" width="8" height="22" rx="4" fill="#FFF" />
      <rect x="240" y="45" width="8" height="25" rx="4" fill="#FFF" />
      {/* Simplified sword */}
      <rect x="70" y="110" width="160" height="6" rx="3" fill="#FFF" />
      <rect x="70" y="102" width="6" height="20" rx="3" fill="#FFF" />
      <rect x="60" y="108" width="20" height="6" rx="3" fill="#FFF" />
    </svg>
  )
}
