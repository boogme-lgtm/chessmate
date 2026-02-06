import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Target,
  Brain,
  Calendar,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";

interface AssessmentData {
  // Section 1: Chess Journey
  rating: number;
  ratingSystem: string;
  yearsPlaying: string;
  competitiveExperience: string[];
  improvementAreas: string[];

  // Section 2: Learning Goals
  primaryGoal: string;
  timeline: string;
  targetImprovement: number;

  // Section 3: Learning Style
  teachingArchetype: string;
  learningMethods: string[];
  feedbackStyle: number;
  lessonPace: string;

  // Section 4: Practical Details
  budgetMin: number;
  budgetMax: number;
  lessonFrequency: string;
  timezone: string;
  availability: string[];
  lessonFormat: string;

  // Section 5: Personality & Preferences
  communicationPreference: string;
  motivations: string[];
  techComfort: number;
  styleIcon: string;
  credentialImportance: string;
}

const TOTAL_QUESTIONS = 20;
const SECTIONS = 5;

export function CoachMatchingAssessment({ onClose }: { onClose: () => void }) {
  const [currentSection, setCurrentSection] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState(0);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [isSubmittingWaitlist, setIsSubmittingWaitlist] = useState(false);

  const addToWaitlistMutation = trpc.waitlist.join.useMutation();

  const [data, setData] = useState<Partial<AssessmentData>>({
    rating: 1200,
    ratingSystem: "lichess",
    competitiveExperience: [],
    improvementAreas: [],
    learningMethods: [],
    feedbackStyle: 5,
    budgetMin: 50,
    budgetMax: 100,
    availability: [],
    motivations: [],
    techComfort: 5,
    targetImprovement: 200,
  });

  const updateData = (key: keyof AssessmentData, value: any) => {
    setData((prev) => ({ ...prev, [key]: value }));
  };

  const toggleArrayItem = (key: keyof AssessmentData, value: string) => {
    const current = (data[key] as string[]) || [];
    if (current.includes(value)) {
      updateData(
        key,
        current.filter((item) => item !== value)
      );
    } else {
      updateData(key, [...current, value]);
    }
  };

  const progress = ((currentQuestion + 1) / TOTAL_QUESTIONS) * 100;

  const handleNext = () => {
    if (currentQuestion < TOTAL_QUESTIONS - 1) {
      setCurrentQuestion(currentQuestion + 1);
      if ((currentQuestion + 1) % 4 === 0) {
        setCurrentSection(Math.floor((currentQuestion + 1) / 4));
      }
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
      setCurrentSection(Math.floor((currentQuestion - 1) / 4));
    }
  };

  const handleSubmit = async () => {
    setIsProcessing(true);
    const steps = [
      "Analyzing your chess background...",
      "Evaluating learning style preferences...",
      "Matching with coach profiles...",
      "Calculating compatibility scores...",
      "Preparing your personalized recommendations...",
    ];

    for (let i = 0; i < steps.length; i++) {
      setProcessingStep(i);
      await new Promise((resolve) => setTimeout(resolve, 1200));
    }

    setIsProcessing(false);
    setShowResults(true);
  };

  const renderQuestion = () => {
    switch (currentQuestion) {
      // SECTION 1: Chess Journey
      case 0:
        return (
          <QuestionCard
            title="What's your current chess rating?"
            icon={<Target className="w-6 h-6" />}
          >
            <div className="space-y-6">
              <div className="text-center">
                <div className="text-5xl font-thin text-[#8B4513] mb-2">
                  {data.rating || 1200}
                </div>
                <div className="text-sm text-neutral-400">
                  {(data.rating || 1200) < 1000
                    ? "Beginner"
                    : (data.rating || 1200) < 1600
                      ? "Intermediate"
                      : (data.rating || 1200) < 2000
                        ? "Advanced"
                        : (data.rating || 1200) < 2200
                          ? "Expert"
                          : "Master"}
                </div>
              </div>
              <Slider
                value={[data.rating || 1200]}
                onValueChange={([value]) => updateData("rating", value)}
                min={0}
                max={2800}
                step={50}
                className="w-full"
              />
              <Select
                value={data.ratingSystem}
                onValueChange={(value) => updateData("ratingSystem", value)}
              >
                <SelectTrigger className="bg-black/20 border-neutral-700">
                  <SelectValue placeholder="Rating system" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lichess">Lichess</SelectItem>
                  <SelectItem value="chesscom">Chess.com</SelectItem>
                  <SelectItem value="fide">FIDE</SelectItem>
                  <SelectItem value="uscf">USCF</SelectItem>
                  <SelectItem value="unrated">Unrated</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </QuestionCard>
        );

      case 1:
        return (
          <QuestionCard
            title="How long have you been playing chess?"
            icon={<Calendar className="w-6 h-6" />}
          >
            <RadioGroup
              value={data.yearsPlaying}
              onValueChange={(value) => updateData("yearsPlaying", value)}
              className="space-y-3"
            >
              {[
                { value: "beginner", label: "Just starting out (< 1 year)" },
                {
                  value: "building",
                  label: "Building foundations (1-3 years)",
                },
                {
                  value: "experienced",
                  label: "Experienced player (3-7 years)",
                },
                { value: "veteran", label: "Veteran (7-15 years)" },
                { value: "lifelong", label: "Lifelong player (15+ years)" },
              ].map((option) => (
                <div
                  key={option.value}
                  className="flex items-center space-x-3 p-4 rounded-lg border border-neutral-700 hover:border-[#8B4513] hover:bg-[#8B4513]/5 transition-colors cursor-pointer"
                  onClick={() => updateData("yearsPlaying", option.value)}
                >
                  <RadioGroupItem value={option.value} id={option.value} />
                  <Label
                    htmlFor={option.value}
                    className="flex-1 cursor-pointer"
                  >
                    {option.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </QuestionCard>
        );

      case 2:
        return (
          <QuestionCard
            title="What's your competitive experience?"
            subtitle="Select all that apply"
            icon={<Users className="w-6 h-6" />}
          >
            <div className="space-y-3">
              {[
                "Casual online play",
                "Local club tournaments",
                "State/regional championships",
                "National tournaments",
                "International competitions",
                "Titled player (CM/FM/IM/GM)",
                "Don't compete, just enjoy playing",
              ].map((option) => (
                <div
                  key={option}
                  className="flex items-center space-x-3 p-4 rounded-lg border border-neutral-700 hover:border-[#8B4513] hover:bg-[#8B4513]/5 transition-colors cursor-pointer"
                  onClick={() =>
                    toggleArrayItem("competitiveExperience", option)
                  }
                >
                  <Checkbox
                    checked={data.competitiveExperience?.includes(option)}
                    onCheckedChange={() =>
                      toggleArrayItem("competitiveExperience", option)
                    }
                  />
                  <Label className="flex-1 cursor-pointer">{option}</Label>
                </div>
              ))}
            </div>
          </QuestionCard>
        );

      case 3:
        return (
          <QuestionCard
            title="Which area needs the most improvement?"
            subtitle="Select up to 3 priorities"
            icon={<Target className="w-6 h-6" />}
          >
            <div className="space-y-3">
              {[
                "Opening preparation",
                "Tactical calculation",
                "Positional understanding",
                "Endgame technique",
                "Time management",
                "Mental game / psychology",
                "Tournament preparation",
                "Game analysis skills",
              ].map((option) => (
                <div
                  key={option}
                  className="flex items-center space-x-3 p-4 rounded-lg border border-neutral-700 hover:border-[#8B4513] hover:bg-[#8B4513]/5 transition-colors cursor-pointer"
                  onClick={() => {
                    if (
                      data.improvementAreas?.includes(option) ||
                      (data.improvementAreas?.length || 0) < 3
                    ) {
                      toggleArrayItem("improvementAreas", option);
                    } else {
                      toast.error("You can select up to 3 priorities");
                    }
                  }}
                >
                  <Checkbox
                    checked={data.improvementAreas?.includes(option)}
                    onCheckedChange={() => {
                      if (
                        data.improvementAreas?.includes(option) ||
                        (data.improvementAreas?.length || 0) < 3
                      ) {
                        toggleArrayItem("improvementAreas", option);
                      }
                    }}
                  />
                  <Label className="flex-1 cursor-pointer">{option}</Label>
                </div>
              ))}
            </div>
          </QuestionCard>
        );

      // SECTION 2: Learning Goals
      case 4:
        return (
          <QuestionCard
            title="What's your primary goal with coaching?"
            icon={<Target className="w-6 h-6" />}
          >
            <div className="space-y-3">
              {[
                {
                  value: "rating",
                  emoji: "🎯",
                  label: "Reach a specific rating target",
                  desc: "I have a clear number in mind",
                },
                {
                  value: "competitive",
                  emoji: "🏆",
                  label: "Competitive success",
                  desc: "Win tournaments and titles",
                },
                {
                  value: "understanding",
                  emoji: "📚",
                  label: "Deep understanding",
                  desc: "Master chess concepts and theory",
                },
                {
                  value: "enjoyment",
                  emoji: "🎮",
                  label: "Enjoyment",
                  desc: "Play better and have more fun",
                },
                {
                  value: "coaching",
                  emoji: "👨‍🏫",
                  label: "Become a coach",
                  desc: "Learn to teach others",
                },
                {
                  value: "intellectual",
                  emoji: "🧠",
                  label: "Intellectual challenge",
                  desc: "Exercise my mind",
                },
              ].map((option) => (
                <div
                  key={option.value}
                  className={`p-4 rounded-lg border cursor-pointer transition-all ${
                    data.primaryGoal === option.value
                      ? "border-[#8B4513] bg-[#8B4513]/10"
                      : "border-neutral-700 hover:border-[#8B4513] hover:bg-[#8B4513]/5"
                  }`}
                  onClick={() => updateData("primaryGoal", option.value)}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{option.emoji}</span>
                    <div className="flex-1">
                      <div className="font-medium">{option.label}</div>
                      <div className="text-sm text-neutral-400">
                        {option.desc}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </QuestionCard>
        );

      case 5:
        return (
          <QuestionCard
            title="What's your timeline?"
            icon={<Calendar className="w-6 h-6" />}
          >
            <RadioGroup
              value={data.timeline}
              onValueChange={(value) => updateData("timeline", value)}
              className="space-y-3"
            >
              {[
                {
                  value: "urgent",
                  emoji: "🚀",
                  label: "Urgent (1-3 months)",
                  desc: "Preparing for a specific event",
                },
                {
                  value: "intensive",
                  emoji: "⚡",
                  label: "Intensive (3-6 months)",
                  desc: "Want rapid improvement",
                },
                {
                  value: "steady",
                  emoji: "📈",
                  label: "Steady (6-12 months)",
                  desc: "Consistent growth",
                },
                {
                  value: "patient",
                  emoji: "🌱",
                  label: "Patient (1+ years)",
                  desc: "Long-term development",
                },
                {
                  value: "flexible",
                  emoji: "🔄",
                  label: "Flexible",
                  desc: "No specific timeline",
                },
              ].map((option) => (
                <div
                  key={option.value}
                  className="flex items-center space-x-3 p-4 rounded-lg border border-neutral-700 hover:border-[#8B4513] hover:bg-[#8B4513]/5 transition-colors cursor-pointer"
                  onClick={() => updateData("timeline", option.value)}
                >
                  <RadioGroupItem value={option.value} id={option.value} />
                  <span className="text-xl">{option.emoji}</span>
                  <div className="flex-1">
                    <Label
                      htmlFor={option.value}
                      className="cursor-pointer font-medium"
                    >
                      {option.label}
                    </Label>
                    <div className="text-sm text-neutral-400">
                      {option.desc}
                    </div>
                  </div>
                </div>
              ))}
            </RadioGroup>
          </QuestionCard>
        );

      case 6:
        return (
          <QuestionCard
            title="What's your target rating improvement?"
            icon={<Target className="w-6 h-6" />}
          >
            <div className="space-y-6">
              <div className="text-center">
                <div className="text-5xl font-thin text-[#8B4513] mb-2">
                  +{data.targetImprovement}
                </div>
                <div className="text-sm text-neutral-400">rating points</div>
              </div>
              <Slider
                value={[data.targetImprovement || 200]}
                onValueChange={([value]) =>
                  updateData("targetImprovement", value)
                }
                min={0}
                max={600}
                step={50}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-neutral-500">
                <span>Not focused on rating</span>
                <span>Complete mastery</span>
              </div>
            </div>
          </QuestionCard>
        );

      // SECTION 3: Learning Style
      case 7:
        return (
          <QuestionCard
            title="Which teaching archetype resonates with you?"
            icon={<Brain className="w-6 h-6" />}
          >
            <div className="space-y-3">
              {[
                {
                  value: "sage",
                  emoji: "🧙",
                  label: "The Chess Sage",
                  desc: "Patient, philosophical, self-discovery approach",
                  best: "Independent thinkers",
                },
                {
                  value: "master",
                  emoji: "📚",
                  label: "The Disciplined Master",
                  desc: "Structured curriculum, high standards",
                  best: "Serious systematic learners",
                },
                {
                  value: "guide",
                  emoji: "🌱",
                  label: "The Supportive Guide",
                  desc: "Empathetic, encouraging, confidence-building",
                  best: "Need positive reinforcement",
                },
                {
                  value: "innovator",
                  emoji: "🔬",
                  label: "The Creative Innovator",
                  desc: "Unconventional methods, fun and memorable",
                  best: "Visual learners",
                },
                {
                  value: "coach",
                  emoji: "🏈",
                  label: "The Motivational Coach",
                  desc: "Inspirational, mental toughness, competitive mindset",
                  best: "Tournament players",
                },
              ].map((option) => (
                <div
                  key={option.value}
                  className={`p-4 rounded-lg border cursor-pointer transition-all ${
                    data.teachingArchetype === option.value
                      ? "border-[#8B4513] bg-[#8B4513]/10"
                      : "border-neutral-700 hover:border-[#8B4513] hover:bg-[#8B4513]/5"
                  }`}
                  onClick={() => updateData("teachingArchetype", option.value)}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{option.emoji}</span>
                    <div className="flex-1">
                      <div className="font-medium">{option.label}</div>
                      <div className="text-sm text-neutral-400">
                        {option.desc}
                      </div>
                      <div className="text-xs text-neutral-500 mt-1">
                        Best for: {option.best}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </QuestionCard>
        );

      case 8:
        return (
          <QuestionCard
            title="How do you prefer to learn?"
            subtitle="Select up to 3 methods"
            icon={<Brain className="w-6 h-6" />}
          >
            <div className="space-y-3">
              {[
                "📖 Studying master games together",
                "🎯 Solving tactical puzzles",
                "♟️ Playing training games with analysis",
                "📊 Structured lessons with theory",
                "🎥 Video analysis of my games",
                "💬 Interactive discussion and Q&A",
                "📝 Homework assignments and exercises",
                "🎮 Online blitz/rapid with commentary",
              ].map((option) => (
                <div
                  key={option}
                  className="flex items-center space-x-3 p-4 rounded-lg border border-neutral-700 hover:border-[#8B4513] hover:bg-[#8B4513]/5 transition-colors cursor-pointer"
                  onClick={() => {
                    if (
                      data.learningMethods?.includes(option) ||
                      (data.learningMethods?.length || 0) < 3
                    ) {
                      toggleArrayItem("learningMethods", option);
                    } else {
                      toast.error("You can select up to 3 methods");
                    }
                  }}
                >
                  <Checkbox
                    checked={data.learningMethods?.includes(option)}
                    onCheckedChange={() => {
                      if (
                        data.learningMethods?.includes(option) ||
                        (data.learningMethods?.length || 0) < 3
                      ) {
                        toggleArrayItem("learningMethods", option);
                      }
                    }}
                  />
                  <Label className="flex-1 cursor-pointer">{option}</Label>
                </div>
              ))}
            </div>
          </QuestionCard>
        );

      case 9:
        return (
          <QuestionCard
            title="What feedback style works best for you?"
            icon={<Brain className="w-6 h-6" />}
          >
            <div className="space-y-6">
              <div className="text-center">
                <div className="text-lg text-neutral-300 mb-2">
                  {data.feedbackStyle! < 4
                    ? "Direct & Blunt"
                    : data.feedbackStyle! > 6
                      ? "Gentle & Encouraging"
                      : "Balanced"}
                </div>
                <div className="text-sm text-neutral-500">
                  {data.feedbackStyle! < 4
                    ? "Tell me exactly what I'm doing wrong"
                    : data.feedbackStyle! > 6
                      ? "Focus on what I'm doing right"
                      : "Mix of constructive criticism and praise"}
                </div>
              </div>
              <Slider
                value={[data.feedbackStyle || 5]}
                onValueChange={([value]) => updateData("feedbackStyle", value)}
                min={1}
                max={10}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-neutral-500">
                <span>Direct</span>
                <span>Balanced</span>
                <span>Gentle</span>
              </div>
            </div>
          </QuestionCard>
        );

      case 10:
        return (
          <QuestionCard
            title="What's your ideal lesson pace?"
            icon={<Brain className="w-6 h-6" />}
          >
            <RadioGroup
              value={data.lessonPace}
              onValueChange={(value) => updateData("lessonPace", value)}
              className="space-y-3"
            >
              {[
                {
                  value: "fast",
                  emoji: "🐇",
                  label: "Fast-paced",
                  desc: "Cover lots of material quickly",
                },
                {
                  value: "balanced",
                  emoji: "⚖️",
                  label: "Balanced",
                  desc: "Mix of depth and breadth",
                },
                {
                  value: "deep",
                  emoji: "🐢",
                  label: "Deep-dive",
                  desc: "Thoroughly explore each concept",
                },
                {
                  value: "adaptive",
                  emoji: "🎯",
                  label: "Adaptive",
                  desc: "Let the coach decide based on my progress",
                },
              ].map((option) => (
                <div
                  key={option.value}
                  className="flex items-center space-x-3 p-4 rounded-lg border border-neutral-700 hover:border-[#8B4513] hover:bg-[#8B4513]/5 transition-colors cursor-pointer"
                  onClick={() => updateData("lessonPace", option.value)}
                >
                  <RadioGroupItem value={option.value} id={option.value} />
                  <span className="text-xl">{option.emoji}</span>
                  <div className="flex-1">
                    <Label
                      htmlFor={option.value}
                      className="cursor-pointer font-medium"
                    >
                      {option.label}
                    </Label>
                    <div className="text-sm text-neutral-400">
                      {option.desc}
                    </div>
                  </div>
                </div>
              ))}
            </RadioGroup>
          </QuestionCard>
        );

      // SECTION 4: Practical Details
      case 11:
        return (
          <QuestionCard
            title="What's your budget per lesson?"
            subtitle="Most students start at $50-100 per hour"
            icon={<Target className="w-6 h-6" />}
          >
            <div className="space-y-6">
              <div className="text-center">
                <div className="text-4xl font-thin text-[#8B4513] mb-2">
                  ${data.budgetMin} - ${data.budgetMax}
                </div>
                <div className="text-sm text-neutral-400">per hour</div>
              </div>
              <div className="space-y-4">
                <div>
                  <Label className="text-sm text-neutral-400 mb-2 block">
                    Minimum: ${data.budgetMin}
                  </Label>
                  <Slider
                    value={[data.budgetMin || 50]}
                    onValueChange={([value]) => updateData("budgetMin", value)}
                    min={25}
                    max={400}
                    step={25}
                    className="w-full"
                  />
                </div>
                <div>
                  <Label className="text-sm text-neutral-400 mb-2 block">
                    Maximum: ${data.budgetMax}
                  </Label>
                  <Slider
                    value={[data.budgetMax || 100]}
                    onValueChange={([value]) => updateData("budgetMax", value)}
                    min={25}
                    max={400}
                    step={25}
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          </QuestionCard>
        );

      case 12:
        return (
          <QuestionCard
            title="How often do you want lessons?"
            icon={<Calendar className="w-6 h-6" />}
          >
            <RadioGroup
              value={data.lessonFrequency}
              onValueChange={(value) => updateData("lessonFrequency", value)}
              className="space-y-3"
            >
              {[
                {
                  value: "intensive",
                  emoji: "💪",
                  label: "Intensive",
                  desc: "3+ times per week",
                },
                {
                  value: "regular",
                  emoji: "📅",
                  label: "Regular",
                  desc: "2 times per week",
                },
                {
                  value: "weekly",
                  emoji: "🗓️",
                  label: "Weekly",
                  desc: "Once per week",
                },
                {
                  value: "biweekly",
                  emoji: "🌙",
                  label: "Bi-weekly",
                  desc: "Every two weeks",
                },
                {
                  value: "flexible",
                  emoji: "🎯",
                  label: "Flexible",
                  desc: "As needed for tournaments/events",
                },
              ].map((option) => (
                <div
                  key={option.value}
                  className="flex items-center space-x-3 p-4 rounded-lg border border-neutral-700 hover:border-[#8B4513] hover:bg-[#8B4513]/5 transition-colors cursor-pointer"
                  onClick={() => updateData("lessonFrequency", option.value)}
                >
                  <RadioGroupItem value={option.value} id={option.value} />
                  <span className="text-xl">{option.emoji}</span>
                  <div className="flex-1">
                    <Label
                      htmlFor={option.value}
                      className="cursor-pointer font-medium"
                    >
                      {option.label}
                    </Label>
                    <div className="text-sm text-neutral-400">
                      {option.desc}
                    </div>
                  </div>
                </div>
              ))}
            </RadioGroup>
          </QuestionCard>
        );

      case 13:
        return (
          <QuestionCard
            title="What's your timezone and availability?"
            icon={<Calendar className="w-6 h-6" />}
          >
            <div className="space-y-6">
              <div>
                <Label className="text-sm text-neutral-400 mb-2 block">
                  Timezone
                </Label>
                <Select
                  value={data.timezone}
                  onValueChange={(value) => updateData("timezone", value)}
                >
                  <SelectTrigger className="bg-black/20 border-neutral-700">
                    <SelectValue placeholder="Select timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="America/New_York">
                      Eastern (ET)
                    </SelectItem>
                    <SelectItem value="America/Chicago">Central (CT)</SelectItem>
                    <SelectItem value="America/Denver">
                      Mountain (MT)
                    </SelectItem>
                    <SelectItem value="America/Los_Angeles">
                      Pacific (PT)
                    </SelectItem>
                    <SelectItem value="Europe/London">London (GMT)</SelectItem>
                    <SelectItem value="Europe/Paris">
                      Central Europe (CET)
                    </SelectItem>
                    <SelectItem value="Asia/Kolkata">India (IST)</SelectItem>
                    <SelectItem value="Asia/Shanghai">China (CST)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm text-neutral-400 mb-3 block">
                  Preferred times (select all that apply)
                </Label>
                <div className="space-y-2">
                  {[
                    "Early morning (6am-9am)",
                    "Morning (9am-12pm)",
                    "Afternoon (12pm-5pm)",
                    "Evening (5pm-9pm)",
                    "Late night (9pm-12am)",
                    "Weekends only",
                    "Flexible",
                  ].map((option) => (
                    <div
                      key={option}
                      className="flex items-center space-x-3 p-3 rounded-lg border border-neutral-700 hover:border-[#8B4513] hover:bg-[#8B4513]/5 transition-colors cursor-pointer"
                      onClick={() => toggleArrayItem("availability", option)}
                    >
                      <Checkbox
                        checked={data.availability?.includes(option)}
                        onCheckedChange={() =>
                          toggleArrayItem("availability", option)
                        }
                      />
                      <Label className="flex-1 cursor-pointer text-sm">
                        {option}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </QuestionCard>
        );

      case 14:
        return (
          <QuestionCard
            title="Lesson format preference?"
            icon={<Users className="w-6 h-6" />}
          >
            <RadioGroup
              value={data.lessonFormat}
              onValueChange={(value) => updateData("lessonFormat", value)}
              className="space-y-3"
            >
              {[
                {
                  value: "online",
                  emoji: "💻",
                  label: "Online only",
                  desc: "Video call + shared board",
                },
                {
                  value: "inperson",
                  emoji: "🤝",
                  label: "In-person only",
                  desc: "If available in my area",
                },
                {
                  value: "hybrid",
                  emoji: "🔄",
                  label: "Hybrid",
                  desc: "Mix of both",
                },
                {
                  value: "flexible",
                  emoji: "📱",
                  label: "Flexible",
                  desc: "Whatever works best",
                },
              ].map((option) => (
                <div
                  key={option.value}
                  className="flex items-center space-x-3 p-4 rounded-lg border border-neutral-700 hover:border-[#8B4513] hover:bg-[#8B4513]/5 transition-colors cursor-pointer"
                  onClick={() => updateData("lessonFormat", option.value)}
                >
                  <RadioGroupItem value={option.value} id={option.value} />
                  <span className="text-xl">{option.emoji}</span>
                  <div className="flex-1">
                    <Label
                      htmlFor={option.value}
                      className="cursor-pointer font-medium"
                    >
                      {option.label}
                    </Label>
                    <div className="text-sm text-neutral-400">
                      {option.desc}
                    </div>
                  </div>
                </div>
              ))}
            </RadioGroup>
          </QuestionCard>
        );

      // SECTION 5: Personality & Preferences
      case 15:
        return (
          <QuestionCard
            title="How do you communicate best?"
            icon={<Users className="w-6 h-6" />}
          >
            <RadioGroup
              value={data.communicationPreference}
              onValueChange={(value) =>
                updateData("communicationPreference", value)
              }
              className="space-y-3"
            >
              {[
                {
                  value: "frequent",
                  emoji: "💬",
                  label: "Frequent messages",
                  desc: "I like staying in touch between lessons",
                },
                {
                  value: "occasional",
                  emoji: "📧",
                  label: "Occasional check-ins",
                  desc: "Updates when needed",
                },
                {
                  value: "lessononly",
                  emoji: "📅",
                  label: "Lesson-time only",
                  desc: "Keep communication to scheduled sessions",
                },
                {
                  value: "flexible",
                  emoji: "🎯",
                  label: "Flexible",
                  desc: "Whatever the coach prefers",
                },
              ].map((option) => (
                <div
                  key={option.value}
                  className="flex items-center space-x-3 p-4 rounded-lg border border-neutral-700 hover:border-[#8B4513] hover:bg-[#8B4513]/5 transition-colors cursor-pointer"
                  onClick={() =>
                    updateData("communicationPreference", option.value)
                  }
                >
                  <RadioGroupItem value={option.value} id={option.value} />
                  <span className="text-xl">{option.emoji}</span>
                  <div className="flex-1">
                    <Label
                      htmlFor={option.value}
                      className="cursor-pointer font-medium"
                    >
                      {option.label}
                    </Label>
                    <div className="text-sm text-neutral-400">
                      {option.desc}
                    </div>
                  </div>
                </div>
              ))}
            </RadioGroup>
          </QuestionCard>
        );

      case 16:
        return (
          <QuestionCard
            title="What motivates you most in chess?"
            subtitle="Select up to 3"
            icon={<Target className="w-6 h-6" />}
          >
            <div className="space-y-3">
              {[
                "🏆 Winning and competition",
                "🧩 Solving complex problems",
                "📚 Mastering theory and knowledge",
                "👥 Social connection and community",
                "🎨 Creative expression and beauty",
                "🧠 Intellectual challenge",
                "💰 Potential professional career",
              ].map((option) => (
                <div
                  key={option}
                  className="flex items-center space-x-3 p-4 rounded-lg border border-neutral-700 hover:border-[#8B4513] hover:bg-[#8B4513]/5 transition-colors cursor-pointer"
                  onClick={() => {
                    if (
                      data.motivations?.includes(option) ||
                      (data.motivations?.length || 0) < 3
                    ) {
                      toggleArrayItem("motivations", option);
                    } else {
                      toast.error("You can select up to 3 motivations");
                    }
                  }}
                >
                  <Checkbox
                    checked={data.motivations?.includes(option)}
                    onCheckedChange={() => {
                      if (
                        data.motivations?.includes(option) ||
                        (data.motivations?.length || 0) < 3
                      ) {
                        toggleArrayItem("motivations", option);
                      }
                    }}
                  />
                  <Label className="flex-1 cursor-pointer">{option}</Label>
                </div>
              ))}
            </div>
          </QuestionCard>
        );

      case 17:
        return (
          <QuestionCard
            title="How comfortable are you with technology?"
            icon={<Brain className="w-6 h-6" />}
          >
            <div className="space-y-6">
              <div className="text-center">
                <div className="text-lg text-neutral-300 mb-2">
                  {data.techComfort! < 4
                    ? "Prefer Simple"
                    : data.techComfort! > 7
                      ? "Tech-Savvy"
                      : "Comfortable"}
                </div>
                <div className="text-sm text-neutral-500">
                  {data.techComfort! < 4
                    ? "Just video call and physical board if possible"
                    : data.techComfort! > 7
                      ? "I use chess engines, databases, and multiple platforms"
                      : "I can handle video calls and online boards"}
                </div>
              </div>
              <Slider
                value={[data.techComfort || 5]}
                onValueChange={([value]) => updateData("techComfort", value)}
                min={1}
                max={10}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-neutral-500">
                <span>Simple</span>
                <span>Comfortable</span>
                <span>Tech-savvy</span>
              </div>
            </div>
          </QuestionCard>
        );

      case 18:
        return (
          <QuestionCard
            title="Which famous player's style resonates with you?"
            icon={<Users className="w-6 h-6" />}
          >
            <div className="space-y-3">
              {[
                {
                  value: "tal",
                  label: "Mikhail Tal",
                  desc: "Aggressive, tactical, sacrificial",
                  emoji: "⚔️",
                },
                {
                  value: "petrosian",
                  label: "Tigran Petrosian",
                  desc: "Defensive genius, prophylactic",
                  emoji: "🏰",
                },
                {
                  value: "carlsen",
                  label: "Magnus Carlsen",
                  desc: "Universal, endgame master, practical",
                  emoji: "👑",
                },
                {
                  value: "kasparov",
                  label: "Garry Kasparov",
                  desc: "Dynamic, aggressive, theoretical",
                  emoji: "⚡",
                },
                {
                  value: "fischer",
                  label: "Bobby Fischer",
                  desc: "Precise, classical, technical",
                  emoji: "🎯",
                },
                {
                  value: "karpov",
                  label: "Anatoly Karpov",
                  desc: "Positional, strategic, patient",
                  emoji: "🔬",
                },
                {
                  value: "polgar",
                  label: "Judit Polgár",
                  desc: "Fearless, attacking, creative",
                  emoji: "🎨",
                },
                {
                  value: "mixed",
                  label: "Not sure / Mix of styles",
                  desc: "I appreciate different approaches",
                  emoji: "🤔",
                },
              ].map((option) => (
                <div
                  key={option.value}
                  className={`p-4 rounded-lg border cursor-pointer transition-all ${
                    data.styleIcon === option.value
                      ? "border-[#8B4513] bg-[#8B4513]/10"
                      : "border-neutral-700 hover:border-[#8B4513] hover:bg-[#8B4513]/5"
                  }`}
                  onClick={() => updateData("styleIcon", option.value)}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{option.emoji}</span>
                    <div className="flex-1">
                      <div className="font-medium">{option.label}</div>
                      <div className="text-sm text-neutral-400">
                        {option.desc}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </QuestionCard>
        );

      case 19:
        return (
          <QuestionCard
            title="How important is your coach's title/credentials?"
            icon={<Target className="w-6 h-6" />}
          >
            <RadioGroup
              value={data.credentialImportance}
              onValueChange={(value) =>
                updateData("credentialImportance", value)
              }
              className="space-y-3"
            >
              {[
                {
                  value: "gm",
                  emoji: "👑",
                  label: "Very important",
                  desc: "I want a Grandmaster (2500+ FIDE)",
                },
                {
                  value: "titled",
                  emoji: "🏅",
                  label: "Prefer titled",
                  desc: "IM or GM preferred (2400+)",
                },
                {
                  value: "somewhat",
                  emoji: "⭐",
                  label: "Somewhat important",
                  desc: "FM or higher (2300+)",
                },
                {
                  value: "teaching",
                  emoji: "🎓",
                  label: "Teaching matters more",
                  desc: "Title less important than coaching ability",
                },
                {
                  value: "notimportant",
                  emoji: "🤝",
                  label: "Not important",
                  desc: "Just need someone stronger who can teach",
                },
              ].map((option) => (
                <div
                  key={option.value}
                  className="flex items-center space-x-3 p-4 rounded-lg border border-neutral-700 hover:border-[#8B4513] hover:bg-[#8B4513]/5 transition-colors cursor-pointer"
                  onClick={() =>
                    updateData("credentialImportance", option.value)
                  }
                >
                  <RadioGroupItem value={option.value} id={option.value} />
                  <span className="text-xl">{option.emoji}</span>
                  <div className="flex-1">
                    <Label
                      htmlFor={option.value}
                      className="cursor-pointer font-medium"
                    >
                      {option.label}
                    </Label>
                    <div className="text-sm text-neutral-400">
                      {option.desc}
                    </div>
                  </div>
                </div>
              ))}
            </RadioGroup>
          </QuestionCard>
        );

      default:
        return null;
    }
  };

  if (isProcessing) {
    const processingSteps = [
      "Analyzing your chess background...",
      "Evaluating learning style preferences...",
      "Matching with coach profiles...",
      "Calculating compatibility scores...",
      "Preparing your personalized recommendations...",
    ];

    return (
      <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full"
        >
          <Card className="bg-neutral-900 border-neutral-800">
            <CardContent className="p-8 text-center space-y-6">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              >
                <Sparkles className="w-16 h-16 text-[#8B4513] mx-auto" />
              </motion.div>
              <div>
                <h3 className="text-xl font-thin mb-2">
                  AI Analysis in Progress
                </h3>
                <p className="text-sm text-neutral-400">
                  {processingSteps[processingStep]}
                </p>
              </div>
              <Progress value={(processingStep + 1) * 20} className="h-2" />
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  if (showResults) {
    return (
      <div className="fixed inset-0 bg-black/95 z-50 overflow-y-auto">
        <div className="container max-w-4xl mx-auto p-4 py-8">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-3xl font-thin">Your Coach Matches</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-neutral-400 hover:text-white"
            >
              <X className="w-6 h-6" />
            </Button>
          </div>

          <div className="space-y-6">
            <Card className="bg-neutral-900 border-neutral-800">
              <CardContent className="p-6">
                <h3 className="text-xl font-thin mb-4">Your Profile Summary</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <div className="text-sm text-neutral-400">Rating</div>
                    <div className="text-lg font-medium">{data.rating}</div>
                  </div>
                  <div>
                    <div className="text-sm text-neutral-400">Goal</div>
                    <div className="text-lg font-medium capitalize">
                      {data.primaryGoal}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-neutral-400">Style</div>
                    <div className="text-lg font-medium capitalize">
                      {data.teachingArchetype}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-neutral-400">Budget</div>
                    <div className="text-lg font-medium">
                      ${data.budgetMin}-${data.budgetMax}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-neutral-900 border-neutral-800">
              <CardContent className="p-8">
                <div className="text-center mb-6">
                  <p className="text-neutral-400 mb-2">
                    We're currently in stealth mode building our coach network.
                  </p>
                  <p className="text-neutral-300 mb-6">
                    Join the waitlist to be notified when coaches matching your
                    profile are available.
                  </p>
                </div>

                <div className="max-w-md mx-auto space-y-4">
                  <div>
                    <Label htmlFor="waitlist-name" className="text-sm text-neutral-300 mb-2 block">
                      Your Name
                    </Label>
                    <input
                      id="waitlist-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Enter your name"
                      className="w-full px-4 py-3 bg-black/20 border border-neutral-700 rounded-lg text-white placeholder:text-neutral-500 focus:outline-none focus:border-[#8B4513] transition-colors"
                    />
                  </div>

                  <div>
                    <Label htmlFor="waitlist-email" className="text-sm text-neutral-300 mb-2 block">
                      Email Address
                    </Label>
                    <input
                      id="waitlist-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      className="w-full px-4 py-3 bg-black/20 border border-neutral-700 rounded-lg text-white placeholder:text-neutral-500 focus:outline-none focus:border-[#8B4513] transition-colors"
                    />
                  </div>

                  <Button
                    size="lg"
                    className="w-full bg-[#8B4513] hover:bg-[#A0522D] text-white"
                    disabled={!email || !name || isSubmittingWaitlist}
                    onClick={async () => {
                      if (!email || !name) {
                        toast.error("Please enter your name and email");
                        return;
                      }

                      setIsSubmittingWaitlist(true);
                      try {
                        await addToWaitlistMutation.mutateAsync({
                          email: email.trim(),
                          name: name.trim(),
                          userType: "student",
                          referralSource: "student-quiz",
                        });
                        toast.success(
                          "🎉 You're on the list! Check your email for confirmation."
                        );
                        onClose();
                      } catch (error: any) {
                        if (
                          error.message?.toLowerCase().includes("already") ||
                          error.message?.toLowerCase().includes("duplicate") ||
                          error.message?.toLowerCase().includes("exists") ||
                          error.message?.toLowerCase().includes("waitlist")
                        ) {
                          toast.info("You're already on the list! We'll be in touch soon.");
                          onClose();
                        } else {
                          toast.error(
                            "Failed to join waitlist. Please try again."
                          );
                        }
                      } finally {
                        setIsSubmittingWaitlist(false);
                      }
                    }}
                  >
                    {isSubmittingWaitlist ? "Joining..." : "Join Waitlist"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/95 z-50 overflow-y-auto">
      <div className="container max-w-3xl mx-auto p-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-thin mb-1">Find Your Perfect Coach</h2>
            <p className="text-sm text-neutral-400">
              Question {currentQuestion + 1} of {TOTAL_QUESTIONS} • Takes 8-10
              minutes
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-neutral-400 hover:text-white"
          >
            <X className="w-6 h-6" />
          </Button>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between mt-2 text-xs text-neutral-500">
            <span>Chess Journey</span>
            <span>Learning Goals</span>
            <span>Learning Style</span>
            <span>Practical Details</span>
            <span>Preferences</span>
          </div>
        </div>

        {/* Question Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuestion}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            {renderQuestion()}
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex justify-between mt-8">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentQuestion === 0}
            className="border-neutral-700"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <Button
            onClick={handleNext}
            className="bg-[#8B4513] hover:bg-[#A0522D] text-white"
          >
            {currentQuestion === TOTAL_QUESTIONS - 1 ? (
              <>
                Complete Assessment
                <Sparkles className="w-4 h-4 ml-2" />
              </>
            ) : (
              <>
                Next
                <ChevronRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function QuestionCard({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="bg-neutral-900 border-neutral-800">
      <CardContent className="p-6 md:p-8">
        <div className="flex items-start gap-4 mb-6">
          <div className="text-[#8B4513]">{icon}</div>
          <div className="flex-1">
            <h3 className="text-xl md:text-2xl font-thin mb-1">{title}</h3>
            {subtitle && (
              <p className="text-sm text-neutral-400">{subtitle}</p>
            )}
          </div>
        </div>
        <div className="max-h-[60vh] overflow-y-auto pr-2">{children}</div>
      </CardContent>
    </Card>
  );
}
