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
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";

// Minimal animation variants
const fadeIn = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] } }
} as const;

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.2 }
  }
};

// Navigation Component - Minimal Palantir style
function Navigation() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, loading } = useAuth();
  


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
          <img
            src="https://d2xsxph8kpxj0f.cloudfront.net/310519663188415081/Xkyng35xnYFybYAdmyVo96/boogme-logo-transparent_1ab89b8a.svg"
            alt="BooGMe"
            className="h-8 w-auto"
          />
        </div>

        <div className="hidden md:flex items-center gap-10">
          <a
            href="/assessment"
            className="text-[13px] font-normal text-white/50 hover:text-[#FAF8F5] transition-colors duration-200"
          >
            Take AI Assessment
          </a>
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

// Features Section - Minimal cards
function FeaturesSection() {
  const features = [
    {
      icon: Shield,
      title: "Payment Protection",
      description: "Escrow-style payments held until lesson completion. Full refund window for satisfaction guarantee."
    },
    {
      icon: Users,
      title: "AI Matching",
      description: "Smart algorithm matches you with coaches based on skill level, goals, and learning style."
    },
    {
      icon: Clock,
      title: "Flexible Scheduling",
      description: "Book lessons at your convenience. Coaches available across all time zones worldwide."
    }
  ];

  return (
    <section id="features" className="section">
      <div className="container">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="space-y-20"
        >
          <motion.div variants={fadeIn} className="text-center space-y-6 max-w-3xl mx-auto">
            <h2 className="text-5xl md:text-6xl font-thin tracking-tighter leading-tight">
              Built for serious players
            </h2>
            <p className="text-xl md:text-2xl font-light text-muted-foreground leading-relaxed">
              A platform designed to protect both students and coaches
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div key={index} variants={fadeIn}>
                <Card className="palantir-card h-full p-8">
                  <CardContent className="p-0 space-y-4">
                    <feature.icon className="w-8 h-8 text-foreground" strokeWidth={1} />
                    <h3 className="text-xl font-light">{feature.title}</h3>
                    <p className="text-sm font-light text-muted-foreground leading-relaxed">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// Payment Protection Section - Detailed explanation
function PaymentProtectionSection() {
  const protectionFeatures = [
    {
      title: "Escrow Payments",
      description: "Funds held securely until lesson completion and student confirmation"
    },
    {
      title: "48-Hour Refund Window",
      description: "Full refund available within 48 hours of lesson completion"
    },
    {
      title: "Rating-Locked Payouts",
      description: "Coaches must maintain minimum ratings to receive payments"
    },
    {
      title: "Dispute Resolution",
      description: "Fair mediation process for any payment or quality disputes"
    }
  ];

  return (
    <section className="section-sm bg-card/30">
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
              Payment Protection
            </h2>
            <p className="text-xl md:text-2xl font-light text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              The chess coaching industry lacks payment protection. We solve this with escrow-style payments and satisfaction guarantees.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-6">
            {protectionFeatures.map((feature, index) => (
              <motion.div key={index} variants={fadeIn} className="flex gap-4">
                <div className="flex-shrink-0 mt-1">
                  <Check className="w-5 h-5 text-foreground" strokeWidth={1.5} />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-normal">{feature.title}</h3>
                  <p className="text-sm font-light text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
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
    <section id="waitlist" className="section bg-card/30">
      <div className="container">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="max-w-2xl mx-auto text-center space-y-12"
        >
          <motion.div variants={fadeIn} className="space-y-6">
            <h2 className="text-5xl md:text-6xl font-thin tracking-tighter leading-tight">
              Join the Waitlist
            </h2>
            <p className="text-xl md:text-2xl font-light text-muted-foreground leading-relaxed">
              We're launching soon. Be among the first to access elite chess coaching with payment protection.
            </p>
            <div className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 w-full sm:w-auto">
              <span style={{ color: '#ffffff', fontWeight: 500, textShadow: '0 1px 2px rgba(0,0,0,0.5)' }} className="text-sm whitespace-nowrap">🔥 Limited spots for founding members</span>
            </div>
          </motion.div>

          <motion.form variants={fadeIn} onSubmit={handleSubmit} className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-background border border-border rounded-md text-sm font-light focus:outline-none focus:ring-1 focus:ring-foreground/20 transition-all"
                />
              </div>
              <Button 
                type="submit" 
                size="lg"
                disabled={joinWaitlist.isPending}
                className="btn-primary"
              >
                {joinWaitlist.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Joining...
                  </>
                ) : (
                  "Join Waitlist"
                )}
              </Button>
            </div>

            <div className="flex items-center justify-center gap-6 text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="role"
                  value="student"
                  checked={userType === "student"}
                  onChange={() => setUserType("student")}
                  className="w-4 h-4"
                />
                <span className="font-light text-muted-foreground">I'm a Student</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="role"
                  value="coach"
                  checked={userType === "coach"}
                  onChange={() => setUserType("coach")}
                  className="w-4 h-4"
                />
                <span className="font-light text-muted-foreground">I'm a Coach</span>
              </label>
            </div>
          </motion.form>
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

// Footer - Minimal
function Footer() {
  return (
    <footer className="border-t border-border/50 py-12">
      <div className="container">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <img src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663188415081/xRYfqyUGHSJUlDcu.png" alt="BooGMe" className="h-6 w-auto" loading="lazy" />
          </div>
          <div className="flex items-center gap-6">
            <a href="/privacy" className="text-sm font-light text-muted-foreground hover:text-foreground transition-colors">
              Privacy Policy
            </a>
            <a href="/terms" className="text-sm font-light text-muted-foreground hover:text-foreground transition-colors">
              Terms of Service
            </a>
          </div>
          <p className="text-sm font-light text-muted-foreground">
            © 2026 BooGMe. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

// Main Home Component
export default function Home() {
  const [assessmentOpen, setAssessmentOpen] = useState(false);

  return (
    <div className="min-h-screen">
      <WelcomePopup onOpenAssessment={() => setAssessmentOpen(true)} />
      <Navigation />
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
