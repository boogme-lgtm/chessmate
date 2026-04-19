/*
 * COACHES LANDING PAGE
 * Dedicated page for coach recruitment with earnings calculator,
 * onboarding flow, and coach-specific value proposition
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { motion } from "framer-motion";
import {
  DollarSign,
  Users,
  Shield,
  Clock,
  TrendingUp,
  CheckCircle2,
  ChevronRight,
  Calendar,
  Globe,
  Award,
  Zap,
  Mail,
  Loader2,
  Check,
  X,
  Menu,
} from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";

const fadeIn = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] },
  },
} as const;

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.2 },
  },
};

// Navigation Component
function Navigation() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  React.useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? "bg-background/80 backdrop-blur-xl border-b border-border/50"
          : "bg-transparent"
      }`}
    >
      <div className="container flex items-center justify-between h-20">
        <div className="flex items-center gap-4">
          <a href="/">
            <img src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663188415081/xRYfqyUGHSJUlDcu.png" alt="BooGMe" className="h-10 w-auto drop-shadow-[0_2px_8px_rgba(255,255,255,0.15)]" />
          </a>
        </div>

        <div className="hidden md:flex items-center gap-8">
          <a
            href="/"
            className="text-sm font-light text-muted-foreground hover:text-foreground transition-colors"
          >
            For Students
          </a>
          <a
            href="#calculator"
            className="text-sm font-light text-muted-foreground hover:text-foreground transition-colors"
          >
            Earnings Calculator
          </a>
          <a
            href="#how-it-works"
            className="text-sm font-light text-muted-foreground hover:text-foreground transition-colors"
          >
            How It Works
          </a>
          <a
            href="#faq"
            className="text-sm font-light text-muted-foreground hover:text-foreground transition-colors"
          >
            FAQ
          </a>
        </div>

        <button
          className="md:hidden"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? (
            <X className="w-5 h-5" />
          ) : (
            <Menu className="w-5 h-5" />
          )}
        </button>
      </div>

      {mobileMenuOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="md:hidden border-t border-border/50 bg-background/95 backdrop-blur-xl"
        >
          <div className="container py-4 space-y-4">
            <a
              href="/"
              className="block text-sm font-light text-muted-foreground hover:text-foreground transition-colors"
            >
              For Students
            </a>
            <a
              href="#calculator"
              className="block text-sm font-light text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              Earnings Calculator
            </a>
            <a
              href="#how-it-works"
              className="block text-sm font-light text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              How It Works
            </a>
            <a
              href="#faq"
              className="block text-sm font-light text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              FAQ
            </a>
          </div>
        </motion.div>
      )}
    </motion.nav>
  );
}

// Hero Section
function CoachHeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center pt-20">
      <div className="container">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
          className="max-w-4xl mx-auto text-center space-y-8"
        >
          <motion.div variants={fadeIn}>
            <Badge
              variant="outline"
              className="mb-6 text-xs font-light border-primary/30 text-primary"
            >
              For Chess Coaches
            </Badge>
          </motion.div>

          <motion.div variants={fadeIn} className="space-y-6">
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-thin tracking-tighter text-balance leading-tight">
              Build Your Coaching Business.
              <br />
              <span className="text-muted-foreground">
                Keep More of Your Earnings.
              </span>
            </h1>
            <p className="text-xl md:text-2xl font-light text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              No payment details until you earn $100. AI-powered student
              matching. Escrow protection for both sides.
            </p>
          </motion.div>

          <motion.div
            variants={fadeIn}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
          >
            <Button
              onClick={() => {
                window.location.href = "/coach/apply";
              }}
              size="lg"
              className="btn-primary group"
            >
              Apply Now
              <ChevronRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button
              onClick={() => {
                const element = document.getElementById("calculator");
                element?.scrollIntoView({ behavior: "smooth" });
              }}
              size="lg"
              variant="outline"
              className="border-border/50"
            >
              Calculate Earnings
            </Button>
          </motion.div>

          <motion.div variants={fadeIn} className="pt-12">
            <div className="flex flex-wrap items-center justify-center gap-8 text-sm font-light text-muted-foreground">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                <span>No upfront costs</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                <span>Payment protection</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span>AI-matched students</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

// Earnings Calculator Section
function EarningsCalculator() {
  const [lessonsPerWeek, setLessonsPerWeek] = useState(10);
  const [hourlyRate, setHourlyRate] = useState(75);

  const weeklyEarnings = lessonsPerWeek * hourlyRate;
  const monthlyEarnings = weeklyEarnings * 4;
  const yearlyEarnings = monthlyEarnings * 12;

  const platformFee = 0.15; // 15% commission
  const takeHome = {
    weekly: weeklyEarnings * (1 - platformFee),
    monthly: monthlyEarnings * (1 - platformFee),
    yearly: yearlyEarnings * (1 - platformFee),
  };

  return (
    <section id="calculator" className="section bg-neutral-950/50">
      <div className="container">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="max-w-4xl mx-auto space-y-12"
        >
          <motion.div variants={fadeIn} className="text-center space-y-4">
            <h2 className="text-4xl md:text-5xl font-thin tracking-tighter">
              Earnings Calculator
            </h2>
            <p className="text-lg font-light text-muted-foreground">
              See your potential income with BooGMe
            </p>
          </motion.div>

          <motion.div variants={fadeIn}>
            <Card className="palantir-card p-8 md:p-12">
              <CardContent className="p-0 space-y-8">
                {/* Lessons per week slider */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-light text-muted-foreground">
                      Lessons per week
                    </label>
                    <span className="text-2xl font-thin text-primary">
                      {lessonsPerWeek}
                    </span>
                  </div>
                  <Slider
                    value={[lessonsPerWeek]}
                    onValueChange={([value]) => setLessonsPerWeek(value)}
                    min={1}
                    max={40}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Part-time</span>
                    <span>Full-time</span>
                  </div>
                </div>

                {/* Hourly rate slider */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-light text-muted-foreground">
                      Hourly rate
                    </label>
                    <span className="text-2xl font-thin text-primary">
                      ${hourlyRate}
                    </span>
                  </div>
                  <Slider
                    value={[hourlyRate]}
                    onValueChange={([value]) => setHourlyRate(value)}
                    min={25}
                    max={400}
                    step={5}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>$25/hr</span>
                    <span>$400/hr</span>
                  </div>
                </div>

                {/* Earnings breakdown */}
                <div className="pt-8 border-t border-border/50 space-y-6">
                  <div className="grid md:grid-cols-3 gap-6">
                    <div className="text-center space-y-2">
                      <div className="text-sm font-light text-muted-foreground">
                        Weekly
                      </div>
                      <div className="text-3xl font-thin">
                        ${takeHome.weekly.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        after minimal platform fee
                      </div>
                    </div>
                    <div className="text-center space-y-2">
                      <div className="text-sm font-light text-muted-foreground">
                        Monthly
                      </div>
                      <div className="text-3xl font-thin text-primary">
                        ${takeHome.monthly.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        after minimal platform fee
                      </div>
                    </div>
                    <div className="text-center space-y-2">
                      <div className="text-sm font-light text-muted-foreground">
                        Yearly
                      </div>
                      <div className="text-3xl font-thin">
                        ${takeHome.yearly.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        after minimal platform fee
                      </div>
                    </div>
                  </div>

                  <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      <div className="text-sm font-light text-muted-foreground">
                        <strong className="text-foreground">
                          No payment details needed until $100 earned.
                        </strong>{" "}
                        Start teaching immediately, add payment info only when
                        you're ready to cash out.
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

// How It Works Section
function HowItWorksSection() {
  const steps = [
    {
      number: "01",
      title: "Join the Waitlist",
      description:
        "Sign up with your email. No payment details required. We'll review your profile and notify you when we're ready to onboard.",
      icon: Mail,
    },
    {
      number: "02",
      title: "Complete Your Profile",
      description:
        "Add your credentials, teaching style, availability, and rates. Our AI uses this to match you with ideal students.",
      icon: Award,
    },
    {
      number: "03",
      title: "Get Matched with Students",
      description:
        "Our AI algorithm matches you with students based on skill level, goals, learning style, and schedule compatibility.",
      icon: Users,
    },
    {
      number: "04",
      title: "Start Teaching",
      description:
        "Conduct lessons via video call. Students pay upfront, but funds are held in escrow until lesson completion.",
      icon: Calendar,
    },
    {
      number: "05",
      title: "Get Paid Automatically",
      description:
        "After each lesson, funds are released to your account. Once you earn $100, add your payment details via Stripe Connect.",
      icon: DollarSign,
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
          <motion.div variants={fadeIn} className="text-center space-y-4">
            <h2 className="text-4xl md:text-5xl font-thin tracking-tighter">
              How It Works
            </h2>
            <p className="text-lg font-light text-muted-foreground max-w-2xl mx-auto">
              From signup to your first payout in 5 simple steps
            </p>
          </motion.div>

          <div className="max-w-3xl mx-auto space-y-8">
            {steps.map((step, index) => (
              <motion.div key={index} variants={fadeIn}>
                <Card className="palantir-card p-6 md:p-8">
                  <CardContent className="p-0">
                    <div className="flex items-start gap-6">
                      <div className="flex-shrink-0">
                        <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                          <step.icon className="w-6 h-6 text-primary" />
                        </div>
                      </div>
                      <div className="flex-1 space-y-2">
                        <div className="flex items-baseline gap-3">
                          <span className="text-xs font-light text-muted-foreground">
                            {step.number}
                          </span>
                          <h3 className="text-xl font-light">{step.title}</h3>
                        </div>
                        <p className="text-sm font-light text-muted-foreground leading-relaxed">
                          {step.description}
                        </p>
                      </div>
                    </div>
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

// Benefits Section
function BenefitsSection() {
  const benefits = [
    {
      icon: DollarSign,
      title: "Keep More of Your Earnings",
      description:
        "Minimal platform fees cover payment processing, AI matching, escrow protection, and customer support. Keep more of your earnings compared to traditional academies.",
    },
    {
      icon: Shield,
      title: "Payment Protection",
      description:
        "Escrow system protects both sides. Students can't ghost you, and you're protected from chargebacks.",
    },
    {
      icon: Users,
      title: "AI-Matched Students",
      description:
        "Stop wasting time on bad fits. Our algorithm matches you with students who align with your teaching style.",
    },
    {
      icon: Clock,
      title: "Flexible Schedule",
      description:
        "Set your own availability. Work as much or as little as you want. No minimums, no quotas.",
    },
    {
      icon: Globe,
      title: "Global Student Base",
      description:
        "Teach students worldwide. Our platform handles time zones, currencies, and international payments.",
    },
    {
      icon: Zap,
      title: "No Upfront Costs",
      description:
        "Start teaching immediately. No payment details needed until you earn $100. Zero risk to try.",
    },
  ];

  return (
    <section className="section bg-neutral-950/50">
      <div className="container">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="space-y-16"
        >
          <motion.div variants={fadeIn} className="text-center space-y-4">
            <h2 className="text-4xl md:text-5xl font-thin tracking-tighter">
              Why Choose BooGMe?
            </h2>
            <p className="text-lg font-light text-muted-foreground max-w-2xl mx-auto">
              Built by coaches, for coaches
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {benefits.map((benefit, index) => (
              <motion.div key={index} variants={fadeIn}>
                <Card className="palantir-card h-full p-6">
                  <CardContent className="p-0 space-y-4">
                    <benefit.icon
                      className="w-8 h-8 text-foreground"
                      strokeWidth={1}
                    />
                    <h3 className="text-lg font-light">{benefit.title}</h3>
                    <p className="text-sm font-light text-muted-foreground leading-relaxed">
                      {benefit.description}
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

// FAQ Section
function FAQSection() {
  const faqs = [
    {
      question: "When do I need to provide payment details?",
      answer:
        "Only after you've earned $100 on the platform. This threshold ensures you can try the platform risk-free and only commit payment details once you've validated it works for you.",
    },
    {
      question: "What's the platform commission?",
      answer:
        "We keep platform fees minimal and transparent — you keep more of your earnings with us than most listing-only services. Your take-home rate improves as your lesson volume grows. Platform fees cover payment processing, AI matching, escrow protection, and customer support.",
    },
    {
      question: "How does the escrow system work?",
      answer:
        "Students pay upfront, but funds are held in escrow until lesson completion. After the lesson, you confirm completion and funds are released to your account within 24 hours. This protects both parties.",
    },
    {
      question: "Can I set my own rates?",
      answer:
        "Absolutely. You have complete control over your hourly rate. We provide guidance based on your credentials and market rates, but the final decision is yours.",
    },
    {
      question: "What if a student doesn't show up?",
      answer:
        "If a student misses a lesson without 24-hour notice, you're automatically paid in full. Our no-show policy protects your time.",
    },
    {
      question: "How do I get paid?",
      answer:
        "We use Stripe Connect for payouts. Once you hit $100 in earnings, you'll complete a 3-5 minute onboarding flow to add your bank account. After that, payouts are automatic after each lesson.",
    },
    {
      question: "What credentials do I need?",
      answer:
        "We welcome coaches of all levels - from strong club players (1800+) to Grandmasters. What matters most is your ability to teach effectively. We verify your rating and review your teaching experience.",
    },
    {
      question: "Can I teach on other platforms?",
      answer:
        "Yes! We don't require exclusivity. Many coaches use multiple platforms. We just ask that lessons booked through BooGMe stay on our platform.",
    },
  ];

  return (
    <section id="faq" className="section">
      <div className="container">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="max-w-3xl mx-auto space-y-12"
        >
          <motion.div variants={fadeIn} className="text-center space-y-4">
            <h2 className="text-4xl md:text-5xl font-thin tracking-tighter">
              Frequently Asked Questions
            </h2>
          </motion.div>

          <div className="space-y-6">
            {faqs.map((faq, index) => (
              <motion.div key={index} variants={fadeIn}>
                <Card className="palantir-card p-6">
                  <CardContent className="p-0 space-y-3">
                    <h3 className="text-lg font-light">{faq.question}</h3>
                    <p className="text-sm font-light text-muted-foreground leading-relaxed">
                      {faq.answer}
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

// Waitlist Section
function CoachWaitlistSection() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [rating, setRating] = useState("");

  const addToWaitlist = trpc.waitlist.join.useMutation({
    onSuccess: () => {
      toast.success("You're on the list! We'll be in touch soon.");
      setEmail("");
      setName("");
      setRating("");
    },
    onError: (error) => {
      const errorMessage = error.message || "Something went wrong. Please try again.";
      
      // Check if it's a duplicate email error
      if (errorMessage.includes("already") || errorMessage.includes("duplicate") || errorMessage.includes("exists") || errorMessage.includes("waitlist")) {
        toast.info("You're already on the list!", {
          description: "We'll be in touch soon. No need to sign up again."
        });
      } else {
        toast.error(errorMessage);
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !name) {
      toast.error("Please fill in all required fields");
      return;
    }
    addToWaitlist.mutate({
      email,
      name,
      userType: "coach",
      referralSource: rating ? `Rating: ${rating}` : undefined,
    });
  };

  return (
    <section id="waitlist" className="section bg-neutral-950/50">
      <div className="container">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="max-w-2xl mx-auto text-center space-y-8"
        >
          <motion.div variants={fadeIn} className="space-y-4">
            <h2 className="text-4xl md:text-5xl font-thin tracking-tighter">
              Join the Coach Waitlist
            </h2>
            <p className="text-lg font-light text-muted-foreground">
              We're currently in stealth mode building our founding coach
              network. Be among the first 50 coaches on the platform.
            </p>
          </motion.div>

          <motion.div variants={fadeIn}>
            <Card className="palantir-card p-8">
              <CardContent className="p-0">
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2 text-left">
                    <label className="text-sm font-light text-muted-foreground">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                      className="w-full px-4 py-3 bg-transparent border border-border rounded-lg text-sm focus:outline-none focus:border-primary transition-colors"
                      required
                    />
                  </div>

                  <div className="space-y-2 text-left">
                    <label className="text-sm font-light text-muted-foreground">
                      Email *
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      className="w-full px-4 py-3 bg-transparent border border-border rounded-lg text-sm focus:outline-none focus:border-primary transition-colors"
                      required
                    />
                  </div>

                  <div className="space-y-2 text-left">
                    <label className="text-sm font-light text-muted-foreground">
                      Chess Rating (optional)
                    </label>
                    <input
                      type="text"
                      value={rating}
                      onChange={(e) => setRating(e.target.value)}
                      placeholder="e.g., 2200 FIDE, 2400 Lichess"
                      className="w-full px-4 py-3 bg-transparent border border-border rounded-lg text-sm focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>

                  <Button
                    type="submit"
                    size="lg"
                    disabled={addToWaitlist.isPending}
                    className="w-full btn-primary"
                  >
                    {addToWaitlist.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Joining...
                      </>
                    ) : (
                      <>
                        Join Waitlist
                        <ChevronRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>

                  <p className="text-xs text-muted-foreground">
                    By joining, you agree to receive updates about the platform.
                    No spam, unsubscribe anytime.
                  </p>
                </form>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={fadeIn} className="pt-8">
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm font-light text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary" />
                <span>No payment details required</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary" />
                <span>Start teaching immediately</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary" />
                <span>Keep more of your earnings</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

// Main Coaches Page
export default function Coaches() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation />
      <CoachHeroSection />
      <EarningsCalculator />
      <HowItWorksSection />
      <BenefitsSection />
      <FAQSection />
      <CoachWaitlistSection />
    </div>
  );
}
