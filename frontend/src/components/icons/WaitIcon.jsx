/**
 * Gender-neutral standing figure icon.
 * Simple silhouette — person standing still.
 */
export function WaitIcon({ size = 48 }) {
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
      {/* Body */}
      <path d="M29 18 L29 36 L25 52 L29 53 L32 40 L35 53 L39 52 L35 36 L35 18 Z" />
      {/* Arms at sides, slightly away from body */}
      <path d="M27 20 L19 34 L23 36 L29 24 Z" />
      <path d="M37 20 L45 34 L41 36 L35 24 Z" />
    </svg>
  )
}
