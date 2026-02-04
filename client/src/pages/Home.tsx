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
      transition={{ duration: 0.8 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled ? "bg-background/80 backdrop-blur-xl border-b border-border/50" : "bg-transparent"
      }`}
    >
      <div className="container flex items-center justify-between h-20">
        <div className="flex items-center gap-4">
          <img src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663188415081/xRYfqyUGHSJUlDcu.png" alt="BooGMe" className="h-10 w-auto drop-shadow-[0_2px_8px_rgba(255,255,255,0.15)]" />
        </div>
        
        <div className="hidden md:flex items-center gap-12">
          <button 
            onClick={() => handleNavClick("features")}
            className="text-sm font-light text-muted-foreground hover:text-foreground transition-colors"
          >
            Features
          </button>
          <a 
            href="/coaches"
            className="text-sm font-light text-muted-foreground hover:text-foreground transition-colors"
          >
            For Coaches
          </a>
          <button 
            onClick={() => handleNavClick("waitlist")}
            className="text-sm font-light text-muted-foreground hover:text-foreground transition-colors"
          >
            Join Waitlist
          </button>
        </div>

        <button
          className="md:hidden"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
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
          className="md:hidden bg-card border-b border-border"
        >
          <div className="container py-6 space-y-4">
            <button 
              onClick={() => handleNavClick("features")}
              className="block text-sm font-light text-muted-foreground hover:text-foreground transition-colors"
            >
              Features
            </button>
            <a 
              href="/coaches"
              className="block text-sm font-light text-muted-foreground hover:text-foreground transition-colors"
            >
              For Coaches
            </a>
            <button 
              onClick={() => handleNavClick("waitlist")}
              className="block text-sm font-light text-muted-foreground hover:text-foreground transition-colors"
            >
              Join Waitlist
            </button>
          </div>
        </motion.div>
      )}
    </motion.nav>
  );
}

// Hero Section - Palantir minimalism
function HeroSection() {
  const [assessmentOpen, setAssessmentOpen] = useState(false);

  return (
    <section className="relative min-h-screen flex items-center justify-center pt-20">
      <div className="container">
        <motion.div 
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
          className="max-w-4xl mx-auto text-center space-y-8"
        >
          <motion.div variants={fadeIn} className="space-y-6">
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-thin tracking-tighter text-balance leading-tight">
              Connect with Elite Chess Coaches.
              <br />
              <span className="text-muted-foreground">Pay Only After Lessons.</span>
            </h1>
            <p className="text-xl md:text-2xl font-light text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              AI-powered coach matching with escrow payment protection. No upfront fees, no risk.
            </p>
          </motion.div>

          <motion.div variants={fadeIn} className="flex justify-center">
            <Button 
              onClick={() => setAssessmentOpen(true)}
              size="lg" 
              className="btn-primary group"
            >
              Find Your Coach
              <ChevronRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </motion.div>

          <motion.div variants={fadeIn} className="pt-12">
            <div className="flex flex-wrap items-center justify-center gap-8 text-sm font-light text-muted-foreground">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                <span>Payment Protection</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span>Elite Coaches</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span>24/7 Support</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>

      {assessmentOpen && <CoachMatchingAssessment onClose={() => setAssessmentOpen(false)} />}
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
              <span className="text-sm font-light text-foreground">Limited spots for founding coaches</span>
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
      toast.error("Something went wrong", {
        description: errorMessage
      });
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
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
              <span className="text-sm font-light text-foreground">🔥 Limited spots for founding members</span>
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

  const coaches: CoachProfile[] = [
    {
      id: "elena-volkov",
      name: "GM Elena Volkov",
      title: "Grandmaster",
      rating: 2587,
      location: "Barcelona, Spain",
      timezone: "UTC+1",
      languages: ["English", "Spanish", "Russian"],
      hourlyRate: 120,
      imageUrl: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663188415081/CAVrGslodptDhLEN.png",
      specializations: ["Tournament Prep", "Strategic Mastery", "Psychological Training"],
      teachingStyle: "The Strategist",
      targetRating: "1800-2400",
      availability: "Mon-Fri",
      detailedAvailability: {
        days: ["monday", "tuesday", "wednesday", "thursday", "friday"],
        timeSlots: ["afternoon", "evening"],
        timezoneOffset: 1 // UTC+1 (Barcelona)
      },
      studentCount: 47,
      reviewRating: 4.9,
      bio: "Former Women's World Championship quarterfinalist with a psychology degree. Specializes in tournament preparation and mental game development for serious competitors."
    },
    {
      id: "david-chen",
      name: "IM David Chen",
      title: "International Master",
      rating: 2421,
      location: "San Francisco, USA",
      timezone: "UTC-8",
      languages: ["English", "Mandarin"],
      hourlyRate: 65,
      imageUrl: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663188415081/CLNgdiGFAHqfVhnZ.png",
      specializations: ["Tactical Training", "Endgame Technique", "Opening Repertoire"],
      teachingStyle: "The Technician",
      targetRating: "1200-2000",
      availability: "Evenings & Weekends",
      detailedAvailability: {
        days: ["tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
        timeSlots: ["evening", "weekend"],
        timezoneOffset: -8 // UTC-8 (San Francisco)
      },
      studentCount: 203,
      reviewRating: 4.8,
      bio: "Software engineer and chess coach using data-driven methods. Known for structured curriculum and modern technology integration. Average student rating gain: 150 points in 6 months."
    },
    {
      id: "maria-santos",
      name: "FM Maria Santos",
      title: "FIDE Master, WGM",
      rating: 2312,
      location: "Buenos Aires, Argentina",
      timezone: "UTC-3",
      languages: ["Spanish", "English", "Portuguese"],
      hourlyRate: 45,
      imageUrl: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663188415081/PVcuRjYIFiiBHaDK.png",
      specializations: ["Beginner Foundations", "Junior Development", "Women's Chess"],
      teachingStyle: "The Mentor",
      targetRating: "0-1600",
      availability: "Flexible, Same-day",
      detailedAvailability: {
        days: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"],
        timeSlots: ["morning", "afternoon"],
        timezoneOffset: -3 // UTC-3 (Buenos Aires)
      },
      studentCount: 512,
      reviewRating: 5.0,
      bio: "18 years of teaching experience specializing in beginners and juniors. Patient, encouraging approach that makes chess fun. Runs a free chess club for 150+ underprivileged kids."
    }
  ];

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
              Meet Our Founding Coaches
            </h2>
            <p className="text-xl md:text-2xl font-light text-muted-foreground leading-relaxed">
              Elite coaches with diverse specializations and teaching styles. From beginners to advanced players, we have the perfect match for your goals.
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

          {/* Results Count */}
          <motion.div variants={fadeIn} className="text-center">
            <p className="text-sm font-light text-muted-foreground">
              Showing {filteredCoaches.length} of {coaches.length} coaches
            </p>
          </motion.div>

          {/* Coach Grid */}
          {filteredCoaches.length > 0 ? (
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
            <img src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663188415081/xRYfqyUGHSJUlDcu.png" alt="BooGMe" className="h-6 w-auto" />
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
  return (
    <div className="min-h-screen">
      <Navigation />
      <HeroSection />
      <FeaturesSection />
      <PaymentProtectionSection />
      <MeetOurCoachesSection />
      <ForCoachesSection />
      <WaitlistSection />
      <Footer />
    </div>
  );
}
