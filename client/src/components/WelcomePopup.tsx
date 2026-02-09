import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Users, GraduationCap } from "lucide-react";
import { useLocation } from "wouter";

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

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-light text-center">Welcome to BooGMe</DialogTitle>
          <DialogDescription className="text-center text-muted-foreground">
            Let's get you started. Are you here as a student or a coach?
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-1 gap-4 py-6">
          <Button
            onClick={() => handleChoice("student")}
            variant="outline"
            className="h-auto flex flex-col items-center gap-3 p-6 hover:bg-primary/5 hover:border-primary/50 transition-all"
          >
            <GraduationCap className="h-12 w-12 text-primary" />
            <div className="text-center">
              <div className="font-medium text-lg">I'm a Student</div>
              <div className="text-sm text-muted-foreground font-light">
                Find the perfect chess coach for my goals
              </div>
            </div>
          </Button>
          
          <Button
            onClick={() => handleChoice("coach")}
            variant="outline"
            className="h-auto flex flex-col items-center gap-3 p-6 hover:bg-primary/5 hover:border-primary/50 transition-all"
          >
            <Users className="h-12 w-12 text-primary" />
            <div className="text-center">
              <div className="font-medium text-lg">I'm a Coach</div>
              <div className="text-sm text-muted-foreground font-light">
                Join the marketplace and grow my coaching business
              </div>
            </div>
          </Button>
        </div>
        
        <div className="text-center">
          <button
            onClick={handleClose}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            I'll decide later
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
