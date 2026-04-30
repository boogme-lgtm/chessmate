/**
 * QuizResultMockup — Tilted glass panel showing mock quiz results.
 * Replaces HeroScene3D. Mouse-tracking perspective transform with dynamic shadow.
 */
import { useState, useRef, useCallback } from "react";

const mockCoaches = [
  { initials: "AK", name: "Alex K.", title: "IM · Endgame specialist", match: 98, rate: 55, color: "var(--color-ember)" },
  { initials: "SR", name: "Sofia R.", title: "FM · Opening theory", match: 91, rate: 42, color: "var(--color-safe)" },
  { initials: "DM", name: "David M.", title: "NM · Tactical trainer", match: 87, rate: 38, color: "var(--color-bone-muted)" },
];

export default function QuizResultMockup() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState("rotateY(-8deg) rotateX(2deg)");
  const [shadow, setShadow] = useState("32px 32px 64px rgba(0,0,0,0.4)");

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5; // -0.5 to 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    
    const rotateY = -8 + x * 12; // -14 to -2
    const rotateX = 2 + y * -8; // -2 to 6
    setTransform(`rotateY(${rotateY}deg) rotateX(${rotateX}deg)`);
    
    // Shadow moves opposite to mouse
    const shadowX = 32 - x * 40;
    const shadowY = 32 - y * 40;
    setShadow(`${shadowX}px ${shadowY}px 64px rgba(0,0,0,0.45), 0 0 120px rgba(232,99,58,0.08)`);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setTransform("rotateY(-8deg) rotateX(2deg)");
    setShadow("32px 32px 64px rgba(0,0,0,0.4)");
  }, []);

  return (
    <div
      ref={containerRef}
      className="hidden lg:block"
      style={{ perspective: "1400px" }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div
        className="w-[420px] rounded-xl border border-border overflow-hidden transition-all duration-200 ease-out"
        style={{
          transform,
          background: "var(--glass-bg)",
          backdropFilter: "blur(12px)",
          boxShadow: shadow,
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <span className="mono-label">Your top matches</span>
          <span className="mono-label text-muted-foreground">3 coaches found</span>
        </div>

        {/* Coach cards */}
        <div className="divide-y divide-border">
          {mockCoaches.map((coach) => (
            <div key={coach.initials} className="flex items-center gap-4 px-6 py-4">
              {/* Avatar */}
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-mono font-bold shrink-0"
                style={{ background: `color-mix(in srgb, ${coach.color} 20%, transparent)`, color: coach.color }}
              >
                {coach.initials}
              </div>
              {/* Name + title */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground">{coach.name}</div>
                <div className="text-xs text-muted-foreground truncate">{coach.title}</div>
              </div>
              {/* Match badge */}
              <div className="text-xs font-mono font-medium shrink-0" style={{ color: coach.color }}>
                {coach.match}%
              </div>
              {/* Rate */}
              <div className="text-sm text-foreground font-medium shrink-0">
                ${coach.rate}/hr
              </div>
            </div>
          ))}
        </div>

        {/* Escrow footer */}
        <div
          className="px-6 py-3 text-center border-t"
          style={{
            background: "color-mix(in srgb, var(--color-safe) 10%, transparent)",
            borderColor: "color-mix(in srgb, var(--color-safe) 20%, transparent)",
          }}
        >
          <span className="text-xs font-mono" style={{ color: "var(--color-safe)" }}>
            🔒 $60 in escrow · Released after lesson
          </span>
        </div>
      </div>
    </div>
  );
}
