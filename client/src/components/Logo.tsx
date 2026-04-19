/**
 * BooGMe logo.
 *
 * Uses the PNG (dark background) variant for reliability across browsers
 * — the transparent SVG had intermittent loading issues. `onError` falls
 * back to a styled "BooGMe" text wordmark if the image fails entirely,
 * so the brand is never replaced by a broken-image icon.
 */

interface LogoProps {
  /** Image height in pixels. The width auto-scales. */
  height?: number;
  className?: string;
  /** Additional tailwind classes applied to the fallback text span. */
  fallbackClassName?: string;
}

const LOGO_URL =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663188415081/Xkyng35xnYFybYAdmyVo96/boogme-logo-current_e2bef41f.png";

export default function Logo({
  height = 32,
  className = "",
  fallbackClassName = "",
}: LogoProps) {
  const fontSize = Math.max(14, Math.round(height * 0.55));
  return (
    <>
      <img
        src={LOGO_URL}
        alt="BooGMe"
        className={`w-auto object-contain ${className}`}
        style={{ height: `${height}px` }}
        onError={(e) => {
          const img = e.currentTarget;
          img.style.display = "none";
          const fallback = img.nextElementSibling as HTMLElement | null;
          if (fallback) fallback.style.display = "inline-block";
        }}
      />
      <span
        className={`font-display font-medium tracking-tight text-foreground ${fallbackClassName}`}
        style={{ fontSize: `${fontSize}px`, display: "none" }}
      >
        BooGMe
      </span>
    </>
  );
}
