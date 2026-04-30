/* ─── Brand mark SVG (circle + bolt + triangle) ─────────────────── */
export function BgMark({ size = 300, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 182 258"
      width={size}
      height={size * (258 / 182)}
      className={className}
      fill="none"
    >
      <circle cx="66" cy="60" r="32" stroke="currentColor" strokeWidth="3" fill="none" />
      <path
        d="M112 8 L152 8 L126 82 L172 82 L80 250 L108 120 L66 120 Z"
        fill="currentColor"
        opacity="0.85"
      />
      <path
        d="M10 108 L130 108 L70 12 Z"
        stroke="currentColor"
        strokeWidth="2.5"
        fill="none"
      />
    </svg>
  );
}
