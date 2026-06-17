/**
 * "Wait" icon — a clock. Distinct at a glance from the walking figure used
 * for "Gå", which is the whole point: the two request types must not look alike.
 * Drawn as a filled ring (so it still reads when the white face blends into a
 * white card) plus a stem, a 12-o'clock tick, and two hands.
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
      {/* Outer ring (the white inner disc carves it into a ring) */}
      <circle cx="32" cy="34" r="23" />
      <circle cx="32" cy="34" r="18" fill="#fff" />
      {/* Top stem / button */}
      <rect x="29" y="4" width="6" height="6" rx="1.5" />
      {/* 12 o'clock tick */}
      <rect x="30.5" y="18" width="3" height="4" rx="1" />
      {/* Hour hand (up), minute hand (to the right), center pin */}
      <rect x="30.5" y="23" width="3" height="13" rx="1.5" />
      <rect x="32" y="32.5" width="13" height="3" rx="1.5" />
      <circle cx="32" cy="34" r="2.6" />
    </svg>
  )
}
