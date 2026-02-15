import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Brain,
  Shield,
  TrendingUp,
  Clock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  Target,
  DollarSign,
  Video,
  Star,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

interface ApplicationData {
  // Step 1: About You
  fullName: string;
  email: string;
  phone: string;
  country: string;
  city: string;
  timezone: string;
  chessTitle: string;
  currentRating: string;
  ratingOrg: string;
  yearsExperience: string;
  totalStudents: string;
  profilePhoto: File | null;

  // Step 2: Expertise
  certifications: string;
  achievements: string;
  specializations: string[];
  targetLevels: string[];
  teachingPhilosophy: string;

  // Step 3: Availability & Pricing
  hourlyRate: string;
  availability: { [key: string]: boolean };
  lessonFormats: string[];
  languages: string[];

  // Step 4: Teaching Approach
  bio: string;
  whyBoogme: string;
  sampleLesson: string;
  videoIntro: File | null;

  // Step 5: Agreements
  backgroundCheckConsent: boolean;
  termsAgreed: boolean;
}

const SPECIALIZATIONS = [
  "Tournament Preparation",
  "Strategic Mastery",
  "Tactical Training",
  "Endgame Technique",
  "Opening Repertoire",
  "Psychological Training",
  "Beginner Foundations",
  "Junior Development (U12)",
  "Teen Development (13-18)",
  "Adult Learners",
  "Women's Chess",
  "Rapid/Blitz Training",
  "Classical Time Control",
  "Online Chess Specific",
];

const TARGET_LEVELS = [
  "Complete Beginners (0-800)",
  "Novice (800-1200)",
  "Intermediate (1200-1600)",
  "Advanced (1600-2000)",
  "Expert (2000-2200)",
  "Master Level (2200+)",
];

const LESSON_FORMATS = [
  "One-on-One Lessons",
  "Small Group (2-4 students)",
  "Large Group (5+ students)",
  "Online Only",
  "In-Person",
];

const LANGUAGES = [
  "English",
  "Spanish",
  "Russian",
  "French",
  "German",
  "Mandarin",
  "Portuguese",
  "Italian",
  "Other",
];

const COUNTRIES = [
  "United States", "Canada", "United Kingdom", "Australia", "Germany", "France", "Spain", "Italy",
  "Netherlands", "Belgium", "Switzerland", "Austria", "Sweden", "Norway", "Denmark", "Finland",
  "Poland", "Czech Republic", "Hungary", "Romania", "Bulgaria", "Greece", "Portugal", "Ireland",
  "Russia", "Ukraine", "Belarus", "Kazakhstan", "Georgia", "Armenia", "Azerbaijan",
  "China", "Japan", "South Korea", "India", "Singapore", "Malaysia", "Thailand", "Vietnam",
  "Philippines", "Indonesia", "Taiwan", "Hong Kong", "Israel", "Turkey", "Saudi Arabia",
  "United Arab Emirates", "Brazil", "Argentina", "Chile", "Colombia", "Mexico", "Peru",
  "South Africa", "Egypt", "Morocco", "Kenya", "Nigeria", "Other"
];

const TIMEZONES = [
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "America/Anchorage", "Pacific/Honolulu", "America/Toronto", "America/Vancouver",
  "Europe/London", "Europe/Paris", "Europe/Berlin", "Europe/Madrid", "Europe/Rome",
  "Europe/Amsterdam", "Europe/Brussels", "Europe/Vienna", "Europe/Stockholm",
  "Europe/Oslo", "Europe/Copenhagen", "Europe/Helsinki", "Europe/Warsaw",
  "Europe/Prague", "Europe/Budapest", "Europe/Bucharest", "Europe/Sofia",
  "Europe/Athens", "Europe/Lisbon", "Europe/Dublin", "Europe/Moscow",
  "Asia/Dubai", "Asia/Karachi", "Asia/Kolkata", "Asia/Dhaka", "Asia/Bangkok",
  "Asia/Singapore", "Asia/Hong_Kong", "Asia/Shanghai", "Asia/Tokyo",
  "Asia/Seoul", "Australia/Sydney", "Australia/Melbourne", "Australia/Brisbane",
  "Pacific/Auckland", "America/Sao_Paulo", "America/Argentina/Buenos_Aires",
  "America/Santiago", "America/Bogota", "America/Mexico_City", "America/Lima",
  "Africa/Johannesburg", "Africa/Cairo", "Africa/Casablanca", "Africa/Nairobi"
];

