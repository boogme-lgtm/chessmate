/**
 * HeroScene3D — CSS 3D floating composition for hero right-rail.
 *
 * Palantir / Apple-glass aesthetic. Seven z-sorted elements in a
 * perspective-transformed stack. All motion is ambient — nothing
 * demands attention, everything breathes.
 *
 * CSS 3D transforms only. No Three.js, WebGL, or canvas.
 */

/* ─── Brand mark SVG (circle + bolt + triangle) ─────────────────── */
function BgMark({ size = 300, className = "" }: { size?: number; className?: string }) {
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

/* ─── Style block (keyframes + glass + grid + reduced motion) ──── */
const SCENE_STYLES = `
/* Parent scene rotation — slow, 24s */
@keyframes hs3d-rotate {
  from { transform: rotateX(14deg) rotateY(-16deg); }
  to   { transform: rotateX(20deg) rotateY(18deg); }
}

/* Float A: 7s — YOU orb, escrow pill */
@keyframes hs3d-float-a {
  from { transform: translateY(-6px); }
  to   { transform: translateY(10px); }
}
/* Float B: 9s — bolt, triangle */
@keyframes hs3d-float-b {
  from { transform: translateY(6px) translateX(-4px); }
  to   { transform: translateY(-8px) translateX(6px); }
}
/* Float C: 11s — match card, recursive badge */
@keyframes hs3d-float-c {
  from { transform: translateY(-4px); }
  to   { transform: translateY(8px); }
}

/* Ambient blob drifts */
@keyframes hs3d-drift-1 {
  from { transform: translate(-30px, -20px) scale(1); }
  to   { transform: translate(40px, 30px) scale(1.15); }
}
@keyframes hs3d-drift-2 {
  from { transform: translate(25px, 15px) scale(1.05); }
  to   { transform: translate(-35px, -25px) scale(0.95); }
}
@keyframes hs3d-drift-3 {
  from { transform: translate(10px, -30px) scale(0.95); }
  to   { transform: translate(-20px, 35px) scale(1.1); }
}

/* ─── Glass recipe ─────────────────────────────────────────────── */
.hs3d-glass {
  position: relative;
  border-radius: 16px;
  backdrop-filter: blur(24px) saturate(140%);
  -webkit-backdrop-filter: blur(24px) saturate(140%);
}

/* Dark mode glass (default — Ember Dark) */
:root .hs3d-glass,
.dark .hs3d-glass {
  background: linear-gradient(
    145deg,
    rgba(255,255,255,0.08),
    rgba(255,255,255,0.04) 50%,
    rgba(255,255,255,0.02)
  );
  border: 1px solid rgba(244,239,230,0.14);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.08),
    0 24px 60px -20px rgba(0,0,0,0.6),
    0 2px 8px -2px rgba(0,0,0,0.3);
}

/* Light mode glass */
.light .hs3d-glass {
  background: linear-gradient(
    145deg,
    rgba(255,255,255,0.55),
    rgba(255,255,255,0.28) 50%,
    rgba(255,255,255,0.12)
  );
  border: 1px solid rgba(255,255,255,0.55);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.7),
    0 20px 60px -20px rgba(44,20,10,0.22),
    0 2px 8px -2px rgba(44,20,10,0.08);
}

/* Sheen overlay */
.hs3d-glass::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(135deg, rgba(255,255,255,0.4), transparent 40%);
  mix-blend-mode: overlay;
  pointer-events: none;
}
.dark .hs3d-glass::before {
  background: linear-gradient(135deg, rgba(255,255,255,0.12), transparent 40%);
}

/* Backdrop-filter fallback */
@supports not (backdrop-filter: blur(1px)) {
  :root .hs3d-glass,
  .dark .hs3d-glass {
    background: rgba(15, 20, 25, 0.88);
  }
  .light .hs3d-glass {
    background: rgba(245, 241, 228, 0.88);
  }
}

/* ─── Precision grid ───────────────────────────────────────────── */
.hs3d-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(to right,  var(--foreground, #F4EFE6) 1px, transparent 1px),
    linear-gradient(to bottom, var(--foreground, #F4EFE6) 1px, transparent 1px);
  background-size: 64px 64px;
  opacity: 0.045;
  mask-image: radial-gradient(ellipse at center, black 40%, transparent 85%);
  -webkit-mask-image: radial-gradient(ellipse at center, black 40%, transparent 85%);
  pointer-events: none;
}

/* ─── Reduced motion ───────────────────────────────────────────── */
@media (prefers-reduced-motion: reduce) {
  .hs3d-stack  { animation-duration: 0s !important; }
  .hs3d-el     { animation-duration: 0s !important; }
  .hs3d-blob   { animation-duration: 0s !important; }
}
`;

export default function HeroScene3D() {
  return (
    <>
      <style>{SCENE_STYLES}</style>

      <div
        aria-hidden="true"
        style={{
          width: "100%",
          height: "100%",
          minHeight: 520,
          position: "relative",
          perspective: 1400,
          perspectiveOrigin: "50% 40%",
          transformStyle: "preserve-3d",
          overflow: "hidden",
        }}
      >
        {/* ── Ambient mesh blobs ────────────────────────────────── */}
        <div
          className="hs3d-blob"
          style={{
            position: "absolute",
            width: 260,
            height: 260,
            borderRadius: "50%",
            background: `radial-gradient(circle, var(--primary, #E8633A) 0%, transparent 70%)`,
            filter: "blur(80px)",
            opacity: 0.45,
            top: "15%",
            left: "20%",
            animation: "hs3d-drift-1 22s ease-in-out infinite alternate",
            mixBlendMode: "screen",
            pointerEvents: "none",
          }}
        />
        <div
          className="hs3d-blob"
          style={{
            position: "absolute",
            width: 220,
            height: 220,
            borderRadius: "50%",
            background: "radial-gradient(circle, #C2824B 0%, transparent 70%)",
            filter: "blur(80px)",
            opacity: 0.38,
            top: "55%",
            right: "15%",
            animation: "hs3d-drift-2 26s ease-in-out infinite alternate",
            mixBlendMode: "screen",
            pointerEvents: "none",
          }}
        />
        <div
          className="hs3d-blob"
          style={{
            position: "absolute",
            width: 200,
            height: 200,
            borderRadius: "50%",
            background: "radial-gradient(circle, #E8C9A7 0%, transparent 70%)",
            filter: "blur(80px)",
            opacity: 0.35,
            bottom: "10%",
            left: "40%",
            animation: "hs3d-drift-3 28s ease-in-out infinite alternate",
            mixBlendMode: "screen",
            pointerEvents: "none",
          }}
        />

        {/* Light mode: switch blobs from screen to multiply */}
        <style>{`
          .light .hs3d-blob { mix-blend-mode: multiply !important; }
        `}</style>

        {/* ── Precision grid ───────────────────────────────────── */}
        <div className="hs3d-grid" />

        {/* ── Scene stack (420×420, centered) ───────────────────── */}
        <div
          className="hs3d-stack"
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: 420,
            height: 420,
            marginLeft: -210,
            marginTop: -210,
            transformStyle: "preserve-3d",
            animation: "hs3d-rotate 24s ease-in-out infinite alternate",
          }}
        >
          {/* 1. GHOST MARK — back plane */}
          <div
            className="hs3d-el"
            style={{
              position: "absolute",
              left: 60,
              top: 40,
              transform: "translateZ(-80px)",
              opacity: 0.12,
              color: "var(--primary, #E8633A)",
              pointerEvents: "none",
            }}
          >
            <BgMark size={300} />
          </div>

          {/* 2. GLASS MATCH-SCORE CARD — top-left, z=-40 */}
          <div
            className="hs3d-el hs3d-glass"
            style={{
              position: "absolute",
              left: -10,
              top: 20,
              width: 240,
              height: 128,
              transform: "translateZ(-40px)",
              padding: "18px 22px",
              animation: "hs3d-float-c 11s ease-in-out infinite alternate",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: 4,
            }}
          >
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10,
                letterSpacing: "0.16em",
                textTransform: "uppercase" as const,
                color: "var(--muted-foreground, #7A8290)",
              }}
            >
              MATCH SCORE
            </span>
            <span
              style={{
                fontSize: 52,
                fontWeight: 300,
                letterSpacing: "-0.02em",
                lineHeight: 1,
                color: "var(--primary, #E8633A)",
              }}
            >
              94%
            </span>
            <span
              style={{
                fontSize: 11,
                color: "var(--muted-foreground, #7A8290)",
                opacity: 0.8,
              }}
            >
              GM Nadia Volkov
            </span>
          </div>

          {/* 3. LIGHTNING BOLT SCULPTURE — center, z=+40 */}
          <div
            className="hs3d-el"
            style={{
              position: "absolute",
              left: 148,
              top: 110,
              transform: "translateZ(40px)",
              animation: "hs3d-float-b 9s ease-in-out infinite alternate",
              filter: "drop-shadow(0 20px 40px rgba(232, 99, 58, 0.4))",
            }}
          >
            <svg viewBox="60 0 120 260" width={130} height={180} fill="none">
              <defs>
                <linearGradient id="hs3d-bolt-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary, #E8633A)" />
                  <stop offset="100%" stopColor="var(--primary, #E8633A)" stopOpacity="0.7" />
                </linearGradient>
              </defs>
              <path
                d="M112 8 L152 8 L126 82 L172 82 L80 250 L108 120 L66 120 Z"
                fill="url(#hs3d-bolt-grad)"
                stroke="rgba(255,255,255,0.3)"
                strokeWidth="1.5"
              />
            </svg>
          </div>

          {/* 4. CIRCLE "YOU" ORB — bottom-left, z=+80 */}
          <div
            className="hs3d-el"
            style={{
              position: "absolute",
              left: 30,
              top: 270,
              width: 110,
              height: 110,
              borderRadius: "50%",
              background: "var(--primary, #E8633A)",
              boxShadow:
                "0 24px 50px -10px rgba(232, 99, 58, 0.45), inset 0 2px 0 rgba(255,255,255,0.25)",
              transform: "translateZ(80px)",
              animation: "hs3d-float-a 7s ease-in-out infinite alternate",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
            }}
          >
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10,
                letterSpacing: "0.16em",
                color: "rgba(255,255,255,0.6)",
              }}
            >
              YOU
            </span>
            <span
              style={{
                fontSize: 22,
                fontWeight: 300,
                letterSpacing: "-0.02em",
                color: "#fff",
              }}
            >
              1420
            </span>
          </div>

          {/* 5. TRIANGLE "COACH" PRISM — bottom-right, z=+40 */}
          <div
            className="hs3d-el"
            style={{
              position: "absolute",
              left: 260,
              top: 275,
              transform: "translateZ(40px)",
              animation: "hs3d-float-b 9s ease-in-out infinite alternate",
              animationDelay: "-3s",
              filter: "drop-shadow(0 16px 32px rgba(0,0,0,0.22))",
            }}
          >
            <svg viewBox="0 0 140 120" width={140} height={120} fill="none">
              <defs>
                <linearGradient id="hs3d-tri-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-charcoal, #2C2C2C)" stopOpacity="0.92" />
                  <stop offset="100%" stopColor="var(--color-charcoal, #2C2C2C)" stopOpacity="0.7" />
                </linearGradient>
              </defs>
              <path
                d="M10 108 L130 108 L70 12 Z"
                fill="url(#hs3d-tri-grad)"
                stroke="rgba(255,255,255,0.18)"
                strokeWidth="1.5"
              />
              <text
                x="70"
                y="96"
                textAnchor="middle"
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 9,
                  letterSpacing: "0.16em",
                  fill: "var(--color-cream, #F5F1E4)",
                  opacity: 0.85,
                }}
              >
                COACH
              </text>
            </svg>
          </div>

          {/* 6. GLASS ESCROW PILL — right, z=+80 */}
          <div
            className="hs3d-el hs3d-glass"
            style={{
              position: "absolute",
              left: 195,
              top: 180,
              width: 220,
              height: 92,
              transform: "translateZ(80px)",
              padding: "14px 18px",
              animation: "hs3d-float-a 7s ease-in-out infinite alternate",
              animationDelay: "-2s",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: 6,
            }}
          >
            {/* Dot + label row */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  display: "inline-block",
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "var(--color-safe, #4A9D7F)",
                  boxShadow: "0 0 0 4px rgba(74, 157, 127, 0.22)",
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 10,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase" as const,
                  color: "var(--muted-foreground, #7A8290)",
                }}
              >
                ESCROW HELD
              </span>
            </div>
            <span
              style={{
                fontSize: 22,
                fontWeight: 400,
                color: "var(--foreground, #F4EFE6)",
              }}
            >
              $65.00
            </span>
            <span
              style={{
                fontSize: 10,
                color: "var(--muted-foreground, #7A8290)",
                opacity: 0.7,
              }}
            >
              Releases after lesson ends
            </span>
          </div>

          {/* 7. GLASS BADGE w/ RECURSIVE MARK — top-right, z=-40 */}
          <div
            className="hs3d-el hs3d-glass"
            style={{
              position: "absolute",
              left: 320,
              top: 15,
              width: 80,
              height: 80,
              transform: "translateZ(-40px)",
              animation: "hs3d-float-c 11s ease-in-out infinite alternate",
              animationDelay: "-4s",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--primary, #E8633A)",
            }}
          >
            <BgMark size={48} />
          </div>
        </div>
      </div>
    </>
  );
}
