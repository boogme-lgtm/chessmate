/*
 * DESIGN: Editorial Cream + Ember Dark — Homepage v2
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
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, delay: 0.1 }}
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        background: isScrolled ? "var(--background)" : "transparent",
        backdropFilter: isScrolled ? "blur(12px)" : "none",
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
      {/* Mobile Menu */}
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
            <button
              onClick={handleOpenAssessment}
              className="text-base font-light text-muted-foreground hover:text-foreground transition-colors min-h-[48px] flex items-center text-left"
            >
              Take AI Assessment
            </button>
            <a
              href="/coaches"
              className="text-base font-light text-muted-foreground hover:text-foreground transition-colors min-h-[48px] flex items-center"
            >
              Browse Coaches
            </a>
            <a
              href="/for-coaches"
              className="text-base font-light text-muted-foreground hover:text-foreground transition-colors min-h-[48px] flex items-center"
            >
              For Coaches
            </a>
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

/* ═══════════════════════════════════════════════════════════════════
   HERO V2
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
          {/* Right column — Quiz Result Mockup */}
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
    <section className="border-y border-border py-5" style={{ background: "var(--surface)" }}>
      <style>{`
        @keyframes pulse-ring {
          0% { box-shadow: 0 0 0 0 rgba(139,69,19,0.4); }
          70% { box-shadow: 0 0 0 8px transparent; }
          100% { box-shadow: 0 0 0 0 transparent; }
        }
        .pulse-dot { animation: pulse-ring 2s infinite; }
      `}</style>
      <div className="container">
        <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
          {/* Left side */}
          <div className="flex items-start md:items-center gap-3 flex-1">
            <div className="w-2.5 h-2.5 rounded-full bg-primary pulse-dot shrink-0 mt-1 md:mt-0" />
            <div className="space-y-1">
              <span className="mono-label text-primary tracking-[0.16em]">NOW IN FOUNDING-COACH BETA</span>
              <p className="text-sm text-muted-foreground">
                We&rsquo;re hand-selecting our first 50 coaches. Founding coaches keep 100% of their fees for the first six months — and help shape the platform.
              </p>
            </div>
          </div>
          {/* Right side — CTAs */}
          <div className="flex items-center gap-3 shrink-0">
            <a href="/coach/onboarding" className="btn-editorial-ghost text-sm px-4 py-2 inline-flex items-center gap-1">
              Apply as a coach <ChevronRight className="w-3.5 h-3.5" />
            </a>
            <button onClick={onOpenAssessment} className="btn-editorial-ghost text-sm px-4 py-2">
              Join the student waitlist
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   PROBLEM STATEMENT
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
    <section className="section bg-[var(--color-cream-deep)] dark:bg-[var(--color-ink-raised)]">
      <div className="container">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="space-y-12"
        >
          <motion.div variants={fadeIn}>
            <span className="eyebrow">01 — The problem with chess coaching today</span>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-3 border-t border-border">
            {problems.map((p, i) => (
              <motion.div
                key={p.num}
                variants={fadeIn}
                className={`p-8 md:p-10 space-y-4 ${i > 0 ? "md:border-l border-t md:border-t-0 border-border" : ""}`}
              >
                <span className="mono-label text-primary">{p.num}</span>
                <h3 className="font-serif text-[28px] font-light leading-tight tracking-tight text-foreground">
                  {p.headline}
                </h3>
                <p className="text-[15px] text-muted-foreground leading-relaxed">{p.body}</p>
              </motion.div>
            ))}
          </div>
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
   WAITLIST SECTION (unchanged)
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
              <span className="eyebrow">03 — Get started</span>
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
   COACH MARKETPLACE SECTION (formerly MeetOurCoachesSection)
   ═══════════════════════════════════════════════════════════════════ */
