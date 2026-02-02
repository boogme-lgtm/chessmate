/*
 * DESIGN: Digital Grandmaster - Cyberpunk-lite Chess Platform
 * Dark backgrounds, electric cyan/magenta accents, glassmorphism cards
 * Snappy animations, data-driven aesthetics, esports feel
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import { 
  Brain, 
  Users, 
  Trophy, 
  Target, 
  Zap, 
  Globe, 
  Star, 
  ChevronRight,
  Play,
  BookOpen,
  MessageSquare,
  TrendingUp,
  Shield,
  Award,
  Flame,
  Crown,
  Sparkles,
  ArrowRight,
  Check,
  Lock,
  RefreshCw,
  Clock,
  BadgeCheck,
  Wallet,
  ShieldCheck,
  CircleDollarSign,
  ThumbsUp
} from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";
import { CoachFinderQuiz } from "@/components/CoachFinderQuiz";

// Image URLs from generated assets
const IMAGES = {
  hero: "https://private-us-east-1.manuscdn.com/sessionFile/7c1WCmSQ3yYhjyR4Csestv/sandbox/EMEa12gwjhSyoVdSXTt8SB-img-1_1770068630000_na1fn_Y2hlc3NtYXRlLWhlcm8.png?x-oss-process=image/resize,w_1920,h_1920/format,webp/quality,q_80&Expires=1798761600&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvN2MxV0NtU1EzeVloanlSNENzZXN0di9zYW5kYm94L0VNRWExMmd3amhTeW9WZFNYVHQ4U0ItaW1nLTFfMTc3MDA2ODYzMDAwMF9uYTFmbl9ZMmhsYzNOdFlYUmxMV2hsY204LnBuZz94LW9zcy1wcm9jZXNzPWltYWdlL3Jlc2l6ZSx3XzE5MjAsaF8xOTIwL2Zvcm1hdCx3ZWJwL3F1YWxpdHkscV84MCIsIkNvbmRpdGlvbiI6eyJEYXRlTGVzc1RoYW4iOnsiQVdTOkVwb2NoVGltZSI6MTc5ODc2MTYwMH19fV19&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=YLdcQU0fhh3~xmtNB0jLvTONKt1cQfH8RKf~SJAZ0NLwyQ~H7chJlW9PU4dcgEgsa-F7jo4ZNbjRHbyW7ZiKazLBBdUYKY-nI42B7nbq-017bAMr4v01kdmeron4b~YKTpHvT4-FbLb249gkocfQz1Wv8PE0J~unh~N2ZYcaAiJ74T-hhXvcUayQyXAQhmKZTrSa8Eh14MgybyloKby-4NaVAQE5NhTeEWFhuFzKq-OyCA9-emgP7xVJ4~GxLjC-HlHawPQ9Q9foQLu5AimrwIXhQABVu4eFsBtbSEkbOXZSAeIIBLPCnJW3LBapklLI-zQ5BdkxDyg1tFqWlp8~HA__",
  matching: "https://private-us-east-1.manuscdn.com/sessionFile/7c1WCmSQ3yYhjyR4Csestv/sandbox/EMEa12gwjhSyoVdSXTt8SB-img-2_1770068631000_na1fn_Y2hlc3NtYXRlLW1hdGNoaW5n.png?x-oss-process=image/resize,w_1920,h_1920/format,webp/quality,q_80&Expires=1798761600&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvN2MxV0NtU1EzeVloanlSNENzZXN0di9zYW5kYm94L0VNRWExMmd3amhTeW9WZFNYVHQ4U0ItaW1nLTJfMTc3MDA2ODYzMTAwMF9uYTFmbl9ZMmhsYzNOdFlYUmxMVzFoZEdOb2FXNW4ucG5nP3gtb3NzLXByb2Nlc3M9aW1hZ2UvcmVzaXplLHdfMTkyMCxoXzE5MjAvZm9ybWF0LHdlYnAvcXVhbGl0eSxxXzgwIiwiQ29uZGl0aW9uIjp7IkRhdGVMZXNzVGhhbiI6eyJBV1M6RXBvY2hUaW1lIjoxNzk4NzYxNjAwfX19XX0_&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=rSl4zc0GOAI9aZQ-XP6Dspa81giJBmztnxlB7zLyW-GjgQAF0jTq-l7KQ6fklW5-6oaZteuXAbvIjUJUUv22EyPz0aRSCr-WUwmUR3EUIVyda5IEegDFOzvz80Ypy~IuDMSaWychDDgrQN4fvjK8489vVlTMBWrDoByf8~dgE0KktNhrQMi~5AOee6eAQOg~guTpUYrWRFF5uqxLV1Ydd5t5w6-Sf03Pt7yHz44HXHNDpzyYXTBb3frlpdr1ktytGU~XYMTE0uAJUqoZWFNYeVkQwFNhVfynF8UnU-iHbsE3DYlF0taLYzn0P2RDZslWeSsmb~mUYajQnUy5ZSoCtQ__",
  gamification: "https://private-us-east-1.manuscdn.com/sessionFile/7c1WCmSQ3yYhjyR4Csestv/sandbox/EMEa12gwjhSyoVdSXTt8SB-img-3_1770068634000_na1fn_Y2hlc3NtYXRlLWdhbWlmaWNhdGlvbg.png?x-oss-process=image/resize,w_1920,h_1920/format,webp/quality,q_80&Expires=1798761600&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvN2MxV0NtU1EzeVloanlSNENzZXN0di9zYW5kYm94L0VNRWExMmd3amhTeW9WZFNYVHQ4U0ItaW1nLTNfMTc3MDA2ODYzNDAwMF9uYTFmbl9ZMmhsYzNOdFlYUmxMV2RoYldsbWFXTmhkR2x2YmcucG5nP3gtb3NzLXByb2Nlc3M9aW1hZ2UvcmVzaXplLHdfMTkyMCxoXzE5MjAvZm9ybWF0LHdlYnAvcXVhbGl0eSxxXzgwIiwiQ29uZGl0aW9uIjp7IkRhdGVMZXNzVGhhbiI6eyJBV1M6RXBvY2hUaW1lIjoxNzk4NzYxNjAwfX19XX0_&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=PoQtfTYTJnV3Gw9PHm9xs-FIhUrhWlbTtHRCkWWxFU2tvMrueCmqwzSe8-hKEHuwUNW454E1RVLo~Ak2HQW0KmtMzQnZoLnG2F9-8rgVzf923Y~iMqeDjxqpH5bgvcANExIiTG7GeapsrRVyE-WGWkDVNAfGKR1IM8aF-F3bJHKZ5-n-Ow9BHj2xTxAA~SB8y3GKICdxlFj4~jwIGp95Ir-e~ldiUM9eN2IyGl9zu~M4NlKHK0A98i9~IcULvho3gvrQUaU07Q5I4Zwq6Cv9wmAFSUDuSV70L8fpyQ~uqKpUiFcwPcPJ2bWJuZKUyQ6va59FIgOd0mGpGXvP3w7KvA__",
  coach: "https://private-us-east-1.manuscdn.com/sessionFile/7c1WCmSQ3yYhjyR4Csestv/sandbox/EMEa12gwjhSyoVdSXTt8SB-img-4_1770068633000_na1fn_Y2hlc3NtYXRlLWNvYWNo.png?x-oss-process=image/resize,w_1920,h_1920/format,webp/quality,q_80&Expires=1798761600&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvN2MxV0NtU1EzeVloanlSNENzZXN0di9zYW5kYm94L0VNRWExMmd3amhTeW9WZFNYVHQ4U0ItaW1nLTRfMTc3MDA2ODYzMzAwMF9uYTFmbl9ZMmhsYzNOdFlYUmxMV052WVdOby5wbmc~eC1vc3MtcHJvY2Vzcz1pbWFnZS9yZXNpemUsd18xOTIwLGhfMTkyMC9mb3JtYXQsd2VicC9xdWFsaXR5LHFfODAiLCJDb25kaXRpb24iOnsiRGF0ZUxlc3NUaGFuIjp7IkFXUzpFcG9jaFRpbWUiOjE3OTg3NjE2MDB9fX1dfQ__&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=lUFckc-01zMSXzKu~Ut8ssdl-0G8Eio~db3YxgWyspn3DAwcHa3B9bq64Z2LgXPnMQ2ZzajdqRxFwZfVd8RdOk9dLmotnxzIBxnxMFuiPu1ROY2ifJDibRChQOyxOLbFEppRSVgK110A0sGBEO8Wl6lzAluLZstLKpMVTyIwS7kbRzMZrej7m7UWsDeqcDP1oNvb6eyLhEL4W0a8FIuJcQAUkYvgT2FQbIiXlnCvXeq3vime8a1u8G0qbNffVFX3z-iXF0WeaIZFy5sfiUnZm~WAx65isZk0ipg0Q0WN79~Yt0YKoXxXl9CkQm2p0a3~R~Su95vUOmSlFAwQrgISkA__",
  community: "https://private-us-east-1.manuscdn.com/sessionFile/7c1WCmSQ3yYhjyR4Csestv/sandbox/EMEa12gwjhSyoVdSXTt8SB-img-5_1770068627000_na1fn_Y2hlc3NtYXRlLWNvbW11bml0eQ.png?x-oss-process=image/resize,w_1920,h_1920/format,webp/quality,q_80&Expires=1798761600&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvN2MxV0NtU1EzeVloanlSNENzZXN0di9zYW5kYm94L0VNRWExMmd3amhTeW9WZFNYVHQ4U0ItaW1nLTVfMTc3MDA2ODYyNzAwMF9uYTFmbl9ZMmhsYzNOdFlYUmxMV052YlcxMWJtbDBlUS5wbmc~eC1vc3MtcHJvY2Vzcz1pbWFnZS9yZXNpemUsd18xOTIwLGhfMTkyMC9mb3JtYXQsd2VicC9xdWFsaXR5LHFfODAiLCJDb25kaXRpb24iOnsiRGF0ZUxlc3NUaGFuIjp7IkFXUzpFcG9jaFRpbWUiOjE3OTg3NjE2MDB9fX1dfQ__&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=u37EYjAPc5atobcR5yZKco62DBnJU1cJ1H6maw7SRknSH9~BZ8h94bG9NgqZDZ7z0zf2fznsWtbRQWArAg4vmk9PsJw30mXD~cHx2ezUpWrkbpiIIPSJpJ4ZbFI3LHOD2sU8ijU2m6m1P8Pnya3T1Jie6PDb4Cv78q5delnIzH9Ko1TVVL3Q~pigcUagOotSwedmvfi~OFMewVeO8LyVsByjtGshADWimMSEL51ePXa9K3yzYgpfzekG23tNKDdimwy-Pc3630H7fnum6Ff14LObQVtDodTAQB7nAumWx9zdRMISHSd9v3rL6CRCjEfuXhvmcPv5fxqWzsDXKFnlnA__",
};

// Animation variants
const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.4 } }
} as const;

// Navigation Component
function Navigation() {
  const [isScrolled, setIsScrolled] = useState(false);

  React.useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleNavClick = (section: string) => {
    const element = document.getElementById(section);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <motion.nav 
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled ? "bg-background/80 backdrop-blur-lg border-b border-border" : ""
      }`}
    >
      <div className="container flex items-center justify-between h-16 md:h-20">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-gradient-to-br from-cyan to-magenta flex items-center justify-center">
            <Crown className="w-5 h-5 md:w-6 md:h-6 text-white" />
          </div>
          <span className="font-display font-bold text-xl md:text-2xl">
            Boo<span className="text-cyan">GMe</span>
          </span>
        </div>
        
        <div className="hidden md:flex items-center gap-8">
          {["Features", "Coaches", "Gamification", "Pricing"].map((item) => (
            <button 
              key={item}
              onClick={() => handleNavClick(item.toLowerCase())}
              className="text-muted-foreground hover:text-cyan transition-colors font-medium"
            >
              {item}
            </button>
          ))}
        </div>
        
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            className="hidden sm:inline-flex text-muted-foreground hover:text-foreground"
            onClick={() => toast("Login feature coming soon!")}
          >
            Log In
          </Button>
          <Button 
            className="bg-gradient-to-r from-cyan to-magenta hover:opacity-90 text-white font-semibold px-4 md:px-6"
            onClick={() => toast("Sign up feature coming soon!")}
          >
            Get Started
          </Button>
        </div>
      </div>
    </motion.nav>
  );
}

// Hero Section
function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center pt-20 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 grid-pattern opacity-50" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/50 to-background" />
      
      {/* Floating elements */}
      <motion.div 
        animate={{ y: [0, -20, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-1/4 left-10 w-20 h-20 rounded-full bg-cyan/10 blur-2xl"
      />
      <motion.div 
        animate={{ y: [0, 20, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className="absolute bottom-1/4 right-10 w-32 h-32 rounded-full bg-magenta/10 blur-3xl"
      />
      
      <div className="container relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left content */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
            className="text-center lg:text-left"
          >
            <motion.div variants={fadeInUp}>
              <Badge className="mb-6 bg-cyan/10 text-cyan border-cyan/20 hover:bg-cyan/20">
                <Sparkles className="w-3 h-3 mr-1" />
                AI-Powered Matching
              </Badge>
            </motion.div>
            
            <motion.h1 
              variants={fadeInUp}
              className="font-display text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold leading-tight mb-6"
            >
              Find Your
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-cyan to-magenta glow-text-cyan">
                Perfect Coach
              </span>
            </motion.h1>
            
            <motion.p 
              variants={fadeInUp}
              className="text-lg sm:text-xl text-muted-foreground mb-8 max-w-xl mx-auto lg:mx-0"
            >
              Connect with world-class chess coaches through intelligent AI matching. 
              Level up your game with personalized training, gamified progress, and a global community.
            </motion.p>
            
            <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <CoachFinderQuiz />
              <Button 
                size="lg" 
                variant="outline" 
                className="border-border hover:border-cyan hover:text-cyan"
                onClick={() => toast("Demo video coming soon!")}
              >
                <Play className="mr-2 w-5 h-5" />
                Watch Demo
              </Button>
            </motion.div>
            
            {/* Stats */}
            <motion.div 
              variants={fadeInUp}
              className="grid grid-cols-3 gap-6 mt-12 pt-8 border-t border-border"
            >
              {[
                { value: "10K+", label: "Active Students" },
                { value: "500+", label: "Expert Coaches" },
                { value: "50+", label: "Countries" }
              ].map((stat) => (
                <div key={stat.label} className="text-center lg:text-left">
                  <div className="font-display text-2xl sm:text-3xl font-bold text-cyan">{stat.value}</div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </motion.div>
          </motion.div>
          
          {/* Right content - Hero image */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, x: 50 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="relative"
          >
            <div className="relative rounded-2xl overflow-hidden glow-cyan">
              <img 
                src={IMAGES.hero} 
                alt="ChessMate - AI-Powered Chess Coaching" 
                className="w-full h-auto rounded-2xl"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent" />
            </div>
            
            {/* Floating card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="absolute -bottom-6 -left-6 glass-card rounded-xl p-4 hidden lg:block"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan to-magenta flex items-center justify-center">
                  <Brain className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="font-semibold">AI Match Found</div>
                  <div className="text-sm text-cyan">98% compatibility</div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// Features Section
function FeaturesSection() {
  const features = [
    {
      icon: Brain,
      title: "AI-Powered Matching",
      description: "Our intelligent algorithm analyzes your playing style, goals, and preferences to find your ideal coach.",
      color: "cyan"
    },
    {
      icon: Target,
      title: "Personalized Learning",
      description: "Custom lesson plans and adaptive training paths tailored to your skill level and improvement areas.",
      color: "magenta"
    },
    {
      icon: Trophy,
      title: "Gamified Progress",
      description: "Earn XP, unlock achievements, and climb leaderboards as you master new chess concepts.",
      color: "cyan"
    },
    {
      icon: Globe,
      title: "Global Community",
      description: "Connect with players and coaches from 50+ countries. Learn, compete, and grow together.",
      color: "magenta"
    },
    {
      icon: BookOpen,
      title: "Rich Content Library",
      description: "Access thousands of lessons, puzzles, and video courses from titled players and grandmasters.",
      color: "cyan"
    },
    {
      icon: MessageSquare,
      title: "Real-Time Coaching",
      description: "Interactive sessions with shared boards, video chat, and instant feedback on your moves.",
      color: "magenta"
    }
  ];

  return (
    <section id="features" className="py-24 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-background via-secondary/20 to-background" />
      
      <div className="container relative z-10">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="text-center mb-16"
        >
          <motion.div variants={fadeInUp}>
            <Badge className="mb-4 bg-magenta/10 text-magenta border-magenta/20">
              Platform Features
            </Badge>
          </motion.div>
          <motion.h2 variants={fadeInUp} className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
            Everything You Need to
            <span className="text-cyan"> Master Chess</span>
          </motion.h2>
          <motion.p variants={fadeInUp} className="text-muted-foreground text-lg max-w-2xl mx-auto">
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
          {features.map((feature, index) => (
            <motion.div key={feature.title} variants={scaleIn}>
              <Card className="glass-card border-border hover:border-cyan/50 transition-all duration-300 group h-full">
                <CardContent className="p-6">
                  <div className={`w-12 h-12 rounded-lg mb-4 flex items-center justify-center ${
                    feature.color === "cyan" 
                      ? "bg-cyan/10 text-cyan group-hover:bg-cyan/20" 
                      : "bg-magenta/10 text-magenta group-hover:bg-magenta/20"
                  } transition-colors`}>
                    <feature.icon className="w-6 h-6" />
                  </div>
                  <h3 className="font-display text-xl font-semibold mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// Payment Protection Section
function PaymentProtectionSection() {
  const protectionFeatures = [
    {
      icon: Lock,
      title: "Escrow Payments",
      description: "Your payment is held securely until the lesson is completed and you confirm satisfaction. Coaches only receive funds after verified delivery.",
      highlight: "100% Secure"
    },
    {
      icon: RefreshCw,
      title: "Pay-Per-Lesson",
      description: "No risky bulk packages. Pay only for each individual lesson after it's completed. Full control over your spending.",
      highlight: "No Lock-in"
    },
    {
      icon: Clock,
      title: "48-Hour Guarantee",
      description: "Not satisfied? Request a full refund within 48 hours of any lesson. No questions asked, no hassle.",
      highlight: "Money Back"
    },
    {
      icon: BadgeCheck,
      title: "Quality Assurance",
      description: "Coaches must maintain a minimum 4.5-star rating to receive payments. Underperformers are automatically flagged.",
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
    <section id="payment-protection" className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-background via-cyan/5 to-background" />
      
      <div className="container relative z-10">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="text-center mb-16"
        >
          <motion.div variants={fadeInUp}>
            <Badge className="mb-4 bg-cyan/10 text-cyan border-cyan/20">
              <ShieldCheck className="w-3 h-3 mr-1" />
              Payment Protection
            </Badge>
          </motion.div>
          <motion.h2 variants={fadeInUp} className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
            Your Money is
            <span className="text-cyan"> Always Protected</span>
          </motion.h2>
          <motion.p variants={fadeInUp} className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Unlike other platforms, BooGMe uses an escrow-based payment system. You only pay when you're satisfied — 
            no more worrying about coaches underperforming after you've paid.
          </motion.p>
        </motion.div>

        {/* How It Works Flow */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <div className="relative">
            {/* Connection line */}
            <div className="hidden md:block absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-cyan/20 via-cyan to-cyan/20 -translate-y-1/2" />
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {howItWorks.map((item, index) => (
                <motion.div
                  key={item.step}
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="relative"
                >
                  <Card className="glass-card border-cyan/20 hover:border-cyan/50 transition-all text-center h-full">
                    <CardContent className="p-6">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan to-magenta flex items-center justify-center mx-auto mb-4 relative z-10">
                        <span className="font-display font-bold text-white">{item.step}</span>
                      </div>
                      <item.icon className="w-6 h-6 text-cyan mx-auto mb-2" />
                      <h4 className="font-display font-semibold mb-1">{item.title}</h4>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
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
            <motion.div key={feature.title} variants={scaleIn}>
              <Card className="glass-card border-border hover:border-cyan/50 transition-all duration-300 group h-full">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-xl bg-cyan/10 text-cyan group-hover:bg-cyan/20 transition-colors flex items-center justify-center flex-shrink-0">
                      <feature.icon className="w-7 h-7" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-display text-xl font-semibold">{feature.title}</h3>
                        <Badge className="bg-cyan/20 text-cyan border-0 text-xs">
                          {feature.highlight}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground">{feature.description}</p>
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
          <Card className="bg-gradient-to-r from-cyan/10 via-magenta/10 to-cyan/10 border-cyan/20">
            <CardContent className="p-8">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan to-magenta flex items-center justify-center">
                    <CircleDollarSign className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h3 className="font-display text-xl font-bold">$0 Lost to Bad Coaches</h3>
                    <p className="text-muted-foreground">Our escrow system has protected over $2M in student payments</p>
                  </div>
                </div>
                <div className="flex items-center gap-6 text-center">
                  <div>
                    <div className="font-display text-2xl font-bold text-cyan">99.2%</div>
                    <div className="text-sm text-muted-foreground">Satisfaction Rate</div>
                  </div>
                  <div className="w-px h-12 bg-border" />
                  <div>
                    <div className="font-display text-2xl font-bold text-magenta">48hr</div>
                    <div className="text-sm text-muted-foreground">Refund Window</div>
                  </div>
                  <div className="w-px h-12 bg-border" />
                  <div>
                    <div className="font-display text-2xl font-bold text-cyan">0%</div>
                    <div className="text-sm text-muted-foreground">Hidden Fees</div>
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
    <section className="py-24 relative overflow-hidden">
      <div className="container">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Image */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative order-2 lg:order-1"
          >
            <div className="relative rounded-2xl overflow-hidden">
              <img 
                src={IMAGES.matching} 
                alt="AI-Powered Coach Matching" 
                className="w-full h-auto rounded-2xl"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-background/40 to-transparent" />
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
            <motion.div variants={fadeInUp}>
              <Badge className="mb-4 bg-cyan/10 text-cyan border-cyan/20">
                <Brain className="w-3 h-3 mr-1" />
                Smart Matching
              </Badge>
            </motion.div>
            
            <motion.h2 variants={fadeInUp} className="font-display text-3xl sm:text-4xl font-bold mb-4">
              AI That Understands
              <span className="text-magenta"> Your Game</span>
            </motion.h2>
            
            <motion.p variants={fadeInUp} className="text-muted-foreground text-lg mb-8">
              Our proprietary matching algorithm analyzes over 50 data points to pair you with coaches 
              who complement your playing style, understand your goals, and fit your schedule perfectly.
            </motion.p>
            
            <motion.div variants={fadeInUp} className="space-y-4 mb-8">
              {matchingFactors.map((factor) => (
                <div key={factor.label}>
                  <div className="flex justify-between mb-2">
                    <span className="font-medium">{factor.label}</span>
                    <span className="text-cyan font-mono">{factor.value}%</span>
                  </div>
                  <Progress value={factor.value} className="h-2 bg-secondary" />
                </div>
              ))}
            </motion.div>
            
            <motion.div variants={fadeInUp}>
              <Button 
                className="bg-gradient-to-r from-cyan to-magenta hover:opacity-90 text-white font-semibold"
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
    <section id="coaches" className="py-24 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-background via-secondary/10 to-background" />
      
      <div className="container relative z-10">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={staggerContainer}
          className="text-center mb-16"
        >
          <motion.div variants={fadeInUp}>
            <Badge className="mb-4 bg-cyan/10 text-cyan border-cyan/20">
              Expert Coaches
            </Badge>
          </motion.div>
          <motion.h2 variants={fadeInUp} className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
            Learn From the
            <span className="text-magenta"> Best</span>
          </motion.h2>
          <motion.p variants={fadeInUp} className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Our platform features verified coaches from around the world, including Grandmasters, 
            International Masters, and certified instructors.
          </motion.p>
        </motion.div>
        
        {/* Coach image showcase */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-12 rounded-2xl overflow-hidden"
        >
          <img 
            src={IMAGES.coach} 
            alt="Professional Chess Coach" 
            className="w-full h-64 md:h-96 object-cover"
          />
        </motion.div>
        
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={staggerContainer}
          className="grid md:grid-cols-3 gap-6"
        >
          {coaches.map((coach) => (
            <motion.div key={coach.name} variants={scaleIn}>
              <Card className="glass-card border-border hover:border-magenta/50 transition-all duration-300 group overflow-hidden">
                <CardContent className="p-0">
                  <div className="relative h-48 overflow-hidden">
                    <img 
                      src={coach.image} 
                      alt={coach.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
                    <Badge className="absolute top-4 right-4 bg-magenta/90 text-white">
                      {coach.title}
                    </Badge>
                  </div>
                  <div className="p-6">
                    <h3 className="font-display text-xl font-semibold mb-1">{coach.name}</h3>
                    <div className="flex items-center gap-2 text-muted-foreground text-sm mb-4">
                      <span className="font-mono text-cyan">{coach.rating}</span>
                      <span>•</span>
                      <span>{coach.specialty}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                        <span className="font-semibold">{coach.rating_stars}</span>
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
          className="text-center mt-10"
        >
          <Button 
            variant="outline" 
            size="lg"
            className="border-cyan text-cyan hover:bg-cyan/10"
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
    <section id="gamification" className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 grid-pattern opacity-30" />
      
      <div className="container relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Content */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
          >
            <motion.div variants={fadeInUp}>
              <Badge className="mb-4 bg-magenta/10 text-magenta border-magenta/20">
                <Zap className="w-3 h-3 mr-1" />
                Gamification
              </Badge>
            </motion.div>
            
            <motion.h2 variants={fadeInUp} className="font-display text-3xl sm:text-4xl font-bold mb-4">
              Level Up Your
              <span className="text-cyan"> Chess Game</span>
            </motion.h2>
            
            <motion.p variants={fadeInUp} className="text-muted-foreground text-lg mb-8">
              Stay motivated with our comprehensive gamification system. Earn XP, unlock achievements, 
              climb leaderboards, and compete in challenges that make learning chess addictive.
            </motion.p>
            
            <motion.div variants={fadeInUp}>
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid grid-cols-3 bg-secondary/50 mb-6">
                  <TabsTrigger value="xp" className="data-[state=active]:bg-cyan data-[state=active]:text-background">
                    XP System
                  </TabsTrigger>
                  <TabsTrigger value="badges" className="data-[state=active]:bg-cyan data-[state=active]:text-background">
                    Badges
                  </TabsTrigger>
                  <TabsTrigger value="ranks" className="data-[state=active]:bg-cyan data-[state=active]:text-background">
                    Ranks
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="xp" className="space-y-4">
                  <Card className="glass-card border-cyan/20">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <div className="text-sm text-muted-foreground">Current Level</div>
                          <div className="font-display text-2xl font-bold text-cyan">Level 42</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-muted-foreground">Total XP</div>
                          <div className="font-mono text-xl text-magenta">8,500 / 10,000</div>
                        </div>
                      </div>
                      <Progress value={85} className="h-3 bg-secondary" />
                      <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-cyan" />
                          <span>+50 XP per lesson</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-cyan" />
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
                      className={`glass-card ${achievement.unlocked ? "border-cyan/30" : "border-border opacity-60"}`}
                    >
                      <CardContent className="p-4 flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                          achievement.unlocked ? "bg-cyan/20 text-cyan" : "bg-secondary text-muted-foreground"
                        }`}>
                          <achievement.icon className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold">{achievement.name}</div>
                          <div className="text-sm text-muted-foreground">{achievement.description}</div>
                        </div>
                        {achievement.unlocked && (
                          <Badge className="bg-cyan/20 text-cyan border-0">Unlocked</Badge>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </TabsContent>
                
                <TabsContent value="ranks" className="space-y-4">
                  <Card className="glass-card border-magenta/20">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-4 mb-6">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan to-magenta flex items-center justify-center">
                          <Crown className="w-8 h-8 text-white" />
                        </div>
                        <div>
                          <div className="font-display text-2xl font-bold">Grandmaster</div>
                          <div className="text-muted-foreground">Top 1% of players</div>
                        </div>
                      </div>
                      <div className="space-y-2 text-sm">
                        {["Beginner", "Intermediate", "Advanced", "Expert", "Master", "Grandmaster"].map((rank, i) => (
                          <div key={rank} className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${i <= 5 ? "bg-cyan" : "bg-secondary"}`} />
                            <span className={i === 5 ? "text-cyan font-semibold" : "text-muted-foreground"}>{rank}</span>
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
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative"
          >
            <div className="relative rounded-2xl overflow-hidden glow-magenta">
              <img 
                src={IMAGES.gamification} 
                alt="Gamification System" 
                className="w-full h-auto rounded-2xl"
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
    <section className="py-24 relative">
      <div className="container">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={staggerContainer}
          className="text-center mb-12"
        >
          <motion.div variants={fadeInUp}>
            <Badge className="mb-4 bg-cyan/10 text-cyan border-cyan/20">
              <Globe className="w-3 h-3 mr-1" />
              Global Community
            </Badge>
          </motion.div>
          <motion.h2 variants={fadeInUp} className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
            Join a Worldwide
            <span className="text-magenta"> Chess Family</span>
          </motion.h2>
          <motion.p variants={fadeInUp} className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Connect with players from over 50 countries. Participate in tournaments, join clubs, 
            and be part of a thriving community dedicated to chess excellence.
          </motion.p>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative rounded-2xl overflow-hidden mb-12"
        >
          <img 
            src={IMAGES.community} 
            alt="Global Chess Community" 
            className="w-full h-64 md:h-[500px] object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
          
          {/* Floating stats */}
          <div className="absolute bottom-8 left-0 right-0">
            <div className="container">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { value: "50K+", label: "Community Members" },
                  { value: "1M+", label: "Games Played" },
                  { value: "500+", label: "Daily Tournaments" },
                  { value: "24/7", label: "Active Players" }
                ].map((stat) => (
                  <Card key={stat.label} className="glass-card border-cyan/20">
                    <CardContent className="p-4 text-center">
                      <div className="font-display text-2xl md:text-3xl font-bold text-cyan">{stat.value}</div>
                      <div className="text-sm text-muted-foreground">{stat.label}</div>
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
    <section id="pricing" className="py-24 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-background via-secondary/10 to-background" />
      
      <div className="container relative z-10">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={staggerContainer}
          className="text-center mb-16"
        >
          <motion.div variants={fadeInUp}>
            <Badge className="mb-4 bg-magenta/10 text-magenta border-magenta/20">
              Pricing Plans
            </Badge>
          </motion.div>
          <motion.h2 variants={fadeInUp} className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
            Choose Your
            <span className="text-cyan"> Path</span>
          </motion.h2>
          <motion.p variants={fadeInUp} className="text-muted-foreground text-lg max-w-2xl mx-auto">
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
            <motion.div key={plan.name} variants={scaleIn}>
              <Card className={`h-full ${
                plan.popular 
                  ? "glass-card border-cyan glow-cyan" 
                  : "glass-card border-border"
              } relative`}>
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-gradient-to-r from-cyan to-magenta text-white border-0">
                      Most Popular
                    </Badge>
                  </div>
                )}
                <CardContent className="p-6 flex flex-col h-full">
                  <div className="text-center mb-6">
                    <h3 className="font-display text-xl font-semibold mb-2">{plan.name}</h3>
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="font-display text-4xl font-bold text-cyan">{plan.price}</span>
                      {plan.period && <span className="text-muted-foreground">{plan.period}</span>}
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">{plan.description}</p>
                  </div>
                  
                  <ul className="space-y-3 mb-8 flex-1">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-cyan flex-shrink-0" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  
                  <Button 
                    className={plan.popular 
                      ? "w-full bg-gradient-to-r from-cyan to-magenta hover:opacity-90 text-white" 
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

// CTA Section
function CTASection() {
  return (
    <section className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 grid-pattern opacity-30" />
      <div className="absolute inset-0 bg-gradient-to-r from-cyan/10 via-transparent to-magenta/10" />
      
      <div className="container relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-3xl mx-auto text-center"
        >
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold mb-6">
            Ready to
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan to-magenta"> Elevate Your Game?</span>
          </h2>
          <p className="text-muted-foreground text-lg mb-8">
            Join thousands of players who have transformed their chess journey with BooGMe. 
            Start your free trial today and discover your perfect coach.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg" 
              className="bg-gradient-to-r from-cyan to-magenta hover:opacity-90 text-white font-semibold text-lg px-8 glow-cyan"
              onClick={() => toast("Sign up feature coming soon!")}
            >
              Start Free Trial
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="border-border hover:border-cyan hover:text-cyan"
              onClick={() => toast("Contact feature coming soon!")}
            >
              Talk to Sales
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// Footer
function Footer() {
  return (
    <footer className="py-12 border-t border-border">
      <div className="container">
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan to-magenta flex items-center justify-center">
                <Crown className="w-5 h-5 text-white" />
              </div>
              <span className="font-display font-bold text-xl">
                Boo<span className="text-cyan">GMe</span>
              </span>
            </div>
            <p className="text-muted-foreground text-sm">
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
              <ul className="space-y-2">
                {section.links.map((link) => (
                  <li key={link}>
                    <button 
                      onClick={() => toast("Page coming soon!")}
                      className="text-muted-foreground hover:text-cyan transition-colors text-sm"
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
            <Badge variant="outline" className="text-cyan border-cyan/30">
              <Shield className="w-3 h-3 mr-1" />
              Secure Platform
            </Badge>
            <Badge variant="outline" className="text-magenta border-magenta/30">
              <Award className="w-3 h-3 mr-1" />
              FIDE Partner
            </Badge>
          </div>
        </div>
      </div>
    </footer>
  );
}

// Main Home Component
export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
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
