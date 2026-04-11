import { useEffect, useRef, useState, useCallback } from "react";

// ─── TYPES ─────────────────────────────────────────────────────────────────
type Agent = "manus" | "claude";
type TabType = "timeline" | "features" | "roadmap" | "stats";

// ─── DATA ──────────────────────────────────────────────────────────────────

const BUILD_TIMELINE = [
  {
    phase: "Foundation & Scaffold",
    date: "Feb 1, 2026",
    agent: "manus" as Agent,
    linesAdded: 4200,
    commits: 1,
    items: [
      "Next.js 15 + React 19 + TypeScript + tRPC 11 full-stack scaffold",
      "MySQL / Drizzle ORM schema (users, coaches, lessons, reviews, waitlist)",
      "Custom email/password auth + Google OAuth integration",
      "Cyberpunk chess landing page with animated hero section",
      "Coach browse & detailed profile pages",
      "Stripe Connect onboarding for coach payouts",
    ],
  },
  {
    phase: "Booking & Payment Flow",
    date: "Feb 3, 2026",
    agent: "manus" as Agent,
    linesAdded: 1800,
    commits: 1,
    items: [
      "Stripe Checkout integration with Connect (platform fee split)",
      "Time-slot booking modal with availability calendar",
      "Lesson detail & payment success/cancel pages",
      "Stripe webhook handler for real-time payment status",
      "Booking confirmation flow (Airbnb-style Accept/Decline)",
    ],
  },
  {
    phase: "Auth Hardening (12 Fixes)",
    date: "Feb 4–8, 2026",
    agent: "manus" as Agent,
    linesAdded: 620,
    commits: 12,
    items: [
      "Fixed cookie name mismatch (session vs app_session_id)",
      "Fixed JWT payload structure for email/password users",
      "Fixed sign-in redirect loop (render-phase navigation bug)",
      "Password visibility toggles on all auth forms",
      "Google OAuth redirect URI fix",
      "Session persistence across HTTPS environments",
    ],
  },
  {
    phase: "Coach Application & AI Vetting",
    date: "Feb 10, 2026",
    agent: "manus" as Agent,
    linesAdded: 2100,
    commits: 1,
    items: [
      "Multi-step coach application wizard (7 steps)",
      "AI confidence scoring + red flag detection via LLM",
      "Admin dashboard for reviewing & approving applications",
      "Waitlist management with CSV export",
      "5-email nurture sequence over 30 days (Resend API)",
    ],
  },
  {
    phase: "Dashboard UX Overhaul",
    date: "Feb 12, 2026",
    agent: "manus" as Agent,
    linesAdded: 1650,
    commits: 1,
    items: [
      "Student dashboard with upcoming/past lessons",
      "Coach dashboard with Accept/Decline buttons",
      "Lesson status badges (Pending, Confirmed, Declined, No Show, Completed)",
      "Mutual reviews schema (Airbnb-style dual review)",
      "Role badges for Coach/Student clarity",
    ],
  },
  {
    phase: "Email System & Reminders",
    date: "Feb 14 – Mar 1, 2026",
    agent: "manus" as Agent,
    linesAdded: 1400,
    commits: 2,
    items: [
      "Booking confirmation emails (student + coach) via Resend",
      "24-hour reminder email scheduler (cron job, runs hourly)",
      "Cancellation confirmation dialog with exact refund breakdown",
      "Tiered refund policy enforced: >48h=100%, 24-48h=50%, <24h=0%",
      "Live countdown timer on lesson cards (color-coded by urgency)",
    ],
  },
  {
    phase: "Critical Bug Fixes — Drizzle ORM",
    date: "Feb 15, 2026",
    agent: "manus" as Agent,
    linesAdded: 340,
    commits: 3,
    items: [
      "Identified Drizzle ORM transaction isolation bug",
      "Replaced all SELECT queries with raw SQL (db.execute)",
      "Fixed lesson creation INSERT to exclude auto-increment id",
      "Fixed post-payment 'Lesson not found' error",
      "Fixed lessons not appearing in dashboard after booking",
    ],
  },
  {
    phase: "Security Audit — 11 Vulnerabilities Fixed",
    date: "Mar 10, 2026",
    agent: "claude" as Agent,
    linesAdded: 890,
    commits: 1,
    items: [
      "SQL injection guards across all query helpers",
      "Input validation hardening on all tRPC procedures",
      "Fixed Stripe refund calculation edge cases",
      "Fixed cancellation policy boundary conditions",
      "Fixed lesson filtering logic in dashboards",
      "Auth token validation improvements",
    ],
  },
  {
    phase: "Client-Side Bug Fixes — 8 Issues",
    date: "Mar 10, 2026",
    agent: "claude" as Agent,
    linesAdded: 420,
    commits: 1,
    items: [
      "Fixed React hooks order violations (rules of hooks)",
      "Added role guards to admin pages (query gated behind auth)",
      "CSV injection prevention in admin waitlist export",
      "Fixed Stripe redirect blocked by popup blocker",
      "JSON.parse try/catch guards in AdminApplications",
    ],
  },
  {
    phase: "Security Refactoring",
    date: "Mar 10, 2026",
    agent: "claude" as Agent,
    linesAdded: 380,
    commits: 1,
    items: [
      "Auth component extraction and hardening",
      "Stripe Connect security improvements",
      "localStorage sync moved from useMemo to useEffect",
      "Admin waitlist query gated behind role === 'admin'",
      "Payment intent handling refactored for safety",
    ],
  },
  {
    phase: "TypeScript Error Resolution",
    date: "Mar 18, 2026",
    agent: "manus" as Agent,
    linesAdded: 12,
    commits: 1,
    items: [
      "Fixed CoachDashboard role guard (role vs userType enum mismatch)",
      "Fixed AdminWaitlist null userType with ?? coalescing",
      "Fixed webhooks.ts null status guard before .includes()",
      "Fixed BookingModal stale 'lesson' property removed from schema",
      "Build confirmed at 0 TypeScript errors ✓",
    ],
  },
];

