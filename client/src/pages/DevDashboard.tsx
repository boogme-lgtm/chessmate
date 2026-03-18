import { useEffect, useRef, useState } from "react";

// ─── DATA ──────────────────────────────────────────────────────────────────

const BUILD_TIMELINE = [
  {
    phase: "Foundation",
    date: "Feb 2026",
    agent: "manus",
    items: [
      "Next.js 15 + React 19 + TypeScript + tRPC 11 scaffold",
      "MySQL / Drizzle ORM schema (users, coaches, lessons, reviews)",
      "Custom email/password auth + Google OAuth",
      "Landing page with cyberpunk chess aesthetic",
      "Coach browse & profile pages",
    ],
  },
  {
    phase: "Booking & Payments",
    date: "Feb 2026",
    agent: "manus",
    items: [
      "Stripe Checkout integration with Connect (coach payouts)",
      "Booking modal with time-slot selection",
      "Lesson detail / payment success page",
      "Stripe webhook handler for payment status updates",
      "Platform fee logic (commission split)",
    ],
  },
  {
    phase: "Auth Hardening",
    date: "Feb 2026",
    agent: "manus",
    items: [
      "Fixed cookie name mismatch (session vs app_session_id)",
      "Fixed JWT payload for email/password users",
      "Fixed sign-in redirect loop (render-phase navigation)",
      "Password visibility toggles on all auth forms",
      "Google OAuth redirect fix",
    ],
  },
  {
    phase: "Coach Application & AI Vetting",
    date: "Feb 2026",
    agent: "manus",
    items: [
      "Multi-step coach application wizard (7 steps)",
      "AI confidence scoring + red flag detection via LLM",
      "Admin dashboard for reviewing applications",
      "Waitlist management with CSV export",
      "5-email nurture sequence (Resend API)",
    ],
  },
  {
    phase: "Dashboard UX",
    date: "Feb 2026",
    agent: "manus",
    items: [
      "Student dashboard with upcoming/past lessons",
      "Coach dashboard with Accept/Decline buttons",
      "Airbnb-style booking confirmation flow",
      "Lesson status badges (Pending, Confirmed, Declined, No Show, Completed)",
      "Mutual reviews schema (Airbnb-style)",
    ],
  },
  {
    phase: "Email & Reminders",
    date: "Feb–Mar 2026",
    agent: "manus",
    items: [
      "Booking confirmation emails (student + coach)",
      "24-hour reminder email scheduler (cron, runs hourly)",
      "Cancellation confirmation dialog with exact refund amount",
      "Tiered refund policy (>48h=100%, 24-48h=50%, <24h=0%)",
      "Live countdown timer on lesson cards (color-coded)",
    ],
  },
  {
    phase: "Security Audit — Deep Fix",
    date: "Mar 2026",
    agent: "claude",
    items: [
      "Fixed 11 security vulnerabilities (SQL injection guards, input validation)",
      "Fixed Stripe refund calculation bugs",
      "Fixed cancellation policy edge cases",
      "Fixed lesson filtering logic",
      "Auth token hardening",
    ],
  },
  {
    phase: "Client-Side Bug Fixes",
    date: "Mar 2026",
    agent: "claude",
    items: [
      "Fixed React hooks order violations",
      "Added role guards to admin pages",
      "CSV injection prevention in admin export",
      "Fixed popup blocker issue on Stripe redirect",
      "JSON.parse try/catch guards in AdminApplications",
    ],
  },
  {
    phase: "Security Refactoring",
    date: "Mar 2026",
    agent: "claude",
    items: [
      "Auth component extraction & hardening",
      "Stripe Connect security improvements",
      "localStorage sync moved to useEffect (not useMemo)",
      "Admin waitlist query gated behind role check",
      "Payment intent handling refactored",
    ],
  },
  {
    phase: "TypeScript Error Fixes",
    date: "Mar 2026",
    agent: "manus",
    items: [
      "Fixed CoachDashboard role guard (role vs userType enum)",
      "Fixed AdminWaitlist null userType coalescing",
      "Fixed webhooks.ts null status guard",
      "Fixed BookingModal stale lesson property removed from schema",
      "Build now at 0 TypeScript errors",
    ],
  },
];

