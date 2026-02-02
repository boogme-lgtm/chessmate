/*
 * DESIGN: Swiss Modern + Neo-Minimal - Coach Finder Quiz
 * Multi-step questionnaire simulating AI matching process
 * Clean, minimal aesthetic with burgundy/terracotta accents
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Brain, 
  ChevronRight, 
  ChevronLeft,
  Target,
  Clock,
  Zap,
  BookOpen,
  Trophy,
  Users,
  Star,
  Check,
  Loader2,
  Crown,
  MessageSquare
} from "lucide-react";
import React, { useState } from "react";

// Quiz questions data
const quizQuestions = [
  {
    id: "skill",
    title: "What's your current skill level?",
    subtitle: "This helps us find coaches who specialize in your range",
    icon: Target,
    options: [
      { value: "beginner", label: "Beginner", description: "Just learning the rules", rating: "Under 800" },
      { value: "intermediate", label: "Intermediate", description: "Know basic tactics", rating: "800-1400" },
      { value: "advanced", label: "Advanced", description: "Tournament player", rating: "1400-1800" },
      { value: "expert", label: "Expert", description: "Seeking master-level guidance", rating: "1800+" }
    ]
  },
  {
    id: "goal",
    title: "What's your primary goal?",
    subtitle: "We'll match you with coaches who excel in this area",
    icon: Trophy,
    options: [
      { value: "improve_rating", label: "Improve Rating", description: "Climb the ladder competitively", icon: "📈" },
      { value: "tournament_prep", label: "Tournament Prep", description: "Prepare for upcoming events", icon: "🏆" },
      { value: "opening_mastery", label: "Opening Mastery", description: "Build a solid repertoire", icon: "📚" },
      { value: "tactical_skills", label: "Tactical Skills", description: "Sharpen calculation ability", icon: "⚡" }
    ]
  },
  {
    id: "style",
    title: "What's your preferred playing style?",
    subtitle: "We'll find coaches who complement your approach",
    icon: Zap,
    options: [
      { value: "aggressive", label: "Aggressive", description: "Attack-minded, sharp positions" },
      { value: "positional", label: "Positional", description: "Strategic, long-term plans" },
      { value: "balanced", label: "Balanced", description: "Flexible, adapts to position" },
      { value: "defensive", label: "Solid/Defensive", description: "Safe, minimize risk" }
    ]
  },
  {
    id: "schedule",
    title: "How often can you practice?",
    subtitle: "This helps us recommend the right coaching intensity",
    icon: Clock,
    options: [
      { value: "casual", label: "Casual", description: "1-2 hours per week", sessions: "1 lesson/week" },
      { value: "regular", label: "Regular", description: "3-5 hours per week", sessions: "2 lessons/week" },
      { value: "serious", label: "Serious", description: "6-10 hours per week", sessions: "3 lessons/week" },
      { value: "intensive", label: "Intensive", description: "10+ hours per week", sessions: "Daily sessions" }
    ]
  },
  {
    id: "learning",
    title: "How do you learn best?",
    subtitle: "We'll match you with coaches who teach your way",
    icon: BookOpen,
    options: [
      { value: "visual", label: "Visual", description: "Diagrams, videos, demonstrations", icon: "👁️" },
      { value: "interactive", label: "Interactive", description: "Hands-on practice, puzzles", icon: "🎮" },
      { value: "analytical", label: "Analytical", description: "Deep game analysis, theory", icon: "🔬" },
      { value: "competitive", label: "Competitive", description: "Learn through playing games", icon: "⚔️" }
    ]
  }
];

// Mock coach data for results
const mockCoaches = [
  {
    id: 1,
    name: "GM Alexandra Chen",
    title: "Grandmaster",
    rating: 2650,
    specialty: "Positional Play",
    students: 234,
    rating_stars: 4.9,
    image: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=400&fit=crop",
    matchScore: 98,
    highlights: ["Opening specialist", "Patient teaching style", "Flexible schedule"]
  },
  {
    id: 2,
    name: "IM Marcus Rodriguez",
    title: "International Master",
    rating: 2480,
    specialty: "Tactical Training",
    students: 189,
    rating_stars: 4.8,
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop",
    matchScore: 94,
    highlights: ["Tactics expert", "Engaging lessons", "Tournament coach"]
  },
  {
    id: 3,
    name: "FM Sarah Mitchell",
    title: "FIDE Master",
    rating: 2350,
    specialty: "Opening Theory",
    students: 312,
    rating_stars: 5.0,
    image: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&h=400&fit=crop",
    matchScore: 91,
    highlights: ["Beginner friendly", "Structured curriculum", "Great communicator"]
  }
];

interface QuizAnswers {
  [key: string]: string;
}

export function CoachFinderQuiz() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswers>({});
  const [isMatching, setIsMatching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [matchProgress, setMatchProgress] = useState(0);

  const totalSteps = quizQuestions.length;
  const progress = ((currentStep) / totalSteps) * 100;
  const currentQuestion = quizQuestions[currentStep];

  const handleAnswer = (value: string) => {
    setAnswers(prev => ({ ...prev, [currentQuestion.id]: value }));
  };

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      startMatching();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const startMatching = () => {
    setIsMatching(true);
    setMatchProgress(0);
    
    const interval = setInterval(() => {
      setMatchProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setIsMatching(false);
            setShowResults(true);
          }, 500);
          return 100;
        }
        return prev + Math.random() * 15 + 5;
      });
    }, 200);
  };

  const resetQuiz = () => {
    setCurrentStep(0);
    setAnswers({});
    setIsMatching(false);
    setShowResults(false);
    setMatchProgress(0);
  };

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(resetQuiz, 300);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          size="lg" 
          className="bg-burgundy hover:bg-burgundy/90 text-white font-medium px-6"
        >
          <Brain className="mr-2 w-5 h-5" />
          Find Your Coach
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-2xl bg-background border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-burgundy flex items-center justify-center">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <span>
              {showResults ? "Your Perfect Matches" : isMatching ? "Finding Your Coaches" : "Coach Finder Quiz"}
            </span>
          </DialogTitle>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {/* Quiz Questions */}
          {!isMatching && !showResults && (
            <motion.div
              key={`question-${currentStep}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {/* Progress bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Question {currentStep + 1} of {totalSteps}</span>
                  <span>{Math.round(progress)}% complete</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>

              {/* Question */}
              <div className="text-center py-4">
                <div className="w-14 h-14 rounded-full bg-burgundy/10 flex items-center justify-center mx-auto mb-4">
                  <currentQuestion.icon className="w-7 h-7 text-burgundy" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{currentQuestion.title}</h3>
                <p className="text-muted-foreground text-sm">{currentQuestion.subtitle}</p>
              </div>

              {/* Options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {currentQuestion.options.map((option) => (
                  <Card
                    key={option.value}
                    className={`cursor-pointer transition-all duration-200 ${
                      answers[currentQuestion.id] === option.value
                        ? "border-burgundy bg-burgundy/5 shadow-sm"
                        : "border-border hover:border-burgundy/50"
                    }`}
                    onClick={() => handleAnswer(option.value)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          answers[currentQuestion.id] === option.value
                            ? "border-burgundy bg-burgundy"
                            : "border-muted-foreground"
                        }`}>
                          {answers[currentQuestion.id] === option.value && (
                            <Check className="w-3 h-3 text-white" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">{option.label}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">{option.description}</div>
                          {"rating" in option && (
                            <div className="text-xs font-mono text-burgundy mt-1">{option.rating}</div>
                          )}
                          {"sessions" in option && (
                            <div className="text-xs font-mono text-terracotta mt-1">{option.sessions}</div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Navigation */}
              <div className="flex justify-between pt-4 border-t border-border">
                <Button
                  variant="ghost"
                  onClick={handleBack}
                  disabled={currentStep === 0}
                  className="text-muted-foreground"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Back
                </Button>
                <Button
                  onClick={handleNext}
                  disabled={!answers[currentQuestion.id]}
                  className="bg-burgundy hover:bg-burgundy/90 text-white"
                >
                  {currentStep === totalSteps - 1 ? "Find Matches" : "Next"}
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* Matching Animation */}
          {isMatching && (
            <motion.div
              key="matching"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-12 text-center"
            >
              <div className="relative w-24 h-24 mx-auto mb-6">
                <div className="absolute inset-0 rounded-full bg-burgundy/10 animate-ping" />
                <div className="relative w-24 h-24 rounded-full bg-burgundy/20 flex items-center justify-center">
                  <Brain className="w-10 h-10 text-burgundy animate-pulse" />
                </div>
              </div>
              
              <h3 className="text-lg font-semibold mb-2">AI Matching in Progress</h3>
              <p className="text-muted-foreground text-sm mb-6">
                Analyzing your preferences and finding the best coaches...
              </p>
              
              <div className="max-w-xs mx-auto space-y-3">
                <Progress value={Math.min(matchProgress, 100)} className="h-2" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Analyzing profile...</span>
                  <span>{Math.round(Math.min(matchProgress, 100))}%</span>
                </div>
              </div>
              
              <div className="mt-8 space-y-2 text-sm text-muted-foreground">
                {matchProgress > 20 && (
                  <motion.div 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }}
                    className="flex items-center justify-center gap-2"
                  >
                    <Check className="w-4 h-4 text-burgundy" />
                    <span>Skill level analyzed</span>
                  </motion.div>
                )}
                {matchProgress > 40 && (
                  <motion.div 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }}
                    className="flex items-center justify-center gap-2"
                  >
                    <Check className="w-4 h-4 text-burgundy" />
                    <span>Goals matched</span>
                  </motion.div>
                )}
                {matchProgress > 60 && (
                  <motion.div 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }}
                    className="flex items-center justify-center gap-2"
                  >
                    <Check className="w-4 h-4 text-burgundy" />
                    <span>Style compatibility checked</span>
                  </motion.div>
                )}
                {matchProgress > 80 && (
                  <motion.div 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }}
                    className="flex items-center justify-center gap-2"
                  >
                    <Check className="w-4 h-4 text-burgundy" />
                    <span>Schedule alignment verified</span>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}

          {/* Results */}
          {showResults && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="text-center py-4">
                <div className="badge-burgundy inline-flex mb-3">
                  <Check className="w-4 h-4 mr-1" />
                  3 Perfect Matches Found
                </div>
                <p className="text-muted-foreground text-sm">
                  Based on your preferences, here are your top coach matches
                </p>
              </div>

              <div className="space-y-4">
                {mockCoaches.map((coach, index) => (
                  <motion.div
                    key={coach.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Card className="border-border hover:border-burgundy/30 transition-colors">
                      <CardContent className="p-4">
                        <div className="flex gap-4">
                          <div className="relative flex-shrink-0">
                            <img 
                              src={coach.image} 
                              alt={coach.name}
                              className="w-16 h-16 rounded-lg object-cover"
                            />
                            <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-burgundy text-white flex items-center justify-center text-xs font-bold">
                              {coach.matchScore}%
                            </div>
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h4 className="font-semibold">{coach.name}</h4>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <span className="badge-burgundy text-xs py-0.5">{coach.title}</span>
                                  <span className="font-mono">{coach.rating}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <Star className="w-4 h-4 text-gold fill-gold" />
                                <span className="text-sm font-medium">{coach.rating_stars}</span>
                              </div>
                            </div>
                            
                            <div className="mt-2 flex flex-wrap gap-1">
                              {coach.highlights.map((highlight) => (
                                <span 
                                  key={highlight}
                                  className="text-xs bg-muted px-2 py-0.5 rounded"
                                >
                                  {highlight}
                                </span>
                              ))}
                            </div>
                            
                            <div className="mt-3 flex items-center justify-between">
                              <div className="text-xs text-muted-foreground">
                                <Users className="w-3 h-3 inline mr-1" />
                                {coach.students} students
                              </div>
                              <Button size="sm" variant="outline" className="text-xs h-7 border-burgundy text-burgundy hover:bg-burgundy/5">
                                <MessageSquare className="w-3 h-3 mr-1" />
                                Book Trial
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>

              <div className="flex gap-3 pt-4 border-t border-border">
                <Button
                  variant="outline"
                  onClick={resetQuiz}
                  className="flex-1"
                >
                  Retake Quiz
                </Button>
                <Button
                  onClick={handleClose}
                  className="flex-1 bg-burgundy hover:bg-burgundy/90 text-white"
                >
                  Browse All Coaches
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
