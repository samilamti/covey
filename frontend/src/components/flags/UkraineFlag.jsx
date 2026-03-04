/**
 * Ukraine flag — blue top, yellow bottom.
 */
export function UkraineFlag({ size = 20 }) {
  return (
    <svg
      width={size}
      height={size * 0.667}
      viewBox="0 0 30 20"
      xmlns="http://www.w3.org/2000/svg"
      style={{ borderRadius: '2px', display: 'inline-block', verticalAlign: 'middle' }}
    >
      <rect width="30" height="10" fill="#005BBB" />
      <rect y="10" width="30" height="10" fill="#FFD500" />
    </svg>
  )
}
