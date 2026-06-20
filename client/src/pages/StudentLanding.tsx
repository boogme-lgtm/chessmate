/**
 * STUDENT LANDING PAGE — Editorial Cream + Ember Dark
 * Student-facing value prop: escrow, AI matching, content library, progress tracking.
 * Same editorial system as Home.tsx. Self-contained component.
 */
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import {
  ChevronRight,
  Shield,
  Users,
  Play,
  BookOpen,
  Calendar,
  TrendingUp,
  Check,
  Mail,
  Loader2,
  Menu,
  X,
} from "lucide-react";
import React, { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import Logo from "@/components/Logo";
import { BgMark } from "@/components/BgMark";
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
function Navigation() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [, setLocation] = useLocation();

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
            onClick={() => handleNavClick("how-it-works")}
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
            href="/for-coaches"
            className="nav-link text-[13px] text-muted-foreground hover:text-foreground transition-colors"
          >
            For coaches
          </a>
          <a
            href={getLoginUrl()}
            className="text-[13px] text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign in
          </a>
          <a href="/coaches" className="btn-editorial-primary text-[13px] py-2 px-4">
            Find your coach
          </a>
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
            <button onClick={() => handleNavClick("how-it-works")} className="block text-sm text-muted-foreground">
              How it works
            </button>
            <button onClick={() => handleNavClick("pricing")} className="block text-sm text-muted-foreground">
              Pricing
            </button>
            <a href="/for-coaches" className="block text-sm text-muted-foreground">
              For coaches
            </a>
            <a href={getLoginUrl()} className="block text-sm text-muted-foreground">
              Sign in
            </a>
            <a href="/coaches" className="btn-editorial-primary text-sm w-full mt-2 text-center block">
              Find your coach
            </a>
          </div>
        </motion.div>
      )}
    </motion.nav>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   HERO
   ═══════════════════════════════════════════════════════════════════ */
