const coaches = [
  { initials: "AK", name: "Alex K.", title: "IM · Endgame specialist", match: 98, rate: 55, color: "var(--primary)" },
  { initials: "SR", name: "Sofia R.", title: "FM · Opening theory", match: 91, rate: 42, color: "var(--color-safe)" },
  { initials: "DM", name: "David M.", title: "NM · Tactical trainer", match: 87, rate: 38, color: "var(--color-bone-muted)" },
];

export default function QuizResultMockup() {
  return (
    <div
      className="w-[420px] max-w-full rounded-xl overflow-hidden"
      style={{
        transform: "perspective(1400px) rotateY(-8deg) rotateX(2deg)",
        background: "rgba(244,239,230,0.04)",
        border: "1px solid rgba(244,239,230,0.08)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        boxShadow: "0 32px 64px rgba(0,0,0,0.4)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: "rgba(244,239,230,0.08)" }}>
        <span className="mono-label">Your top matches</span>
        <span className="mono-label text-muted-foreground">3 coaches found</span>
      </div>

      {/* Coach rows */}
      {coaches.map((c, i) => (
        <div
          key={c.initials}
          className="flex items-center gap-3 px-5 py-3.5"
          style={{ borderBottom: i < 2 ? "1px solid rgba(244,239,230,0.06)" : "none" }}
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
            style={{ background: `color-mix(in oklab, ${c.color} 18%, transparent)`, color: c.color }}
          >
            {c.initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-foreground">{c.name}</div>
            <div className="text-xs text-muted-foreground truncate">{c.title}</div>
          </div>
          <div className="text-right shrink-0">
            <div className="mono-label" style={{ color: c.color }}>{c.match}% match</div>
            <div className="text-xs text-muted-foreground">${c.rate}/hr</div>
          </div>
        </div>
      ))}

      {/* Escrow footer */}
      <div
        className="px-5 py-3 text-center"
        style={{
          background: "rgba(74,157,127,0.08)",
          borderTop: "1px solid rgba(74,157,127,0.15)",
        }}
      >
        <span className="mono-label text-safe">&#x1f512; $60 in escrow &middot; Released after lesson</span>
      </div>
    </div>
  );
}
