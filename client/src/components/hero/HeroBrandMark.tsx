import { Suspense, lazy, useEffect, useState } from "react";

/**
 * Hero brand mark — circle + lightning bolt + triangle.
 *
 * Renders the 3D `HeroScene` when possible, with a static SVG fallback for:
 *   - `prefers-reduced-motion: reduce` (design brief requirement)
 *   - WebGL-missing environments (old browsers, forced-off)
 *   - The brief moment before the lazy chunk resolves
 *
 * The 3D scene is loaded via React.lazy so three.js stays out of the
 * initial bundle — the hero copy paints first, the scene streams in.
 */

const HeroScene = lazy(() => import("./HeroScene"));

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

function webglSupported() {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return !!(
      canvas.getContext("webgl2") || canvas.getContext("webgl")
    );
  } catch {
    return false;
  }
}

function BrandMarkSVG() {
  return (
    <svg
      viewBox="0 0 600 400"
      className="w-full h-full"
      aria-hidden
    >
      <defs>
        <radialGradient id="bm-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#E8633A" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#E8633A" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect x="0" y="0" width="600" height="400" fill="url(#bm-glow)" />

      {/* Circle (torus silhouette) */}
      <circle
        cx="160"
        cy="200"
        r="70"
        fill="none"
        stroke="#E8633A"
        strokeWidth="18"
      />

      {/* Lightning bolt */}
      <path
        d="M 320 110 L 260 220 L 305 220 L 280 310 L 360 180 L 315 180 Z"
        fill="#F4EFE6"
        stroke="#8B4513"
        strokeWidth="2"
      />

      {/* Triangle (tetrahedron silhouette) */}
      <polygon
        points="475,135 550,265 400,265"
        fill="#8B4513"
        stroke="#E8633A"
        strokeWidth="3"
      />
    </svg>
  );
}

export default function HeroBrandMark() {
  const reduced = useReducedMotion();
  const [webgl, setWebgl] = useState(true);

  useEffect(() => {
    setWebgl(webglSupported());
  }, []);

  const shouldRender3D = !reduced && webgl;

  return (
    <div className="w-full h-full">
      {shouldRender3D ? (
        <Suspense fallback={<BrandMarkSVG />}>
          <HeroScene />
        </Suspense>
      ) : (
        <BrandMarkSVG />
      )}
    </div>
  );
}