const FEATURES = [
  { cat: "Auth", name: "Email/password auth", done: true },
  { cat: "Auth", name: "Google OAuth", done: true },
  { cat: "Auth", name: "Password reset flow", done: true },
  { cat: "Auth", name: "Email verification", done: true },
  { cat: "Coaches", name: "Coach browse & search", done: true },
  { cat: "Coaches", name: "Coach profile pages", done: true },
  { cat: "Coaches", name: "AI vetting (LLM scoring)", done: true },
  { cat: "Coaches", name: "Multi-step application wizard", done: true },
  { cat: "Coaches", name: "Stripe Connect onboarding", done: true },
  { cat: "Coaches", name: "Guided onboarding wizard (post-approval)", done: false },
  { cat: "Bookings", name: "Time-slot booking modal", done: true },
  { cat: "Bookings", name: "Stripe Checkout payment", done: true },
  { cat: "Bookings", name: "Airbnb-style Accept/Decline", done: true },
  { cat: "Bookings", name: "Tiered cancellation & refund policy", done: true },
  { cat: "Bookings", name: "24-hour reminder emails", done: true },
  { cat: "Bookings", name: "Live countdown timer", done: true },
  { cat: "Bookings", name: "Group lessons", done: false },
  { cat: "Bookings", name: "Recurring subscriptions", done: false },
  { cat: "Payments", name: "Stripe webhook handler", done: true },
  { cat: "Payments", name: "Partial refunds", done: true },
  { cat: "Payments", name: "Coach payout dashboard", done: false },
  { cat: "Dashboards", name: "Student dashboard", done: true },
  { cat: "Dashboards", name: "Coach dashboard", done: true },
  { cat: "Dashboards", name: "Admin applications panel", done: true },
  { cat: "Dashboards", name: "Admin waitlist management", done: true },
  { cat: "Dashboards", name: "Revenue analytics dashboard", done: false },
  { cat: "Reviews", name: "Reviews DB schema (mutual)", done: true },
  { cat: "Reviews", name: "Review submission UI", done: false },
  { cat: "Reviews", name: "Reviews on coach profiles", done: false },
  { cat: "Emails", name: "Booking confirmations", done: true },
  { cat: "Emails", name: "Waitlist nurture (5-email sequence)", done: true },
  { cat: "Emails", name: "Password reset email", done: true },
  { cat: "Emails", name: "Email verification", done: true },
  { cat: "Emails", name: "24-hour lesson reminders", done: true },
  { cat: "Content", name: "PPV content marketplace", done: false },
  { cat: "Content", name: "Video lesson recordings", done: false },
  { cat: "Messaging", name: "In-app messaging per lesson", done: false },
  { cat: "Mobile", name: "React Native / Expo app", done: false },
  { cat: "Gamification", name: "Student progress tracking", done: false },
  { cat: "Gamification", name: "Achievement badges", done: false },
];

const ROADMAP = [
  {
    phase: "Phase 1",
    title: "MVP — Live",
    status: "complete" as const,
    color: "#00ff88",
    shadow: "rgba(0,255,136,0.25)",
    icon: "♟",
    items: [
      "Auth (email + Google OAuth)",
      "Coach profiles & browse",
      "Stripe booking & payments",
      "Student & coach dashboards",
      "AI coach vetting",
      "Admin panel",
      "Email notification system",
      "Cancellation & refund policy",
      "24-hour reminder scheduler",
    ],
  },
  {
    phase: "Phase 2",
    title: "Growth — In Progress",
    status: "active" as const,
    color: "#f59e0b",
    shadow: "rgba(245,158,11,0.25)",
    icon: "♜",
    items: [
      "Reviews & ratings UI",
      "Coach onboarding wizard",
      "Past lesson auto-status updates",
      "Coach payout dashboard",
      "In-app messaging per lesson",
      "Mobile app (React Native/Expo)",
      "Sign-in redirect fix",
      "Analytics for coaches",
    ],
  },
  {
    phase: "Phase 3",
    title: "Scale — Planned",
    status: "planned" as const,
    color: "#818cf8",
    shadow: "rgba(129,140,248,0.25)",
    icon: "♛",
    items: [
      "PPV content marketplace",
      "Group lessons",
      "Recurring subscriptions",
      "Video lesson recordings",
      "Student progress tracking",
      "Achievement gamification",
      "Revenue analytics",
      "Multi-currency support",
    ],
  },
  {
    phase: "Phase 4",
    title: "Enterprise — Vision",
    status: "vision" as const,
    color: "#ec4899",
    shadow: "rgba(236,72,153,0.25)",
    icon: "♚",
    items: [
      "Team & school accounts",
      "White-label for chess clubs",
      "Tournament integration",
      "AI lesson recommendations",
      "Live streaming lessons",
      "Third-party API",
      "Mobile app v2",
      "VC live metrics dashboard",
    ],
  },
];

