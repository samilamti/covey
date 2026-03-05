/**
 * Megaphone icon — communicates "broadcast to everyone."
 */
export function EveryoneIcon({ size = 48 }) {
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
      {/* Megaphone cone */}
      <path d="M8 24 L8 40 L18 40 L18 24 Z" />
      <path d="M18 20 L48 8 L48 56 L18 44 Z" />

      {/* Handle at bottom */}
      <path d="M10 40 L10 48 L16 48 L16 40 Z" />

      {/* Sound waves */}
      <path d="M52 22 Q58 32 52 42" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
      <path d="M56 16 Q64 32 56 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
    </svg>
  )
}
