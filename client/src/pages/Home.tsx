/*
 * DESIGN: Palantir-Inspired Minimalism
 * Ultra-thin typography, dark mode, generous whitespace
 * Tech-forward aesthetic, coach-first messaging
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
  Mail,
  Loader2,
  Check
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
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";

// Glass Grandmaster animation system (spec Phase 7)
// - Section entrance: 0.5s easeOut
// - Stagger children: 0.08
// No spring physics, no bouncy transitions, nothing over 1s.
const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
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
        background: isScrolled ? "rgba(10, 10, 18, 0.8)" : "transparent",
        backdropFilter: isScrolled ? "blur(20px)" : "none",
        WebkitBackdropFilter: isScrolled ? "blur(20px)" : "none",
        borderBottom: isScrolled ? "0.5px solid rgba(255, 255, 255, 0.06)" : "0.5px solid transparent",
      }}
    >
      <div className="container flex items-center justify-between h-[60px]">
        <div className="flex items-center gap-4">
          <Logo height={32} />
        </div>

        <div className="hidden md:flex items-center gap-10">
          <button
            onClick={handleOpenAssessment}
            className="text-[13px] font-normal text-white/50 hover:text-[#FAF8F5] transition-colors duration-200"
          >
            Take AI Assessment
          </button>
          <button
            onClick={() => handleNavClick("features")}
            className="text-[13px] font-normal text-white/50 hover:text-[#FAF8F5] transition-colors duration-200"
          >
            Features
          </button>
          <a
            href="/coaches"
            className="text-[13px] font-normal text-white/50 hover:text-[#FAF8F5] transition-colors duration-200"
          >
            Browse Coaches
          </a>
          <a
            href="/for-coaches"
            className="text-[13px] font-normal text-white/50 hover:text-[#FAF8F5] transition-colors duration-200"
          >
            For Coaches
          </a>
          <button
            onClick={() => handleNavClick("waitlist")}
            className="text-[13px] font-normal text-white/50 hover:text-[#FAF8F5] transition-colors duration-200"
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
                <button className="glass rounded-lg px-4 py-1.5 text-[13px] text-[#FAF8F5] transition-all duration-200">
                  Sign In
                </button>
              </a>
            )
          )}
        </div>

        <button
          className="md:hidden text-[#FAF8F5]"
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
          className="md:hidden border-b border-white/[0.06]"
          style={{
            background: "rgba(10, 10, 18, 0.95)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
          }}
        >
          <div className="container py-6 flex flex-col gap-4">
            <a
              href="/coaches"
              className="text-base font-light text-white/60 hover:text-[#FAF8F5] transition-colors min-h-[48px] flex items-center"
            >
              Browse Coaches
            </a>
            <button
              onClick={() => handleNavClick("features")}
              className="text-base font-light text-white/60 hover:text-[#FAF8F5] transition-colors min-h-[48px] flex items-center text-left"
            >
              Features
            </button>
            <a
              href="/for-coaches"
              className="text-base font-light text-white/60 hover:text-[#FAF8F5] transition-colors min-h-[48px] flex items-center"
            >
              For Coaches
            </a>
            <button
              onClick={() => handleNavClick("waitlist")}
              className="text-base font-light text-white/60 hover:text-[#FAF8F5] transition-colors min-h-[48px] flex items-center text-left"
            >
              Join Waitlist
            </button>

            {/* Mobile User Menu or Sign In */}
            <div className="pt-4 border-t border-white/[0.06]">
              {!loading && (
                user ? (
                  <UserMenu />
                ) : (
                  <a href="/sign-in" className="block">
                    <button className="glass rounded-lg w-full py-3 text-sm text-[#FAF8F5]">
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

// Hero Section - Palantir minimalism
function HeroSection({ onOpenAssessment }: { onOpenAssessment: () => void }) {
  return (
    <section className="mesh-bg mesh-bg-animated relative min-h-[85vh] flex items-center justify-center pt-20">
      {/* Third mesh blob (terracotta) */}
      <div className="mesh-accent" />

      <div className="container relative z-10">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
          className="max-w-[600px] mx-auto text-center space-y-8"
        >
          {/* Badge */}
          <motion.div variants={fadeIn}>
            <span className="glass-badge">
              Founding members — limited spots
            </span>
          </motion.div>

          {/* Headline with gradient accent phrase */}
          <motion.div variants={fadeIn} className="space-y-5">
            <h1 className="text-balance">
              Find the coach who{" "}
              <span className="gradient-text">elevates your game.</span>
            </h1>
            <p className="text-[15px] leading-relaxed text-white/40 max-w-[400px] mx-auto">
              AI-matched chess coaches. Payment held in escrow until you're satisfied. No upfront fees, no risk.
            </p>
          </motion.div>

          {/* CTAs */}
          <motion.div variants={fadeIn} className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
            <a href="/coaches">
              <button className="btn-glass-primary group inline-flex items-center gap-2 w-full sm:w-auto justify-center">
                Browse Coaches
                <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </a>
            <button
              onClick={onOpenAssessment}
              className="glass rounded-[10px] px-7 py-3 text-[14px] font-medium text-white/80 inline-flex items-center gap-2 w-full sm:w-auto justify-center group"
            >
              Take AI Assessment
              <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </motion.div>

          {/* Stat cards */}
          <motion.div variants={fadeIn} className="grid grid-cols-3 gap-3 pt-6 max-w-[480px] mx-auto">
            <div className="glass-stat">
              <div className="text-[10px] uppercase tracking-[1px] text-white/30 mb-1.5">Avg rating gain</div>
              <div className="stat-number text-2xl font-light text-[#FAF8F5]">+127</div>
            </div>
            <div className="glass-stat">
              <div className="text-[10px] uppercase tracking-[1px] text-white/30 mb-1.5">Match accuracy</div>
              <div className="stat-number text-2xl font-light text-[#FAF8F5]">94%</div>
            </div>
            <div className="glass-stat">
              <div className="text-[10px] uppercase tracking-[1px] text-white/30 mb-1.5">Coaches keep</div>
              <div className="stat-number text-2xl font-light text-[#C27A4A]">85%+</div>
            </div>
          </motion.div>

          {/* Trust row */}
          <motion.div variants={fadeIn} className="pt-6">
            <div className="flex flex-wrap items-center justify-center gap-8 text-[12px] text-white/35">
              <div className="flex items-center gap-2">
                <Shield className="w-3.5 h-3.5" />
                <span>Payment Protection</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-3.5 h-3.5" />
                <span>Elite Coaches</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5" />
                <span>24/7 Support</span>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-float">
          <ChevronRight className="w-5 h-5 text-white/15 rotate-90" />
        </div>
      </div>
    </section>
  );
}

// Features Section → How It Works (4-step horizontal flow per spec 5e)
function FeaturesSection() {
  const steps = [
    {
      num: 1,
      title: "Pick a time",
      subtitle: "Real availability",
      gradient: "linear-gradient(135deg, #722F37, #8B3A43)",
    },
    {
      num: 2,
      title: "Coach confirms",
      subtitle: "Within 24 hours",
      gradient: "linear-gradient(135deg, #C27A4A, #D08B5C)",
    },
    {
      num: 3,
      title: "Pay securely",
      subtitle: "Escrow protected",
      gradient: "linear-gradient(135deg, #2D5A4A, #3A7260)",
    },
    {
      num: 4,
      title: "Learn & review",
      subtitle: "Rate your experience",
      gradient: "linear-gradient(135deg, #B8860B, #D4AA2B)",
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
          <motion.div variants={fadeIn} className="text-center space-y-4 max-w-3xl mx-auto">
            <div className="section-label">How it works</div>
            <h2>Four steps to better chess</h2>
          </motion.div>

          {/* Horizontal flow with dashed connector (hidden on mobile) */}
          <div className="relative grid grid-cols-1 md:grid-cols-4 gap-6 md:gap-4">
            {/* Dashed connector line (desktop only) */}
            <div className="hidden md:block absolute top-8 left-[12.5%] right-[12.5%] h-px border-t border-dashed border-white/[0.08] z-0" />

            {steps.map((step) => (
              <motion.div key={step.num} variants={fadeIn} className="relative z-10">
                <div className="glass-stat text-center space-y-3 h-full">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-medium text-[#FAF8F5] mx-auto"
                    style={{ background: step.gradient }}
                  >
                    {step.num}
                  </div>
                  <div>
                    <div className="text-[13px] font-medium text-[#FAF8F5]">{step.title}</div>
                    <div className="text-[11px] text-white/35 mt-0.5">{step.subtitle}</div>
                  </div>
                </div>
              </motion.div>
            ))}
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
    <section className="mesh-bg mesh-bg-warm section-sm relative">
      <div className="container relative z-10">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="max-w-5xl mx-auto"
        >
          <motion.div variants={fadeIn} className="glass-heavy rounded-[20px] p-7 md:p-10 grid md:grid-cols-2 gap-6 md:gap-10">
            {/* Students column */}
            <div className="space-y-4">
              <div className="section-label">For students</div>
              <h3 className="text-[20px] font-normal text-[#FAF8F5] leading-snug">
                Improve faster with the right coach
              </h3>
              <p className="body-muted">
                Matched to your goals, protected by escrow, reviewed by the community.
              </p>
              <ul className="space-y-2.5 pt-2">
                {studentPoints.map((point) => (
                  <li key={point} className="flex items-start gap-3 text-[13px] text-white/60">
                    <span className="mt-[7px] w-1 h-1 rounded-full bg-[#B8860B] flex-shrink-0" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Coaches column */}
            <div className="space-y-4">
              <div className="section-label">For coaches</div>
              <h3 className="text-[20px] font-normal text-[#FAF8F5] leading-snug">
                Build your business, keep your earnings
              </h3>
              <p className="body-muted">
                Focus on teaching. We handle matching, scheduling, escrow, and payouts.
              </p>
              <ul className="space-y-2.5 pt-2">
                {coachPoints.map((point) => (
                  <li key={point} className="flex items-start gap-3 text-[13px] text-white/60">
                    <span className="mt-[7px] w-1 h-1 rounded-full bg-[#B8860B] flex-shrink-0" />
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
          <motion.div variants={fadeIn} className="text-center space-y-6">
            <h2 className="text-5xl md:text-6xl font-thin tracking-tighter leading-tight">
              For Chess Coaches
            </h2>
            <p className="text-xl md:text-2xl font-light text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Full-service marketplace with payment protection, AI matching, and escrow. Not just a listing board.
            </p>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
              <span style={{ color: '#ffffff', fontWeight: 500, textShadow: '0 1px 2px rgba(0,0,0,0.5)' }} className="text-sm">Limited spots for founding coaches</span>
            </div>
          </motion.div>

          <motion.div variants={fadeIn} className="space-y-4">
            {coachBenefits.map((benefit, index) => (
              <div key={index} className="flex gap-4 items-start">
                <div className="flex-shrink-0 mt-1">
                  <Check className="w-5 h-5 text-foreground" strokeWidth={1.5} />
                </div>
                <p className="text-base font-light text-muted-foreground">
                  {benefit}
                </p>
              </div>
            ))}
          </motion.div>

          <motion.div variants={fadeIn} className="text-center pt-8">
            <Button 
              size="lg" 
              className="btn-secondary"
              onClick={() => {
                const element = document.getElementById("waitlist");
                if (element) {
                  element.scrollIntoView({ behavior: "smooth" });
                }
              }}
            >
              Apply as Coach
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
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
    <section id="waitlist" className="mesh-bg section relative">
      <div className="mesh-accent" />
      <div className="container relative z-10">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="max-w-[480px] mx-auto"
        >
          <motion.div variants={fadeIn} className="glass-heavy rounded-[20px] p-7 md:p-10 space-y-6">
            <div className="text-center space-y-3">
              <span className="glass-badge">Founding members — limited spots</span>
              <h2>Join the founding class</h2>
              <p className="body-muted max-w-sm mx-auto">
                We're launching soon. Be first to access elite chess coaching with payment protection.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="glass-input"
                  style={{ paddingLeft: '2.75rem' }}
                />
              </div>

              <div className="flex items-center justify-center gap-5 text-[13px]">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="role"
                    value="student"
                    checked={userType === "student"}
                    onChange={() => setUserType("student")}
                    className="accent-[#722F37] w-3.5 h-3.5"
                  />
                  <span className="text-white/60">I'm a Student</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="role"
                    value="coach"
                    checked={userType === "coach"}
                    onChange={() => setUserType("coach")}
                    className="accent-[#722F37] w-3.5 h-3.5"
                  />
                  <span className="text-white/60">I'm a Coach</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={joinWaitlist.isPending}
                className="btn-glass-primary w-full disabled:opacity-60"
              >
                {joinWaitlist.isPending ? (
                  <span className="inline-flex items-center gap-2 justify-center">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Joining…
                  </span>
                ) : (
                  "Join Waitlist"
                )}
              </button>

              <p className="text-[10px] text-white/20 text-center">
                No spam. Unsubscribe anytime.
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
          <motion.div variants={fadeIn} className="text-center space-y-6 max-w-3xl mx-auto">
            <h2 className="text-5xl md:text-6xl font-thin tracking-tighter leading-tight">
              Our Coach Community
            </h2>
            <p className="text-xl md:text-2xl font-light text-muted-foreground leading-relaxed">
              We're building a curated network of elite chess coaches. Join the waitlist to be notified when our founding coaches launch.
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
              className="text-center py-24 space-y-6"
            >
              <div className="space-y-4">
                <p className="text-2xl font-light text-foreground">
                  Our founding coaches are coming soon.
                </p>
                <p className="text-lg font-light text-muted-foreground max-w-2xl mx-auto">
                  We're currently vetting applications from elite chess coaches. Join the waitlist below to be notified when they launch.
                </p>
              </div>
              <Button
                size="lg"
                onClick={() => {
                  const element = document.getElementById("waitlist");
                  if (element) {
                    element.scrollIntoView({ behavior: "smooth" });
                  }
                }}
                className="font-light"
              >
                Join Waitlist
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
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

// Footer — Glass Grandmaster editorial
function Footer() {
  return (
    <footer className="bg-[#0A0A12] border-t border-white/[0.04] py-12 md:py-14">
      <div className="container">
        <div className="grid md:grid-cols-[1fr_auto] gap-10 md:gap-16">
          {/* Brand */}
          <div className="space-y-3 opacity-50">
            <Logo height={24} fallbackClassName="opacity-80" />
            <p className="text-[11px] text-white/30">The chess coaching marketplace</p>
          </div>

          {/* Link columns */}
          <nav aria-label="Footer" className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
            <div className="space-y-3">
              <div className="text-[11px] uppercase tracking-[1px] text-white/25">Platform</div>
              <ul className="space-y-2">
                <li><a href="/coaches" className="text-[13px] text-white/35 hover:text-white/60 transition-colors">Browse Coaches</a></li>
                <li><a href="/for-coaches" className="text-[13px] text-white/35 hover:text-white/60 transition-colors">For Coaches</a></li>
                <li><a href="/?openAssessment=1" className="text-[13px] text-white/35 hover:text-white/60 transition-colors">AI Matching</a></li>
              </ul>
            </div>
            <div className="space-y-3">
              <div className="text-[11px] uppercase tracking-[1px] text-white/25">Company</div>
              <ul className="space-y-2">
                <li><a href="#" className="text-[13px] text-white/35 hover:text-white/60 transition-colors">About</a></li>
                <li><a href="#" className="text-[13px] text-white/35 hover:text-white/60 transition-colors">Blog</a></li>
              </ul>
            </div>
            <div className="space-y-3">
              <div className="text-[11px] uppercase tracking-[1px] text-white/25">Legal</div>
              <ul className="space-y-2">
                <li><a href="/privacy" className="text-[13px] text-white/35 hover:text-white/60 transition-colors">Privacy Policy</a></li>
                <li><a href="/terms" className="text-[13px] text-white/35 hover:text-white/60 transition-colors">Terms of Service</a></li>
              </ul>
            </div>
            <div className="space-y-3">
              <div className="text-[11px] uppercase tracking-[1px] text-white/25">Connect</div>
              <ul className="space-y-2">
                <li><a href="mailto:hello@boogme.com" className="text-[13px] text-white/35 hover:text-white/60 transition-colors">Email</a></li>
              </ul>
            </div>
          </nav>
        </div>

        <div className="mt-12 pt-6 border-t border-white/[0.04]">
          <p className="text-[11px] text-white/15">© 2026 BooGMe. All rights reserved.</p>
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
