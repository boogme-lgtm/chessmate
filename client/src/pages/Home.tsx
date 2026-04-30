/**
 * DESIGN: Editorial Cream + Ember Dark — Homepage v2 (Design Board Aligned)
 * YC homepage framework. Honest pre-launch positioning.
 * Two-sided value: coaches earn beyond the hour; students get personalized material.
 * No fabricated metrics, no fake testimonials.
 */
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  Shield,
  Users,
  ChevronRight,
  Menu,
  X,
  Loader2,
  Check,
  Mail,
  MessageSquare,
  Play,
  Calendar,
  DollarSign,
  Star,
  BarChart3,
} from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { CoachMatchingAssessment } from "@/components/CoachMatchingAssessment";
import { WelcomePopup } from "@/components/WelcomePopup";
import { UserMenu } from "@/components/UserMenu";
import Logo from "@/components/Logo";
import QuizResultMockup from "@/components/hero/QuizResultMockup";
import { BgMark } from "@/components/BgMark";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";

// Editorial motion tokens
const fadeIn = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.9, ease: [0.2, 0.7, 0.2, 1] },
  },
} as const;
const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

/* ═══════════════════════════════════════════════════════════════════
   NAVIGATION
   ═══════════════════════════════════════════════════════════════════ */
function Navigation({ onOpenAssessment }: { onOpenAssessment: () => void }) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, loading } = useAuth();

  const handleOpenAssessment = () => {
    onOpenAssessment();
    setMobileMenuOpen(false);
  };

  React.useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleNavClick = (section: string) => {
    const element = document.getElementById(section);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
    setMobileMenuOpen(false);
  };

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.2, 0.7, 0.2, 1] }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? "bg-background/90 backdrop-blur-md border-b border-border shadow-sm"
          : "bg-transparent"
      }`}
    >
      <div className="container flex items-center justify-between h-16">
        <a href="/" className="flex items-center gap-2">
          <Logo height={28} />
        </a>
        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-8">
          <button
            onClick={() => handleNavClick("features")}
            className="nav-link text-[13px] text-muted-foreground hover:text-foreground transition-colors"
          >
            How it works
          </button>
          <button
            onClick={() => handleNavClick("pricing")}
            className="nav-link text-[13px] text-muted-foreground hover:text-foreground transition-colors"
          >
            Pricing
          </button>
          <a
            href="/coaches"
            className="nav-link text-[13px] text-muted-foreground hover:text-foreground transition-colors"
          >
            For coaches
          </a>
          {loading ? null : user ? (
            <UserMenu />
          ) : (
            <>
              <a
                href={getLoginUrl()}
                className="text-[13px] text-muted-foreground hover:text-foreground transition-colors"
              >
                Sign in
              </a>
              <button onClick={handleOpenAssessment} className="btn-editorial-primary text-[13px] py-2 px-4">
                Find your coach
              </button>
            </>
          )}
        </div>
        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2 text-foreground"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>
      {/* Mobile menu */}
      {mobileMenuOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="md:hidden bg-background border-b border-border"
        >
          <div className="container py-4 space-y-3">
            <button onClick={() => handleNavClick("features")} className="block text-sm text-muted-foreground">
              How it works
            </button>
            <button onClick={() => handleNavClick("pricing")} className="block text-sm text-muted-foreground">
              Pricing
            </button>
            <a href="/coaches" className="block text-sm text-muted-foreground">
              For coaches
            </a>
            {user ? (
              <a href="/dashboard" className="block text-sm text-foreground font-medium">
                Dashboard
              </a>
            ) : (
              <>
                <a href={getLoginUrl()} className="block text-sm text-muted-foreground">
                  Sign in
                </a>
                <button onClick={handleOpenAssessment} className="btn-editorial-primary text-sm w-full mt-2">
                  Find your coach
                </button>
              </>
            )}
          </div>
        </motion.div>
      )}
    </motion.nav>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   HERO V2 (with QuizResultMockup + 3D mouse shadow)
   ═══════════════════════════════════════════════════════════════════ */
function HeroV2({ onOpenAssessment }: { onOpenAssessment: () => void }) {
  return (
    <section className="mesh-bg mesh-bg-animated relative min-h-[85vh] flex items-center pt-24 pb-16 overflow-hidden">
      <style>{`
        @keyframes shimmer-text {
          0% { background-position: 0% center; }
          100% { background-position: 200% center; }
        }
        .shimmer-word {
          background: linear-gradient(90deg, #8B4513, #E8633A, #8B4513);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: shimmer-text 3s linear infinite;
        }
      `}</style>
      <div className="mesh-accent" />
      <div className="container relative z-10">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
          className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-12 lg:gap-16 items-center"
        >
          {/* Left column */}
          <div className="space-y-8">
            <motion.div variants={fadeIn} className="space-y-6">
              <span className="eyebrow">01 — Pay after you learn</span>
              <h1 className="text-5xl md:text-6xl font-light tracking-tight text-foreground leading-[1.1]">
                Pay your coach<br />
                <span className="shimmer-word">after</span> the lesson.
              </h1>
              <p className="font-serif text-[19px] text-muted-foreground leading-relaxed max-w-md">
                AI matches you to a vetted coach in 8 minutes. Money sits in escrow
                until you&rsquo;ve actually learned something. From{" "}
                <span className="font-semibold text-foreground">$38 per lesson</span>.
              </p>
            </motion.div>
            {/* CTA */}
            <motion.div variants={fadeIn} className="flex flex-col sm:flex-row gap-3 items-start sm:items-center pt-2">
              <button
                onClick={onOpenAssessment}
                className="btn-editorial-primary group inline-flex items-center gap-2"
              >
                Take the 8-minute quiz
                <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </button>
              <span className="mono-label sm:ml-3">No signup · No card required</span>
            </motion.div>
            {/* Trust strip */}
            <motion.div
              variants={fadeIn}
              className="grid grid-cols-2 sm:grid-cols-4 gap-px mt-12 border-t border-b border-border"
            >
              {[
                { value: "0%", label: "Platform fee until $100" },
                { value: "48h", label: "Refund window" },
                { value: "8min", label: "Match assessment" },
                { value: "20Q", label: "Style + goals + schedule" },
              ].map((stat) => (
                <div key={stat.label} className="bg-background py-6 px-4">
                  <div className="stat-number text-3xl font-light text-foreground">{stat.value}</div>
                  <div className="mono-label mt-2">{stat.label}</div>
                </div>
              ))}
            </motion.div>
          </div>
          {/* Right column — Quiz Result Mockup with 3D mouse tracking */}
          <motion.div variants={fadeIn}>
            <QuizResultMockup />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SOCIAL PROOF BAR
   ═══════════════════════════════════════════════════════════════════ */
function SocialProofBar({ onOpenAssessment }: { onOpenAssessment: () => void }) {
  return (
    <section className="bg-[var(--color-cream-deep)] dark:bg-[var(--color-ink-raised)] border-b border-border">
      <div className="container py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="inline-block w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="mono-label">
            Founding-coach beta — First 20 coaches pay 0% platform fee for 3 months
          </span>
        </div>
        <button
          onClick={onOpenAssessment}
          className="text-[13px] font-medium text-primary hover:underline"
        >
          Apply now →
        </button>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   PROBLEM STATEMENT — 2-column editorial (Design Board ss#1)
   Large headline left, numbered problems right with dividers
   ═══════════════════════════════════════════════════════════════════ */
function ProblemStatement() {
  const problems = [
    {
      num: "01",
      headline: "You pay first. You hope it works.",
      body: "Send a stranger $60 on Venmo. They no-show, ghost, or teach badly. Your money is gone.",
    },
    {
      num: "02",
      headline: "You pick blind.",
      body: "Discord recommendations. A YouTube channel. A friend\u2019s friend. No way to know if their style fits how you actually learn.",
    },
    {
      num: "03",
      headline: "Coaches lose a chunk of every dollar to platforms that don\u2019t help them grow.",
      body: "The big sites take a cut, force pricing that prices out new students, and give coaches no tools to sell their own content. Coaches go back to Venmo. Students lose protection. The cycle continues.",
    },
  ];

  return (
    <section
      className="py-20 md:py-28"
      style={{ background: "var(--color-ink)", color: "#F5F1E4" }}
    >
      <div className="container">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-12 lg:gap-20 items-start"
        >
          {/* Left — big headline */}
          <motion.div variants={fadeIn} className="space-y-6 lg:sticky lg:top-32">
            <span className="mono-label text-[11px] font-medium uppercase tracking-[0.12em]" style={{ color: "#E8633A" }}>
              02 — The problem
            </span>
            <h2 className="text-4xl md:text-[56px] font-light leading-[1.05] tracking-tight" style={{ color: "#F5F1E4" }}>
              Chess coaching is broken in three ways.
            </h2>
          </motion.div>

          {/* Right — numbered problems */}
          <motion.div variants={fadeIn} className="space-y-0">
            {problems.map((p, i) => (
              <div
                key={p.num}
                className={`py-8 ${i > 0 ? "border-t" : ""}`}
                style={{ borderColor: "rgba(245,241,228,0.12)" }}
              >
                <div className="flex gap-5">
                  <span className="font-mono text-sm font-medium shrink-0 pt-1" style={{ color: "#E8633A" }}>
                    {p.num}
                  </span>
                  <div className="space-y-3">
                    <h3 className="text-xl md:text-2xl font-medium leading-tight" style={{ color: "#F5F1E4" }}>
                      {p.headline}
                    </h3>
                    <p className="text-[15px] leading-relaxed" style={{ color: "#A89F8A" }}>
                      {p.body}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   FEATURES SECTION (03 + 04 updated)
   ═══════════════════════════════════════════════════════════════════ */
function FeaturesSection() {
  const features = [
    {
      num: "01",
      icon: Shield,
      title: "Escrow-held payment",
      copy: "Your payment sits in escrow until the lesson is complete. Dispute it within 48 hours, get it all back.",
    },
    {
      num: "02",
      icon: Users,
      title: "AI coach matching",
      copy: "A 20-question assessment learns your style, goals, time, openings, weaknesses — and surfaces 3 coaches tuned to how you learn.",
    },
    {
      num: "03",
      icon: MessageSquare,
      title: "Direct messaging & requests",
      copy: "Talk to your coach between lessons. Ask questions, share games, request a focused video on the line you keep losing — built into every coach profile.",
    },
    {
      num: "04",
      icon: Play,
      title: "Personalized content, on demand",
      copy: "Every coach has a storefront for PPV tutorials and made-to-order content. Coaches earn beyond the lesson hour. Students get material built for their exact gap.",
    },
  ];
  return (
    <section id="features" className="section">
      <div className="container">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="space-y-16"
        >
          <motion.div
            variants={fadeIn}
            className="grid md:grid-cols-[1fr_380px] gap-8 md:gap-12 items-end"
          >
            <div className="space-y-5">
              <span className="eyebrow">03 — How it works</span>
              <h2 className="text-balance">
                The infrastructure
                <br />
                coaching never had.
              </h2>
            </div>
            <p className="lede text-muted-foreground md:text-right">
              Built for the long lesson arc — from first match to hundredth session — not the
              one-time Zoom link.
            </p>
          </motion.div>
          {/* 4-column editorial grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border-t border-border">
            {features.map((f, i) => {
              const Icon = f.icon;
              return (
                <motion.div
                  key={f.num}
                  variants={fadeIn}
                  className={`p-6 md:p-8 space-y-6 border-border ${
                    i > 0 ? "lg:border-l" : ""
                  } ${i > 0 ? "sm:border-t-0 border-t" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="mono-label">{f.num}</span>
                    <Icon className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
                  </div>
                  <h3 className="text-foreground">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.copy}</p>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   ONBOARDING QUIZ SECTION (Design Board ss#3)
   "20 questions. 8 minutes. One perfect match." + live quiz mockup
   ═══════════════════════════════════════════════════════════════════ */
function OnboardingQuizSection({ onOpenAssessment }: { onOpenAssessment: () => void }) {
  const [selectedAnswer, setSelectedAnswer] = useState(1); // "Look for patterns" selected

  const quizQuestion = "When you're stuck in a position, what do you do?";
  const answers = [
    "Calculate concrete lines",
    "Look for patterns",
    "Think about long-term plans",
    "Play on intuition",
    "Freeze, honestly",
  ];

  return (
    <section
      className="py-20 md:py-28"
      style={{ background: "var(--color-ink)", color: "#F5F1E4" }}
    >
      <div className="container">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center"
        >
          {/* Left — headline + description */}
          <motion.div variants={fadeIn} className="space-y-8">
            <span className="mono-label text-[11px] font-medium uppercase tracking-[0.12em]" style={{ color: "#E8633A" }}>
              03 — Onboarding
            </span>
            <h2 className="text-4xl md:text-[56px] font-light leading-[1.05] tracking-tight" style={{ color: "#F5F1E4" }}>
              20 questions.<br />
              8 minutes.<br />
              One perfect match.
            </h2>
            <p className="font-serif text-[17px] leading-relaxed max-w-md" style={{ color: "#A89F8A" }}>
              We learn your rating, style, goals, learning preferences, weaknesses, schedule, and budget
              — then recommend three coaches who fit the way you think.
            </p>
            {/* Tags */}
            <div className="flex flex-wrap gap-2 pt-2">
              {["Style", "Learning Mode", "Goals", "Weaknesses", "Schedule", "Openings"].map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1.5 text-xs font-mono uppercase tracking-wider border"
                  style={{ borderColor: "rgba(245,241,228,0.2)", color: "#F5F1E4" }}
                >
                  {tag}
                </span>
              ))}
            </div>
            <button
              onClick={onOpenAssessment}
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors"
              style={{ background: "#E8633A", color: "#F5F1E4" }}
            >
              Start the quiz →
            </button>
          </motion.div>

          {/* Right — Quiz mockup card */}
          <motion.div variants={fadeIn}>
            <div
              className="border rounded-lg overflow-hidden"
              style={{ background: "var(--color-ink-raised)", borderColor: "rgba(245,241,228,0.1)" }}
            >
              {/* Quiz header */}
              <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "rgba(245,241,228,0.1)" }}>
                <BgMark size={20} />
                <span className="font-mono text-xs uppercase tracking-wider" style={{ color: "#A89F8A" }}>
                  Question 03 / 20
                </span>
              </div>
              {/* Progress bar */}
              <div className="px-6 pt-4">
                <div className="h-0.5 rounded-full" style={{ background: "rgba(245,241,228,0.1)" }}>
                  <div className="h-full rounded-full" style={{ width: "15%", background: "#E8633A" }} />
                </div>
              </div>
              {/* Question */}
              <div className="px-6 py-6 space-y-5">
                <h3 className="text-xl md:text-2xl font-light" style={{ color: "#F5F1E4" }}>
                  {quizQuestion}
                </h3>
                {/* Answer options */}
                <div className="space-y-3">
                  {answers.map((answer, i) => (
                    <button
                      key={answer}
                      onClick={() => setSelectedAnswer(i)}
                      className="w-full text-left px-5 py-3.5 border text-sm transition-all"
                      style={{
                        borderColor: i === selectedAnswer ? "#F5F1E4" : "rgba(245,241,228,0.15)",
                        background: i === selectedAnswer ? "rgba(245,241,228,0.08)" : "transparent",
                        color: "#F5F1E4",
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span>{answer}</span>
                        {i === selectedAnswer && <Check className="w-4 h-4" style={{ color: "#F5F1E4" }} />}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              {/* Footer nav */}
              <div className="flex items-center justify-between px-6 py-4 border-t" style={{ borderColor: "rgba(245,241,228,0.1)" }}>
                <button className="text-sm flex items-center gap-1" style={{ color: "#A89F8A" }}>
                  ← Back
                </button>
                <button
                  className="px-5 py-2 text-sm font-medium flex items-center gap-1"
                  style={{ background: "#E8633A", color: "#F5F1E4" }}
                >
                  Continue →
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   COACH MATCH RESULTS (Design Board ss#5)
   3 static cards with match scores, ratings, prices, Book CTAs
   ═══════════════════════════════════════════════════════════════════ */
function CoachMatchResults() {
  const matchedCoaches = [
    {
      initials: "NV",
      name: "GM Nadia Volkov",
      rating: "2582 FIDE",
      specialty: "Endgame specialist",
      matchScore: 94,
      tags: ["Endgames", "Positional"],
      levelTag: "1600–2200",
      reviewRating: 4.9,
      reviewCount: 128,
      price: 65,
      nextSlot: "Today 7pm",
      featured: true,
    },
    {
      initials: "TR",
      name: "IM Tomás Rivera",
      rating: "2445 FIDE",
      specialty: "Dynamic play",
      matchScore: 91,
      tags: ["Attacking", "Openings"],
      levelTag: "1200–1800",
      reviewRating: 4.8,
      reviewCount: 87,
      price: 48,
      nextSlot: "Today 7pm",
      featured: false,
    },
    {
      initials: "HO",
      name: "FM Helena Okafor",
      rating: "2310 FIDE",
      specialty: "Junior coaching",
      matchScore: 88,
      tags: ["Kids", "Fundamentals"],
      levelTag: "Unrated–1200",
      reviewRating: 5.0,
      reviewCount: 54,
      price: 38,
      nextSlot: "Today 7pm",
      featured: false,
    },
  ];

  return (
    <section
      className="py-20 md:py-28"
      style={{ background: "var(--color-ink)", color: "#F5F1E4" }}
    >
      <div className="container">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="space-y-14"
        >
          {/* Header */}
          <motion.div variants={fadeIn} className="space-y-5">
            <span className="mono-label text-[11px] font-medium uppercase tracking-[0.12em]" style={{ color: "#E8633A" }}>
              04 — Your matches
            </span>
            <h2 className="text-4xl md:text-[56px] font-light leading-[1.05] tracking-tight" style={{ color: "#F5F1E4" }}>
              Three coaches.<br />
              Ranked by fit, not ad spend.
            </h2>
          </motion.div>

          {/* 3 Coach Cards */}
          <motion.div variants={fadeIn} className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {matchedCoaches.map((coach) => (
              <div
                key={coach.initials}
                className={`border p-6 space-y-5 ${coach.featured ? "bg-[#F5F1E4]" : ""}`}
                style={{
                  borderColor: coach.featured ? "#F5F1E4" : "rgba(245,241,228,0.15)",
                }}
              >
                {/* Match score header */}
                <div className="flex items-center justify-between">
                  <span
                    className="font-mono text-xs uppercase tracking-wider"
                    style={{ color: coach.featured ? "#1A1F26" : "#A89F8A" }}
                  >
                    Match score
                  </span>
                  <span
                    className="text-3xl font-mono font-bold"
                    style={{ color: coach.featured ? "#1A1F26" : "#E8633A" }}
                  >
                    {coach.matchScore}%
                  </span>
                </div>

                {/* Coach info */}
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-mono font-bold"
                    style={{
                      background: coach.featured ? "rgba(232,99,58,0.1)" : "rgba(245,241,228,0.08)",
                      color: coach.featured ? "#E8633A" : "#A89F8A",
                    }}
                  >
                    {coach.initials}
                  </div>
                  <div>
                    <div
                      className="font-medium text-base"
                      style={{ color: coach.featured ? "#1A1F26" : "#F5F1E4" }}
                    >
                      {coach.name}
                    </div>
                    <div
                      className="text-xs"
                      style={{ color: coach.featured ? "#6B6358" : "#A89F8A" }}
                    >
                      {coach.rating} · {coach.specialty}
                    </div>
                  </div>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-2">
                  {[...coach.tags, coach.levelTag].map((tag) => (
                    <span
                      key={tag}
                      className="px-2.5 py-1 text-[11px] font-mono uppercase tracking-wider border"
                      style={{
                        borderColor: coach.featured ? "rgba(26,31,38,0.2)" : "rgba(245,241,228,0.15)",
                        color: coach.featured ? "#1A1F26" : "#F5F1E4",
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-4 pt-2">
                  <div>
                    <div
                      className="text-[10px] font-mono uppercase tracking-wider"
                      style={{ color: coach.featured ? "#6B6358" : "#A89F8A" }}
                    >
                      Rating
                    </div>
                    <div
                      className="text-sm font-medium mt-0.5"
                      style={{ color: coach.featured ? "#1A1F26" : "#F5F1E4" }}
                    >
                      ★ {coach.reviewRating}
                    </div>
                    <div
                      className="text-[11px]"
                      style={{ color: coach.featured ? "#6B6358" : "#A89F8A" }}
                    >
                      ({coach.reviewCount})
                    </div>
                  </div>
                  <div>
                    <div
                      className="text-[10px] font-mono uppercase tracking-wider"
                      style={{ color: coach.featured ? "#6B6358" : "#A89F8A" }}
                    >
                      Per lesson
                    </div>
                    <div
                      className="text-sm font-medium mt-0.5"
                      style={{ color: coach.featured ? "#1A1F26" : "#F5F1E4" }}
                    >
                      ${coach.price}
                    </div>
                  </div>
                  <div>
                    <div
                      className="text-[10px] font-mono uppercase tracking-wider"
                      style={{ color: coach.featured ? "#6B6358" : "#A89F8A" }}
                    >
                      Next slot
                    </div>
                    <div
                      className="text-sm font-medium mt-0.5"
                      style={{ color: coach.featured ? "#1A1F26" : "#F5F1E4" }}
                    >
                      {coach.nextSlot}
                    </div>
                  </div>
                </div>

                {/* Book CTA */}
                <button
                  className="w-full py-3 text-sm font-medium flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
                  style={{ background: "#E8633A", color: "#F5F1E4" }}
                  onClick={() => toast.info("Join the waitlist to book lessons with our founding coaches!")}
                >
                  Book a trial lesson →
                </button>

                {/* Escrow note */}
                {!coach.featured && (
                  <p className="text-center text-[11px]" style={{ color: "#A89F8A" }}>
                    You won&rsquo;t be charged until the lesson ends
                  </p>
                )}
              </div>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   COACH DASHBOARD PREVIEW (Design Board ss#6)
   Full browser-chrome mockup with sidebar, stats, upcoming lessons
   ═══════════════════════════════════════════════════════════════════ */
function CoachDashboardPreview() {
  const menuItems = ["Overview", "Schedule", "Students", "Lessons", "Content", "Payouts", "Profile"];
  const upcomingLessons = [
    { time: "5:00 PM", student: "Marcus Reid", type: "1:1 · Endgame", duration: "60min" },
    { time: "6:30 PM", student: "Group: Rook endings", type: "4 students", duration: "45min" },
    { time: "8:00 PM", student: "Ava Lindqvist", type: "1:1 · Opening prep", duration: "60min" },
  ];

  return (
    <section
      className="py-20 md:py-28"
      style={{ background: "var(--color-ink)", color: "#F5F1E4", borderBottom: "1px solid #222" }}
    >
      <div className="container">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-12 lg:gap-16 items-start"
        >
          {/* Left — copy */}
          <motion.div variants={fadeIn} className="space-y-8 lg:sticky lg:top-32">
            <span className="mono-label text-[11px] font-medium uppercase tracking-[0.12em]" style={{ color: "#E8633A" }}>
              05 — For coaches
            </span>
            <h2 className="text-4xl md:text-[48px] font-light leading-[1.1]" style={{ color: "#F5F1E4" }}>
              Run your whole coaching business from one place.
            </h2>
            <p className="text-base leading-relaxed" style={{ color: "#A89F8A" }}>
              Scheduling, lesson video, payouts, group sessions, pay-per-view tutorials, and made-to-order
              content — priced by you, protected by escrow, delivered through your own storefront.
            </p>
            {/* Feature bullets */}
            <div className="space-y-3 pt-4">
              {[
                { icon: Calendar, text: "Integrated scheduling & availability" },
                { icon: DollarSign, text: "Built-in payouts via Stripe Connect" },
                { icon: Play, text: "PPV content storefront" },
                { icon: BarChart3, text: "Student analytics & progress notes" },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-3 text-sm" style={{ color: "#F5F1E4" }}>
                  <Icon className="w-4 h-4 shrink-0" style={{ color: "#E8633A" }} />
                  {text}
                </div>
              ))}
            </div>
            <a
              href="/coach/onboarding"
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors"
              style={{ background: "#E8633A", color: "#F5F1E4" }}
            >
              Apply as a founding coach →
            </a>
          </motion.div>

          {/* Right — Browser chrome mockup */}
          <motion.div variants={fadeIn}>
            <div
              className="border rounded-lg overflow-hidden"
              style={{ borderColor: "rgba(245,241,228,0.1)", background: "#0F1419" }}
            >
              {/* Browser chrome bar */}
              <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: "rgba(245,241,228,0.08)" }}>
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full" style={{ background: "#3B3B3B" }} />
                  <div className="w-3 h-3 rounded-full" style={{ background: "#3B3B3B" }} />
                  <div className="w-3 h-3 rounded-full" style={{ background: "#3B3B3B" }} />
                </div>
                <div
                  className="flex-1 text-center text-xs font-mono"
                  style={{ color: "#A89F8A" }}
                >
                  boogme.com/dashboard
                </div>
              </div>

              {/* Dashboard content */}
              <div className="grid grid-cols-[180px_1fr]" style={{ minHeight: "380px" }}>
                {/* Sidebar */}
                <div className="border-r py-5 px-4 space-y-5" style={{ borderColor: "rgba(245,241,228,0.06)" }}>
                  <div className="flex items-center gap-2">
                    <BgMark size={16} />
                    <span className="text-xs font-bold tracking-wide" style={{ color: "#F5F1E4" }}>BOOGME</span>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[10px] font-mono uppercase tracking-wider mb-2" style={{ color: "#A89F8A" }}>
                      Menu
                    </div>
                    {menuItems.map((item, i) => (
                      <div
                        key={item}
                        className={`text-xs py-1.5 px-2 rounded-sm ${i === 0 ? "font-medium" : ""}`}
                        style={{
                          color: i === 0 ? "#F5F1E4" : "#A89F8A",
                          borderLeft: i === 0 ? "2px solid #E8633A" : "2px solid transparent",
                        }}
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Main content area */}
                <div className="p-5 space-y-5">
                  {/* Greeting */}
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "#A89F8A" }}>
                        April 2026
                      </div>
                      <div className="text-lg font-light" style={{ color: "#F5F1E4" }}>
                        Good afternoon, Nadia.
                      </div>
                    </div>
                    <div
                      className="px-3 py-1.5 text-xs font-medium rounded-sm"
                      style={{ background: "#E8633A", color: "#F5F1E4" }}
                    >
                      + New
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "This month", value: "$3,840", sub: "+22%" },
                      { label: "Lessons taught", value: "48", sub: "12 this week" },
                      { label: "Avg rating", value: "4.96", sub: "128 reviews" },
                    ].map((stat) => (
                      <div
                        key={stat.label}
                        className="border p-3 space-y-1"
                        style={{ borderColor: "rgba(245,241,228,0.08)" }}
                      >
                        <div className="text-[9px] font-mono uppercase tracking-wider" style={{ color: "#A89F8A" }}>
                          {stat.label}
                        </div>
                        <div className="text-xl font-mono font-bold" style={{ color: "#F5F1E4" }}>
                          {stat.value}
                        </div>
                        <div className="text-[10px]" style={{ color: "#E8633A" }}>
                          {stat.sub}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Upcoming lessons */}
                  <div className="space-y-2">
                    <div className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "#A89F8A" }}>
                      Upcoming
                    </div>
                    {upcomingLessons.map((lesson) => (
                      <div
                        key={lesson.time}
                        className="flex items-center justify-between py-2 border-b"
                        style={{ borderColor: "rgba(245,241,228,0.06)" }}
                      >
                        <div className="flex items-center gap-4">
                          <span className="text-xs font-mono" style={{ color: "#E8633A" }}>
                            {lesson.time}
                          </span>
                          <span className="text-sm" style={{ color: "#F5F1E4" }}>
                            {lesson.student}
                          </span>
                        </div>
                        <span className="text-[11px]" style={{ color: "#A89F8A" }}>
                          {lesson.type} · {lesson.duration}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   TESTIMONIAL BLOCK V2 (founding principle)
   ═══════════════════════════════════════════════════════════════════ */
function TestimonialBlockV2() {
  return (
    <section className="bg-background py-24 md:py-32">
      <div className="container">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="max-w-[980px] mx-auto text-center space-y-10"
        >
          <motion.div variants={fadeIn}>
            <span className="eyebrow">06 — What we believe</span>
          </motion.div>
          <motion.div variants={fadeIn}>
            <p className="font-serif italic text-[28px] md:text-[36px] text-foreground leading-[1.3]">
              &ldquo;Coaching shouldn&rsquo;t end when the lesson does. The hour you spend
              together is worth more when the conversation continues — and when
              the content the coach makes is built for the student in front of them.&rdquo;
            </p>
          </motion.div>
          <motion.div variants={fadeIn} className="flex items-center justify-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <BgMark size={20} />
            </div>
            <div className="text-left">
              <div className="text-sm font-medium text-foreground">The BooGMe team</div>
              <div className="mono-label text-muted-foreground">FOUNDING PRINCIPLE</div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   FOUNDERS BLOCK (dark section)
   ═══════════════════════════════════════════════════════════════════ */
function FoundersBlock() {
  return (
    <section
      className="py-20 md:py-28"
      style={{ background: "var(--color-ink)", color: "#F5F1E4", borderBottom: "1px solid #222" }}
    >
      <div className="container">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="grid grid-cols-1 md:grid-cols-[2fr_3fr] gap-12 md:gap-20 items-start"
        >
          {/* Left column — founder portrait */}
          <motion.div variants={fadeIn} className="space-y-3">
            <div
              className="aspect-[1/1.15] border rounded-sm flex items-center justify-center"
              style={{ background: "#151B22", borderColor: "#22303C" }}
            >
              <span className="font-mono text-[64px] font-bold" style={{ color: "#E8633A" }}>
                CC
              </span>
            </div>
            <div>
              <div className="text-sm font-medium" style={{ color: "#F5F1E4" }}>Cristian Chirila</div>
              <div className="mono-label" style={{ color: "#A89F8A" }}>Founder · GM · Coach of World #3 Fabiano Caruana</div>
            </div>
          </motion.div>

          {/* Right column — founding story */}
          <motion.div variants={fadeIn} className="space-y-8">
            <span className="mono-label text-[11px] font-medium uppercase tracking-[0.12em]" style={{ color: "#E8633A" }}>
              07 — Built by a player who&rsquo;s seen it all
            </span>
            <h2 className="text-3xl md:text-[48px] font-light leading-[1.1]" style={{ color: "#F5F1E4" }}>
              I&rsquo;ve coached at the highest level.<br />
              I built this for everyone below it.
            </h2>
            <p className="text-base leading-relaxed max-w-prose" style={{ color: "#A89F8A" }}>
              I&rsquo;m Cristian Chirila — Grandmaster, second to World #3 Fabiano Caruana,
              and head coach of the Mizzou Chess Program. I&rsquo;ve spent a decade watching
              talented players get burned by bad coaching experiences: no-shows, mismatched
              styles, money gone with nothing to show. BooGMe is the platform I wish had
              existed when I started — one that protects students, respects coaches, and
              makes the lesson hour the beginning of the relationship, not the end of it.
            </p>
            <a href="#" className="text-sm hover:underline" style={{ color: "#E8633A" }}>
              Read the founding story →
            </a>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   WAITLIST SECTION (moved later in flow)
   ═══════════════════════════════════════════════════════════════════ */
function WaitlistSection() {
  const [email, setEmail] = useState("");
  const [userType, setUserType] = useState<"student" | "coach" | "both">("student");

  const joinWaitlist = trpc.waitlist.join.useMutation({
    onSuccess: () => {
      toast.success("You're on the list!", {
        description: "We'll notify you when we launch.",
      });
      setEmail("");
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : "Failed to join waitlist";
      if (errorMessage.includes("already") || errorMessage.includes("duplicate") || errorMessage.includes("exists") || errorMessage.includes("waitlist")) {
        toast.info("You're already on the list!", {
          description: "We'll notify you when we launch. No need to sign up again.",
        });
      } else {
        toast.error("Something went wrong", { description: errorMessage });
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error("Please enter your email");
      return;
    }
    joinWaitlist.mutate({ email, userType });
  };

  return (
    <section id="waitlist" className="mesh-bg mesh-bg-animated section relative">
      <div className="mesh-accent" />
      <div className="container relative z-10">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="max-w-[520px] mx-auto"
        >
          <motion.div
            variants={fadeIn}
            className="bg-background border border-border p-8 md:p-10 space-y-7"
          >
            <div className="space-y-4">
              <span className="eyebrow">08 — Get started</span>
              <h2>Join the founding class.</h2>
              <p className="lede text-base">
                We&rsquo;re launching soon. Be first to access elite chess coaching with payment
                protection.
              </p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-5 pt-4 border-t border-border">
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="editorial-input with-icon"
                />
              </div>
              <div className="flex items-center gap-6 text-[13px]">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="role"
                    value="student"
                    checked={userType === "student"}
                    onChange={() => setUserType("student")}
                    className="accent-primary w-3.5 h-3.5"
                  />
                  <span className="text-foreground">I&rsquo;m a student</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="role"
                    value="coach"
                    checked={userType === "coach"}
                    onChange={() => setUserType("coach")}
                    className="accent-primary w-3.5 h-3.5"
                  />
                  <span className="text-foreground">I&rsquo;m a coach</span>
                </label>
              </div>
              <button
                type="submit"
                disabled={joinWaitlist.isPending}
                className="btn-editorial-primary w-full disabled:opacity-60"
              >
                {joinWaitlist.isPending ? (
                  <span className="inline-flex items-center gap-2 justify-center">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Joining…
                  </span>
                ) : (
                  "Join the waitlist"
                )}
              </button>
              <p className="mono-label text-center">No spam · Unsubscribe anytime</p>
            </form>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   PRICING TABLE
   ═══════════════════════════════════════════════════════════════════ */
function PricingTable() {
  const tiers = [
    {
      name: "Free",
      price: "$0",
      fee: "Minimal platform fee",
      features: [
        "First 3 months free for founding coaches",
        "Escrow-protected payments",
        "AI student matching",
        "In-app messaging",
      ],
      cta: "Get started \u2192",
      ctaStyle: "ghost" as const,
      href: "/coach/onboarding",
    },
    {
      name: "Pro",
      price: "$19",
      fee: "Lower platform fee",
      features: [
        "Priority in search results",
        "Analytics dashboard",
        "Custom availability rules",
        "PPV content storefront",
      ],
      cta: "Apply as founding coach \u2192",
      ctaStyle: "primary" as const,
      href: "/coach/onboarding",
      highlighted: true,
    },
    {
      name: "Elite",
      price: "$49",
      fee: "Lowest platform fee",
      features: [
        "Featured placement",
        "Custom profile URL",
        "Dedicated support",
        "Advanced analytics & reporting",
      ],
      cta: "Contact us \u2192",
      ctaStyle: "ghost" as const,
      href: "mailto:hello@boogme.com",
    },
  ];

  return (
    <section id="pricing" className="section bg-background">
      <div className="container">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="space-y-16"
        >
          <motion.div variants={fadeIn} className="space-y-5">
            <span className="eyebrow">09 — Simple, transparent pricing</span>
            <h2>Start free. Grow with us.</h2>
          </motion.div>

          <motion.div variants={fadeIn} className="grid grid-cols-1 md:grid-cols-3 gap-px bg-border">
            {tiers.map((tier) => (
              <div
                key={tier.name}
                className={`bg-background p-8 md:p-10 space-y-6 ${tier.highlighted ? "ring-1 ring-primary" : ""}`}
              >
                <div className="space-y-4">
                  <span className="eyebrow text-primary">{tier.name}</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-light text-foreground">{tier.price}</span>
                    <span className="text-muted-foreground text-base">/mo</span>
                  </div>
                  <div className="mono-label text-muted-foreground">{tier.fee}</div>
                </div>
                <div className="border-t border-border pt-6 space-y-3">
                  {tier.features.map((feature) => (
                    <div key={feature} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      {feature}
                    </div>
                  ))}
                </div>
                <a
                  href={tier.href}
                  className={
                    tier.ctaStyle === "primary"
                      ? "btn-editorial-primary w-full text-center block"
                      : "btn-editorial-ghost w-full text-center block"
                  }
                >
                  {tier.cta}
                </a>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   CLOSING CTA
   ═══════════════════════════════════════════════════════════════════ */
function ClosingCTA({ onOpenAssessment }: { onOpenAssessment: () => void }) {
  return (
    <section className="py-32 text-center bg-[var(--color-cream)] dark:bg-[var(--color-ink-raised)]">
      <div className="container">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="space-y-8"
        >
          <motion.div variants={fadeIn}>
            <span className="eyebrow">10 — Get matched</span>
          </motion.div>
          <motion.div variants={fadeIn}>
            <h2 className="text-5xl md:text-[64px] font-light tracking-tight text-foreground">
              Eight minutes.
            </h2>
            <h2 className="text-5xl md:text-[64px] font-light tracking-tight text-primary mt-2">
              One perfect match.
            </h2>
          </motion.div>
          <motion.div variants={fadeIn} className="pt-4">
            <button
              onClick={onOpenAssessment}
              className="btn-editorial-primary group inline-flex items-center gap-2"
            >
              Take the 8-minute quiz
              <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </motion.div>
          <motion.div variants={fadeIn}>
            <p className="mono-label text-muted-foreground">
              20 questions · No card required · Money-back guarantee
            </p>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   FOOTER (dark background fix applied)
   ═══════════════════════════════════════════════════════════════════ */
function Footer() {
  return (
    <footer
      className="py-14"
      style={{ background: "var(--color-ink)", color: "#F5F1E4", borderTop: "1px solid #222" }}
    >
      <div className="container">
        <div className="grid md:grid-cols-[1fr_auto] gap-10 md:gap-16">
          <div className="space-y-3">
            <Logo height={24} />
            <p className="text-[11px] font-mono uppercase tracking-[0.08em]" style={{ color: "#A89F8A" }}>
              The chess coaching marketplace
            </p>
          </div>
          <nav aria-label="Footer" className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
            <div className="space-y-3">
              <div className="text-[11px] font-mono uppercase tracking-[0.08em]" style={{ color: "#A89F8A" }}>Platform</div>
              <ul className="space-y-2">
                <li><a href="/coaches" className="text-[13px] hover:underline" style={{ color: "#F5F1E4" }}>Browse coaches</a></li>
                <li><a href="/for-coaches" className="text-[13px] hover:underline" style={{ color: "#F5F1E4" }}>For coaches</a></li>
                <li><a href="/?openAssessment=1" className="text-[13px] hover:underline" style={{ color: "#F5F1E4" }}>AI matching</a></li>
              </ul>
            </div>
            <div className="space-y-3">
              <div className="text-[11px] font-mono uppercase tracking-[0.08em]" style={{ color: "#A89F8A" }}>Company</div>
              <ul className="space-y-2">
                <li><a href="#" className="text-[13px] hover:underline" style={{ color: "#F5F1E4" }}>About</a></li>
                <li><a href="#" className="text-[13px] hover:underline" style={{ color: "#F5F1E4" }}>Blog</a></li>
              </ul>
            </div>
            <div className="space-y-3">
              <div className="text-[11px] font-mono uppercase tracking-[0.08em]" style={{ color: "#A89F8A" }}>Legal</div>
              <ul className="space-y-2">
                <li><a href="/privacy" className="text-[13px] hover:underline" style={{ color: "#F5F1E4" }}>Privacy</a></li>
                <li><a href="/terms" className="text-[13px] hover:underline" style={{ color: "#F5F1E4" }}>Terms</a></li>
              </ul>
            </div>
            <div className="space-y-3">
              <div className="text-[11px] font-mono uppercase tracking-[0.08em]" style={{ color: "#A89F8A" }}>Connect</div>
              <ul className="space-y-2">
                <li><a href="mailto:hello@boogme.com" className="text-[13px] hover:underline" style={{ color: "#F5F1E4" }}>Email</a></li>
              </ul>
            </div>
          </nav>
        </div>
        <div className="mt-12 pt-6" style={{ borderTop: "1px solid #222" }}>
          <p className="text-[11px] font-mono uppercase tracking-[0.08em]" style={{ color: "#A89F8A" }}>
            © 2026 BooGMe. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   HOME — Main export
   ═══════════════════════════════════════════════════════════════════ */
export default function Home() {
  const [assessmentOpen, setAssessmentOpen] = useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("openAssessment") === "1") {
      setAssessmentOpen(true);
      params.delete("openAssessment");
      const cleanSearch = params.toString();
      window.history.replaceState(
        {},
        "",
        window.location.pathname + (cleanSearch ? `?${cleanSearch}` : "")
      );
    }
  }, []);

  return (
    <div className="min-h-screen">
      <WelcomePopup onOpenAssessment={() => setAssessmentOpen(true)} />
      <Navigation onOpenAssessment={() => setAssessmentOpen(true)} />
      <HeroV2 onOpenAssessment={() => setAssessmentOpen(true)} />
      <SocialProofBar onOpenAssessment={() => setAssessmentOpen(true)} />
      <ProblemStatement />
      <FeaturesSection />
      <OnboardingQuizSection onOpenAssessment={() => setAssessmentOpen(true)} />
      <CoachMatchResults />
      <CoachDashboardPreview />
      <TestimonialBlockV2 />
      <FoundersBlock />
      <WaitlistSection />
      <PricingTable />
      <ClosingCTA onOpenAssessment={() => setAssessmentOpen(true)} />
      <Footer />
      {assessmentOpen && <CoachMatchingAssessment onClose={() => setAssessmentOpen(false)} />}
    </div>
  );
}