const COMPLETED_FEATURES = [
  { category: "Auth", name: "Email/password registration & login", done: true },
  { category: "Auth", name: "Google OAuth", done: true },
  { category: "Auth", name: "Password reset flow", done: true },
  { category: "Auth", name: "Email verification", done: true },
  { category: "Coaches", name: "Coach browse & search", done: true },
  { category: "Coaches", name: "Coach profile pages", done: true },
  { category: "Coaches", name: "Multi-step application wizard", done: true },
  { category: "Coaches", name: "AI vetting (confidence score + red flags)", done: true },
  { category: "Coaches", name: "Stripe Connect onboarding", done: true },
  { category: "Coaches", name: "Coach onboarding wizard (guided 7-step)", done: false },
  { category: "Bookings", name: "Time-slot booking modal", done: true },
  { category: "Bookings", name: "Stripe Checkout payment", done: true },
  { category: "Bookings", name: "Airbnb-style Accept/Decline flow", done: true },
  { category: "Bookings", name: "Cancellation with tiered refund policy", done: true },
  { category: "Bookings", name: "24-hour reminder emails", done: true },
  { category: "Bookings", name: "Live countdown timer", done: true },
  { category: "Bookings", name: "Group lessons", done: false },
  { category: "Bookings", name: "Recurring lesson subscriptions", done: false },
  { category: "Payments", name: "Stripe webhook handler", done: true },
  { category: "Payments", name: "Partial refunds", done: true },
  { category: "Payments", name: "Coach payout dashboard", done: false },
  { category: "Dashboards", name: "Student dashboard", done: true },
  { category: "Dashboards", name: "Coach dashboard", done: true },
  { category: "Dashboards", name: "Admin applications dashboard", done: true },
  { category: "Dashboards", name: "Admin waitlist management", done: true },
  { category: "Dashboards", name: "Analytics dashboard (revenue, bookings)", done: false },
  { category: "Reviews", name: "Reviews schema (mutual Airbnb-style)", done: true },
  { category: "Reviews", name: "Reviews submission UI", done: false },
  { category: "Reviews", name: "Reviews display on coach profiles", done: false },
  { category: "Emails", name: "Booking confirmation emails", done: true },
  { category: "Emails", name: "Waitlist nurture sequence (5 emails)", done: true },
  { category: "Emails", name: "Password reset email", done: true },
  { category: "Emails", name: "Email verification", done: true },
  { category: "Emails", name: "24-hour lesson reminders", done: true },
  { category: "Content", name: "PPV content marketplace (Phase 2)", done: false },
  { category: "Content", name: "Video lesson recordings", done: false },
  { category: "Messaging", name: "In-app messaging per lesson", done: false },
  { category: "Mobile", name: "React Native / Expo mobile app", done: false },
  { category: "Gamification", name: "Student progress tracking", done: false },
  { category: "Gamification", name: "Achievement badges", done: false },
];

const ROADMAP = [
  {
    phase: "Phase 1 — MVP",
    status: "complete",
    color: "#00ff88",
    items: [
      "Auth system (email + Google OAuth)",
      "Coach profiles & browse",
      "Booking + Stripe payments",
      "Student & coach dashboards",
      "Email notifications",
      "AI coach vetting",
      "Admin panel",
      "Cancellation & refund policy",
      "24-hour reminder system",
    ],
  },
  {
    phase: "Phase 2 — Growth",
    status: "in-progress",
    color: "#f59e0b",
    items: [
      "Reviews & ratings UI",
      "Coach onboarding wizard",
      "Past lesson auto-status updates",
      "Coach payout dashboard",
      "Analytics for coaches",
      "Mobile app (React Native/Expo)",
      "In-app messaging per lesson",
      "Sign-in redirect fix",
    ],
  },
  {
    phase: "Phase 3 — Scale",
    status: "planned",
    color: "#6366f1",
    items: [
      "PPV content marketplace",
      "Group lessons",
      "Recurring subscriptions",
      "Video lesson recordings",
      "Student progress tracking",
      "Achievement gamification",
      "Revenue analytics dashboard",
      "Multi-currency support",
    ],
  },
  {
    phase: "Phase 4 — Enterprise",
    status: "planned",
    color: "#ec4899",
    items: [
      "Team/school accounts",
      "White-label for chess clubs",
      "Tournament integration",
      "AI-powered lesson recommendations",
      "Live streaming lessons",
      "API for third-party integrations",
      "Mobile app v2 (native features)",
      "VC pitch deck live metrics",
    ],
  },
];

// ─── COMPONENT ─────────────────────────────────────────────────────────────

