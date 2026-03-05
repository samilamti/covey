/**
 * Two gender-neutral figures — communicates "few, similar to me."
 */
export function FewPeopleIcon({ size = 48 }) {
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
      <circle cx="22" cy="14" r="5" />
      <path d="M18 22 L18 38 L15 50 L19 51 L22 40 L25 51 L29 50 L26 38 L26 22 Z" />

      {/* Right figure */}
      <circle cx="42" cy="14" r="5" />
      <path d="M38 22 L38 38 L35 50 L39 51 L42 40 L45 51 L49 50 L46 38 L46 22 Z" />
    </svg>
  )
}
