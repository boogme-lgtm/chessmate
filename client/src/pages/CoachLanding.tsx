/**
 * COACH LANDING PAGE — Editorial Cream + Ember Dark
 * Coach-side recruitment page. Same editorial system as Home.tsx.
 * Real pricing data from @shared/pricing. Sentence case, no exclamation marks.
 */
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import {
  ChevronRight,
  DollarSign,
  Shield,
  Users,
  Calendar,
  Play,
  BarChart3,
  Clock,
  Globe,
  Zap,
  Check,
  CheckCircle2,
  Loader2,
  Menu,
  X,
  Mail,
} from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import Logo from "@/components/Logo";
import {
  PRICING_TIERS,
  DEFAULT_PRICING_TIER,
  type PricingTier,
} from "@shared/pricing";

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
        <a href="/for-coaches" className="flex items-center gap-2">
          <Logo height={28} />
        </a>
        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-8">
          <button
            onClick={() => handleNavClick("calculator")}
            className="nav-link text-[13px] text-muted-foreground hover:text-foreground transition-colors"
          >
            Earnings calculator
          </button>
          <button
            onClick={() => handleNavClick("how-it-works")}
            className="nav-link text-[13px] text-muted-foreground hover:text-foreground transition-colors"
          >
            How it works
          </button>
          <button
            onClick={() => handleNavClick("faq")}
            className="nav-link text-[13px] text-muted-foreground hover:text-foreground transition-colors"
          >
            FAQ
          </button>
          <a
            href="/for-students"
            className="nav-link text-[13px] text-muted-foreground hover:text-foreground transition-colors"
          >
            For students
          </a>
          <a
            href="/sign-in"
            className="text-[13px] text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign in
          </a>
          <a href="/coach/onboarding" className="btn-editorial-primary text-[13px] py-2 px-4">
            Start earning
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
            <button onClick={() => handleNavClick("calculator")} className="block text-sm text-muted-foreground">
              Earnings calculator
            </button>
            <button onClick={() => handleNavClick("how-it-works")} className="block text-sm text-muted-foreground">
              How it works
            </button>
            <button onClick={() => handleNavClick("faq")} className="block text-sm text-muted-foreground">
              FAQ
            </button>
            <a href="/for-students" className="block text-sm text-muted-foreground">
              For students
            </a>
            <a href="/sign-in" className="block text-sm text-muted-foreground">
              Sign in
            </a>
            <a href="/coach/onboarding" className="btn-editorial-primary text-sm w-full mt-2 text-center block">
              Start earning
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
              <span className="eyebrow">01 — your whole business in one place</span>
              <h1 className="text-5xl md:text-6xl font-light tracking-tight text-foreground leading-[1.1]">
                Coach chess.<br />
                <span className="text-primary">Build a business.</span>
              </h1>
              <p className="font-serif text-[19px] text-muted-foreground leading-relaxed max-w-md">
                Lessons, courses, and made-to-order content — sold from one storefront,
                protected by escrow. AI sends you matched students. Go live in 8 minutes.
              </p>
            </motion.div>
            {/* CTA */}
            <motion.div variants={fadeIn} className="flex flex-col sm:flex-row gap-3 items-start sm:items-center pt-2">
              <a
                href="/coach/onboarding"
                className="btn-editorial-primary group inline-flex items-center gap-2"
              >
                Start earning
                <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </a>
              <span className="mono-label sm:ml-3">Set your rate · No upfront costs</span>
            </motion.div>
            {/* Stat strip */}
            <motion.div
              variants={fadeIn}
              className="grid grid-cols-2 sm:grid-cols-4 gap-px mt-12 border-t border-b border-border"
            >
              {[
                { value: "storefront", label: "Sell courses & content" },
                { value: "8min", label: "Profile setup" },
                { value: "$38+", label: "Average lesson rate" },
                { value: "escrow", label: "Payment protection" },
              ].map((stat) => (
                <div key={stat.label} className="bg-background py-6 px-4">
                  <div className="stat-number text-3xl font-light text-foreground">{stat.value}</div>
                  <div className="mono-label mt-2">{stat.label}</div>
                </div>
              ))}
            </motion.div>
          </div>
          {/* Right column — Coach dashboard mockup */}
          <motion.div variants={fadeIn}>
            <div
              className="border rounded-lg p-6 md:p-8 space-y-6 w-[340px] md:w-[380px]"
              style={{ background: "var(--color-ink-raised)", borderColor: "var(--line)" }}
            >
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Welcome back,</p>
                <p className="text-lg font-medium text-foreground">Coach Elena</p>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <div className="stat-number text-2xl md:text-3xl font-light text-foreground">$3,840</div>
                  <div className="mono-label">Earnings</div>
                </div>
                <div className="space-y-1">
                  <div className="stat-number text-2xl md:text-3xl font-light text-foreground">48</div>
                  <div className="mono-label">Lessons</div>
                </div>
                <div className="space-y-1">
                  <div className="stat-number text-2xl md:text-3xl font-light text-foreground">4.96</div>
                  <div className="mono-label">Rating</div>
                </div>
              </div>
              <div className="border-t pt-4 space-y-3" style={{ borderColor: "var(--line)" }}>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Next lesson</span>
                  <span className="text-foreground">Today, 3:00 PM</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Pending payouts</span>
                  <span className="text-foreground">$480</span>
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
   EARNINGS CALCULATOR
   ═══════════════════════════════════════════════════════════════════ */
