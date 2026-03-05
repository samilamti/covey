/**
 * Gender-neutral walking figure icon.
 * Simple silhouette — no gendered features.
 */
export function WalkIcon({ size = 48 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="currentColor"
      role="img"
      aria-hidden="true"
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
    >
      {/* Head */}
      <circle cx="32" cy="10" r="6" />
      {/* Body + legs in walking pose */}
      <path d="M30 18 L28 34 L20 50 L24 52 L32 38 L40 52 L44 50 L36 34 L34 18 Z" />
      {/* Arms swinging */}
      <path d="M26 22 L16 36 L20 38 L28 26 Z" />
      <path d="M38 22 L48 36 L44 38 L36 26 Z" />
    </svg>
  )
}
