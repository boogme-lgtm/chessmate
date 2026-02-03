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
          <img src="/logo.png" alt="BooGMe" className="h-8 w-auto" />
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
    "Keep 80-85% of your earnings with transparent 15-20% platform fee",
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

// Footer - Minimal
function Footer() {
  return (
    <footer className="border-t border-border/50 py-12">
      <div className="container">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <img src="/logo.png" alt="BooGMe" className="h-6 w-auto" />
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
      <ForCoachesSection />
      <WaitlistSection />
      <Footer />
    </div>
  );
}
