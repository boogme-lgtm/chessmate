/*
 * DESIGN: Swiss Modern + Neo-Minimal
 * Clean grid layouts, earthy burgundy/terracotta palette
 * Generous whitespace, subtle animations, professional feel
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import { 
  Brain, 
  Users, 
  Trophy, 
  Target, 
  Globe, 
  Star, 
  ChevronRight,
  Play,
  BookOpen,
  MessageSquare,
  Shield,
  Award,
  Flame,
  Crown,
  ArrowRight,
  Check,
  Lock,
  RefreshCw,
  Clock,
  BadgeCheck,
  Wallet,
  ShieldCheck,
  CircleDollarSign,
  ThumbsUp,
  Menu,
  X,
  Loader2,
  Mail
} from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { CoachFinderQuiz } from "@/components/CoachFinderQuiz";
import { PuzzleDemoTrigger } from "@/components/PuzzleDemo";

// Subtle animation variants for Swiss Modern feel
const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
} as const;

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 }
  }
};

// Navigation Component - Clean and minimal
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
      transition={{ duration: 0.5 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled ? "bg-background/95 backdrop-blur-sm border-b border-border shadow-sm" : "bg-transparent"
      }`}
    >
      <div className="container flex items-center justify-between h-16 md:h-20">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-burgundy flex items-center justify-center">
            <Crown className="w-5 h-5 text-white" />
          </div>
          <span className="font-display font-bold text-xl tracking-tight">
            Boo<span className="text-burgundy">GMe</span>
          </span>
        </div>
        
        <div className="hidden md:flex items-center gap-10">
          {["Features", "Coaches", "Pricing"].map((item) => (
            <button 
              key={item}
              onClick={() => handleNavClick(item.toLowerCase())}
              className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium"
            >
              {item}
            </button>
          ))}
        </div>
        
        <div className="hidden md:flex items-center gap-4">
          <Button 
            variant="ghost" 
            className="text-muted-foreground hover:text-foreground"
            onClick={() => toast("Login feature coming soon!")}
          >
            Log In
          </Button>
          <Button 
            className="bg-burgundy hover:bg-burgundy/90 text-white font-medium px-5"
            onClick={() => toast("Sign up feature coming soon!")}
          >
            Get Started
          </Button>
        </div>

        <button 
          className="md:hidden p-2"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="md:hidden bg-background border-b border-border py-4"
        >
          <div className="container flex flex-col gap-4">
            {["Features", "Coaches", "Pricing"].map((item) => (
              <button 
                key={item}
                onClick={() => handleNavClick(item.toLowerCase())}
                className="text-left text-muted-foreground hover:text-foreground py-2"
              >
                {item}
              </button>
            ))}
            <div className="flex gap-3 pt-4 border-t border-border">
              <Button variant="outline" className="flex-1" onClick={() => toast("Login feature coming soon!")}>
                Log In
              </Button>
              <Button className="flex-1 bg-burgundy hover:bg-burgundy/90 text-white" onClick={() => toast("Sign up feature coming soon!")}>
                Get Started
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </motion.nav>
  );
}

// Hero Section - Clean, spacious, grid-based
function HeroSection() {
  return (
    <section className="relative min-h-[90vh] flex items-center pt-24 pb-16">
      <div className="container">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left content */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
            className="max-w-xl"
          >
            <motion.div variants={fadeIn}>
              <span className="badge-burgundy mb-6 inline-flex">
                AI-Powered Matching
              </span>
            </motion.div>
            
            <motion.h1 
              variants={fadeIn}
              className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.1] mb-6 text-balance"
            >
              Find Your
              <span className="block text-burgundy">Perfect Coach</span>
            </motion.h1>
            
            <motion.p 
              variants={fadeIn}
              className="text-lg text-muted-foreground mb-8 leading-relaxed"
            >
              Connect with world-class chess coaches through intelligent matching. 
              Level up your game with personalized training and a global community.
            </motion.p>
            
            <motion.div variants={fadeIn} className="flex flex-col sm:flex-row gap-4">
              <CoachFinderQuiz />
              <PuzzleDemoTrigger />
            </motion.div>
            
            {/* Stats - Clean grid */}
            <motion.div 
              variants={fadeIn}
              className="grid grid-cols-3 gap-8 mt-16 pt-8 border-t border-border"
            >
              {[
                { value: "10K+", label: "Active Students" },
                { value: "500+", label: "Expert Coaches" },
                { value: "50+", label: "Countries" }
              ].map((stat) => (
                <div key={stat.label}>
                  <div className="text-2xl sm:text-3xl font-bold text-burgundy">{stat.value}</div>
                  <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
                </div>
              ))}
            </motion.div>
          </motion.div>
          
          {/* Right content - Hero image with clean styling */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative hidden lg:block"
          >
            <div className="relative">
              {/* Decorative elements */}
              <div className="absolute -top-6 -left-6 w-24 h-24 bg-burgundy/5 rounded-2xl" />
              <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-terracotta/5 rounded-2xl" />
              
              <div className="relative rounded-2xl overflow-hidden shadow-xl">
                <img 
                  src="https://images.unsplash.com/photo-1529699211952-734e80c4d42b?w=800&h=600&fit=crop" 
                  alt="Chess coaching session" 
                  className="w-full h-auto object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
              </div>
              
              {/* Floating card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="absolute -bottom-8 -left-8 bg-card rounded-xl p-5 shadow-lg border border-border"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-burgundy/10 flex items-center justify-center">
                    <Brain className="w-6 h-6 text-burgundy" />
                  </div>
                  <div>
                    <div className="font-semibold">AI Match Found</div>
                    <div className="text-sm text-burgundy font-medium">98% compatibility</div>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// Features Section - Grid-based Swiss Modern layout
function FeaturesSection() {
  const features = [
    {
      icon: Brain,
      title: "AI-Powered Matching",
      description: "Our intelligent algorithm analyzes your playing style, goals, and preferences to find your ideal coach."
    },
    {
      icon: Target,
      title: "Personalized Learning",
      description: "Custom lesson plans and adaptive training paths tailored to your skill level and improvement areas."
    },
    {
      icon: Trophy,
      title: "Gamified Progress",
      description: "Earn XP, unlock achievements, and climb leaderboards as you master new chess concepts."
    },
    {
      icon: Globe,
      title: "Global Community",
      description: "Connect with players and coaches from 50+ countries. Learn, compete, and grow together."
    },
    {
      icon: BookOpen,
      title: "Rich Content Library",
      description: "Access thousands of lessons, puzzles, and video courses from titled players and grandmasters."
    },
    {
      icon: MessageSquare,
      title: "Real-Time Coaching",
      description: "Interactive sessions with shared boards, video chat, and instant feedback on your moves."
    }
  ];

  return (
    <section id="features" className="section bg-stone dark:bg-secondary/30">
      <div className="container">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="max-w-2xl mb-16"
        >
          <motion.span variants={fadeIn} className="badge-terracotta mb-4 inline-flex">
            Platform Features
          </motion.span>
          <motion.h2 variants={fadeIn} className="mb-4">
            Everything You Need to
            <span className="text-burgundy"> Master Chess</span>
          </motion.h2>
          <motion.p variants={fadeIn} className="text-muted-foreground text-lg">
            A complete ecosystem designed to accelerate your chess journey, whether you're a beginner or an aspiring grandmaster.
          </motion.p>
        </motion.div>
        
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {features.map((feature) => (
            <motion.div key={feature.title} variants={fadeIn}>
              <Card className="swiss-card h-full border-0">
                <CardContent className="p-8">
                  <div className="w-12 h-12 rounded-xl bg-burgundy/10 flex items-center justify-center mb-5">
                    <feature.icon className="w-6 h-6 text-burgundy" />
                  </div>
                  <h3 className="text-lg font-semibold mb-3">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// Payment Protection Section - Clean and trustworthy
function PaymentProtectionSection() {
  const protectionFeatures = [
    {
      icon: Lock,
      title: "Escrow Payments",
      description: "Your payment is held securely until the lesson is completed and you confirm satisfaction.",
      highlight: "100% Secure"
    },
    {
      icon: RefreshCw,
      title: "Pay-Per-Lesson",
      description: "No risky bulk packages. Pay only for each individual lesson after it's completed.",
      highlight: "No Lock-in"
    },
    {
      icon: Clock,
      title: "48-Hour Guarantee",
      description: "Not satisfied? Request a full refund within 48 hours of any lesson. No questions asked.",
      highlight: "Money Back"
    },
    {
      icon: BadgeCheck,
      title: "Quality Assurance",
      description: "Coaches must maintain a minimum 4.5-star rating to receive payments.",
      highlight: "Verified Quality"
    }
  ];

  const howItWorks = [
    { step: 1, title: "Book Lesson", description: "Schedule with your matched coach", icon: BookOpen },
    { step: 2, title: "Payment Held", description: "Funds secured in escrow", icon: Wallet },
    { step: 3, title: "Learn & Play", description: "Enjoy your coaching session", icon: Trophy },
    { step: 4, title: "Confirm & Release", description: "Approve payment after satisfaction", icon: ThumbsUp }
  ];

  return (
    <section id="payment-protection" className="section">
      <div className="container">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="max-w-2xl mb-16"
        >
          <motion.span variants={fadeIn} className="badge-burgundy mb-4 inline-flex">
            <ShieldCheck className="w-4 h-4 mr-2" />
            Payment Protection
          </motion.span>
          <motion.h2 variants={fadeIn} className="mb-4">
            Your Money is
            <span className="text-burgundy"> Always Protected</span>
          </motion.h2>
          <motion.p variants={fadeIn} className="text-muted-foreground text-lg">
            Unlike other platforms, BooGMe uses an escrow-based payment system. You only pay when you're satisfied.
          </motion.p>
        </motion.div>

        {/* How It Works Flow */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {howItWorks.map((item, index) => (
              <div key={item.step} className="relative">
                <Card className="swiss-card border-0 text-center h-full">
                  <CardContent className="p-6">
                    <div className="w-10 h-10 rounded-full bg-burgundy text-white flex items-center justify-center mx-auto mb-4 font-semibold">
                      {item.step}
                    </div>
                    <item.icon className="w-5 h-5 text-terracotta mx-auto mb-3" />
                    <h4 className="font-semibold mb-1 text-sm">{item.title}</h4>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  </CardContent>
                </Card>
                {index < 3 && (
                  <div className="hidden md:block absolute top-1/2 -right-3 transform -translate-y-1/2">
                    <ChevronRight className="w-5 h-5 text-border" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </motion.div>

        {/* Protection Features Grid */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="grid md:grid-cols-2 gap-6"
        >
          {protectionFeatures.map((feature) => (
            <motion.div key={feature.title} variants={fadeIn}>
              <Card className="swiss-card border-0 h-full">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-burgundy/10 flex items-center justify-center flex-shrink-0">
                      <feature.icon className="w-6 h-6 text-burgundy" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold">{feature.title}</h3>
                        <span className="badge-gold text-xs">{feature.highlight}</span>
                      </div>
                      <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {/* Trust Banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-12"
        >
          <Card className="bg-burgundy/5 border-burgundy/10">
            <CardContent className="p-8">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-burgundy flex items-center justify-center">
                    <CircleDollarSign className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">$0 Lost to Bad Coaches</h3>
                    <p className="text-muted-foreground text-sm">Our escrow system has protected over $2M in student payments</p>
                  </div>
                </div>
                <div className="flex items-center gap-8 text-center">
                  <div>
                    <div className="text-2xl font-bold text-burgundy">99.2%</div>
                    <div className="text-xs text-muted-foreground">Satisfaction Rate</div>
                  </div>
                  <div className="w-px h-10 bg-border" />
                  <div>
                    <div className="text-2xl font-bold text-terracotta">48hr</div>
                    <div className="text-xs text-muted-foreground">Refund Window</div>
                  </div>
                  <div className="w-px h-10 bg-border" />
                  <div>
                    <div className="text-2xl font-bold text-burgundy">0%</div>
                    <div className="text-xs text-muted-foreground">Hidden Fees</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </section>
  );
}

// AI Matching Section
function MatchingSection() {
  const matchingFactors = [
    { label: "Playing Style", value: 95 },
    { label: "Learning Goals", value: 88 },
    { label: "Schedule Fit", value: 92 },
    { label: "Communication", value: 97 }
  ];

  return (
    <section className="section bg-stone dark:bg-secondary/30">
      <div className="container">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Image */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative order-2 lg:order-1"
          >
            <div className="relative rounded-2xl overflow-hidden shadow-lg">
              <img 
                src="https://images.unsplash.com/photo-1580541832626-2a7131ee809f?w=800&h=600&fit=crop" 
                alt="AI-Powered Coach Matching" 
                className="w-full h-auto"
              />
            </div>
          </motion.div>
          
          {/* Content */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="order-1 lg:order-2"
          >
            <motion.span variants={fadeIn} className="badge-burgundy mb-4 inline-flex">
              <Brain className="w-4 h-4 mr-2" />
              Smart Matching
            </motion.span>
            
            <motion.h2 variants={fadeIn} className="mb-4">
              AI That Understands
              <span className="text-terracotta"> Your Game</span>
            </motion.h2>
            
            <motion.p variants={fadeIn} className="text-muted-foreground text-lg mb-8 leading-relaxed">
              Our proprietary matching algorithm analyzes over 50 data points to pair you with coaches 
              who complement your playing style, understand your goals, and fit your schedule perfectly.
            </motion.p>
            
            <motion.div variants={fadeIn} className="space-y-5 mb-8">
              {matchingFactors.map((factor) => (
                <div key={factor.label}>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium">{factor.label}</span>
                    <span className="text-sm font-mono text-burgundy">{factor.value}%</span>
                  </div>
                  <Progress value={factor.value} className="h-2" />
                </div>
              ))}
            </motion.div>
            
            <motion.div variants={fadeIn}>
              <Button 
                className="bg-burgundy hover:bg-burgundy/90 text-white"
                onClick={() => toast("Find your match feature coming soon!")}
              >
                Find Your Match
                <ChevronRight className="ml-2 w-4 h-4" />
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// Coaches Section
function CoachesSection() {
  const coaches = [
    {
      name: "GM Alexandra Chen",
      title: "Grandmaster",
      rating: 2650,
      specialty: "Positional Play",
      students: 234,
      rating_stars: 4.9,
      image: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=400&fit=crop"
    },
    {
      name: "IM Marcus Rodriguez",
      title: "International Master",
      rating: 2480,
      specialty: "Tactical Training",
      students: 189,
      rating_stars: 4.8,
      image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop"
    },
    {
      name: "FM Sarah Mitchell",
      title: "FIDE Master",
      rating: 2350,
      specialty: "Opening Theory",
      students: 312,
      rating_stars: 5.0,
      image: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&h=400&fit=crop"
    }
  ];

  return (
    <section id="coaches" className="section">
      <div className="container">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={staggerContainer}
          className="max-w-2xl mb-16"
        >
          <motion.span variants={fadeIn} className="badge-terracotta mb-4 inline-flex">
            Expert Coaches
          </motion.span>
          <motion.h2 variants={fadeIn} className="mb-4">
            Learn From the
            <span className="text-burgundy"> Best</span>
          </motion.h2>
          <motion.p variants={fadeIn} className="text-muted-foreground text-lg">
            Our platform features verified coaches from around the world, including Grandmasters, 
            International Masters, and certified instructors.
          </motion.p>
        </motion.div>
        
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={staggerContainer}
          className="grid md:grid-cols-3 gap-6"
        >
          {coaches.map((coach) => (
            <motion.div key={coach.name} variants={fadeIn}>
              <Card className="swiss-card border-0 overflow-hidden">
                <CardContent className="p-0">
                  <div className="relative h-56 overflow-hidden">
                    <img 
                      src={coach.image} 
                      alt={coach.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <span className="absolute top-4 right-4 badge-burgundy bg-burgundy text-white border-0">
                      {coach.title}
                    </span>
                  </div>
                  <div className="p-6">
                    <h3 className="font-semibold text-lg mb-1">{coach.name}</h3>
                    <div className="flex items-center gap-2 text-muted-foreground text-sm mb-4">
                      <span className="font-mono text-burgundy">{coach.rating}</span>
                      <span>•</span>
                      <span>{coach.specialty}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-gold fill-gold" />
                        <span className="font-medium">{coach.rating_stars}</span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <Users className="w-4 h-4 inline mr-1" />
                        {coach.students} students
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mt-12"
        >
          <Button 
            variant="outline" 
            size="lg"
            className="border-burgundy text-burgundy hover:bg-burgundy/5"
            onClick={() => toast("Browse all coaches feature coming soon!")}
          >
            Browse All Coaches
            <ChevronRight className="ml-2 w-4 h-4" />
          </Button>
        </motion.div>
      </div>
    </section>
  );
}

// Gamification Section
function GamificationSection() {
  const [activeTab, setActiveTab] = useState("xp");
  
  const achievements = [
    { icon: Trophy, name: "First Victory", description: "Win your first rated game", unlocked: true },
    { icon: Flame, name: "7-Day Streak", description: "Complete daily goals for 7 days", unlocked: true },
    { icon: Target, name: "Puzzle Master", description: "Solve 100 tactical puzzles", unlocked: false },
    { icon: Crown, name: "Tournament Champion", description: "Win a community tournament", unlocked: false }
  ];

  return (
    <section id="gamification" className="section bg-stone dark:bg-secondary/30">
      <div className="container">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Content */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
          >
            <motion.span variants={fadeIn} className="badge-gold mb-4 inline-flex">
              Gamification
            </motion.span>
            
            <motion.h2 variants={fadeIn} className="mb-4">
              Level Up Your
              <span className="text-burgundy"> Chess Game</span>
            </motion.h2>
            
            <motion.p variants={fadeIn} className="text-muted-foreground text-lg mb-8 leading-relaxed">
              Stay motivated with our comprehensive gamification system. Earn XP, unlock achievements, 
              climb leaderboards, and compete in challenges that make learning chess addictive.
            </motion.p>
            
            <motion.div variants={fadeIn}>
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid grid-cols-3 mb-6 bg-background">
                  <TabsTrigger value="xp" className="data-[state=active]:bg-burgundy data-[state=active]:text-white">
                    XP System
                  </TabsTrigger>
                  <TabsTrigger value="badges" className="data-[state=active]:bg-burgundy data-[state=active]:text-white">
                    Badges
                  </TabsTrigger>
                  <TabsTrigger value="ranks" className="data-[state=active]:bg-burgundy data-[state=active]:text-white">
                    Ranks
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="xp" className="space-y-4">
                  <Card className="swiss-card border-0">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <div className="text-sm text-muted-foreground">Current Level</div>
                          <div className="text-2xl font-bold text-burgundy">Level 42</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-muted-foreground">Total XP</div>
                          <div className="font-mono text-lg text-terracotta">8,500 / 10,000</div>
                        </div>
                      </div>
                      <Progress value={85} className="h-3" />
                      <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-burgundy" />
                          <span>+50 XP per lesson</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-burgundy" />
                          <span>+100 XP per win</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="badges" className="space-y-3">
                  {achievements.map((achievement) => (
                    <Card 
                      key={achievement.name} 
                      className={`swiss-card border-0 ${!achievement.unlocked && "opacity-50"}`}
                    >
                      <CardContent className="p-4 flex items-center gap-4">
                        <div className={`w-11 h-11 rounded-lg flex items-center justify-center ${
                          achievement.unlocked ? "bg-burgundy/10 text-burgundy" : "bg-muted text-muted-foreground"
                        }`}>
                          <achievement.icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium">{achievement.name}</div>
                          <div className="text-sm text-muted-foreground">{achievement.description}</div>
                        </div>
                        {achievement.unlocked && (
                          <span className="badge-burgundy text-xs">Unlocked</span>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </TabsContent>
                
                <TabsContent value="ranks" className="space-y-4">
                  <Card className="swiss-card border-0">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-4 mb-6">
                        <div className="w-14 h-14 rounded-full bg-burgundy flex items-center justify-center">
                          <Crown className="w-7 h-7 text-white" />
                        </div>
                        <div>
                          <div className="text-xl font-bold">Grandmaster</div>
                          <div className="text-muted-foreground text-sm">Top 1% of players</div>
                        </div>
                      </div>
                      <div className="space-y-2 text-sm">
                        {["Beginner", "Intermediate", "Advanced", "Expert", "Master", "Grandmaster"].map((rank, i) => (
                          <div key={rank} className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${i <= 5 ? "bg-burgundy" : "bg-muted"}`} />
                            <span className={i === 5 ? "text-burgundy font-medium" : "text-muted-foreground"}>{rank}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </motion.div>
          </motion.div>
          
          {/* Image */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative hidden lg:block"
          >
            <div className="relative rounded-2xl overflow-hidden shadow-lg">
              <img 
                src="https://images.unsplash.com/photo-1611195974226-a6a9be9dd763?w=800&h=600&fit=crop" 
                alt="Gamification System" 
                className="w-full h-auto"
              />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// Community Section
function CommunitySection() {
  return (
    <section className="section">
      <div className="container">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={staggerContainer}
          className="text-center max-w-2xl mx-auto mb-12"
        >
          <motion.span variants={fadeIn} className="badge-burgundy mb-4 inline-flex">
            <Globe className="w-4 h-4 mr-2" />
            Global Community
          </motion.span>
          <motion.h2 variants={fadeIn} className="mb-4">
            Join a Worldwide
            <span className="text-terracotta"> Chess Family</span>
          </motion.h2>
          <motion.p variants={fadeIn} className="text-muted-foreground text-lg">
            Connect with players from over 50 countries. Participate in tournaments, join clubs, 
            and be part of a thriving community dedicated to chess excellence.
          </motion.p>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative rounded-2xl overflow-hidden mb-12"
        >
          <img 
            src="https://images.unsplash.com/photo-1604948501466-4e9c339b9c24?w=1200&h=500&fit=crop" 
            alt="Global Chess Community" 
            className="w-full h-64 md:h-[400px] object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
          
          {/* Floating stats */}
          <div className="absolute bottom-6 left-0 right-0">
            <div className="container">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { value: "50K+", label: "Community Members" },
                  { value: "1M+", label: "Games Played" },
                  { value: "500+", label: "Daily Tournaments" },
                  { value: "24/7", label: "Active Players" }
                ].map((stat) => (
                  <Card key={stat.label} className="swiss-card border-0 bg-card/95 backdrop-blur-sm">
                    <CardContent className="p-4 text-center">
                      <div className="text-xl md:text-2xl font-bold text-burgundy">{stat.value}</div>
                      <div className="text-xs text-muted-foreground">{stat.label}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// Pricing Section
function PricingSection() {
  const plans = [
    {
      name: "Free",
      price: "$0",
      description: "Perfect for beginners",
      features: [
        "Basic puzzle access",
        "Community forums",
        "3 AI matches/day",
        "Basic progress tracking"
      ],
      cta: "Get Started",
      popular: false
    },
    {
      name: "Premium",
      price: "$14.99",
      period: "/month",
      description: "For serious improvers",
      features: [
        "Unlimited puzzles & lessons",
        "AI coach recommendations",
        "Advanced analytics",
        "Priority support",
        "Tournament access",
        "Ad-free experience"
      ],
      cta: "Start Free Trial",
      popular: true
    },
    {
      name: "Pro",
      price: "$29.99",
      period: "/month",
      description: "For coaches & pros",
      features: [
        "Everything in Premium",
        "Coach dashboard",
        "Student management",
        "Revenue analytics",
        "Lower commission fees",
        "Featured profile"
      ],
      cta: "Contact Sales",
      popular: false
    }
  ];

  return (
    <section id="pricing" className="section bg-stone dark:bg-secondary/30">
      <div className="container">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={staggerContainer}
          className="text-center max-w-2xl mx-auto mb-16"
        >
          <motion.span variants={fadeIn} className="badge-terracotta mb-4 inline-flex">
            Pricing Plans
          </motion.span>
          <motion.h2 variants={fadeIn} className="mb-4">
            Choose Your
            <span className="text-burgundy"> Path</span>
          </motion.h2>
          <motion.p variants={fadeIn} className="text-muted-foreground text-lg">
            Start free and upgrade as you grow. All plans include access to our global community.
          </motion.p>
        </motion.div>
        
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={staggerContainer}
          className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto"
        >
          {plans.map((plan) => (
            <motion.div key={plan.name} variants={fadeIn}>
              <Card className={`h-full swiss-card ${
                plan.popular 
                  ? "border-2 border-burgundy shadow-lg" 
                  : "border-0"
              } relative`}>
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="badge-burgundy bg-burgundy text-white border-0 px-4">
                      Most Popular
                    </span>
                  </div>
                )}
                <CardContent className="p-8 flex flex-col h-full">
                  <div className="text-center mb-8">
                    <h3 className="text-lg font-semibold mb-2">{plan.name}</h3>
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-4xl font-bold text-burgundy">{plan.price}</span>
                      {plan.period && <span className="text-muted-foreground">{plan.period}</span>}
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">{plan.description}</p>
                  </div>
                  
                  <ul className="space-y-3 mb-8 flex-1">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-3">
                        <Check className="w-4 h-4 text-burgundy flex-shrink-0" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  
                  <Button 
                    className={plan.popular 
                      ? "w-full bg-burgundy hover:bg-burgundy/90 text-white" 
                      : "w-full"
                    }
                    variant={plan.popular ? "default" : "outline"}
                    onClick={() => toast(`${plan.name} plan feature coming soon!`)}
                  >
                    {plan.cta}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// CTA Section with Waitlist Form
function CTASection() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [userType, setUserType] = useState<"student" | "coach" | "both">("student");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const joinWaitlist = trpc.waitlist.join.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      toast.success("You're on the list! We'll be in touch soon.");
    },
    onError: (error: { message: string }) => {
      if (error.message.includes("already registered")) {
        toast.error("This email is already on our waitlist!");
      } else {
        toast.error("Something went wrong. Please try again.");
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setIsSubmitting(true);
    joinWaitlist.mutate({ email, name: name || undefined, userType });
    setIsSubmitting(false);
  };

  return (
    <section className="section bg-burgundy/5">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-2xl mx-auto"
        >
          {!submitted ? (
            <>
              <div className="text-center mb-8">
                <h2 className="mb-4">
                  Join the
                  <span className="text-burgundy"> Waitlist</span>
                </h2>
                <p className="text-muted-foreground">
                  Be the first to know when BooGMe launches. Get early access and exclusive benefits.
                </p>
              </div>

              <Card className="swiss-card">
                <CardContent className="p-6 md:p-8">
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium mb-2 block">Name (optional)</label>
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Your name"
                          className="w-full px-4 py-2.5 rounded-lg border border-border bg-background focus:border-burgundy focus:outline-none transition-colors"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block">Email *</label>
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@example.com"
                          required
                          className="w-full px-4 py-2.5 rounded-lg border border-border bg-background focus:border-burgundy focus:outline-none transition-colors"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block">I'm interested as a...</label>
                      <div className="flex gap-3">
                        {[
                          { value: "student" as const, label: "Student" },
                          { value: "coach" as const, label: "Coach" },
                          { value: "both" as const, label: "Both" },
                        ].map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setUserType(option.value)}
                            className={`flex-1 py-2.5 px-4 rounded-lg border text-sm font-medium transition-all ${
                              userType === option.value
                                ? "border-burgundy bg-burgundy/10 text-burgundy"
                                : "border-border hover:border-burgundy/50"
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <Button
                      type="submit"
                      size="lg"
                      className="w-full bg-burgundy hover:bg-burgundy/90 text-white font-medium"
                      disabled={isSubmitting || !email}
                    >
                      {isSubmitting ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Mail className="w-4 h-4 mr-2" />
                      )}
                      Join Waitlist
                    </Button>
                  </form>

                  <p className="text-xs text-muted-foreground text-center mt-4">
                    We respect your privacy. Unsubscribe at any time.
                  </p>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="swiss-card">
              <CardContent className="p-8 md:p-12 text-center">
                <div className="w-16 h-16 rounded-full bg-burgundy/10 flex items-center justify-center mx-auto mb-6">
                  <Check className="w-8 h-8 text-burgundy" />
                </div>
                <h3 className="text-2xl font-semibold mb-3">You're on the list!</h3>
                <p className="text-muted-foreground mb-6">
                  Thanks for joining. We'll notify you as soon as BooGMe launches.
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSubmitted(false);
                    setEmail("");
                    setName("");
                  }}
                >
                  Add another email
                </Button>
              </CardContent>
            </Card>
          )}
        </motion.div>
      </div>
    </section>
  );
}

// Footer
function Footer() {
  return (
    <footer className="py-16 border-t border-border bg-stone dark:bg-secondary/30">
      <div className="container">
        <div className="grid md:grid-cols-4 gap-12 mb-12">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-burgundy flex items-center justify-center">
                <Crown className="w-5 h-5 text-white" />
              </div>
              <span className="font-display font-bold text-xl">
                Boo<span className="text-burgundy">GMe</span>
              </span>
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed">
              The future of chess education. AI-powered coaching for players of all levels.
            </p>
          </div>
          
          {[
            {
              title: "Product",
              links: ["Features", "Pricing", "Coaches", "Community"]
            },
            {
              title: "Company",
              links: ["About", "Blog", "Careers", "Press"]
            },
            {
              title: "Support",
              links: ["Help Center", "Contact", "Privacy", "Terms"]
            }
          ].map((section) => (
            <div key={section.title}>
              <h4 className="font-semibold mb-4">{section.title}</h4>
              <ul className="space-y-3">
                {section.links.map((link) => (
                  <li key={link}>
                    <button 
                      onClick={() => toast("Page coming soon!")}
                      className="text-muted-foreground hover:text-burgundy transition-colors text-sm"
                    >
                      {link}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        
        <div className="pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-muted-foreground text-sm">
            © 2026 BooGMe. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <span className="badge-burgundy text-xs">
              <Shield className="w-3 h-3 mr-1" />
              Secure Platform
            </span>
            <span className="badge-gold text-xs">
              <Award className="w-3 h-3 mr-1" />
              FIDE Partner
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}

// Main Home Component
export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation />
      <HeroSection />
      <FeaturesSection />
      <PaymentProtectionSection />
      <MatchingSection />
      <CoachesSection />
      <GamificationSection />
      <CommunitySection />
      <PricingSection />
      <CTASection />
      <Footer />
    </div>
  );
}
