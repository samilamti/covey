/**
 * Three gender-neutral figures with a small shield on the center one —
 * communicates "more people, safety-verified."
 */
export function MorePeopleIcon({ size = 48 }) {
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
      {/* Left figure */}
      <circle cx="12" cy="16" r="4.5" />
      <path d="M8.5 24 L8.5 38 L6 48 L9.5 49 L12 39 L14.5 49 L18 48 L15.5 38 L15.5 24 Z" />

      {/* Center figure (slightly taller) */}
      <circle cx="32" cy="12" r="5" />
      <path d="M28 20 L28 36 L25 48 L29 49 L32 38 L35 49 L39 48 L36 36 L36 20 Z" />
      {/* Small shield accent on center figure's chest */}
      <path d="M32 24 L28.5 26 L28.5 30 C28.5 33 32 35 32 35 C32 35 35.5 33 35.5 30 L35.5 26 Z" opacity="0.3" />

      {/* Right figure */}
      <circle cx="52" cy="16" r="4.5" />
      <path d="M48.5 24 L48.5 38 L46 48 L49.5 49 L52 39 L54.5 49 L58 48 L55.5 38 L55.5 24 Z" />
    </svg>
  )
}
