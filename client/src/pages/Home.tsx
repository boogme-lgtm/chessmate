/*
 * DESIGN: Editorial Cream + Ember Dark
 * Swiss typographic discipline. Numbered eyebrows (01 — The platform),
 * Inter Light displays, Source Serif 4 ledes, JetBrains Mono labels.
 * No gradient CTAs, no glassmorphism, no decorative colour.
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { 
  Shield,
  Users,
  Clock,
  ChevronRight,
  Menu,
  X,
  Loader2,
  Check,
  Mail
} from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { CoachMatchingAssessment } from "@/components/CoachMatchingAssessment";
import { CoachProfileCard, type CoachProfile } from "@/components/CoachProfileCard";
import { CoachFilters, type FilterState } from "@/components/CoachFilters";
import { WelcomePopup } from "@/components/WelcomePopup";
import { UserMenu } from "@/components/UserMenu";
import Logo from "@/components/Logo";
import HeroScene3D from "@/components/hero/HeroScene3D";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";

// Editorial motion tokens (brief spec).
// Reveal: 900ms cubic-bezier(0.2, 0.7, 0.2, 1), translateY(24px → 0).
// Stagger children: 0.08s, delay 0.1s.
const fadeIn = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.9, ease: [0.2, 0.7, 0.2, 1] }
  }
} as const;

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 }
  }
};

// Navigation Component - Minimal Palantir style
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
    window.addEventListener("scroll", handleScroll);
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
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        background: isScrolled ? "color-mix(in oklab, var(--background) 88%, transparent)" : "transparent",
        backdropFilter: isScrolled ? "saturate(140%)" : "none",
        WebkitBackdropFilter: isScrolled ? "saturate(140%)" : "none",
        borderBottom: isScrolled ? "1px solid var(--line)" : "1px solid transparent",
      }}
    >
      <div className="container flex items-center justify-between h-[60px]">
        <div className="flex items-center gap-4">
          <Logo height={32} />
        </div>

        <div className="hidden md:flex items-center gap-10">
          <button
            onClick={handleOpenAssessment}
            className="text-[13px] font-normal text-muted-foreground hover:text-foreground transition-colors duration-200"
          >
            Take AI Assessment
          </button>
          <button
            onClick={() => handleNavClick("features")}
            className="text-[13px] font-normal text-muted-foreground hover:text-foreground transition-colors duration-200"
          >
            Features
          </button>
          <a
            href="/coaches"
            className="text-[13px] font-normal text-muted-foreground hover:text-foreground transition-colors duration-200"
          >
            Browse Coaches
          </a>
          <a
            href={
              !loading && ((user as any)?.userType === "coach" || (user as any)?.userType === "both")
                ? "/dashboard"
                : "/for-coaches"
            }
            className="text-[13px] font-normal text-muted-foreground hover:text-foreground transition-colors duration-200"
          >
            {!loading && ((user as any)?.userType === "coach" || (user as any)?.userType === "both")
              ? "My Dashboard"
              : "For Coaches"}
          </a>
          <button
            onClick={() => handleNavClick("waitlist")}
            className="text-[13px] font-normal text-muted-foreground hover:text-foreground transition-colors duration-200"
          >
            Join Waitlist
          </button>
        </div>

        {/* User Menu or Sign In */}
        <div className="hidden md:block">
          {!loading && (
            user ? (
              <UserMenu />
            ) : (
              <a href="/sign-in">
                <button className="btn-editorial-ghost px-4 py-1.5 text-[13px]">
                  Sign In
                </button>
              </a>
            )
          )}
        </div>

        <button
          className="md:hidden text-foreground"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Menu — full-width frosted overlay */}
      {mobileMenuOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="md:hidden border-b border-border"
          style={{ background: "var(--background)" }}
        >
          <div className="container py-6 flex flex-col gap-4">
            <a
              href="/coaches"
              className="text-base font-light text-muted-foreground hover:text-foreground transition-colors min-h-[48px] flex items-center"
            >
              Browse Coaches
            </a>
            <button
              onClick={() => handleNavClick("features")}
              className="text-base font-light text-muted-foreground hover:text-foreground transition-colors min-h-[48px] flex items-center text-left"
            >
              Features
            </button>
            <a
              href={
                !loading && ((user as any)?.userType === "coach" || (user as any)?.userType === "both")
                  ? "/dashboard"
                  : "/for-coaches"
              }
              className="text-base font-light text-muted-foreground hover:text-foreground transition-colors min-h-[48px] flex items-center"
            >
              {!loading && ((user as any)?.userType === "coach" || (user as any)?.userType === "both")
                ? "My Dashboard"
                : "For Coaches"}
            </a>
            <button
              onClick={() => handleNavClick("waitlist")}
              className="text-base font-light text-muted-foreground hover:text-foreground transition-colors min-h-[48px] flex items-center text-left"
            >
              Join Waitlist
            </button>

            {/* Mobile User Menu or Sign In */}
            <div className="pt-4 border-t border-border">
              {!loading && (
                user ? (
                  <UserMenu />
                ) : (
                  <a href="/sign-in" className="block">
                    <button className="btn-editorial-ghost w-full py-3 text-sm">
                      Sign In
                    </button>
                  </a>
                )
              )}
            </div>
          </div>
        </motion.div>
      )}
    </motion.nav>
  );
}