function CoachMarketplaceSection() {
  const [filters, setFilters] = useState<FilterState>({
    priceRange: [0, 200],
    minRating: null,
    specializations: [],
    preferredTimeSlots: [],
    timezoneOffset: null,
  });

  const coaches: CoachProfile[] = [];

  const allSpecializations = Array.from(
    new Set(coaches.flatMap((c) => c.specializations))
  );

  const filteredCoaches = coaches.filter((coach) => {
    if (coach.hourlyRate < filters.priceRange[0] || coach.hourlyRate > filters.priceRange[1]) {
      return false;
    }
    if (filters.minRating && coach.reviewRating && coach.reviewRating < filters.minRating) {
      return false;
    }
    if (filters.specializations.length > 0) {
      const hasMatchingSpec = filters.specializations.some((spec) =>
        coach.specializations.includes(spec)
      );
      if (!hasMatchingSpec) return false;
    }
    if (filters.preferredTimeSlots.length > 0) {
      const hasMatchingTimeSlot = filters.preferredTimeSlots.some((slot) =>
        coach.detailedAvailability.timeSlots.includes(slot)
      );
      if (!hasMatchingTimeSlot) return false;
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
                  if (element) element.scrollIntoView({ behavior: "smooth" });
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
                <CoachProfileCard key={coach.id} coach={coach} onBookClick={handleBookClick} />
              ))}
            </div>
          ) : (
            <motion.div variants={fadeIn} className="text-center py-16 space-y-4">
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
            <span className="eyebrow">04 — What we believe</span>
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
   COACH DASHBOARD PREVIEW (dark section)
   ═══════════════════════════════════════════════════════════════════ */
function CoachDashboardPreview() {
  const features = [
    "Stripe-powered instant payouts",
    "Lesson scheduling with calendar sync",
    "PPV content storefront",
    "Student progress notes",
    "In-lesson messaging",
    "Referral program with earnings",
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
          className="space-y-12"
        >
          <motion.div variants={fadeIn} className="space-y-6 max-w-3xl">
            <span className="mono-label text-[11px] font-medium uppercase tracking-[0.12em]" style={{ color: "#E8633A" }}>
              05 — Built for coaches who take their business seriously
            </span>
            <h2 className="text-4xl md:text-[48px] font-light leading-[1.1]" style={{ color: "#F5F1E4" }}>
              Your coaching business, in one place.
            </h2>
            <p className="font-serif text-[19px] leading-relaxed" style={{ color: "#A89F8A" }}>
              Manage bookings, track earnings, message students, and sell your content — all from a single dashboard.
            </p>
          </motion.div>

          {/* Stats row */}
          <motion.div
            variants={fadeIn}
            className="grid grid-cols-1 sm:grid-cols-3 gap-px border-t"
            style={{ borderColor: "#22303C" }}
          >
            {[
              { value: "$2,400", label: "Monthly earnings" },
              { value: "18", label: "Active students" },
              { value: "4.9\u2605", label: "Average rating" },
            ].map((stat) => (
              <div key={stat.label} className="py-8 px-2">
                <div className="text-3xl font-mono font-light" style={{ color: "#F5F1E4" }}>{stat.value}</div>
                <div className="mono-label mt-2" style={{ color: "#A89F8A" }}>{stat.label}</div>
              </div>
            ))}
          </motion.div>

          {/* Feature list */}
          <motion.div variants={fadeIn} className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-12">
            {features.map((feature) => (
              <div key={feature} className="flex items-center gap-3 text-sm" style={{ color: "#F5F1E4" }}>
                <Check className="w-4 h-4 shrink-0" style={{ color: "#E8633A" }} />
                {feature}
              </div>
            ))}
          </motion.div>

          {/* CTA */}
          <motion.div variants={fadeIn} className="pt-4">
            <a
              href="/coach/onboarding"
              className="inline-flex items-center gap-2 px-6 py-3 border rounded-sm text-sm transition-colors"
              style={{ borderColor: "rgba(245,241,228,0.2)", color: "#F5F1E4" }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(245,241,228,0.4)")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(245,241,228,0.2)")}
            >
              Apply as a founding coach
              <ChevronRight className="w-4 h-4" />
            </a>
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
            <div className="mono-label text-xs" style={{ color: "rgba(168,159,138,0.5)" }}>
              ← Placeholder — real photo before launch
            </div>
          </motion.div>

          {/* Right column — founding story */}
          <motion.div variants={fadeIn} className="space-y-8">
            <span className="mono-label text-[11px] font-medium uppercase tracking-[0.12em]" style={{ color: "#E8633A" }}>
              05 — Built by a player who&rsquo;s seen it all
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
    <section className="section bg-background">
      <div className="container">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="space-y-16"
        >
          <motion.div variants={fadeIn} className="space-y-5">
            <span className="eyebrow">06 — Simple, transparent pricing</span>
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
            <span className="eyebrow">07 — Get matched</span>
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
      <WaitlistSection />
      <CoachMarketplaceSection />
      <TestimonialBlockV2 />
      <CoachDashboardPreview />
      <FoundersBlock />
      <PricingTable />
      <ClosingCTA onOpenAssessment={() => setAssessmentOpen(true)} />
      <Footer />
      {assessmentOpen && <CoachMatchingAssessment onClose={() => setAssessmentOpen(false)} />}
    </div>
  );
}