function EarningsCalculator() {
  const [lessonsPerWeek, setLessonsPerWeek] = useState(8);
  const [hourlyRate, setHourlyRate] = useState(65);

  const fee = PRICING_TIERS[DEFAULT_PRICING_TIER].platformFeePercent;
  const weeklyGross = lessonsPerWeek * hourlyRate;
  const weeklyNet = weeklyGross * (1 - fee / 100);
  const monthlyNet = weeklyNet * 4;
  const yearlyNet = monthlyNet * 12;

  const fmt = (n: number) =>
    n >= 1000
      ? `$${Math.round(n).toLocaleString()}`
      : `$${Math.round(n)}`;

  return (
    <section id="calculator" className="section bg-background">
      <div className="container">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="space-y-14"
        >
          <motion.div variants={fadeIn} className="space-y-5">
            <span className="eyebrow">02 — your earnings</span>
            <h2 className="text-4xl md:text-[56px] font-light leading-[1.05] tracking-tight text-foreground">
              See what you could earn.
            </h2>
          </motion.div>

          <motion.div variants={fadeIn}>
            <div className="editorial-card p-8 md:p-10 space-y-8">
              {/* Lessons per week slider */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm text-muted-foreground">Lessons per week</label>
                  <span className="stat-number text-2xl font-light text-primary">{lessonsPerWeek}</span>
                </div>
                <Slider
                  value={[lessonsPerWeek]}
                  onValueChange={([value]) => setLessonsPerWeek(value)}
                  min={1}
                  max={30}
                  step={1}
                  className="w-full"
                />
              </div>

              {/* Hourly rate slider */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm text-muted-foreground">Hourly rate</label>
                  <span className="stat-number text-2xl font-light text-primary">${hourlyRate}</span>
                </div>
                <Slider
                  value={[hourlyRate]}
                  onValueChange={([value]) => setHourlyRate(value)}
                  min={20}
                  max={200}
                  step={5}
                  className="w-full"
                />
              </div>

              {/* Earnings breakdown */}
              <div className="border-t border-border pt-8">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
                  <div className="space-y-2">
                    <div className="stat-number text-3xl font-light text-foreground">{fmt(weeklyNet)}</div>
                    <div className="mono-label">Weekly</div>
                  </div>
                  <div className="space-y-2">
                    <div className="stat-number text-4xl md:text-5xl font-light text-foreground">{fmt(monthlyNet)}</div>
                    <div className="mono-label">Monthly</div>
                  </div>
                  <div className="space-y-2">
                    <div className="stat-number text-3xl font-light text-foreground">{fmt(yearlyNet)}</div>
                    <div className="mono-label">Yearly</div>
                  </div>
                </div>
              </div>

              {/* Fee callout */}
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
                <p className="text-sm text-muted-foreground">
                  These projections reflect BooGMe&rsquo;s flat {fee}% platform fee — no subscription,
                  no tiers, no upfront cost. It covers AI matching, escrow protection, payment
                  processing, and support. Content sales use the same flat rate.
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
   WHY COACH HERE (dark)
   ═══════════════════════════════════════════════════════════════════ */
function WhyCoachHere() {
  const reasons = [
    {
      icon: DollarSign,
      title: "One flat fee, everything included",
      body: "A flat 12% on lessons and content covers AI matching, escrow, processing, and support. No subscription, no tiers, no hidden charges.",
    },
    {
      icon: Shield,
      title: "Earn first, connect payouts later",
      body: "Go live and start getting booked immediately. Connect Stripe when you’re ready to withdraw — it’s never a blocker.",
    },
    {
      icon: Play,
      title: "Sell content beyond the lesson hour",
      body: "Your own storefront for courses, videos, PGN packs, and custom content requests. Every sale is another income stream.",
    },
    {
      icon: BarChart3,
      title: "A real dashboard",
      body: "Earnings, lessons, students, inbox, content, reviews — everything in one place.",
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
          {/* Left — sticky headline */}
          <motion.div variants={fadeIn} className="space-y-6 lg:sticky lg:top-32">
            <span className="mono-label text-[11px] font-medium uppercase tracking-[0.12em]" style={{ color: "#E8633A" }}>
              03 — why boogme
            </span>
            <h2 className="text-4xl md:text-[56px] font-light leading-[1.05] tracking-tight" style={{ color: "#F5F1E4" }}>
              Run your whole coaching business from one place.
            </h2>
          </motion.div>

          {/* Right — feature items */}
          <motion.div variants={fadeIn} className="space-y-0">
            {reasons.map((item, i) => (
              <div
                key={item.title}
                className={`py-8 ${i > 0 ? "border-t" : ""}`}
                style={{ borderColor: "rgba(245,241,228,0.12)" }}
              >
                <div className="flex gap-5">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: "rgba(232,99,58,0.1)" }}
                  >
                    <item.icon className="w-5 h-5" style={{ color: "#E8633A" }} />
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-xl md:text-2xl font-medium leading-tight" style={{ color: "#F5F1E4" }}>
                      {item.title}
                    </h3>
                    <p className="text-[15px] leading-relaxed" style={{ color: "#A89F8A" }}>
                      {item.body}
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
  const steps = [
    {
      icon: Calendar,
      title: "Build your profile",
      body: "Set up your coach profile in 8 minutes — credentials, specialties, availability, and pricing.",
    },
    {
      icon: DollarSign,
      title: "Set your rate",
      body: "Choose your hourly rate and pricing tier. Students pay upfront into escrow.",
    },
    {
      icon: Users,
      title: "Get booked",
      body: "AI matches students to coaches by style, goals, and level. Your profile does the selling.",
    },
    {
      icon: Shield,
      title: "Get paid",
      body: "Payouts release after lessons. Connect Stripe when you’re ready to withdraw — no upfront payment details required.",
    },
  ];

  return (
    <section id="how-it-works" className="section bg-background">
      <div className="container">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="space-y-14"
        >
          <motion.div variants={fadeIn} className="space-y-5">
            <span className="eyebrow">04 — how it works</span>
            <h2 className="text-4xl md:text-[56px] font-light leading-[1.05] tracking-tight text-foreground">
              Go live in four steps.
            </h2>
          </motion.div>

          <motion.div variants={fadeIn} className="max-w-3xl space-y-0">
            {steps.map((step, i) => (
              <div key={step.title} className={`py-8 flex gap-6 ${i > 0 ? "border-t border-border" : ""}`}>
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <step.icon className="w-5 h-5 text-primary" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-medium text-foreground">{step.title}</h3>
                  <p className="text-[15px] text-muted-foreground leading-relaxed">{step.body}</p>
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
   MORE THAN LESSONS (dark)
   ═══════════════════════════════════════════════════════════════════ */
function MoreThanLessons() {
  const items = [
    {
      title: "Sell content",
      body: "Upload courses, videos, PGN packs, and bundles. Set your price. Students buy and download from your profile.",
    },
    {
      title: "Custom content requests",
      body: "Students commission tailored analysis or training material. You quote, they pay, you deliver — Fiverr-style, with escrow.",
    },
    {
      title: "Tips, subscriptions, referrals",
      body: "Additional income streams built into the platform.",
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
          {/* Left — sticky headline */}
          <motion.div variants={fadeIn} className="space-y-6 lg:sticky lg:top-32">
            <span className="mono-label text-[11px] font-medium uppercase tracking-[0.12em]" style={{ color: "#E8633A" }}>
              05 — beyond the lesson hour
            </span>
            <h2 className="text-4xl md:text-[56px] font-light leading-[1.05] tracking-tight" style={{ color: "#F5F1E4" }}>
              Every coach gets a storefront.
            </h2>
          </motion.div>

          {/* Right — items */}
          <motion.div variants={fadeIn} className="space-y-0">
            {items.map((item, i) => (
              <div
                key={item.title}
                className={`py-8 ${i > 0 ? "border-t" : ""}`}
                style={{ borderColor: "rgba(245,241,228,0.12)" }}
              >
                <div className="space-y-3">
                  <h3 className="text-xl md:text-2xl font-medium leading-tight" style={{ color: "#F5F1E4" }}>
                    {item.title}
                  </h3>
                  <p className="text-[15px] leading-relaxed" style={{ color: "#A89F8A" }}>
                    {item.body}
                  </p>
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
   FAQ (light)
   ═══════════════════════════════════════════════════════════════════ */
function FAQ() {
  const faqs = [
    {
      q: "When do I need to provide payment details?",
      a: "Not until you’re ready to withdraw. You can go live, get booked, and earn — Stripe setup is only needed to transfer money out.",
    },
    {
      q: "What’s the platform fee?",
      a: `A flat ${PRICING_TIERS[DEFAULT_PRICING_TIER].platformFeePercent}% on lessons and content sales — no subscription, no tiers. It covers AI matching, escrow, payment processing, and support.`,
    },
    {
      q: "How does the escrow system work?",
      a: "Students pay upfront. The money is held securely until the lesson is completed. If there’s a dispute, an admin reviews and can issue a refund.",
    },
    {
      q: "Can I set my own rates?",
      a: "Yes. You have complete control over your hourly rate and lesson durations.",
    },
    {
      q: "What credentials do I need?",
      a: "We welcome coaches of all levels — from strong club players (1800+) to Grandmasters. What matters most is your ability to teach effectively.",
    },
    {
      q: "Can I teach on other platforms?",
      a: "Yes. We don’t require exclusivity.",
    },
  ];

  return (
    <section id="faq" className="section bg-background">
      <div className="container">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="space-y-14"
        >
          <motion.div variants={fadeIn} className="space-y-5">
            <span className="eyebrow">06 — questions</span>
            <h2 className="text-4xl md:text-[56px] font-light leading-[1.05] tracking-tight text-foreground">
              Frequently asked.
            </h2>
          </motion.div>

          <motion.div variants={fadeIn} className="max-w-3xl space-y-0">
            {faqs.map((faq, i) => (
              <div
                key={i}
                className={`editorial-card p-6 md:p-8 ${i > 0 ? "mt-4" : ""}`}
              >
                <h3 className="text-lg font-medium text-foreground mb-3">{faq.q}</h3>
                <p className="text-[15px] text-muted-foreground leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   FOUNDER NOTE (dark)
   ═══════════════════════════════════════════════════════════════════ */
function FounderNote() {
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
          className="max-w-[980px] mx-auto text-center space-y-10"
        >
          <motion.div variants={fadeIn}>
            <span className="mono-label text-[11px] font-medium uppercase tracking-[0.12em]" style={{ color: "#E8633A" }}>
              07 — from the founder
            </span>
          </motion.div>
          <motion.div variants={fadeIn}>
            <p className="font-serif italic text-[28px] md:text-[36px] leading-[1.3]" style={{ color: "#F5F1E4" }}>
              &ldquo;I&rsquo;ve spent a decade watching talented players get burned by
              bad coaching experiences &mdash; no-shows, mismatched styles, money gone
              with nothing to show. BooGMe is the platform I wish had existed when I
              started.&rdquo;
            </p>
          </motion.div>
          <motion.div variants={fadeIn} className="flex items-center justify-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-mono font-bold"
              style={{ background: "rgba(232,99,58,0.1)", color: "#E8633A" }}
            >
              CC
            </div>
            <div className="text-left">
              <div className="text-sm font-medium" style={{ color: "#F5F1E4" }}>Cristian Chirila</div>
              <div className="mono-label" style={{ color: "#A89F8A" }}>Grandmaster · Head Coach, Mizzou Chess Program</div>
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
            <span className="eyebrow">08 — start today</span>
          </motion.div>
          <motion.div variants={fadeIn}>
            <h2 className="text-5xl md:text-[64px] font-light tracking-tight text-foreground">
              Go live in minutes.
            </h2>
            <h2 className="text-5xl md:text-[64px] font-light tracking-tight text-primary mt-2">
              Start earning today.
            </h2>
          </motion.div>
          <motion.div variants={fadeIn} className="pt-4">
            <a
              href="/coach/onboarding"
              className="btn-editorial-primary group inline-flex items-center gap-2"
            >
              Apply as a founding coach
              <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </a>
          </motion.div>
          <motion.div variants={fadeIn}>
            <p className="mono-label text-muted-foreground">
              No payment details required · Set your own rate
            </p>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   FOOTER
   ═══════════════════════════════════════════════════════════════════ */
function CoachFooter() {
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
                <li>
                  <button
                    onClick={() => document.getElementById("calculator")?.scrollIntoView({ behavior: "smooth" })}
                    className="text-[13px] hover:underline"
                    style={{ color: "#F5F1E4" }}
                  >
                    Earnings calculator
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })}
                    className="text-[13px] hover:underline"
                    style={{ color: "#F5F1E4" }}
                  >
                    How it works
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => document.getElementById("faq")?.scrollIntoView({ behavior: "smooth" })}
                    className="text-[13px] hover:underline"
                    style={{ color: "#F5F1E4" }}
                  >
                    FAQ
                  </button>
                </li>
              </ul>
            </div>
            <div className="space-y-3">
              <div className="text-[11px] font-mono uppercase tracking-[0.08em]" style={{ color: "#A89F8A" }}>Company</div>
              <ul className="space-y-2">
                <li><a href="/for-students" className="text-[13px] hover:underline" style={{ color: "#F5F1E4" }}>For students</a></li>
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
   COACH LANDING — Main export
   ═══════════════════════════════════════════════════════════════════ */
export default function CoachLanding() {
  return (
    <div className="min-h-screen">
      <Navigation />
      <Hero />
      <EarningsCalculator />
      <WhyCoachHere />
      <HowItWorks />
      <MoreThanLessons />
      <FAQ />
      <FounderNote />
      <ClosingCTA />
      <CoachFooter />
    </div>
  );
}