const AVAILABILITY_SLOTS = [
  { day: "Monday", slots: ["Morning", "Afternoon", "Evening"] },
  { day: "Tuesday", slots: ["Morning", "Afternoon", "Evening"] },
  { day: "Wednesday", slots: ["Morning", "Afternoon", "Evening"] },
  { day: "Thursday", slots: ["Morning", "Afternoon", "Evening"] },
  { day: "Friday", slots: ["Morning", "Afternoon", "Evening"] },
  { day: "Saturday", slots: ["Morning", "Afternoon", "Evening"] },
  { day: "Sunday", slots: ["Morning", "Afternoon", "Evening"] },
];

export function CoachApplication() {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<ApplicationData>({
    fullName: "",
    email: "",
    phone: "",
    country: "",
    city: "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    chessTitle: "",
    currentRating: "",
    ratingOrg: "",
    yearsExperience: "",
    totalStudents: "",
    profilePhoto: null,
    certifications: "",
    achievements: "",
    specializations: [],
    targetLevels: [],
    teachingPhilosophy: "",
    hourlyRate: "",
    availability: {},
    lessonFormats: [],
    languages: [],
    bio: "",
    whyBoogme: "",
    sampleLesson: "",
    videoIntro: null,
    backgroundCheckConsent: false,
    termsAgreed: false,
  });

  const totalSteps = 5;
  const progress = ((currentStep + 1) / totalSteps) * 100;

  const updateField = (field: keyof ApplicationData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const toggleArrayField = (field: keyof ApplicationData, value: string) => {
    setFormData((prev) => {
      const currentArray = prev[field] as string[];
      const newArray = currentArray.includes(value)
        ? currentArray.filter((item) => item !== value)
        : [...currentArray, value];
      return { ...prev, [field]: newArray };
    });
  };

  const toggleAvailability = (day: string, slot: string) => {
    const key = `${day}-${slot}`;
    setFormData((prev) => ({
      ...prev,
      availability: {
        ...prev.availability,
        [key]: !prev.availability[key],
      },
    }));
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 0:
        if (
          !formData.fullName ||
          !formData.email ||
          !formData.country ||
          !formData.city ||
          !formData.chessTitle ||
          !formData.currentRating ||
          !formData.ratingOrg ||
          !formData.yearsExperience
        ) {
          toast.error("Please fill in all required fields");
          return false;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
          toast.error("Please enter a valid email address");
          return false;
        }
        const rating = parseInt(formData.currentRating);
        if (rating < 1000 || rating > 3000) {
          toast.error("Rating must be between 1000 and 3000");
          return false;
        }
        return true;

      case 1:
        if (!formData.achievements || formData.achievements.trim().length === 0) {
          toast.error("Please provide notable achievements");
          return false;
        }
        if (formData.specializations.length < 3) {
          toast.error("Please select at least 3 specializations");
          return false;
        }
        if (formData.targetLevels.length < 1) {
          toast.error("Please select at least 1 target student level");
          return false;
        }
        if (!formData.teachingPhilosophy || formData.teachingPhilosophy.trim().length === 0) {
          toast.error("Please provide your teaching philosophy");
          return false;
        }
        return true;

      case 2:
        if (!formData.hourlyRate) {
          toast.error("Please set your hourly rate");
          return false;
        }
        const rate = parseInt(formData.hourlyRate);
        if (rate < 25 || rate > 200) {
          toast.error("Hourly rate must be between $25 and $200");
          return false;
        }
        const availabilityCount = Object.values(formData.availability).filter(Boolean).length;
        if (availabilityCount < 6) {
          toast.error("Please select at least 6 hours of weekly availability");
          return false;
        }
        if (formData.lessonFormats.length < 1) {
          toast.error("Please select at least one lesson format");
          return false;
        }
        if (formData.languages.length < 1) {
          toast.error("Please select at least one language");
          return false;
        }
        return true;

      case 3:
        if (!formData.bio || formData.bio.trim().length === 0) {
          toast.error("Please provide a professional bio");
          return false;
        }
        if (!formData.whyBoogme || formData.whyBoogme.trim().length === 0) {
          toast.error("Please explain why you want to join BooGMe");
          return false;
        }
        if (!formData.sampleLesson || formData.sampleLesson.trim().length === 0) {
          toast.error("Please describe a sample lesson");
          return false;
        }
        return true;

      case 4:
        if (!formData.backgroundCheckConsent) {
          toast.error("Please consent to background check");
          return false;
        }
        if (!formData.termsAgreed) {
          toast.error("Please agree to Terms of Service");
          return false;
        }
        return true;

      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (currentStep < totalSteps - 1) {
        setCurrentStep(currentStep + 1);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const submitMutation = trpc.coachApplication.submit.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      // TODO: Redirect to confirmation page or show success modal
    },
    onError: (error) => {
      toast.error(error.message || "Failed to submit application");
    },
  });

  const handleSubmit = () => {
    if (validateStep(currentStep)) {
      submitMutation.mutate({
        fullName: formData.fullName,
        email: formData.email,
        phone: formData.phone,
        country: formData.country,
        city: formData.city,
        timezone: formData.timezone,
        chessTitle: formData.chessTitle,
        currentRating: parseInt(formData.currentRating),
        ratingOrg: formData.ratingOrg,
        yearsExperience: formData.yearsExperience,
        totalStudents: formData.totalStudents ? parseInt(formData.totalStudents) : undefined,
        profilePhotoUrl: undefined, // TODO: Upload photo to S3
        certifications: formData.certifications,
        achievements: formData.achievements,
        specializations: formData.specializations,
        targetLevels: formData.targetLevels,
        teachingPhilosophy: formData.teachingPhilosophy,
        hourlyRate: parseInt(formData.hourlyRate),
        availability: formData.availability,
        lessonFormats: formData.lessonFormats,
        languages: formData.languages,
        bio: formData.bio,
        whyBoogme: formData.whyBoogme,
        sampleLesson: formData.sampleLesson,
        videoIntroUrl: undefined, // TODO: Upload video to S3
        backgroundCheckConsent: formData.backgroundCheckConsent,
        termsAgreed: formData.termsAgreed,
      });
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return <Step1AboutYou formData={formData} updateField={updateField} />;
      case 1:
        return (
          <Step2Expertise
            formData={formData}
            updateField={updateField}
            toggleArrayField={toggleArrayField}
          />
        );
      case 2:
        return (
          <Step3AvailabilityPricing
            formData={formData}
            updateField={updateField}
            toggleArrayField={toggleArrayField}
            toggleAvailability={toggleAvailability}
          />
        );
      case 3:
        return <Step4TeachingApproach formData={formData} updateField={updateField} />;
      case 4:
        return <Step5ReviewSubmit formData={formData} updateField={updateField} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="container max-w-6xl mx-auto">
        {/* Progress Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold">Coach Application</h1>
              <p className="text-muted-foreground mt-1">
                Step {currentStep + 1} of {totalSteps}
              </p>
            </div>
            <Badge variant="outline" className="text-sm">
              <Clock className="w-4 h-4 mr-1" />
              8-10 minutes
            </Badge>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            <Card>
              <CardContent className="pt-6">{renderStep()}</CardContent>
            </Card>

            {/* Navigation Buttons */}
            <div className="flex justify-between mt-6">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={currentStep === 0}
                className="gap-2"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </Button>

              {currentStep < totalSteps - 1 ? (
                <Button onClick={handleNext} className="gap-2">
                  Continue
                  <ChevronRight className="w-4 h-4" />
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={submitMutation.isPending} className="gap-2">
                  {submitMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      Submit Application
                      <CheckCircle2 className="w-4 h-4" />
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <SidebarValueProp step={currentStep} />
          </div>
        </div>
      </div>
    </div>
  );
}

// Step Components
function Step1AboutYou({
  formData,
  updateField,
}: {
  formData: ApplicationData;
  updateField: (field: keyof ApplicationData, value: any) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">About You</h2>
        <p className="text-muted-foreground">
          Let's start with your basic information and chess credentials
        </p>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="fullName">
              Full Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="fullName"
              value={formData.fullName}
              onChange={(e) => updateField("fullName", e.target.value)}
              placeholder="John Doe"
            />
          </div>
          <div>
            <Label htmlFor="email">
              Email Address <span className="text-destructive">*</span>
            </Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => updateField("email", e.target.value)}
              placeholder="john@example.com"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => updateField("phone", e.target.value)}
              placeholder="+1 (555) 123-4567"
            />
          </div>
          <div>
            <Label htmlFor="country">
              Country <span className="text-destructive">*</span>
            </Label>
            <Select value={formData.country} onValueChange={(value) => updateField("country", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select country" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {COUNTRIES.map((country) => (
                  <SelectItem key={country} value={country}>
                    {country}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="city">
              City <span className="text-destructive">*</span>
            </Label>
            <Input
              id="city"
              value={formData.city}
              onChange={(e) => updateField("city", e.target.value)}
              placeholder="New York"
            />
          </div>
          <div>
            <Label htmlFor="timezone">
              Timezone <span className="text-destructive">*</span>
            </Label>
            <Select value={formData.timezone} onValueChange={(value) => updateField("timezone", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select timezone" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="border-t pt-4 mt-6">
          <h3 className="font-semibold mb-4">Chess Credentials</h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="chessTitle">
                Chess Title <span className="text-destructive">*</span>
              </Label>
              <Select value={formData.chessTitle} onValueChange={(value) => updateField("chessTitle", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select title" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GM">Grandmaster (GM)</SelectItem>
                  <SelectItem value="IM">International Master (IM)</SelectItem>
                  <SelectItem value="FM">FIDE Master (FM)</SelectItem>
                  <SelectItem value="CM">Candidate Master (CM)</SelectItem>
                  <SelectItem value="NM">National Master (NM)</SelectItem>
                  <SelectItem value="Expert">Expert</SelectItem>
                  <SelectItem value="ClassA">Class A</SelectItem>
                  <SelectItem value="ClassB">Class B</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="currentRating">
                Current Rating <span className="text-destructive">*</span>
              </Label>
              <Input
                id="currentRating"
                type="number"
                value={formData.currentRating}
                onChange={(e) => updateField("currentRating", e.target.value)}
                placeholder="2400"
              />
              <p className="text-xs text-muted-foreground mt-1">FIDE, USCF, or equivalent</p>
            </div>
            <div>
              <Label htmlFor="ratingOrg">
                Rating Organization <span className="text-destructive">*</span>
              </Label>
              <Select value={formData.ratingOrg} onValueChange={(value) => updateField("ratingOrg", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FIDE">FIDE</SelectItem>
                  <SelectItem value="USCF">USCF</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <Label htmlFor="yearsExperience">
                Years of Coaching Experience <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.yearsExperience}
                onValueChange={(value) => updateField("yearsExperience", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="<1">Less than 1 year</SelectItem>
                  <SelectItem value="1-2">1-2 years</SelectItem>
                  <SelectItem value="3-5">3-5 years</SelectItem>
                  <SelectItem value="6-10">6-10 years</SelectItem>
                  <SelectItem value="10+">10+ years</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="totalStudents">Total Students Taught</Label>
              <Input
                id="totalStudents"
                type="number"
                value={formData.totalStudents}
                onChange={(e) => updateField("totalStudents", e.target.value)}
                placeholder="50"
              />
              <p className="text-xs text-muted-foreground mt-1">Approximate number</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Step2Expertise({
  formData,
  updateField,
  toggleArrayField,
}: {
  formData: ApplicationData;
  updateField: (field: keyof ApplicationData, value: any) => void;
  toggleArrayField: (field: keyof ApplicationData, value: string) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Your Expertise</h2>
        <p className="text-muted-foreground">Showcase your qualifications and teaching specialties</p>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="certifications">Teaching Certifications</Label>
          <Textarea
            id="certifications"
            value={formData.certifications}
            onChange={(e) => updateField("certifications", e.target.value)}
            placeholder="e.g., USCF Certified Coach, Chess in Schools Instructor"
            rows={2}
          />
          <p className="text-xs text-muted-foreground mt-1">List any relevant certifications</p>
        </div>

        <div>
          <Label htmlFor="achievements">
            Notable Achievements <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="achievements"
            value={formData.achievements}
            onChange={(e) => updateField("achievements", e.target.value)}
            placeholder="e.g., Coached 3 students to state championship, Former national team member, Published opening repertoire book"
            rows={3}
          />
          <p className="text-xs text-muted-foreground mt-1">
            {formData.achievements.length}/500 characters (min 100)
          </p>
        </div>

        <div>
          <Label>
            Specializations <span className="text-destructive">*</span>
          </Label>
          <p className="text-sm text-muted-foreground mb-3">Select 3-5 areas where you excel</p>
          <div className="grid grid-cols-2 gap-2">
            {SPECIALIZATIONS.map((spec) => (
              <div key={spec} className="flex items-center space-x-2">
                <Checkbox
                  id={spec}
                  checked={formData.specializations.includes(spec)}
                  onCheckedChange={() => toggleArrayField("specializations", spec)}
                />
                <label
                  htmlFor={spec}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  {spec}
                </label>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Selected: {formData.specializations.length} (need 3-5)
          </p>
        </div>

        <div>
          <Label>
            Target Student Levels <span className="text-destructive">*</span>
          </Label>
          <p className="text-sm text-muted-foreground mb-3">Select 1-3 levels you teach best</p>
          <div className="grid grid-cols-1 gap-2">
            {TARGET_LEVELS.map((level) => (
              <div key={level} className="flex items-center space-x-2">
                <Checkbox
                  id={level}
                  checked={formData.targetLevels.includes(level)}
                  onCheckedChange={() => toggleArrayField("targetLevels", level)}
                />
                <label
                  htmlFor={level}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  {level}
                </label>
              </div>
            ))}
          </div>
        </div>

        <div>
          <Label htmlFor="teachingPhilosophy">
            Teaching Philosophy <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="teachingPhilosophy"
            value={formData.teachingPhilosophy}
            onChange={(e) => updateField("teachingPhilosophy", e.target.value)}
            placeholder="Describe your approach to coaching. What's your teaching style? How do you help students improve?"
            rows={4}
          />
          <p className="text-xs text-muted-foreground mt-1">
            {formData.teachingPhilosophy.split(" ").filter((w) => w).length} words (min 50)
          </p>
        </div>
      </div>
    </div>
  );
}

function Step3AvailabilityPricing({
  formData,
  updateField,
  toggleArrayField,
  toggleAvailability,
}: {
  formData: ApplicationData;
  updateField: (field: keyof ApplicationData, value: any) => void;
  toggleArrayField: (field: keyof ApplicationData, value: string) => void;
  toggleAvailability: (day: string, slot: string) => void;
}) {
  const getMarketRate = (title: string) => {
    switch (title) {
      case "GM":
        return "$100-150/hr";
      case "IM":
        return "$60-100/hr";
      case "FM":
      case "NM":
        return "$45-75/hr";
      case "Expert":
      case "ClassA":
        return "$35-55/hr";
      default:
        return "$35-75/hr";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Availability & Pricing</h2>
        <p className="text-muted-foreground">Set your rate and schedule</p>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="hourlyRate">
            Hourly Rate (USD) <span className="text-destructive">*</span>
          </Label>
          <div className="flex items-center gap-2">
            <span className="text-2xl">$</span>
            <Input
              id="hourlyRate"
              type="number"
              value={formData.hourlyRate}
              onChange={(e) => updateField("hourlyRate", e.target.value)}
              placeholder="65"
              className="max-w-[150px]"
            />
            <span className="text-muted-foreground">/hour</span>
          </div>
          <div className="mt-3 p-3 bg-muted rounded-lg">
            <p className="text-sm font-semibold mb-1">💰 Market Rates by Title</p>
            <p className="text-sm text-muted-foreground">
              Your title ({formData.chessTitle || "Not selected"}): {getMarketRate(formData.chessTitle)}
            </p>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            You can adjust this anytime. Start competitive to build reviews.
          </p>
        </div>

        <div>
          <Label>
            Weekly Availability <span className="text-destructive">*</span>
          </Label>
          <p className="text-sm text-muted-foreground mb-3">Select at least 6 hours (minimum 6 slots)</p>
          <div className="space-y-2">
            {AVAILABILITY_SLOTS.map(({ day, slots }) => (
              <div key={day} className="flex items-center gap-2">
                <div className="w-24 text-sm font-medium">{day}</div>
                <div className="flex gap-2">
                  {slots.map((slot) => {
                    const key = `${day}-${slot}`;
                    const isSelected = formData.availability[key];
                    return (
                      <Button
                        key={slot}
                        type="button"
                        variant={isSelected ? "default" : "outline"}
                        size="sm"
                        onClick={() => toggleAvailability(day, slot)}
                        className="text-xs"
                      >
                        {slot}
                      </Button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Selected: {Object.values(formData.availability).filter(Boolean).length} slots (need 6+)
          </p>
        </div>

        <div>
          <Label>
            Lesson Formats <span className="text-destructive">*</span>
          </Label>
          <p className="text-sm text-muted-foreground mb-3">Select all that apply</p>
          <div className="grid grid-cols-1 gap-2">
            {LESSON_FORMATS.map((format) => (
              <div key={format} className="flex items-center space-x-2">
                <Checkbox
                  id={format}
                  checked={formData.lessonFormats.includes(format)}
                  onCheckedChange={() => toggleArrayField("lessonFormats", format)}
                />
                <label
                  htmlFor={format}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  {format}
                </label>
              </div>
            ))}
          </div>
        </div>

        <div>
          <Label>
            Languages Spoken <span className="text-destructive">*</span>
          </Label>
          <p className="text-sm text-muted-foreground mb-3">Select all that apply</p>
          <div className="grid grid-cols-2 gap-2">
            {LANGUAGES.map((lang) => (
              <div key={lang} className="flex items-center space-x-2">
                <Checkbox
                  id={lang}
                  checked={formData.languages.includes(lang)}
                  onCheckedChange={() => toggleArrayField("languages", lang)}
                />
                <label
                  htmlFor={lang}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  {lang}
                </label>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Step4TeachingApproach({
  formData,
  updateField,
}: {
  formData: ApplicationData;
  updateField: (field: keyof ApplicationData, value: any) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Teaching Approach</h2>
        <p className="text-muted-foreground">Help students understand your unique teaching style</p>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="bio">
            Professional Bio <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="bio"
            value={formData.bio}
            onChange={(e) => updateField("bio", e.target.value)}
            placeholder="Start with your chess journey, explain your coaching philosophy, share student success stories, and describe what makes your lessons unique..."
            rows={6}
          />
          <p className="text-xs text-muted-foreground mt-1">
            {formData.bio.length} characters
          </p>
        </div>

        <div>
          <Label htmlFor="whyBoogme">
            Why BooGMe? <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="whyBoogme"
            value={formData.whyBoogme}
            onChange={(e) => updateField("whyBoogme", e.target.value)}
            placeholder="Why do you want to join BooGMe? What are you hoping to achieve?"
            rows={3}
          />
          <p className="text-xs text-muted-foreground mt-1">
            {formData.whyBoogme.length} characters
          </p>
        </div>

        <div>
          <Label htmlFor="sampleLesson">
            Sample Lesson Description <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="sampleLesson"
            value={formData.sampleLesson}
            onChange={(e) => updateField("sampleLesson", e.target.value)}
            placeholder="Describe a typical first lesson with a new student. What would you cover?"
            rows={4}
          />
          <p className="text-xs text-muted-foreground mt-1">
            {formData.sampleLesson.length} characters
          </p>
        </div>

        <div>
          <Label htmlFor="videoIntro">Video Introduction</Label>
          <div className="mt-2 p-4 border-2 border-dashed rounded-lg">
            <div className="flex items-start gap-3">
              <Video className="w-5 h-5 text-muted-foreground mt-1" />
              <div className="flex-1">
                <p className="text-sm font-medium">Upload a 2-minute video introduction</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Introduce yourself, explain your teaching style, and why students should choose you
                </p>
                <Input
                  id="videoIntro"
                  type="file"
                  accept="video/*"
                  onChange={(e) => updateField("videoIntro", e.target.files?.[0] || null)}
                  className="mt-3"
                />
                <Badge variant="secondary" className="mt-2">
                  <Star className="w-3 h-3 mr-1" />
                  Recommended - 5x higher conversion
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Step5ReviewSubmit({
  formData,
  updateField,
}: {
  formData: ApplicationData;
  updateField: (field: keyof ApplicationData, value: any) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Review & Submit</h2>
        <p className="text-muted-foreground">Review your application and agree to terms</p>
      </div>

      <div className="space-y-4">
        {/* Application Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Application Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold text-sm mb-2">Personal Info & Credentials</h4>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>
                  <strong>Name:</strong> {formData.fullName}
                </p>
                <p>
                  <strong>Email:</strong> {formData.email}
                </p>
                <p>
                  <strong>Location:</strong> {formData.city}, {formData.country}
                </p>
                <p>
                  <strong>Title:</strong> {formData.chessTitle} • Rating: {formData.currentRating} (
                  {formData.ratingOrg})
                </p>
                <p>
                  <strong>Experience:</strong> {formData.yearsExperience} years
                </p>
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-sm mb-2">Expertise</h4>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>
                  <strong>Specializations:</strong> {formData.specializations.join(", ")}
                </p>
                <p>
                  <strong>Target Levels:</strong> {formData.targetLevels.join(", ")}
                </p>
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-sm mb-2">Availability & Pricing</h4>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>
                  <strong>Hourly Rate:</strong> ${formData.hourlyRate}/hour
                </p>
                <p>
                  <strong>Weekly Availability:</strong>{" "}
                  {Object.values(formData.availability).filter(Boolean).length} slots
                </p>
                <p>
                  <strong>Lesson Formats:</strong> {formData.lessonFormats.join(", ")}
                </p>
                <p>
                  <strong>Languages:</strong> {formData.languages.join(", ")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Agreements */}
        <div className="space-y-3">
          <div className="flex items-start space-x-2">
            <Checkbox
              id="backgroundCheck"
              checked={formData.backgroundCheckConsent}
              onCheckedChange={(checked) => updateField("backgroundCheckConsent", checked as boolean)}
            />
            <label htmlFor="backgroundCheck" className="text-sm font-medium leading-relaxed cursor-pointer">
              I consent to verification as part of the approval process{" "}
              <span className="text-destructive">*</span>
              <p className="text-xs text-muted-foreground mt-1">
                Standard verification to maintain platform quality
              </p>
            </label>
          </div>

          <div className="flex items-start space-x-2">
            <Checkbox
              id="terms"
              checked={formData.termsAgreed}
              onCheckedChange={(checked) => updateField("termsAgreed", checked as boolean)}
            />
            <label htmlFor="terms" className="text-sm leading-relaxed cursor-pointer">
              I agree to BooGMe's Terms of Service and Coach Agreement{" "}
              <span className="text-destructive">*</span>
            </label>
          </div>
        </div>

        {/* What Happens Next */}
        <Card className="bg-muted/50">
          <CardHeader>
            <CardTitle className="text-lg">What Happens Next?</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium text-sm">Application Submitted</p>
                  <p className="text-xs text-muted-foreground">You'll receive a confirmation email immediately</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium text-sm">Under Review (24-48 hours)</p>
                  <p className="text-xs text-muted-foreground">Our team will review your application</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium text-sm">Approval Email</p>
                  <p className="text-xs text-muted-foreground">
                    Complete profile setup & payment onboarding (Stripe Connect)
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <TrendingUp className="w-5 h-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium text-sm">Start Teaching (Day 4-7)</p>
                  <p className="text-xs text-muted-foreground">First student inquiries start arriving</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SidebarValueProp({ step }: { step: number }) {
  const valueProp = [
    {
      icon: <Lightbulb className="w-5 h-5" />,
      title: "Did you know?",
      description: "Coaches with complete profiles get 3x more student inquiries",
    },
    {
      icon: <Target className="w-5 h-5" />,
      title: "Pro Tip",
      description: "Students search by specialization. Be specific about what you teach best!",
    },
    {
      icon: <DollarSign className="w-5 h-5" />,
      title: "Success Metric",
      description: "Coaches with flexible availability earn 40% more than those with limited schedules",
    },
    {
      icon: <Video className="w-5 h-5" />,
      title: "Conversion Boost",
      description: "Coaches with video introductions convert 5x better than those without",
    },
    {
      icon: <CheckCircle2 className="w-5 h-5" />,
      title: "Almost There!",
      description: "Review your application carefully. You can edit your profile after approval.",
    },
  ][step];

  return (
    <div className="space-y-6">
      <Card className="bg-primary/5 border-primary/20">
        <CardHeader>
          <div className="flex items-center gap-2 text-primary">
            {valueProp.icon}
            <CardTitle className="text-lg">{valueProp.title}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm">{valueProp.description}</p>
        </CardContent>
      </Card>

      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Why Join BooGMe?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <Brain className="w-5 h-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium text-sm">AI-Powered Matching</p>
                <p className="text-xs text-muted-foreground">
                  We bring qualified students to you through intelligent matching
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium text-sm">Payment Protection</p>
                <p className="text-xs text-muted-foreground">
                  Get paid for every lesson with our secure escrow system
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <TrendingUp className="w-5 h-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium text-sm">Business Tools</p>
                <p className="text-xs text-muted-foreground">
                  Calendar, analytics, and student management included
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
