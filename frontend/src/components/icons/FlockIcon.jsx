/**
 * FlockIcon — Covey's brand mark rendered as a nav icon: a small flock of birds
 * (one lead bird above two followers), drawn in the same two-arc "seagull"
 * silhouette as the app icon (public/icon.svg).
 *
 * Stroke-based + currentColor so it recolours with the active/inactive nav
 * state and sits naturally beside the lucide icons (matching viewBox, stroke
 * width and round caps).
 */
export function FlockIcon({ size = 24, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      role="img"
      aria-hidden="true"
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
      {...props}
    >
      {/* Lead bird */}
      <path d="M7 8 Q9.5 3.6 12 8.6 Q14.5 3.6 17 8" />
      {/* Two followers, below and flanking */}
      <path d="M4 15 Q5.75 11.7 7.5 15.6 Q9.25 11.7 11 15" />
      <path d="M13 15 Q14.75 11.7 16.5 15.6 Q18.25 11.7 20 15" />
    </svg>
  )
}