// ─── PARTICLE SYSTEM ───────────────────────────────────────────────────────
function useParticles(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const animRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();
    window.addEventListener("resize", resize);

    const W = () => canvas.offsetWidth;
    const H = () => canvas.offsetHeight;

    type P = { x: number; y: number; vx: number; vy: number; r: number; hue: number; alpha: number };
    const hues = [240, 280, 160, 330, 200];
    const particles: P[] = Array.from({ length: 100 }, () => ({
      x: Math.random() * W(),
      y: Math.random() * H(),
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      r: Math.random() * 1.8 + 0.4,
      hue: hues[Math.floor(Math.random() * hues.length)],
      alpha: Math.random() * 0.5 + 0.15,
    }));

    let t = 0;
    const draw = () => {
      t++;
      ctx.clearRect(0, 0, W(), H());

      // Subtle grid
      ctx.strokeStyle = "rgba(99,102,241,0.04)";
      ctx.lineWidth = 1;
      const gridSize = 60;
      for (let x = 0; x < W(); x += gridSize) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H()); ctx.stroke();
      }
      for (let y = 0; y < H(); y += gridSize) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W(), y); ctx.stroke();
      }

      particles.forEach((p) => {
        p.x += p.vx + Math.sin(t * 0.003 + p.y * 0.01) * 0.1;
        p.y += p.vy + Math.cos(t * 0.003 + p.x * 0.01) * 0.1;
        if (p.x < 0) p.x = W();
        if (p.x > W()) p.x = 0;
        if (p.y < 0) p.y = H();
        if (p.y > H()) p.y = 0;

        const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 3);
        grd.addColorStop(0, `hsla(${p.hue},80%,65%,${p.alpha})`);
        grd.addColorStop(1, `hsla(${p.hue},80%,65%,0)`);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 3, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();
      });

      // Connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 90) {
            const alpha = (1 - d / 90) * 0.12;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(99,102,241,${alpha})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }

      animRef.current = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animRef.current);
    };
  }, [canvasRef]);
}

// ─── ANIMATED COUNTER ──────────────────────────────────────────────────────
function useCounter(target: number, duration = 1200) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setVal(target); clearInterval(timer); }
      else setVal(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);
  return val;
}

