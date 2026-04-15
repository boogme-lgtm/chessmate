/**
 * Coach Onboarding Wizard — 7-step guided setup for new coaches
 * Steps:
 *   1. Welcome & Guidelines
 *   2. Personal Profile (name, bio, photo, timezone)
 *   3. Chess Credentials (title, FIDE rating, Lichess/Chess.com)
 *   4. Specialties & Teaching Style
 *   5. Pricing & Lesson Settings
 *   6. Availability Schedule
 *   7. Stripe Connect & Go Live
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import {
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  User,
  Trophy,
  BookOpen,
  DollarSign,
  Calendar,
  CreditCard,
  Sparkles,
  Globe,
  Clock,
  Shield,
  Star,
  Zap,
  Upload,
  X,
  Camera,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type DaySchedule = { enabled: boolean; slots: { start: string; end: string }[] };
type WeekSchedule = Record<string, DaySchedule>;

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const DAY_LABELS: Record<string, string> = {
  monday: "Mon", tuesday: "Tue", wednesday: "Wed", thursday: "Thu",
  friday: "Fri", saturday: "Sat", sunday: "Sun",
};

const SPECIALTIES = [
  "Openings", "Middlegame", "Endgames", "Tactics", "Strategy",
  "Positional Play", "Attack & Defense", "Calculation", "Time Management",
  "Tournament Prep", "Blitz & Rapid", "Classical", "Kids & Beginners",
];

const LANGUAGES = [
  { code: "en", label: "English" }, { code: "es", label: "Spanish" },
  { code: "fr", label: "French" }, { code: "de", label: "German" },
  { code: "ru", label: "Russian" }, { code: "pt", label: "Portuguese" },
  { code: "zh", label: "Chinese" }, { code: "ar", label: "Arabic" },
];

const TITLES = ["none", "CM", "FM", "IM", "GM", "WCM", "WFM", "WIM", "WGM"] as const;

const STEPS = [
  { id: 1, label: "Welcome", icon: Sparkles },
  { id: 2, label: "Profile", icon: User },
  { id: 3, label: "Chess", icon: Trophy },
  { id: 4, label: "Teaching", icon: BookOpen },
  { id: 5, label: "Pricing", icon: DollarSign },
  { id: 6, label: "Schedule", icon: Calendar },
  { id: 7, label: "Go Live", icon: Zap },
];

// ─── Default schedule ─────────────────────────────────────────────────────────
function defaultSchedule(): WeekSchedule {
  return Object.fromEntries(
    DAYS.map((d) => [d, { enabled: d !== "saturday" && d !== "sunday", slots: [{ start: "09:00", end: "17:00" }] }])
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function CoachOnboarding() {
  const [, navigate] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // ── Form state ──
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [country, setCountry] = useState("");

  const [title, setTitle] = useState<typeof TITLES[number]>("none");
  const [fideRating, setFideRating] = useState<string>("");
  const [lichessUsername, setLichessUsername] = useState("");
  const [chesscomUsername, setChesscomUsername] = useState("");
  const [experienceYears, setExperienceYears] = useState(1);

  const [specialties, setSpecialties] = useState<string[]>([]);
  const [teachingStyle, setTeachingStyle] = useState<"visual" | "interactive" | "analytical" | "competitive">("interactive");
  const [languages, setLanguages] = useState<string[]>(["en"]);

  const [hourlyRate, setHourlyRate] = useState(50); // in dollars
  const [lessonDurations, setLessonDurations] = useState<number[]>([30, 60]);
  const [packageDiscount, setPackageDiscount] = useState(false);
  const [packageDiscountPercent, setPackageDiscountPercent] = useState(10);
  const [minAdvanceHours, setMinAdvanceHours] = useState(24);
  const [maxAdvanceDays, setMaxAdvanceDays] = useState(30);
  const [bufferMinutes, setBufferMinutes] = useState(15);

  const [schedule, setSchedule] = useState<WeekSchedule>(defaultSchedule());
  const [guidelinesAgreed, setGuidelinesAgreed] = useState(false);

  // ── Photo upload state ──
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoDragOver, setPhotoDragOver] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // ── Load existing profile ──
  const { data: profileData } = trpc.coach.getMyProfile.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (profileData?.user) {
      const u = profileData.user;
      if (u.name) setName(u.name);
      if (u.bio) setBio(u.bio);
      if (u.avatarUrl) setAvatarUrl(u.avatarUrl);
      if (u.timezone) setTimezone(u.timezone);
      if (u.country) setCountry(u.country);
    }
    if (profileData?.profile) {
      const p = profileData.profile;
      if (p.title) setTitle(p.title as typeof TITLES[number]);
      if (p.fideRating) setFideRating(String(p.fideRating));
      if (p.lichessUsername) setLichessUsername(p.lichessUsername);
      if (p.chesscomUsername) setChesscomUsername(p.chesscomUsername);
      if (p.experienceYears) setExperienceYears(p.experienceYears);
      if (p.specialties) {
        try { setSpecialties(JSON.parse(p.specialties)); } catch {}
      }
      if (p.teachingStyle) setTeachingStyle(p.teachingStyle as any);
      if (p.languages) {
        try { setLanguages(JSON.parse(p.languages)); } catch {}
      }
      if (p.hourlyRateCents) setHourlyRate(p.hourlyRateCents / 100);
      if (p.lessonDurations) {
        try { setLessonDurations(JSON.parse(p.lessonDurations)); } catch {}
      }
      if (p.packageDiscountEnabled !== null) setPackageDiscount(p.packageDiscountEnabled ?? false);
      if (p.packageDiscountPercent) setPackageDiscountPercent(p.packageDiscountPercent);
      if (p.minAdvanceHours) setMinAdvanceHours(p.minAdvanceHours);
      if (p.maxAdvanceDays) setMaxAdvanceDays(p.maxAdvanceDays);
      if (p.bufferMinutes !== null) setBufferMinutes(p.bufferMinutes ?? 15);
      if (p.availabilitySchedule) {
        try { setSchedule(JSON.parse(p.availabilitySchedule)); } catch {}
      }
      if (p.guidelinesAgreed) setGuidelinesAgreed(p.guidelinesAgreed);
      // Resume from saved step
      if (p.onboardingStep && p.onboardingStep > 1 && !p.onboardingCompleted) {
        setStep(p.onboardingStep);
      }
    }
  }, [profileData]);

  const updateProfile = trpc.coach.updateProfile.useMutation();
  const startStripeOnboarding = trpc.coach.startOnboarding.useMutation();
  const uploadPhotoMutation = trpc.coach.uploadPhoto.useMutation();

  // ── Photo upload handler ──
  const handlePhotoUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file (JPEG, PNG, WebP, or GIF).");
      return;
    }
    if (file.size > 8_000_000) {
      toast.error("Image must be smaller than 8 MB.");
      return;
    }
    setPhotoUploading(true);
    try {
      const reader = new FileReader();
      const base64Data = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          // Strip the data URI prefix ("data:image/jpeg;base64,")
          resolve(result.split(",")[1] ?? "");
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const mimeType = file.type as "image/jpeg" | "image/png" | "image/webp" | "image/gif";
      const { url } = await uploadPhotoMutation.mutateAsync({ base64Data, mimeType });
      setAvatarUrl(url);
      toast.success("Photo uploaded successfully!");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to upload photo. Please try again.");
    } finally {
      setPhotoUploading(false);
    }
  }, [uploadPhotoMutation]);
  const stripeStatus = trpc.coach.getOnboardingStatus.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchOnWindowFocus: true,
  });
  const confirmStripeOnboarded = trpc.coach.confirmStripeOnboarded.useMutation();

  // ── Save current step and advance ──
  async function saveAndNext() {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { onboardingStep: step + 1 };

      if (step === 2) {
        Object.assign(payload, { name, bio, avatarUrl: avatarUrl || undefined, country, timezone });
      } else if (step === 3) {
        Object.assign(payload, {
          title,
          fideRating: fideRating ? parseInt(fideRating) : undefined,
          lichessUsername: lichessUsername || undefined,
          chesscomUsername: chesscomUsername || undefined,
          experienceYears,
        });
      } else if (step === 4) {
        Object.assign(payload, { specialties, teachingStyle, languages });
      } else if (step === 5) {
        Object.assign(payload, {
          hourlyRateCents: Math.round(hourlyRate * 100),
          lessonDurations,
          packageDiscountEnabled: packageDiscount,
          packageDiscountPercent,
          minAdvanceHours,
          maxAdvanceDays,
          bufferMinutes,
        });
      } else if (step === 6) {
        Object.assign(payload, { availabilitySchedule: schedule });
      }

      await updateProfile.mutateAsync(payload as any);
      setStep((s) => s + 1);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleGoLive() {
    if (!guidelinesAgreed) {
      toast.error("Please agree to the coach guidelines to continue.");
      return;
    }
    setSaving(true);
    try {
      await updateProfile.mutateAsync({
        guidelinesAgreed: true,
        onboardingCompleted: true,
        profileActive: true,
        onboardingStep: 7,
      } as any);
      toast.success("Your coach profile is now live! 🎉");
      navigate("/coach/dashboard");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to go live. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleStripeConnect() {
    setSaving(true);
    try {
      const result = await startStripeOnboarding.mutateAsync();
      if (result.url) {
        window.open(result.url, "_blank");
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to start Stripe setup.");
    } finally {
      setSaving(false);
    }
  }

  // ── Check for Stripe return / refresh ──
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("stripe_return") === "1") {
      // Verify Stripe account is actually onboarded and persist the flag
      stripeStatus.refetch().then(({ data }) => {
        if (data?.onboarded) {
          confirmStripeOnboarded.mutate(undefined, {
            onSuccess: () => toast.success("Stripe setup completed! Review your profile and go live."),
            onError: () => toast.success("Stripe setup completed! You can go live now."),
          });
        } else {
          toast.info("Stripe setup in progress — you may need to complete additional verification steps.");
        }
      });
      // Clean the URL to prevent re-processing on refresh
      window.history.replaceState({}, "", "/coach/onboarding");
      setStep(7);
    }
    if (params.get("stripe_refresh") === "1") {
      toast.error("Your Stripe setup session expired. Please try again.");
      window.history.replaceState({}, "", "/coach/onboarding");
      setStep(7);
    }
  }, []);

  // ── Toggle helpers ──
  function toggleSpecialty(s: string) {
    setSpecialties((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  }
  function toggleLanguage(code: string) {
    setLanguages((prev) => prev.includes(code) ? prev.filter((x) => x !== code) : [...prev, code]);
  }
  function toggleDuration(d: number) {
    setLessonDurations((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]);
  }
  function toggleDay(day: string) {
    setSchedule((prev) => ({
      ...prev,
      [day]: { ...prev[day], enabled: !prev[day]?.enabled },
    }));
  }
  function updateSlot(day: string, idx: number, field: "start" | "end", value: string) {
    setSchedule((prev) => {
      const slots = [...(prev[day]?.slots ?? [])];
      slots[idx] = { ...slots[idx], [field]: value };
      return { ...prev, [day]: { ...prev[day], slots } };
    });
  }

  const progress = ((step - 1) / (STEPS.length - 1)) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-slate-950/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <a
            href="/"
            className="inline-flex items-center gap-2 text-[13px] text-white/50 hover:text-white transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Home
          </a>
          <div className="flex items-center gap-3 flex-1 justify-center">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-black font-bold text-sm">B</div>
            <span className="font-semibold text-white hidden sm:inline">Coach Setup</span>
          </div>
          <span className="text-sm text-slate-400 whitespace-nowrap">Step {step} of {STEPS.length}</span>
        </div>
        {/* Progress bar */}
        <div className="h-1 bg-slate-800">
          <div
            className="h-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Step indicators */}
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-8">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const isComplete = step > s.id;
            const isCurrent = step === s.id;
            return (
              <div key={s.id} className="flex flex-col items-center gap-1">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 ${
                  isComplete ? "bg-amber-400 text-black" :
                  isCurrent ? "bg-amber-400/20 border-2 border-amber-400 text-amber-400" :
                  "bg-slate-800 text-slate-500"
                }`}>
                  {isComplete ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-4 h-4" />}
                </div>
                <span className={`text-xs hidden sm:block ${isCurrent ? "text-amber-400" : isComplete ? "text-slate-300" : "text-slate-600"}`}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* ── Step Content ── */}
        <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-6 sm:p-8 backdrop-blur-sm">

          {/* STEP 1: Welcome */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mx-auto">
                  <Sparkles className="w-8 h-8 text-black" />
                </div>
                <h1 className="text-2xl font-bold">Welcome to BooGMe Coaching</h1>
                <p className="text-slate-400 max-w-md mx-auto">
                  Let's set up your coach profile in 7 quick steps. This takes about 5 minutes and you can save and return anytime.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { icon: Globe, title: "Global reach", desc: "Connect with students worldwide" },
                  { icon: DollarSign, title: "Set your rates", desc: "You control your pricing" },
                  { icon: Calendar, title: "Your schedule", desc: "Teach when it suits you" },
                  { icon: Shield, title: "Secure payments", desc: "Stripe-powered payouts" },
                ].map(({ icon: Icon, title, desc }) => (
                  <div key={title} className="flex items-start gap-3 p-4 rounded-xl bg-slate-800/50 border border-white/5">
                    <div className="w-9 h-9 rounded-lg bg-amber-400/10 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-4 h-4 text-amber-400" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{title}</p>
                      <p className="text-xs text-slate-400">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Button onClick={() => setStep(2)} className="w-full bg-amber-400 hover:bg-amber-500 text-black font-semibold h-12">
                Get Started <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          )}

          {/* STEP 2: Personal Profile */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2"><User className="w-5 h-5 text-amber-400" /> Personal Profile</h2>
                <p className="text-slate-400 text-sm mt-1">This is what students see on your coach card.</p>
              </div>
              <div className="space-y-4">
                <div>
                  <Label className="text-slate-300 mb-1.5 block">Full Name *</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Magnus Carlsen" className="bg-slate-800 border-slate-700 text-white" />
                </div>
                <div>
                  <Label className="text-slate-300 mb-1.5 block">Bio <span className="text-slate-500 text-xs">({bio.length}/2000)</span></Label>
                  <Textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Tell students about your chess background, coaching philosophy, and what makes your sessions unique..."
                    className="bg-slate-800 border-slate-700 text-white min-h-[120px]"
                    maxLength={2000}
                  />
                </div>
                {/* Profile Photo Upload */}
                <div>
                  <Label className="text-slate-300 mb-2 block">Profile Photo</Label>
                  {/* Hidden file input */}
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handlePhotoUpload(file);
                      e.target.value = "";
                    }}
                  />
                  <div className="flex items-start gap-4">
                    {/* Avatar preview */}
                    <div className="relative flex-shrink-0">
                      {avatarUrl ? (
                        <div className="relative">
                          <img
                            src={avatarUrl}
                            alt="Profile preview"
                            className="w-20 h-20 rounded-full object-cover border-2 border-amber-400/40"
                            onError={() => setAvatarUrl("")}
                          />
                          <button
                            type="button"
                            onClick={() => setAvatarUrl("")}
                            className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center hover:bg-red-600 transition-colors"
                          >
                            <X className="w-3 h-3 text-white" />
                          </button>
                        </div>
                      ) : (
                        <div className="w-20 h-20 rounded-full bg-slate-800 border-2 border-dashed border-slate-600 flex items-center justify-center">
                          <Camera className="w-7 h-7 text-slate-500" />
                        </div>
                      )}
                    </div>
                    {/* Drop zone */}
                    <div
                      className={`flex-1 border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
                        photoDragOver
                          ? "border-amber-400 bg-amber-400/10"
                          : "border-slate-700 hover:border-slate-500 bg-slate-800/50"
                      }`}
                      onClick={() => photoInputRef.current?.click()}
                      onDragOver={(e) => { e.preventDefault(); setPhotoDragOver(true); }}
                      onDragLeave={() => setPhotoDragOver(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setPhotoDragOver(false);
                        const file = e.dataTransfer.files?.[0];
                        if (file) handlePhotoUpload(file);
                      }}
                    >
                      {photoUploading ? (
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-7 h-7 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                          <span className="text-sm text-slate-400">Uploading...</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <Upload className="w-6 h-6 text-slate-400" />
                          <p className="text-sm text-slate-300 font-medium">Drop photo here or click to browse</p>
                          <p className="text-xs text-slate-500">JPEG, PNG, WebP or GIF · max 8 MB</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-300 mb-1.5 block">Country</Label>
                    <Input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="e.g. United States" className="bg-slate-800 border-slate-700 text-white" />
                  </div>
                  <div>
                    <Label className="text-slate-300 mb-1.5 block">Timezone</Label>
                    <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="America/New_York" className="bg-slate-800 border-slate-700 text-white" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Chess Credentials */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2"><Trophy className="w-5 h-5 text-amber-400" /> Chess Credentials</h2>
                <p className="text-slate-400 text-sm mt-1">Help students understand your chess background.</p>
              </div>
              <div className="space-y-4">
                <div>
                  <Label className="text-slate-300 mb-2 block">FIDE Title</Label>
                  <div className="flex flex-wrap gap-2">
                    {TITLES.map((t) => (
                      <button
                        key={t}
                        onClick={() => setTitle(t)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                          title === t
                            ? "bg-amber-400 border-amber-400 text-black"
                            : "bg-slate-800 border-slate-700 text-slate-300 hover:border-amber-400/50"
                        }`}
                      >
                        {t === "none" ? "No Title" : t}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-slate-300 mb-1.5 block">FIDE Rating</Label>
                  <Input
                    value={fideRating}
                    onChange={(e) => setFideRating(e.target.value.replace(/\D/g, ""))}
                    placeholder="e.g. 2650"
                    className="bg-slate-800 border-slate-700 text-white"
                    type="number"
                    min={0}
                    max={3000}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-300 mb-1.5 block">Lichess Username</Label>
                    <Input value={lichessUsername} onChange={(e) => setLichessUsername(e.target.value)} placeholder="your-username" className="bg-slate-800 border-slate-700 text-white" />
                  </div>
                  <div>
                    <Label className="text-slate-300 mb-1.5 block">Chess.com Username</Label>
                    <Input value={chesscomUsername} onChange={(e) => setChesscomUsername(e.target.value)} placeholder="your-username" className="bg-slate-800 border-slate-700 text-white" />
                  </div>
                </div>
                <div>
                  <Label className="text-slate-300 mb-2 block">Years of Coaching Experience: <span className="text-amber-400">{experienceYears}</span></Label>
                  <Slider
                    value={[experienceYears]}
                    onValueChange={([v]) => setExperienceYears(v)}
                    min={0}
                    max={30}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-slate-500 mt-1">
                    <span>0</span><span>10</span><span>20</span><span>30+</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Specialties & Teaching Style */}
          {step === 4 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2"><BookOpen className="w-5 h-5 text-amber-400" /> Teaching Style</h2>
                <p className="text-slate-400 text-sm mt-1">Help students find the right coach for their learning style.</p>
              </div>
              <div>
                <Label className="text-slate-300 mb-2 block">Specialties <span className="text-slate-500 text-xs">(select all that apply)</span></Label>
                <div className="flex flex-wrap gap-2">
                  {SPECIALTIES.map((s) => (
                    <button
                      key={s}
                      onClick={() => toggleSpecialty(s)}
                      className={`px-3 py-1.5 rounded-full text-sm border transition-all ${
                        specialties.includes(s)
                          ? "bg-amber-400/20 border-amber-400 text-amber-300"
                          : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-slate-300 mb-2 block">Teaching Style</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { value: "visual", label: "Visual", desc: "Diagrams, boards, visual patterns" },
                    { value: "interactive", label: "Interactive", desc: "Live analysis, Q&A, puzzles" },
                    { value: "analytical", label: "Analytical", desc: "Deep calculation, engine work" },
                    { value: "competitive", label: "Competitive", desc: "Tournament prep, game analysis" },
                  ].map(({ value, label, desc }) => (
                    <button
                      key={value}
                      onClick={() => setTeachingStyle(value as any)}
                      className={`p-3 rounded-xl text-left border transition-all ${
                        teachingStyle === value
                          ? "bg-amber-400/10 border-amber-400 text-white"
                          : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600"
                      }`}
                    >
                      <p className="font-medium text-sm">{label}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-slate-300 mb-2 block">Languages</Label>
                <div className="flex flex-wrap gap-2">
                  {LANGUAGES.map(({ code, label }) => (
                    <button
                      key={code}
                      onClick={() => toggleLanguage(code)}
                      className={`px-3 py-1.5 rounded-full text-sm border transition-all ${
                        languages.includes(code)
                          ? "bg-amber-400/20 border-amber-400 text-amber-300"
                          : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: Pricing */}
          {step === 5 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2"><DollarSign className="w-5 h-5 text-amber-400" /> Pricing & Lessons</h2>
                <p className="text-slate-400 text-sm mt-1">Set your rates and lesson preferences.</p>
              </div>
              <div>
                <Label className="text-slate-300 mb-2 block">
                  Hourly Rate: <span className="text-amber-400 font-bold">${hourlyRate}/hr</span>
                </Label>
                <Slider
                  value={[hourlyRate]}
                  onValueChange={([v]) => setHourlyRate(v)}
                  min={5}
                  max={500}
                  step={5}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  <span>$5</span><span>$100</span><span>$250</span><span>$500</span>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  BooGMe takes a 15% platform fee. You receive <span className="text-green-400">${(hourlyRate * 0.85).toFixed(0)}/hr</span>.
                </p>
              </div>
              <div>
                <Label className="text-slate-300 mb-2 block">Lesson Durations Offered</Label>
                <div className="flex gap-3">
                  {[30, 45, 60, 90, 120].map((d) => (
                    <button
                      key={d}
                      onClick={() => toggleDuration(d)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${
                        lessonDurations.includes(d)
                          ? "bg-amber-400 border-amber-400 text-black"
                          : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600"
                      }`}
                    >
                      {d}m
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="pkg"
                    checked={packageDiscount}
                    onCheckedChange={(v) => setPackageDiscount(!!v)}
                    className="border-slate-600"
                  />
                  <Label htmlFor="pkg" className="text-slate-300 cursor-pointer">Offer package discount</Label>
                </div>
                {packageDiscount && (
                  <div>
                    <Label className="text-slate-300 mb-2 block">Discount: <span className="text-amber-400">{packageDiscountPercent}%</span> off 5+ lessons</Label>
                    <Slider
                      value={[packageDiscountPercent]}
                      onValueChange={([v]) => setPackageDiscountPercent(v)}
                      min={5}
                      max={30}
                      step={5}
                      className="w-full"
                    />
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-slate-300 mb-1.5 block text-xs">Min advance notice</Label>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      value={minAdvanceHours}
                      onChange={(e) => setMinAdvanceHours(Number(e.target.value))}
                      min={1}
                      max={168}
                      className="bg-slate-800 border-slate-700 text-white text-sm"
                    />
                    <span className="text-slate-500 text-xs">hrs</span>
                  </div>
                </div>
                <div>
                  <Label className="text-slate-300 mb-1.5 block text-xs">Max advance booking</Label>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      value={maxAdvanceDays}
                      onChange={(e) => setMaxAdvanceDays(Number(e.target.value))}
                      min={1}
                      max={90}
                      className="bg-slate-800 border-slate-700 text-white text-sm"
                    />
                    <span className="text-slate-500 text-xs">days</span>
                  </div>
                </div>
                <div>
                  <Label className="text-slate-300 mb-1.5 block text-xs">Buffer between lessons</Label>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      value={bufferMinutes}
                      onChange={(e) => setBufferMinutes(Number(e.target.value))}
                      min={0}
                      max={60}
                      step={5}
                      className="bg-slate-800 border-slate-700 text-white text-sm"
                    />
                    <span className="text-slate-500 text-xs">min</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 6: Availability Schedule */}
          {step === 6 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2"><Calendar className="w-5 h-5 text-amber-400" /> Weekly Schedule</h2>
                <p className="text-slate-400 text-sm mt-1">Set your default weekly availability. Students can only book during these hours.</p>
              </div>
              <div className="space-y-2">
                {DAYS.map((day) => {
                  const dayData = schedule[day] ?? { enabled: false, slots: [{ start: "09:00", end: "17:00" }] };
                  return (
                    <div key={day} className={`rounded-xl border p-3 transition-all ${dayData.enabled ? "bg-slate-800/60 border-slate-700" : "bg-slate-900/40 border-slate-800"}`}>
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={dayData.enabled}
                          onCheckedChange={() => toggleDay(day)}
                          className="border-slate-600"
                        />
                        <span className={`w-10 text-sm font-medium ${dayData.enabled ? "text-white" : "text-slate-500"}`}>
                          {DAY_LABELS[day]}
                        </span>
                        {dayData.enabled && dayData.slots.map((slot, idx) => (
                          <div key={idx} className="flex items-center gap-2 flex-1">
                            <Input
                              type="time"
                              value={slot.start}
                              onChange={(e) => updateSlot(day, idx, "start", e.target.value)}
                              className="bg-slate-700 border-slate-600 text-white text-sm h-8 min-w-0 flex-1 max-w-[120px]"
                            />
                            <span className="text-slate-500 text-xs">to</span>
                            <Input
                              type="time"
                              value={slot.end}
                              onChange={(e) => updateSlot(day, idx, "end", e.target.value)}
                              className="bg-slate-700 border-slate-600 text-white text-sm h-8 min-w-0 flex-1 max-w-[120px]"
                            />
                          </div>
                        ))}
                        {!dayData.enabled && <span className="text-slate-600 text-sm">Unavailable</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 7: Go Live */}
          {step === 7 && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mx-auto">
                  <Zap className="w-8 h-8 text-black" />
                </div>
                <h2 className="text-2xl font-bold">Almost there!</h2>
                <p className="text-slate-400 text-sm">Set up payments and agree to our guidelines to go live.</p>
              </div>

              {/* Stripe Connect */}
              <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700 space-y-3">
                <div className="flex items-center gap-3">
                  <CreditCard className="w-5 h-5 text-amber-400" />
                  <div>
                    <p className="font-medium text-sm">Stripe Connect</p>
                    <p className="text-xs text-slate-400">Required to receive lesson payments</p>
                  </div>
                  {profileData?.user?.stripeConnectOnboarded ? (
                    <Badge className="ml-auto bg-green-500/20 text-green-400 border-green-500/30">Connected</Badge>
                  ) : (
                    <Badge className="ml-auto bg-slate-700 text-slate-400 border-slate-600">Not set up</Badge>
                  )}
                </div>
                {!profileData?.user?.stripeConnectOnboarded && (
                  <Button
                    onClick={handleStripeConnect}
                    disabled={saving}
                    variant="outline"
                    className="w-full border-amber-400/50 text-amber-400 hover:bg-amber-400/10"
                  >
                    <CreditCard className="w-4 h-4 mr-2" />
                    Set Up Stripe Payments
                  </Button>
                )}
              </div>

              {/* Profile summary */}
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700 space-y-2">
                <p className="font-medium text-sm text-slate-300 mb-3">Profile Summary</p>
                {[
                  { label: "Name", value: name || user?.name },
                  { label: "Title", value: title !== "none" ? title : "No title" },
                  { label: "Rate", value: `$${hourlyRate}/hr` },
                  { label: "Specialties", value: specialties.length > 0 ? `${specialties.length} selected` : "None" },
                  { label: "Schedule", value: `${Object.values(schedule).filter((d) => d.enabled).length} days/week` },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-slate-500">{label}</span>
                    <span className="text-slate-200">{value}</span>
                  </div>
                ))}
              </div>

              {/* Guidelines agreement */}
              <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-800/40 border border-slate-700">
                <Checkbox
                  id="guidelines"
                  checked={guidelinesAgreed}
                  onCheckedChange={(v) => setGuidelinesAgreed(!!v)}
                  className="border-slate-600 mt-0.5"
                />
                <Label htmlFor="guidelines" className="text-slate-300 text-sm cursor-pointer leading-relaxed">
                  I agree to the{" "}
                  <a href="/terms" target="_blank" className="text-amber-400 hover:underline">Coach Guidelines</a>
                  {" "}and{" "}
                  <a href="/terms" target="_blank" className="text-amber-400 hover:underline">Terms of Service</a>.
                  I understand that BooGMe takes a 15% platform fee on all lessons.
                </Label>
              </div>

              <Button
                onClick={handleGoLive}
                disabled={saving || !guidelinesAgreed}
                className="w-full bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-black font-bold h-12 text-base"
              >
                <Star className="w-5 h-5 mr-2" />
                Go Live — Publish My Profile
              </Button>
            </div>
          )}

          {/* Navigation buttons */}
          {step > 1 && step < 7 && (
            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                onClick={() => setStep((s) => s - 1)}
                className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800"
              >
                <ChevronLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              <Button
                onClick={saveAndNext}
                disabled={saving}
                className="flex-1 bg-amber-400 hover:bg-amber-500 text-black font-semibold"
              >
                {saving ? "Saving..." : "Continue"} <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
