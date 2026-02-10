import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Users, GraduationCap } from "lucide-react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";

export function WelcomePopup({ onOpenAssessment }: { onOpenAssessment: () => void }) {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Check if user has seen the popup before
    const hasSeenPopup = localStorage.getItem("hasSeenWelcomePopup");
    
    // Only show popup on homepage and if not seen before
    if (!hasSeenPopup && window.location.pathname === "/") {
      // Delay popup slightly for better UX
      const timer = setTimeout(() => {
        setOpen(true);
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, []);

  const handleChoice = (userType: "student" | "coach") => {
    // Mark as seen
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
  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { duration: 0.3 }
    },
    exit: { 
      opacity: 0,
      transition: { duration: 0.2 }
    }
  };

  const modalVariants = {
    hidden: { 
      opacity: 0,
      scale: 0.9,
      y: 20
    },
    visible: { 
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        type: "spring",
        damping: 25,
        stiffness: 300
      } as any
    },
    exit: { 
      opacity: 0,
      scale: 0.95,
      transition: { duration: 0.2 }
    }
  };

  const buttonVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (custom: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: custom * 0.1,
        duration: 0.4
      }
    })
  };

  const iconVariants = {
    rest: { scale: 1 },
    hover: { 
      scale: 1.1,
      transition: {
        type: "spring",
        stiffness: 400,
        damping: 10
      } as any
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md" asChild>
        <motion.div
          variants={modalVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
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
            transition={{ delay: 0.3, duration: 0.4 }}
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