// ─── CHESS BOARD 3D ────────────────────────────────────────────────────────
function ChessBoard3D() {
  return (
    <div style={{ perspective: "600px", perspectiveOrigin: "50% 30%" }}>
      <div
        style={{
          transform: "rotateX(55deg) rotateZ(15deg)",
          transformStyle: "preserve-3d",
          width: 160,
          height: 160,
          display: "grid",
          gridTemplateColumns: "repeat(8, 1fr)",
          gridTemplateRows: "repeat(8, 1fr)",
          borderRadius: 4,
          overflow: "hidden",
          boxShadow: "0 30px 60px rgba(0,0,0,0.8), 0 0 40px rgba(99,102,241,0.3)",
          border: "1px solid rgba(99,102,241,0.3)",
        }}
      >
        {Array.from({ length: 64 }, (_, i) => {
          const row = Math.floor(i / 8);
          const col = i % 8;
          const isLight = (row + col) % 2 === 0;
          return (
            <div
              key={i}
              style={{
                background: isLight ? "rgba(129,140,248,0.15)" : "rgba(10,10,30,0.8)",
                borderRight: "1px solid rgba(99,102,241,0.08)",
                borderBottom: "1px solid rgba(99,102,241,0.08)",
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── STAT RING ─────────────────────────────────────────────────────────────
function StatRing({ pct, color, label, value }: { pct: number; color: string; label: string; value: string }) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: 88, height: 88 }}>
        <svg width="88" height="88" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="44" cy="44" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
          <circle
            cx="44" cy="44" r={r} fill="none"
            stroke={color} strokeWidth="6"
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 6px ${color})`, transition: "stroke-dasharray 1s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-black" style={{ color }}>{value}</span>
        </div>
      </div>
      <span className="text-xs text-white/40 text-center leading-tight">{label}</span>
    </div>
  );
}

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────
export default function DevDashboard() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useParticles(canvasRef);

  const [tab, setTab] = useState<TabType>("timeline");
  const [agentFilter, setAgentFilter] = useState<"all" | Agent>("all");
  const [catFilter, setCatFilter] = useState("All");
  const [hoveredPhase, setHoveredPhase] = useState<number | null>(null);

  const totalFeatures = FEATURES.length;
  const doneFeatures = FEATURES.filter((f) => f.done).length;
  const completionPct = Math.round((doneFeatures / totalFeatures) * 100);
  const manusPhases = BUILD_TIMELINE.filter((t) => t.agent === "manus").length;
  const claudePhases = BUILD_TIMELINE.filter((t) => t.agent === "claude").length;
  const totalLines = BUILD_TIMELINE.reduce((a, b) => a + b.linesAdded, 0);
  const manusLines = BUILD_TIMELINE.filter((t) => t.agent === "manus").reduce((a, b) => a + b.linesAdded, 0);
  const claudeLines = BUILD_TIMELINE.filter((t) => t.agent === "claude").reduce((a, b) => a + b.linesAdded, 0);

  const counterLines = useCounter(totalLines);
  const counterFeatures = useCounter(doneFeatures);
  const counterPct = useCounter(completionPct);

  const categories = ["All", ...Array.from(new Set(FEATURES.map((f) => f.cat)))];
  const filteredTimeline = BUILD_TIMELINE.filter((t) => agentFilter === "all" || t.agent === agentFilter);
  const filteredFeatures = FEATURES.filter((f) => catFilter === "All" || f.cat === catFilter);

  const TABS: { id: TabType; label: string; icon: string }[] = [
    { id: "timeline", label: "Build Timeline", icon: "⏱" },
    { id: "features", label: "Feature Tracker", icon: "✦" },
    { id: "roadmap", label: "Roadmap", icon: "◈" },
    { id: "stats", label: "Stats", icon: "◉" },
  ];

  return (
    <div
      className="min-h-screen text-white overflow-x-hidden"
      style={{
        background: "radial-gradient(ellipse at 20% 0%, rgba(99,102,241,0.12) 0%, transparent 50%), radial-gradient(ellipse at 80% 100%, rgba(236,72,153,0.08) 0%, transparent 50%), #04040f",
        fontFamily: "'Inter', 'SF Pro Display', system-ui, sans-serif",
      }}
    >
      {/* Particle canvas */}
      <canvas ref={canvasRef} className="fixed inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }} />

      <div className="relative" style={{ zIndex: 1 }}>

        {/* ── HEADER ── */}
        <header
          className="sticky top-0 border-b"
          style={{
            background: "rgba(4,4,15,0.85)",
            backdropFilter: "blur(24px)",
            borderColor: "rgba(99,102,241,0.12)",
            zIndex: 50,
          }}
        >
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Logo cube */}
              <div style={{ perspective: "200px" }}>
                <div
                  style={{
                    width: 40, height: 40,
                    background: "linear-gradient(135deg, #6366f1 0%, #ec4899 100%)",
                    borderRadius: 10,
                    transform: "rotateX(15deg) rotateY(-15deg)",
                    boxShadow: "0 8px 24px rgba(99,102,241,0.5), inset 0 1px 0 rgba(255,255,255,0.2)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 18, fontWeight: 900,
                  }}
                >
                  B
                </div>
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: "-0.02em" }}>BooGMe Dev Intelligence</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 1 }}>
                  Founder Dashboard · Cristian Chirila, GM
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "5px 12px", borderRadius: 20,
                  background: "rgba(0,255,136,0.08)",
                  border: "1px solid rgba(0,255,136,0.25)",
                  fontSize: 11, fontWeight: 600, color: "#00ff88",
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#00ff88", display: "inline-block", boxShadow: "0 0 6px #00ff88", animation: "pulse 2s infinite" }} />
                LIVE · boogme.com
              </div>
              <a
                href="/"
                style={{
                  fontSize: 12, color: "rgba(255,255,255,0.35)",
                  textDecoration: "none", padding: "6px 14px",
                  borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => { (e.target as HTMLElement).style.color = "rgba(255,255,255,0.8)"; (e.target as HTMLElement).style.borderColor = "rgba(255,255,255,0.2)"; }}
                onMouseLeave={(e) => { (e.target as HTMLElement).style.color = "rgba(255,255,255,0.35)"; (e.target as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)"; }}
              >
                ← Back to BooGMe
              </a>
            </div>
          </div>
        </header>

        {/* ── HERO ── */}
        <section className="max-w-7xl mx-auto px-6 pt-12 pb-8">
          <div className="flex items-start justify-between gap-8 flex-wrap">
            <div className="flex-1" style={{ minWidth: 280 }}>
              <div
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "4px 14px", borderRadius: 20, marginBottom: 16,
                  background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.25)",
                  fontSize: 11, fontWeight: 600, color: "#818cf8", letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                ◈ Build Intelligence Dashboard
              </div>
              <h1
                style={{
                  fontSize: "clamp(28px, 4vw, 48px)",
                  fontWeight: 900,
                  letterSpacing: "-0.03em",
                  lineHeight: 1.1,
                  marginBottom: 16,
                  background: "linear-gradient(135deg, #ffffff 0%, rgba(255,255,255,0.6) 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                Every line of code.<br />Every decision. Every fix.
              </h1>
              <p style={{ fontSize: 15, color: "rgba(255,255,255,0.45)", lineHeight: 1.7, maxWidth: 480 }}>
                A real-time view of BooGMe's complete build history — what Manus built, what Claude fixed,
                what's shipped, and what's coming. From $270M market to $686M by 2035.
              </p>

              {/* Market badge */}
              <div
                style={{
                  display: "inline-flex", alignItems: "center", gap: 10,
                  marginTop: 20, padding: "10px 16px", borderRadius: 12,
                  background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <span style={{ fontSize: 20 }}>📈</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.8)" }}>$270M → $686M market · 10.9% CAGR</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>Online chess instruction 2026–2035 · Redbud VC pitch submitted</div>
                </div>
              </div>
            </div>

            {/* 3D Chess Board */}
            <div className="flex-shrink-0 hidden md:flex items-center justify-center" style={{ width: 200, height: 200 }}>
              <ChessBoard3D />
            </div>
          </div>
        </section>

        {/* ── KPI STRIP ── */}
        <section className="max-w-7xl mx-auto px-6 pb-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              {
                value: `${counterPct}%`,
                label: "Product Complete",
                sub: `${counterFeatures}/${totalFeatures} features shipped`,
                color: "#00ff88",
                glow: "rgba(0,255,136,0.2)",
                icon: "◎",
              },
              {
                value: counterLines.toLocaleString(),
                label: "Lines of Code",
                sub: `${manusLines.toLocaleString()} Manus · ${claudeLines.toLocaleString()} Claude`,
                color: "#818cf8",
                glow: "rgba(129,140,248,0.2)",
                icon: "◈",
              },
              {
                value: manusPhases,
                label: "Manus Build Phases",
                sub: "Features, fixes & architecture",
                color: "#6366f1",
                glow: "rgba(99,102,241,0.2)",
                icon: "M",
              },
              {
                value: claudePhases,
                label: "Claude Audit Passes",
                sub: "Security & bug fix commits",
                color: "#f59e0b",
                glow: "rgba(245,158,11,0.2)",
                icon: "C",
              },
            ].map((kpi, i) => (
              <div
                key={i}
                style={{
                  borderRadius: 16,
                  padding: "20px 22px",
                  background: "rgba(255,255,255,0.025)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  boxShadow: `0 0 40px ${kpi.glow}, inset 0 1px 0 rgba(255,255,255,0.05)`,
                  position: "relative", overflow: "hidden",
                  transform: "perspective(400px) rotateX(2deg)",
                  transition: "transform 0.3s ease, box-shadow 0.3s ease",
                  cursor: "default",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = "perspective(400px) rotateX(0deg) translateY(-2px)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = "perspective(400px) rotateX(2deg)"; }}
              >
                <div
                  style={{
                    position: "absolute", top: -20, right: -20,
                    width: 80, height: 80, borderRadius: "50%",
                    background: kpi.color, opacity: 0.08, filter: "blur(20px)",
                  }}
                />
                <div style={{ position: "relative" }}>
                  <div
                    style={{
                      fontSize: 32, fontWeight: 900, letterSpacing: "-0.03em",
                      color: kpi.color, textShadow: `0 0 20px ${kpi.color}60`,
                      marginBottom: 4,
                    }}
                  >
                    {kpi.value}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.75)", marginBottom: 3 }}>{kpi.label}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{kpi.sub}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Master progress bar */}
          <div
            style={{
              marginTop: 16, borderRadius: 16, padding: "16px 22px",
              background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.5)" }}>Overall Build Progress</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#00ff88" }}>{completionPct}% complete</span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
              <div
                style={{
                  height: "100%", width: `${completionPct}%`,
                  background: "linear-gradient(90deg, #6366f1 0%, #00ff88 100%)",
                  borderRadius: 3,
                  boxShadow: "0 0 12px rgba(0,255,136,0.5)",
                  transition: "width 1.5s cubic-bezier(0.4,0,0.2,1)",
                }}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
              {["Phase 1 MVP", "Phase 2 Growth", "Phase 3 Scale", "Phase 4 Enterprise"].map((p, i) => (
                <span key={i} style={{ fontSize: 10, color: "rgba(255,255,255,0.2)" }}>{p}</span>
              ))}
            </div>
          </div>
        </section>

        {/* ── TABS ── */}
        <div className="max-w-7xl mx-auto px-6">
          <div
            style={{
              display: "inline-flex", gap: 4, padding: 4,
              borderRadius: 14, background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.07)", marginBottom: 28,
            }}
          >
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  padding: "8px 18px", borderRadius: 10,
                  fontSize: 13, fontWeight: 600,
                  border: "none", cursor: "pointer",
                  transition: "all 0.2s ease",
                  ...(tab === t.id
                    ? {
                        background: "linear-gradient(135deg, #6366f1, #818cf8)",
                        color: "white",
                        boxShadow: "0 4px 16px rgba(99,102,241,0.4)",
                      }
                    : {
                        background: "transparent",
                        color: "rgba(255,255,255,0.4)",
                      }),
                }}
              >
                <span style={{ marginRight: 6 }}>{t.icon}</span>{t.label}
              </button>
            ))}
          </div>

          {/* ── TIMELINE TAB ── */}
          {tab === "timeline" && (
            <div>
              <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
                {(["all", "manus", "claude"] as const).map((a) => (
                  <button
                    key={a}
                    onClick={() => setAgentFilter(a)}
                    style={{
                      padding: "6px 16px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                      border: "none", cursor: "pointer", transition: "all 0.2s",
                      ...(agentFilter === a
                        ? {
                            background: a === "manus" ? "rgba(99,102,241,0.25)" : a === "claude" ? "rgba(245,158,11,0.25)" : "rgba(255,255,255,0.12)",
                            color: a === "manus" ? "#818cf8" : a === "claude" ? "#fbbf24" : "white",
                            boxShadow: `0 0 12px ${a === "manus" ? "rgba(99,102,241,0.3)" : a === "claude" ? "rgba(245,158,11,0.3)" : "rgba(255,255,255,0.1)"}`,
                          }
                        : { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.35)" }),
                    }}
                  >
                    {a === "all" ? "All Phases" : a === "manus" ? "🤖 Manus" : "🔵 Claude"}
                  </button>
                ))}
                <span style={{ marginLeft: "auto", fontSize: 12, color: "rgba(255,255,255,0.25)", alignSelf: "center" }}>
                  {filteredTimeline.length} phases · {filteredTimeline.reduce((a, b) => a + b.linesAdded, 0).toLocaleString()} lines
                </span>
              </div>

              <div style={{ position: "relative" }}>
                {/* Timeline spine */}
                <div
                  style={{
                    position: "absolute", left: 20, top: 0, bottom: 0, width: 2,
                    background: "linear-gradient(to bottom, #6366f1, #ec4899, rgba(99,102,241,0.1))",
                    borderRadius: 1,
                  }}
                />

                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {filteredTimeline.map((phase, i) => {
                    const isManus = phase.agent === "manus";
                    const accent = isManus ? "#6366f1" : "#f59e0b";
                    const accentSoft = isManus ? "rgba(99,102,241,0.15)" : "rgba(245,158,11,0.15)";
                    const isHovered = hoveredPhase === i;

                    return (
                      <div
                        key={i}
                        style={{ display: "flex", gap: 20, alignItems: "flex-start" }}
                        onMouseEnter={() => setHoveredPhase(i)}
                        onMouseLeave={() => setHoveredPhase(null)}
                      >
                        {/* Node */}
                        <div style={{ flexShrink: 0, position: "relative", zIndex: 1 }}>
                          <div
                            style={{
                              width: 42, height: 42, borderRadius: "50%",
                              background: accentSoft,
                              border: `2px solid ${accent}`,
                              boxShadow: isHovered ? `0 0 20px ${accent}80` : `0 0 8px ${accent}40`,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 13, fontWeight: 900, color: accent,
                              transition: "all 0.2s ease",
                              transform: isHovered ? "scale(1.1)" : "scale(1)",
                            }}
                          >
                            {isManus ? "M" : "C"}
                          </div>
                        </div>

                        {/* Card */}
                        <div
                          style={{
                            flex: 1,
                            borderRadius: 14,
                            padding: "16px 20px",
                            background: isHovered ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.025)",
                            border: `1px solid ${isHovered ? accent + "40" : "rgba(255,255,255,0.06)"}`,
                            boxShadow: isHovered ? `0 8px 32px ${accent}20` : "none",
                            transition: "all 0.25s ease",
                            transform: isHovered ? "perspective(600px) rotateX(0deg) translateX(4px)" : "perspective(600px) rotateX(1deg)",
                            cursor: "default",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10, gap: 12 }}>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 14, color: "rgba(255,255,255,0.9)", marginBottom: 3 }}>{phase.phase}</div>
                              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{phase.date}</div>
                            </div>
                            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                              <span
                                style={{
                                  fontSize: 11, padding: "3px 10px", borderRadius: 20, fontWeight: 600,
                                  background: accentSoft, color: accent,
                                  border: `1px solid ${accent}40`,
                                }}
                              >
                                {isManus ? "🤖 Manus" : "🔵 Claude"}
                              </span>
                              <span
                                style={{
                                  fontSize: 11, padding: "3px 10px", borderRadius: 20, fontWeight: 600,
                                  background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.3)",
                                  border: "1px solid rgba(255,255,255,0.08)",
                                }}
                              >
                                +{phase.linesAdded.toLocaleString()} lines
                              </span>
                            </div>
                          </div>
                          <ul style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {phase.items.map((item, j) => (
                              <li key={j} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: "rgba(255,255,255,0.55)" }}>
                                <span
                                  style={{
                                    flexShrink: 0, marginTop: 6,
                                    width: 5, height: 5, borderRadius: "50%",
                                    background: accent, boxShadow: `0 0 4px ${accent}`,
                                    display: "inline-block",
                                  }}
                                />
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── FEATURES TAB ── */}
          {tab === "features" && (
            <div>
              {/* Category pills */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
                {categories.map((cat) => {
                  const catItems = FEATURES.filter((f) => f.cat === cat || cat === "All");
                  const catDone = catItems.filter((f) => f.done).length;
                  const pct = Math.round((catDone / catItems.length) * 100);
                  return (
                    <button
                      key={cat}
                      onClick={() => setCatFilter(cat)}
                      style={{
                        padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                        border: "none", cursor: "pointer", transition: "all 0.2s",
                        ...(catFilter === cat
                          ? { background: "rgba(99,102,241,0.25)", color: "#818cf8", boxShadow: "0 0 12px rgba(99,102,241,0.3)" }
                          : { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.35)" }),
                      }}
                    >
                      {cat} {cat !== "All" && <span style={{ opacity: 0.5, marginLeft: 4 }}>{pct}%</span>}
                    </button>
                  );
                })}
              </div>

              {/* Feature grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 8 }}>
                {filteredFeatures.map((f, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "12px 16px", borderRadius: 12,
                      background: f.done ? "rgba(0,255,136,0.04)" : "rgba(255,255,255,0.02)",
                      border: f.done ? "1px solid rgba(0,255,136,0.12)" : "1px solid rgba(255,255,255,0.05)",
                      transition: "all 0.2s",
                    }}
                  >
                    <div
                      style={{
                        width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 11, fontWeight: 700,
                        ...(f.done
                          ? { background: "rgba(0,255,136,0.15)", border: "1px solid rgba(0,255,136,0.4)", color: "#00ff88" }
                          : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.2)" }),
                      }}
                    >
                      {f.done ? "✓" : "·"}
                    </div>
                    <span style={{ fontSize: 13, flex: 1, color: f.done ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.3)" }}>
                      {f.name}
                    </span>
                    <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.25)", flexShrink: 0 }}>
                      {f.cat}
                    </span>
                  </div>
                ))}
              </div>

              {/* Category breakdown rings */}
              <div
                style={{
                  marginTop: 32, padding: "24px 28px", borderRadius: 16,
                  background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.5)", marginBottom: 20 }}>Completion by Category</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 24, justifyContent: "center" }}>
                  {categories.slice(1).map((cat) => {
                    const catItems = FEATURES.filter((f) => f.cat === cat);
                    const catDone = catItems.filter((f) => f.done).length;
                    const pct = Math.round((catDone / catItems.length) * 100);
                    const color = pct === 100 ? "#00ff88" : pct >= 60 ? "#f59e0b" : pct >= 30 ? "#818cf8" : "#ec4899";
                    return (
                      <StatRing key={cat} pct={pct} color={color} label={cat} value={`${pct}%`} />
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── ROADMAP TAB ── */}
          {tab === "roadmap" && (
            <div>
              {/* Timeline connector */}
              <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 32, overflowX: "auto", paddingBottom: 8 }}>
                {ROADMAP.map((p, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                    <div
                      style={{
                        display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                        padding: "8px 16px",
                      }}
                    >
                      <div
                        style={{
                          width: 40, height: 40, borderRadius: "50%",
                          background: p.status === "complete" ? p.color : p.status === "active" ? `${p.color}30` : "rgba(255,255,255,0.05)",
                          border: `2px solid ${p.color}`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 18,
                          boxShadow: p.status !== "vision" ? `0 0 16px ${p.shadow}` : "none",
                        }}
                      >
                        {p.icon}
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 600, color: p.color, whiteSpace: "nowrap" }}>{p.phase}</span>
                    </div>
                    {i < ROADMAP.length - 1 && (
                      <div
                        style={{
                          height: 2, width: 60, flexShrink: 0,
                          background: i === 0 ? `linear-gradient(90deg, ${ROADMAP[0].color}, ${ROADMAP[1].color})` : `linear-gradient(90deg, ${ROADMAP[i].color}40, ${ROADMAP[i + 1].color}20)`,
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
                {ROADMAP.map((phase, i) => (
                  <div
                    key={i}
                    style={{
                      borderRadius: 18, padding: "22px 24px",
                      background: "rgba(255,255,255,0.025)",
                      border: `1px solid ${phase.color}25`,
                      boxShadow: `0 0 40px ${phase.shadow}, inset 0 1px 0 rgba(255,255,255,0.04)`,
                      position: "relative", overflow: "hidden",
                      transform: `perspective(600px) rotateX(${i % 2 === 0 ? 1.5 : -1.5}deg)`,
                      transition: "transform 0.3s ease",
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = "perspective(600px) rotateX(0deg) translateY(-4px)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = `perspective(600px) rotateX(${i % 2 === 0 ? 1.5 : -1.5}deg)`; }}
                  >
                    {/* Glow orb */}
                    <div style={{ position: "absolute", top: -30, right: -30, width: 100, height: 100, borderRadius: "50%", background: phase.color, opacity: 0.12, filter: "blur(30px)" }} />

                    <div style={{ position: "relative" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: phase.color, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>{phase.phase}</div>
                          <div style={{ fontSize: 16, fontWeight: 800, color: "rgba(255,255,255,0.9)" }}>{phase.title}</div>
                        </div>
                        <span style={{ fontSize: 28 }}>{phase.icon}</span>
                      </div>

                      <div
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 6,
                          padding: "4px 12px", borderRadius: 20, marginBottom: 16,
                          background: `${phase.color}15`, border: `1px solid ${phase.color}30`,
                          fontSize: 11, fontWeight: 600, color: phase.color,
                        }}
                      >
                        {phase.status === "complete" ? "✅ Complete" : phase.status === "active" ? "⚡ In Progress" : phase.status === "planned" ? "📋 Planned" : "🔮 Vision"}
                      </div>

                      <ul style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {phase.items.map((item, j) => (
                          <li key={j} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13 }}>
                            <span
                              style={{
                                flexShrink: 0, marginTop: 5,
                                width: 5, height: 5, borderRadius: "50%",
                                background: phase.color,
                                boxShadow: `0 0 5px ${phase.color}`,
                                display: "inline-block",
                              }}
                            />
                            <span style={{ color: phase.status === "complete" ? "rgba(255,255,255,0.7)" : phase.status === "active" ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.35)" }}>
                              {item}
                            </span>
                          </li>
                        ))}
                      </ul>

                      {phase.status === "active" && (
                        <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "rgba(255,255,255,0.3)", marginBottom: 6 }}>
                            <span>Phase progress</span><span>~30%</span>
                          </div>
                          <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
                            <div style={{ height: "100%", width: "30%", background: phase.color, borderRadius: 2, boxShadow: `0 0 8px ${phase.color}` }} />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── STATS TAB ── */}
          {tab === "stats" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Agent comparison */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[
                  { agent: "Manus", color: "#6366f1", shadow: "rgba(99,102,241,0.25)", icon: "🤖", phases: manusPhases, lines: manusLines, pct: Math.round((manusLines / totalLines) * 100), role: "Architecture, features, UX, email system, bug fixes" },
                  { agent: "Claude", color: "#f59e0b", shadow: "rgba(245,158,11,0.25)", icon: "🔵", phases: claudePhases, lines: claudeLines, pct: Math.round((claudeLines / totalLines) * 100), role: "Security audits, vulnerability fixes, code hardening" },
                ].map((a) => (
                  <div
                    key={a.agent}
                    style={{
                      borderRadius: 18, padding: "24px",
                      background: "rgba(255,255,255,0.025)",
                      border: `1px solid ${a.color}25`,
                      boxShadow: `0 0 40px ${a.shadow}`,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                      <div
                        style={{
                          width: 48, height: 48, borderRadius: 14,
                          background: `${a.color}20`, border: `2px solid ${a.color}40`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 22,
                        }}
                      >
                        {a.icon}
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 18, color: "rgba(255,255,255,0.9)" }}>{a.agent}</div>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{a.role}</div>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                      {[
                        { label: "Phases", value: a.phases },
                        { label: "Lines", value: a.lines.toLocaleString() },
                        { label: "Share", value: `${a.pct}%` },
                      ].map((stat) => (
                        <div key={stat.label} style={{ textAlign: "center" }}>
                          <div style={{ fontSize: 22, fontWeight: 900, color: a.color }}>{stat.value}</div>
                          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>{stat.label}</div>
                        </div>
                      ))}
                    </div>
                    {/* Bar */}
                    <div style={{ marginTop: 16, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${a.pct}%`, background: a.color, borderRadius: 2, boxShadow: `0 0 8px ${a.color}` }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Lines per phase chart */}
              <div
                style={{
                  borderRadius: 18, padding: "24px",
                  background: "rgba(255,255,255,0.025)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.5)", marginBottom: 20 }}>Lines Added per Build Phase</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {BUILD_TIMELINE.map((phase, i) => {
                    const isManus = phase.agent === "manus";
                    const color = isManus ? "#6366f1" : "#f59e0b";
                    const maxLines = Math.max(...BUILD_TIMELINE.map((p) => p.linesAdded));
                    const barWidth = (phase.linesAdded / maxLines) * 100;
                    return (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 160, fontSize: 11, color: "rgba(255,255,255,0.4)", textAlign: "right", flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {phase.phase}
                        </div>
                        <div style={{ flex: 1, height: 20, borderRadius: 4, background: "rgba(255,255,255,0.04)", overflow: "hidden" }}>
                          <div
                            style={{
                              height: "100%", width: `${barWidth}%`,
                              background: `linear-gradient(90deg, ${color}80, ${color})`,
                              borderRadius: 4,
                              boxShadow: `0 0 8px ${color}40`,
                              display: "flex", alignItems: "center", paddingLeft: 8,
                            }}
                          >
                            <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.7)", whiteSpace: "nowrap" }}>
                              +{phase.linesAdded.toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <span style={{ fontSize: 10, color: color, fontWeight: 600, width: 20, flexShrink: 0 }}>
                          {isManus ? "M" : "C"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Tech stack */}
              <div
                style={{
                  borderRadius: 18, padding: "24px",
                  background: "rgba(255,255,255,0.025)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.5)", marginBottom: 20 }}>Tech Stack</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {[
                    ["Next.js 15", "#00d8ff"], ["React 19", "#61dafb"], ["TypeScript", "#3178c6"],
                    ["tRPC 11", "#398ccb"], ["Drizzle ORM", "#c5f74f"], ["MySQL / TiDB", "#4479a1"],
                    ["Stripe", "#635bff"], ["Resend", "#000000"], ["Tailwind CSS 4", "#38bdf8"],
                    ["Vite 7", "#646cff"], ["Vitest", "#6e9f18"], ["Express 4", "#68a063"],
                  ].map(([name, color]) => (
                    <span
                      key={name}
                      style={{
                        padding: "6px 14px", borderRadius: 20,
                        fontSize: 12, fontWeight: 600,
                        background: `${color}15`, color: color,
                        border: `1px solid ${color}30`,
                      }}
                    >
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div
            style={{
              marginTop: 48, paddingTop: 24, paddingBottom: 32,
              borderTop: "1px solid rgba(255,255,255,0.05)",
              display: "flex", justifyContent: "space-between", alignItems: "center",
              flexWrap: "wrap", gap: 12,
            }}
          >
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)" }}>
              BooGMe LLC · Founded February 2026 · Sole Proprietor · Cristian Chirila, GM
            </span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)" }}>
              Built with Manus AI + Claude · Powered by boogme.com
            </span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(0.9); }
        }
      `}</style>
    </div>
  );
}
