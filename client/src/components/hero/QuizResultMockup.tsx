/**
 * QuizResultMockup — Tilted glass panel showing mock quiz results.
 * Replaces HeroScene3D. CSS-only perspective transform, no WebGL.
 */

const mockCoaches = [
  { initials: "AK", name: "Alex K.", title: "IM · Endgame specialist", match: 98, rate: 55, color: "var(--color-ember)" },
  { initials: "SR", name: "Sofia R.", title: "FM · Opening theory", match: 91, rate: 42, color: "var(--color-safe)" },
  { initials: "DM", name: "David M.", title: "NM · Tactical trainer", match: 87, rate: 38, color: "var(--color-bone-muted)" },
];

export default function QuizResultMockup() {
  return (
    <div
      className="hidden lg:block"
      style={{
        perspective: "1400px",
      }}
    >
      <div
        className="w-[420px] rounded-xl border border-border overflow-hidden"
        style={{
          transform: "rotateY(-8deg) rotateX(2deg)",
          background: "var(--glass-bg)",
          backdropFilter: "blur(12px)",
          boxShadow: "0 32px 64px rgba(0,0,0,0.4)",
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