export default function DevDashboard() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [activeTab, setActiveTab] = useState<"timeline" | "features" | "roadmap">("timeline");
  const [filterAgent, setFilterAgent] = useState<"all" | "manus" | "claude">("all");
  const [filterCategory, setFilterCategory] = useState("All");
  const animRef = useRef<number>(0);

  const completedCount = COMPLETED_FEATURES.filter((f) => f.done).length;
  const totalCount = COMPLETED_FEATURES.length;
  const completionPct = Math.round((completedCount / totalCount) * 100);

  const manusCommits = BUILD_TIMELINE.filter((t) => t.agent === "manus").length;
  const claudeCommits = BUILD_TIMELINE.filter((t) => t.agent === "claude").length;

  // ── Three.js-style particle canvas ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    type Particle = { x: number; y: number; vx: number; vy: number; r: number; alpha: number; color: string };
    const colors = ["#6366f1", "#00ff88", "#f59e0b", "#ec4899", "#38bdf8"];
    const particles: Particle[] = Array.from({ length: 80 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      r: Math.random() * 2 + 0.5,
      alpha: Math.random() * 0.6 + 0.2,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color + Math.round(p.alpha * 255).toString(16).padStart(2, "0");
        ctx.fill();
      });

      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 100) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(99,102,241,${0.15 * (1 - dist / 100)})`;
            ctx.lineWidth = 0.5;
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
  }, []);

  const filteredTimeline = BUILD_TIMELINE.filter(
    (t) => filterAgent === "all" || t.agent === filterAgent
  );

  const categories = ["All", ...Array.from(new Set(COMPLETED_FEATURES.map((f) => f.category)))];
  const filteredFeatures = COMPLETED_FEATURES.filter(
    (f) => filterCategory === "All" || f.category === filterCategory
  );

  return (
    <div className="min-h-screen bg-[#050510] text-white overflow-x-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Particle canvas background */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 w-full h-full pointer-events-none"
        style={{ zIndex: 0 }}
      />

      {/* Content */}
      <div className="relative" style={{ zIndex: 1 }}>
        {/* Header */}
        <div className="border-b border-white/5 bg-black/40 backdrop-blur-xl sticky top-0" style={{ zIndex: 10 }}>
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-black"
                style={{ background: "linear-gradient(135deg, #6366f1, #ec4899)", boxShadow: "0 0 20px rgba(99,102,241,0.5)" }}
              >
                B
              </div>
              <div>
                <div className="font-bold text-lg tracking-tight">BooGMe Dev Dashboard</div>
                <div className="text-xs text-white/40">Founder Build Intelligence</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium" style={{ background: "rgba(0,255,136,0.1)", border: "1px solid rgba(0,255,136,0.3)", color: "#00ff88" }}>
                <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-pulse inline-block" />
                Live
              </div>
              <a href="/" className="text-xs text-white/40 hover:text-white/80 transition-colors">← Back to BooGMe</a>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-10">

          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
            {[
              { label: "Build Phases", value: BUILD_TIMELINE.length, sub: "total checkpoints", color: "#6366f1", glow: "rgba(99,102,241,0.3)" },
              { label: "Manus Commits", value: manusCommits, sub: "feature builds", color: "#00ff88", glow: "rgba(0,255,136,0.3)" },
              { label: "Claude Commits", value: claudeCommits, sub: "security & bug fixes", color: "#f59e0b", glow: "rgba(245,158,11,0.3)" },
              { label: "Completion", value: `${completionPct}%`, sub: `${completedCount}/${totalCount} features`, color: "#ec4899", glow: "rgba(236,72,153,0.3)" },
            ].map((kpi) => (
              <div
                key={kpi.label}
                className="rounded-2xl p-5 relative overflow-hidden"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  boxShadow: `0 0 40px ${kpi.glow}`,
                  transform: "perspective(600px) rotateX(2deg)",
                }}
              >
                <div className="absolute inset-0 opacity-10" style={{ background: `radial-gradient(circle at 70% 30%, ${kpi.color}, transparent 60%)` }} />
                <div className="relative">
                  <div className="text-3xl font-black mb-1" style={{ color: kpi.color }}>{kpi.value}</div>
                  <div className="font-semibold text-sm text-white/80">{kpi.label}</div>
                  <div className="text-xs text-white/40 mt-0.5">{kpi.sub}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Progress Bar */}
          <div
            className="rounded-2xl p-6 mb-10"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="font-semibold text-white/80">Overall Product Completion</span>
              <span className="text-2xl font-black" style={{ color: "#00ff88" }}>{completionPct}%</span>
            </div>
            <div className="h-3 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{
                  width: `${completionPct}%`,
                  background: "linear-gradient(90deg, #6366f1, #00ff88)",
                  boxShadow: "0 0 12px rgba(0,255,136,0.6)",
                }}
              />
            </div>
            <div className="flex justify-between text-xs text-white/30 mt-2">
              <span>MVP Foundation</span>
              <span>Phase 2 Growth</span>
              <span>Phase 3 Scale</span>
              <span>Phase 4 Enterprise</span>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-8">
            {(["timeline", "features", "roadmap"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold capitalize transition-all duration-200"
                style={
                  activeTab === tab
                    ? { background: "linear-gradient(135deg, #6366f1, #ec4899)", color: "white", boxShadow: "0 0 20px rgba(99,102,241,0.4)" }
                    : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.08)" }
                }
              >
                {tab === "timeline" ? "🕐 Build Timeline" : tab === "features" ? "✅ Feature Tracker" : "🗺️ Roadmap"}
              </button>
            ))}
          </div>

          {/* ── TIMELINE TAB ── */}
          {activeTab === "timeline" && (
            <div>
              <div className="flex gap-2 mb-6">
                {(["all", "manus", "claude"] as const).map((a) => (
                  <button
                    key={a}
                    onClick={() => setFilterAgent(a)}
                    className="px-4 py-1.5 rounded-full text-xs font-semibold capitalize transition-all"
                    style={
                      filterAgent === a
                        ? {
                            background: a === "manus" ? "rgba(99,102,241,0.3)" : a === "claude" ? "rgba(245,158,11,0.3)" : "rgba(255,255,255,0.15)",
                            color: a === "manus" ? "#818cf8" : a === "claude" ? "#fbbf24" : "white",
                            border: `1px solid ${a === "manus" ? "#6366f1" : a === "claude" ? "#f59e0b" : "rgba(255,255,255,0.3)"}`,
                          }
                        : { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)" }
                    }
                  >
                    {a === "all" ? "All" : a === "manus" ? "🤖 Manus" : "🔵 Claude"}
                  </button>
                ))}
              </div>

              <div className="relative">
                {/* Vertical line */}
                <div className="absolute left-[22px] top-0 bottom-0 w-px" style={{ background: "linear-gradient(to bottom, #6366f1, #ec4899, transparent)" }} />

                <div className="space-y-6">
                  {filteredTimeline.map((phase, i) => (
                    <div key={i} className="flex gap-6 group">
                      {/* Dot */}
                      <div className="relative flex-shrink-0 mt-1">
                        <div
                          className="w-11 h-11 rounded-full flex items-center justify-center text-lg font-black border-2 transition-all duration-300"
                          style={{
                            background: phase.agent === "manus" ? "rgba(99,102,241,0.2)" : "rgba(245,158,11,0.2)",
                            borderColor: phase.agent === "manus" ? "#6366f1" : "#f59e0b",
                            boxShadow: `0 0 16px ${phase.agent === "manus" ? "rgba(99,102,241,0.5)" : "rgba(245,158,11,0.5)"}`,
                          }}
                        >
                          {phase.agent === "manus" ? "M" : "C"}
                        </div>
                      </div>

                      {/* Card */}
                      <div
                        className="flex-1 rounded-2xl p-5 transition-all duration-300"
                        style={{
                          background: "rgba(255,255,255,0.03)",
                          border: `1px solid ${phase.agent === "manus" ? "rgba(99,102,241,0.2)" : "rgba(245,158,11,0.2)"}`,
                          transform: "perspective(800px) rotateX(1deg)",
                        }}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="font-bold text-white">{phase.phase}</div>
                            <div className="text-xs text-white/40 mt-0.5">{phase.date}</div>
                          </div>
                          <span
                            className="text-xs px-2.5 py-1 rounded-full font-semibold"
                            style={
                              phase.agent === "manus"
                                ? { background: "rgba(99,102,241,0.2)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.3)" }
                                : { background: "rgba(245,158,11,0.2)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.3)" }
                            }
                          >
                            {phase.agent === "manus" ? "🤖 Manus" : "🔵 Claude"}
                          </span>
                        </div>
                        <ul className="space-y-1.5">
                          {phase.items.map((item, j) => (
                            <li key={j} className="flex items-start gap-2 text-sm text-white/60">
                              <span className="mt-1 flex-shrink-0 w-1.5 h-1.5 rounded-full" style={{ background: phase.agent === "manus" ? "#6366f1" : "#f59e0b" }} />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── FEATURES TAB ── */}
          {activeTab === "features" && (
            <div>
              <div className="flex flex-wrap gap-2 mb-6">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setFilterCategory(cat)}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                    style={
                      filterCategory === cat
                        ? { background: "rgba(99,102,241,0.3)", color: "#818cf8", border: "1px solid #6366f1" }
                        : { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)" }
                    }
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                {filteredFeatures.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-200"
                    style={{
                      background: f.done ? "rgba(0,255,136,0.04)" : "rgba(255,255,255,0.02)",
                      border: f.done ? "1px solid rgba(0,255,136,0.15)" : "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs"
                      style={
                        f.done
                          ? { background: "rgba(0,255,136,0.2)", border: "1px solid #00ff88", color: "#00ff88" }
                          : { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.2)" }
                      }
                    >
                      {f.done ? "✓" : "○"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium truncate ${f.done ? "text-white/80" : "text-white/35"}`}>{f.name}</div>
                    </div>
                    <span
                      className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.3)" }}
                    >
                      {f.category}
                    </span>
                  </div>
                ))}
              </div>

              {/* Category breakdown */}
              <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
                {categories.slice(1).map((cat) => {
                  const catFeatures = COMPLETED_FEATURES.filter((f) => f.category === cat);
                  const catDone = catFeatures.filter((f) => f.done).length;
                  const pct = Math.round((catDone / catFeatures.length) * 100);
                  return (
                    <div
                      key={cat}
                      className="rounded-xl p-4"
                      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
                    >
                      <div className="text-xs text-white/40 mb-1">{cat}</div>
                      <div className="text-xl font-black" style={{ color: pct === 100 ? "#00ff88" : pct > 50 ? "#f59e0b" : "#6366f1" }}>{pct}%</div>
                      <div className="text-xs text-white/30">{catDone}/{catFeatures.length}</div>
                      <div className="mt-2 h-1 rounded-full bg-white/5 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${pct}%`,
                            background: pct === 100 ? "#00ff88" : pct > 50 ? "#f59e0b" : "#6366f1",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── ROADMAP TAB ── */}
          {activeTab === "roadmap" && (
            <div className="grid md:grid-cols-2 gap-6">
              {ROADMAP.map((phase, i) => (
                <div
                  key={i}
                  className="rounded-2xl p-6 relative overflow-hidden"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: `1px solid ${phase.color}33`,
                    boxShadow: `0 0 40px ${phase.color}15`,
                    transform: `perspective(800px) rotateX(${i % 2 === 0 ? 1 : -1}deg) rotateY(${i < 2 ? 1 : -1}deg)`,
                  }}
                >
                  {/* Glow orb */}
                  <div
                    className="absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-20 blur-3xl"
                    style={{ background: phase.color }}
                  />

                  <div className="relative">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <div className="font-bold text-white text-lg">{phase.phase}</div>
                      </div>
                      <span
                        className="text-xs px-3 py-1 rounded-full font-semibold capitalize"
                        style={{
                          background: `${phase.color}20`,
                          color: phase.color,
                          border: `1px solid ${phase.color}40`,
                        }}
                      >
                        {phase.status === "complete" ? "✅ Complete" : phase.status === "in-progress" ? "⚡ In Progress" : "📋 Planned"}
                      </span>
                    </div>

                    <ul className="space-y-2">
                      {phase.items.map((item, j) => (
                        <li key={j} className="flex items-start gap-2.5 text-sm">
                          <span
                            className="mt-1.5 flex-shrink-0 w-1.5 h-1.5 rounded-full"
                            style={{ background: phase.color, boxShadow: `0 0 6px ${phase.color}` }}
                          />
                          <span style={{ color: phase.status === "complete" ? "rgba(255,255,255,0.7)" : phase.status === "in-progress" ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.35)" }}>
                            {item}
                          </span>
                        </li>
                      ))}
                    </ul>

                    {/* Phase progress bar */}
                    {phase.status === "in-progress" && (
                      <div className="mt-4 pt-4 border-t border-white/5">
                        <div className="flex justify-between text-xs text-white/30 mb-1.5">
                          <span>Progress</span>
                          <span>~30%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                          <div className="h-full w-[30%] rounded-full" style={{ background: phase.color, boxShadow: `0 0 8px ${phase.color}` }} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="mt-16 pt-8 border-t border-white/5 flex items-center justify-between text-xs text-white/20">
            <span>BooGMe LLC · Founded February 2026 · Cristian Chirila, GM</span>
            <span>$270M → $686M market · 10.9% CAGR</span>
          </div>
        </div>
      </div>
    </div>
  );
}