function Hero() {
  return (
    <section className="mesh-bg mesh-bg-animated relative min-h-[85vh] flex items-center pt-24 pb-16 overflow-hidden">
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
              <span className="eyebrow">01 — pay after you learn</span>
              <h1 className="text-5xl md:text-6xl font-light tracking-tight text-foreground leading-[1.1]">
                Pay your coach<br />
                after the lesson.
              </h1>
              <p className="font-serif text-[19px] text-muted-foreground leading-relaxed max-w-md">
                AI matches you to a vetted coach in 8 minutes. Money sits in escrow
                until you&rsquo;ve actually learned something. From{" "}
                <span className="font-semibold text-foreground">$38 per lesson</span>.
              </p>
            </motion.div>
            {/* CTA */}
            <motion.div variants={fadeIn} className="flex flex-col sm:flex-row gap-3 items-start sm:items-center pt-2">
              <a
                href="/coaches"
                className="btn-editorial-primary group inline-flex items-center gap-2"
              >
                Find your coach
                <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </a>
              <span className="mono-label sm:ml-3">No signup · No card required</span>
            </motion.div>
            {/* Stat strip */}
            <motion.div
              variants={fadeIn}
              className="grid grid-cols-2 sm:grid-cols-4 gap-px mt-12 border-t border-b border-border"
            >
              {[
                { value: "0%", label: "Platform fee until $100" },
                { value: "1h", label: "Cancellation window" },
                { value: "8min", label: "Match assessment" },
                { value: "escrow", label: "Until you've learned" },
              ].map((stat) => (
                <div key={stat.label} className="bg-background py-6 px-4">
                  <div className="stat-number text-3xl font-light text-foreground">{stat.value}</div>
                  <div className="mono-label mt-2">{stat.label}</div>
                </div>
              ))}
            </motion.div>
          </div>
          {/* Right column — coach match card mockup */}
          <motion.div variants={fadeIn}>
            <div
              className="border rounded-lg overflow-hidden w-[300px] hidden lg:block"
              style={{ background: "var(--color-ink-raised)", borderColor: "rgba(245,241,228,0.1)" }}
            >
              {/* Card header */}
              <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "rgba(245,241,228,0.1)" }}>
                <span className="font-mono text-xs uppercase tracking-wider" style={{ color: "#A89F8A" }}>
                  Your top match
                </span>
                <span className="text-2xl font-mono font-bold" style={{ color: "#E8633A" }}>
                  94%
                </span>
              </div>
              {/* Coach info */}
              <div className="px-5 py-5 space-y-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-mono font-bold"
                    style={{ background: "rgba(232,99,58,0.1)", color: "#E8633A" }}
                  >
                    NV
                  </div>
                  <div>
                    <div className="font-medium text-base" style={{ color: "#F5F1E4" }}>GM Nadia Volkov</div>
                    <div className="text-xs" style={{ color: "#A89F8A" }}>2582 FIDE · Endgame specialist</div>
                  </div>
                </div>
                {/* Tags */}
                <div className="flex flex-wrap gap-2">
                  {["Endgames", "Positional", "1600-2200"].map((tag) => (
                    <span
                      key={tag}
                      className="px-2.5 py-1 text-[11px] font-mono uppercase tracking-wider border"
                      style={{ borderColor: "rgba(245,241,228,0.15)", color: "#F5F1E4" }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                {/* Stats */}
                <div className="grid grid-cols-3 gap-3 pt-1">
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "#A89F8A" }}>Rating</div>
                    <div className="text-sm font-medium mt-0.5" style={{ color: "#F5F1E4" }}>4.9</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "#A89F8A" }}>Per lesson</div>
                    <div className="text-sm font-medium mt-0.5" style={{ color: "#F5F1E4" }}>$65</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "#A89F8A" }}>Next slot</div>
                    <div className="text-sm font-medium mt-0.5" style={{ color: "#F5F1E4" }}>Today 7pm</div>
                  </div>
                </div>
                {/* CTA */}
                <button
                  className="w-full py-2.5 text-sm font-medium flex items-center justify-center gap-2"
                  style={{ background: "#E8633A", color: "#F5F1E4" }}
                >
                  Book a trial lesson
                </button>
                <p className="text-center text-[11px]" style={{ color: "#A89F8A" }}>
                  You won&rsquo;t be charged until the lesson ends
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   PROBLEM STATEMENT (dark)
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
      body: "Discord recommendations. A YouTube channel. A friend’s friend. No way to know if their style fits how you actually learn.",
    },
    {
      num: "03",
      headline: "Coaches leave. Students lose.",
      body: "The big sites take a cut, force pricing, and give coaches no tools to grow. Coaches go back to Venmo. Students lose protection. The cycle continues.",
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
   HOW IT WORKS (light)
   ═══════════════════════════════════════════════════════════════════ */
function HowItWorks() {
  const features = [
    {
      num: "01",
      icon: Shield,
      title: "Escrow-held payment",
      copy: "Your money sits in a secure hold until the lesson is done. Dispute resolution built in.",
    },
    {
      num: "02",
      icon: Users,
      title: "AI coach matching",
      copy: "A 20-question assessment learns your style, goals, and weaknesses — then surfaces 3 coaches tuned to how you learn.",
    },
    {
      num: "03",
      icon: BookOpen,
      title: "Your content library",
      copy: "Purchase courses, videos, and PGN packs from your coach’s storefront. Download anytime.",
    },
    {
      num: "04",
      icon: TrendingUp,
      title: "Track your progress",
      copy: "Rating history, chess.com and Lichess integration, and session notes — all in one dashboard.",
    },
  ];

  return (
    <section id="how-it-works" className="section">
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
                The infrastructure<br />
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
   WHAT YOU'RE PROTECTED BY (dark)
   ═══════════════════════════════════════════════════════════════════ */
function ProtectionSection() {
  const protections = [
    {
      num: "01",
      headline: "Payment held in escrow",
      body: "Your money never goes directly to a coach. It sits in a secure hold managed by Stripe until the lesson is complete and you confirm satisfaction. No lesson, no charge.",
    },
    {
      num: "02",
      headline: "1-hour cancellation window",
      body: "Life happens. Cancel up to one hour before your scheduled lesson for a full refund, no questions asked. The hold is released instantly.",
    },
    {
      num: "03",
      headline: "Dispute resolution",
      body: "If something goes wrong, raise an issue. Our admin team reviews the case, mediates between you and the coach, and issues a refund if warranted.",
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
          {/* Left — headline */}
          <motion.div variants={fadeIn} className="space-y-6 lg:sticky lg:top-32">
            <span className="mono-label text-[11px] font-medium uppercase tracking-[0.12em]" style={{ color: "#E8633A" }}>
              04 — Your money is safe
            </span>
            <h2 className="text-4xl md:text-[56px] font-light leading-[1.05] tracking-tight" style={{ color: "#F5F1E4" }}>
              You won&rsquo;t be charged until the lesson ends.
            </h2>
          </motion.div>

          {/* Right — protection items */}
          <motion.div variants={fadeIn} className="space-y-0">
            {protections.map((p, i) => (
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
   BELIEF QUOTE (light)
   ═══════════════════════════════════════════════════════════════════ */
function BeliefQuote() {
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
            <span className="eyebrow">05 — What we believe</span>
          </motion.div>
          <motion.div variants={fadeIn}>
            <p className="font-serif italic text-[28px] md:text-[36px] text-foreground leading-[1.3]">
              &ldquo;Coaching shouldn&rsquo;t end when the lesson does. The hour you spend
              together is worth more when the conversation continues &mdash; and when
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
   CLOSING CTA
   ═══════════════════════════════════════════════════════════════════ */
function ClosingCTA() {
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
            <span className="eyebrow">06 — Get started</span>
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
            <a
              href="/coaches"
              className="btn-editorial-primary group inline-flex items-center gap-2"
            >
              Find your coach
              <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </a>
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
   FOOTER (dark)
   ═══════════════════════════════════════════════════════════════════ */
function FooterSection() {
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
          <nav aria-label="Footer" className="grid grid-cols-2 md:grid-cols-3 gap-8 md:gap-12">
            <div className="space-y-3">
              <div className="text-[11px] font-mono uppercase tracking-[0.08em]" style={{ color: "#A89F8A" }}>Product</div>
              <ul className="space-y-2">
                <li><a href="#how-it-works" className="text-[13px] hover:underline" style={{ color: "#F5F1E4" }}>How it works</a></li>
                <li><a href="#pricing" className="text-[13px] hover:underline" style={{ color: "#F5F1E4" }}>Pricing</a></li>
                <li><a href="/coaches" className="text-[13px] hover:underline" style={{ color: "#F5F1E4" }}>Browse coaches</a></li>
              </ul>
            </div>
            <div className="space-y-3">
              <div className="text-[11px] font-mono uppercase tracking-[0.08em]" style={{ color: "#A89F8A" }}>Company</div>
              <ul className="space-y-2">
                <li><a href="/for-coaches" className="text-[13px] hover:underline" style={{ color: "#F5F1E4" }}>For coaches</a></li>
                <li><a href="#" className="text-[13px] hover:underline" style={{ color: "#F5F1E4" }}>About</a></li>
              </ul>
            </div>
            <div className="space-y-3">
              <div className="text-[11px] font-mono uppercase tracking-[0.08em]" style={{ color: "#A89F8A" }}>Legal</div>
              <ul className="space-y-2">
                <li><a href="/terms" className="text-[13px] hover:underline" style={{ color: "#F5F1E4" }}>Terms</a></li>
                <li><a href="/privacy" className="text-[13px] hover:underline" style={{ color: "#F5F1E4" }}>Privacy</a></li>
              </ul>
            </div>
          </nav>
        </div>
        <div className="mt-12 pt-6" style={{ borderTop: "1px solid #222" }}>
          <p className="text-[11px] font-mono uppercase tracking-[0.08em]" style={{ color: "#A89F8A" }}>
            &copy; 2026 BooGMe. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   STUDENT LANDING — Main export
   ═══════════════════════════════════════════════════════════════════ */
export default function StudentLanding() {
  return (
    <div className="min-h-screen">
      <Navigation />
      <Hero />
      <ProblemStatement />
      <HowItWorks />
      <ProtectionSection />
      <BeliefQuote />
      <ClosingCTA />
      <FooterSection />
    </div>
  );
}