// Hero — editorial layout with eyebrow + numbered section, shimmer second line.
function HeroSection({ onOpenAssessment }: { onOpenAssessment: () => void }) {
  return (
    <section className="mesh-bg mesh-bg-animated relative min-h-[85vh] flex items-center pt-24 pb-16 overflow-hidden">
      <div className="mesh-accent" />
      <div className="precision-grid" aria-hidden />

      {/* 3D brand scene — floating glass cards + logo primitives.
          Positioned on the right on lg+ so the editorial text layout
          stays anchored left. Hidden below lg for mobile perf. */}
      <div
        className="hidden lg:block absolute right-0 top-1/2 -translate-y-1/2 w-[50%] max-w-[680px] pointer-events-none z-0"
        style={{ height: 560 }}
      >
        <HeroScene3D />
      </div>

      <div className="container relative z-10">
        {/* Top row — numbered eyebrow + mono URL label */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="flex items-center justify-between mb-12"
        >
          <span className="eyebrow">01 — The platform</span>
          <span className="mono-label hidden sm:inline">BOOGME.COM / HOMEPAGE</span>
        </motion.div>

        <motion.div
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
          className="max-w-[820px] space-y-8"
        >
          {/* Headline — H1 with shimmer on the second line */}
          <motion.div variants={fadeIn} className="space-y-6">
            <h1 className="text-balance">
              Chess coaching,
              <br />
              <span className="shimmer">without the risk.</span>
            </h1>
            <p className="lede max-w-[560px]">
              AI-matched coaches. Payment sits in escrow until your lesson is complete.
              Dispute it within 48 hours, get every dollar back.
            </p>
          </motion.div>

          {/* CTAs — primary + ghost, plus mono reassurance */}
          <motion.div variants={fadeIn} className="flex flex-col sm:flex-row gap-3 items-start sm:items-center pt-2">
            <button
              onClick={onOpenAssessment}
              className="btn-editorial-primary group inline-flex items-center gap-2"
            >
              Take the 8-minute quiz
              <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
            <a href="/for-coaches">
              <button className="btn-editorial-ghost group inline-flex items-center gap-2">
                I&rsquo;m a coach
                <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </a>
            <span className="mono-label sm:ml-3">No signup · No card required</span>
          </motion.div>

          {/* Trust strip — 4-column stats per brief (0% / 48h / 8min / 20Q) */}
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
        </motion.div>
      </div>
    </section>
  );
}

// 02 — How it works. Four editorial cells, mono numbers, vertical dividers,
// per the brief's "infrastructure coaching never had" section.
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
      icon: Check,
      title: "Rating-locked payouts",
      copy: "Coaches keep their fees only when ratings hold. Quality is not a badge; it's a gate on payment.",
    },
    {
      num: "04",
      icon: Clock,
      title: "Coach-first economics",
      copy: "Low single-digit platform fees. No card required until a coach earns $100. Coaches keep more, students pay less.",
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
              <span className="eyebrow">02 — How it works</span>
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

          {/* 4-column editorial grid, hairline top + vertical dividers between cells */}
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

// Value Proposition Section — two-column glass panel (spec 5d)
function PaymentProtectionSection() {
  const studentPoints = [
    "AI matches your playing style and goals",
    "Payments held in escrow until satisfied",
    "Review coaches before you commit",
  ];
  const coachPoints = [
    "Keep more of your earnings, transparent fees",
    "No payment details until you've earned $100",
    "Automated scheduling, escrow, and payouts",
  ];

  return (
    <section className="section-sm relative" style={{ background: "var(--surface)" }}>
      <div className="container relative z-10">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="max-w-5xl mx-auto"
        >
          <motion.div variants={fadeIn} className="grid md:grid-cols-2 gap-px bg-border">
            {/* Students column */}
            <div className="bg-background p-8 md:p-10 space-y-5">
              <span className="eyebrow">For students</span>
              <h3 className="text-foreground">Improve faster with the right coach</h3>
              <p className="lede text-muted-foreground text-base">
                Matched to your goals, protected by escrow, reviewed by the community.
              </p>
              <ul className="space-y-3 pt-2 border-t border-border">
                {studentPoints.map((point) => (
                  <li key={point} className="flex items-start gap-3 text-sm text-foreground pt-3">
                    <Check className="w-4 h-4 text-safe mt-0.5 flex-shrink-0" strokeWidth={1.5} />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Coaches column */}
            <div className="bg-background p-8 md:p-10 space-y-5">
              <span className="eyebrow">For coaches</span>
              <h3 className="text-foreground">Build your business, keep your earnings</h3>
              <p className="lede text-muted-foreground text-base">
                Focus on teaching. We handle matching, scheduling, escrow, and payouts.
              </p>
              <ul className="space-y-3 pt-2 border-t border-border">
                {coachPoints.map((point) => (
                  <li key={point} className="flex items-start gap-3 text-sm text-foreground pt-3">
                    <Check className="w-4 h-4 text-safe mt-0.5 flex-shrink-0" strokeWidth={1.5} />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

// For Coaches Section
function ForCoachesSection() {
  const coachBenefits = [
    "Payment protection with escrow system - get paid for every completed lesson",
    "AI-powered student matching based on teaching style and expertise",
    "No payment details needed until you earn $100",
    "Keep more of your earnings with minimal platform fees",
    "Automated scheduling, payments, and calendar management",
    "Built-in video conferencing and analysis tools"
  ];

  return (
    <section id="coaches" className="section">
      <div className="container">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="max-w-4xl mx-auto space-y-16"
        >
          <motion.div variants={fadeIn} className="space-y-5">
            <span className="eyebrow">04 — For coaches</span>
            <h2 className="text-balance">
              Full-service marketplace,
              <br />
              not a listing board.
            </h2>
            <p className="lede max-w-2xl">
              Payment protection, AI matching, escrow, scheduling — built so you can focus
              entirely on teaching.
            </p>
          </motion.div>

          <motion.div variants={fadeIn} className="grid sm:grid-cols-2 gap-x-10 gap-y-5 border-t border-border pt-10">
            {coachBenefits.map((benefit) => (
              <div key={benefit} className="flex gap-3 items-start">
                <Check className="w-4 h-4 text-safe mt-1 flex-shrink-0" strokeWidth={1.5} />
                <p className="text-sm text-foreground leading-relaxed">{benefit}</p>
              </div>
            ))}
          </motion.div>

          <motion.div variants={fadeIn} className="pt-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <button
              className="btn-editorial-primary inline-flex items-center gap-2"
              onClick={() => {
                const element = document.getElementById("waitlist");
                if (element) {
                  element.scrollIntoView({ behavior: "smooth" });
                }
              }}
            >
              Apply as coach
              <ChevronRight className="w-4 h-4" />
            </button>
            <span className="mono-label">Limited founding-class spots</span>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

// Waitlist Section
function WaitlistSection() {
  const [email, setEmail] = useState("");
  const [userType, setUserType] = useState<"student" | "coach" | "both">("student");
  
  const joinWaitlist = trpc.waitlist.join.useMutation({
    onSuccess: () => {
      toast.success("You're on the list!", {
        description: "We'll notify you when we launch."
      });
      setEmail("");
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : "Failed to join waitlist";
      
      // Check if it's a duplicate email error
      if (errorMessage.includes("already") || errorMessage.includes("duplicate") || errorMessage.includes("exists") || errorMessage.includes("waitlist")) {
        toast.info("You're already on the list!", {
          description: "We'll notify you when we launch. No need to sign up again."
        });
      } else {
        toast.error("Something went wrong", {
          description: errorMessage
        });
      }
    }
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
              <span className="eyebrow">05 — Get started</span>
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

              <p className="mono-label text-center">
                No spam · Unsubscribe anytime
              </p>
            </form>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

// Meet Our Coaches Section
function MeetOurCoachesSection() {
  const [filters, setFilters] = useState<FilterState>({
    priceRange: [0, 200],
    minRating: null,
    specializations: [],
    preferredTimeSlots: [],
    timezoneOffset: null,
  });

  // TODO: Fetch real coaches from database when they sign up
  const coaches: CoachProfile[] = [];

  // Extract all unique specializations from coaches
  const allSpecializations = Array.from(
    new Set(coaches.flatMap((coach) => coach.specializations))
  ).sort();

  // Filter coaches based on current filters
  const filteredCoaches = coaches.filter((coach) => {
    // Price filter
    if (
      coach.hourlyRate < filters.priceRange[0] ||
      coach.hourlyRate > filters.priceRange[1]
    ) {
      return false;
    }

    // Rating filter
    if (filters.minRating && coach.reviewRating && coach.reviewRating < filters.minRating) {
      return false;
    }

    // Specialization filter
    if (filters.specializations.length > 0) {
      const hasMatchingSpec = filters.specializations.some((spec) =>
        coach.specializations.includes(spec)
      );
      if (!hasMatchingSpec) {
        return false;
      }
    }

    // Time slot availability filter
    if (filters.preferredTimeSlots.length > 0) {
      const hasMatchingTimeSlot = filters.preferredTimeSlots.some((slot) =>
        coach.detailedAvailability.timeSlots.includes(slot)
      );
      if (!hasMatchingTimeSlot) {
        return false;
      }
    }

    return true;
  });

  const handleBookClick = () => {
    const element = document.getElementById("waitlist");
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
    toast.info("Join the waitlist to book lessons with our founding coaches!");
  };

  return (
    <section className="section">
      <div className="container">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="space-y-16"
        >
          <motion.div variants={fadeIn} className="space-y-5 max-w-3xl">
            <span className="eyebrow">03 — Your matches</span>
            <h2 className="text-balance">
              Three coaches.
              <br />
              Ranked by fit, not ad spend.
            </h2>
            <p className="lede">
              We&rsquo;re building a curated network of elite chess coaches. Join the waitlist to be
              notified when our founding coaches launch.
            </p>
          </motion.div>

          {/* Filters */}
          <motion.div variants={fadeIn}>
            <CoachFilters
              filters={filters}
              onFiltersChange={setFilters}
              availableSpecializations={allSpecializations}
            />
          </motion.div>

          {/* Results Count - Only show if coaches exist */}
          {coaches.length > 0 && (
            <motion.div variants={fadeIn} className="text-center">
              <p className="text-sm font-light text-muted-foreground">
                Showing {filteredCoaches.length} of {coaches.length} coaches
              </p>
            </motion.div>
          )}

          {/* Coach Grid or Empty State */}
          {coaches.length === 0 ? (
            <motion.div
              variants={fadeIn}
              className="border border-border p-10 md:p-14 space-y-6"
            >
              <div className="space-y-4 max-w-2xl">
                <span className="eyebrow">In review</span>
                <p className="text-2xl font-light text-foreground">
                  Our founding coaches are coming soon.
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  We&rsquo;re currently vetting applications from elite chess coaches. Join the
                  waitlist below to be notified when they launch.
                </p>
              </div>
              <button
                onClick={() => {
                  const element = document.getElementById("waitlist");
                  if (element) {
                    element.scrollIntoView({ behavior: "smooth" });
                  }
                }}
                className="btn-editorial-primary inline-flex items-center gap-2"
              >
                Join the waitlist
                <ChevronRight className="h-4 w-4" />
              </button>
            </motion.div>
          ) : filteredCoaches.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredCoaches.map((coach) => (
                <CoachProfileCard
                  key={coach.id}
                  coach={coach}
                  onBookClick={handleBookClick}
                />
              ))}
            </div>
          ) : (
            <motion.div
              variants={fadeIn}
              className="text-center py-16 space-y-4"
            >
              <p className="text-xl font-light text-muted-foreground">
                No coaches match your current filters.
              </p>
              <Button
                variant="outline"
                onClick={() =>
                  setFilters({
                    priceRange: [0, 200],
                    minRating: null,
                    specializations: [],
                    preferredTimeSlots: [],
                    timezoneOffset: null,
                  })
                }
                className="font-light"
              >
                Reset Filters
              </Button>
            </motion.div>
          )}
        </motion.div>
      </div>
    </section>
  );
}

// Footer — editorial. Hairline dividers, mono labels, semantic tokens.
function Footer() {
  return (
    <footer className="border-t border-border py-14" style={{ background: "var(--surface)" }}>
      <div className="container">
        <div className="grid md:grid-cols-[1fr_auto] gap-10 md:gap-16">
          <div className="space-y-3">
            <Logo height={24} />
            <p className="mono-label">The chess coaching marketplace</p>
          </div>

          <nav aria-label="Footer" className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
            <div className="space-y-3">
              <div className="mono-label">Platform</div>
              <ul className="space-y-2">
                <li><a href="/coaches" className="text-[13px] text-muted-foreground hover:text-foreground transition-colors">Browse coaches</a></li>
                <li><a href="/for-coaches" className="text-[13px] text-muted-foreground hover:text-foreground transition-colors">For coaches</a></li>
                <li><a href="/?openAssessment=1" className="text-[13px] text-muted-foreground hover:text-foreground transition-colors">AI matching</a></li>
              </ul>
            </div>
            <div className="space-y-3">
              <div className="mono-label">Company</div>
              <ul className="space-y-2">
                <li><a href="#" className="text-[13px] text-muted-foreground hover:text-foreground transition-colors">About</a></li>
                <li><a href="#" className="text-[13px] text-muted-foreground hover:text-foreground transition-colors">Blog</a></li>
              </ul>
            </div>
            <div className="space-y-3">
              <div className="mono-label">Legal</div>
              <ul className="space-y-2">
                <li><a href="/privacy" className="text-[13px] text-muted-foreground hover:text-foreground transition-colors">Privacy</a></li>
                <li><a href="/terms" className="text-[13px] text-muted-foreground hover:text-foreground transition-colors">Terms</a></li>
              </ul>
            </div>
            <div className="space-y-3">
              <div className="mono-label">Connect</div>
              <ul className="space-y-2">
                <li><a href="mailto:hello@boogme.com" className="text-[13px] text-muted-foreground hover:text-foreground transition-colors">Email</a></li>
              </ul>
            </div>
          </nav>
        </div>

        <div className="mt-12 pt-6 border-t border-border">
          <p className="mono-label">© 2026 BooGMe. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

// Main Home Component
export default function Home() {
  const [assessmentOpen, setAssessmentOpen] = useState(false);

  // Auto-open assessment modal when ?openAssessment=1 is in the URL.
  // This backs both /?openAssessment=1 and the /assessment route alias.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("openAssessment") === "1") {
      setAssessmentOpen(true);
      // Clean the URL so refreshing doesn't keep re-opening the modal.
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
      <HeroSection onOpenAssessment={() => setAssessmentOpen(true)} />
      <FeaturesSection />
      <PaymentProtectionSection />
      <MeetOurCoachesSection />
      <ForCoachesSection />
      <WaitlistSection />
      <Footer />
      {assessmentOpen && <CoachMatchingAssessment onClose={() => setAssessmentOpen(false)} />}
    </div>
  );
}
