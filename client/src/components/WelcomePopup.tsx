import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Users, GraduationCap } from "lucide-react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useAuth } from "@/_core/hooks/useAuth";

export function WelcomePopup({ onOpenAssessment }: { onOpenAssessment: () => void }) {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { isAuthenticated, loading } = useAuth();

  useEffect(() => {
    // Skip entirely if auth is still loading or user is already signed in
    if (loading) return;
    if (isAuthenticated) return;

    // Use localStorage so the popup shows only once ever per browser
    // (new visitors only — returning registered users never see it)
    const hasSeenPopup = localStorage.getItem("hasSeenWelcomePopup");

    // Only show popup on homepage and if not seen before
    if (!hasSeenPopup && window.location.pathname === "/") {
      // Delay popup slightly for better UX
      const timer = setTimeout(() => {
        setOpen(true);
      }, 1200);

      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, loading]);

  const handleChoice = (userType: "student" | "coach") => {
    // Mark as seen permanently in localStorage
    localStorage.setItem("hasSeenWelcomePopup", "true");
    setOpen(false);
    
    // Route to appropriate flow
    if (userType === "student") {
      // Open assessment modal instead of routing
      onOpenAssessment();
    } else {
      setLocation("/for-coaches");
    }
  };

  const handleClose = () => {
    localStorage.setItem("hasSeenWelcomePopup", "true");
    setOpen(false);
  };

  // Animation variants
  const containerVariants = {
    hidden: { 
      opacity: 0,
      scale: 0.95,
      y: 20
    },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        duration: 0.25,
        ease: "easeOut",
      } as any
    }
  };

  const buttonVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (custom: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: 0.2 + custom * 0.1,
        duration: 0.4
      }
    })
  };

  const iconVariants = {
    rest: { scale: 1 },
    hover: {
      scale: 1.05,
      transition: {
        duration: 0.2,
        ease: "easeOut",
      } as any
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <DialogHeader>
            <DialogTitle className="text-2xl font-light text-center">Welcome to BooGMe</DialogTitle>
            <DialogDescription className="text-center text-muted-foreground">
              Let's get you started. Are you here as a student or a coach?
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-1 gap-4 py-6">
            <motion.div
              custom={0}
              variants={buttonVariants}
              initial="hidden"
              animate="visible"
            >
              <motion.div
                initial="rest"
                whileHover="hover"
                animate="rest"
              >
                <Button
                  onClick={() => handleChoice("student")}
                  variant="outline"
                  className="w-full h-auto flex flex-col items-center gap-3 p-6 hover:bg-primary/5 hover:border-primary/50 transition-all"
                >
                  <motion.div variants={iconVariants}>
                    <GraduationCap className="h-12 w-12 text-primary" />
                  </motion.div>
                  <div className="text-center">
                    <div className="font-medium text-lg">I'm a Student</div>
                    <div className="text-sm text-muted-foreground font-light">
                      Find the perfect chess coach for my goals
                    </div>
                  </div>
                </Button>
              </motion.div>
            </motion.div>
            
            <motion.div
              custom={1}
              variants={buttonVariants}
              initial="hidden"
              animate="visible"
            >
              <motion.div
                initial="rest"
                whileHover="hover"
                animate="rest"
              >
                <Button
                  onClick={() => handleChoice("coach")}
                  variant="outline"
                  className="w-full h-auto flex flex-col items-center gap-3 p-6 hover:bg-primary/5 hover:border-primary/50 transition-all"
                >
                  <motion.div variants={iconVariants}>
                    <Users className="h-12 w-12 text-primary" />
                  </motion.div>
                  <div className="text-center">
                    <div className="font-medium text-lg">I'm a Coach</div>
                    <div className="text-sm text-muted-foreground font-light">
                      Join the marketplace and grow my coaching business
                    </div>
                  </div>
                </Button>
              </motion.div>
            </motion.div>
          </div>
          
          <motion.div 
            className="text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.4 }}
          >
            <button
              onClick={handleClose}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              I'll decide later
            </button>
          </motion.div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
