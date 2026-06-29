import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { rankCoachesForStudent, toCoachForMatching, parseJsonArray, type StudentForMatching } from "@shared/coachMatching";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Star,
  Award,
  ChevronRight,
  ArrowLeft,
  Menu,
  LayoutGrid,
  List,
  Trophy,
} from "lucide-react";
import { useLocation } from "wouter";
import Footer from "@/components/Footer";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useState, useMemo } from "react";

// ── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

type ProfileCompleteness = { photo: boolean; bio: boolean; video: boolean; availability: boolean };

function getCompleteness(user: any, profile: any): ProfileCompleteness {
  return {
    photo: !!(profile?.profilePhotoUrl || user?.avatarUrl),
    bio: (user?.bio?.length ?? 0) > 20,
    video: !!profile?.videoIntroUrl,
    availability: profile?.isAvailable === true,
  };
}

function completenessScore(c: ProfileCompleteness): number {
  return [c.photo, c.bio, c.video, c.availability].filter(Boolean).length;
}

// ── Filters & Sorts ──────────────────────────────────────────────────────────

const FILTER_OPTIONS = ["All", "GM/IM", "Under $100", "Openings", "Endgames", "Tactics"] as const;
type FilterKey = (typeof FILTER_OPTIONS)[number];

const SORT_OPTIONS = ["Best Match", "Top Rated", "Price: Low to High", "Most Lessons", "Newest"] as const;
type SortKey = (typeof SORT_OPTIONS)[number];

function matchesFilter(coach: any, filter: FilterKey): boolean {
  if (filter === "All") return true;
  const p = coach.coach_profiles;
  if (filter === "GM/IM") return ["GM", "IM"].includes(p?.title);
  if (filter === "Under $100") return (p?.hourlyRateCents ?? 0) < 10000;
  const specs = parseJsonArray(p?.specialties).map((s: string) => s.toLowerCase());
  const term = filter.toLowerCase();
  return specs.some((s: string) => s.includes(term));
}

function coachId(c: any): number {
  return c.users?.id ?? c.coach_profiles?.userId ?? 0;
}

function profileToStudent(studentProfile: any): StudentForMatching {
  return {
    learningStyle: studentProfile.learningStyle,
    improvementAreas: studentProfile.improvementAreas,
    budgetMinCents: studentProfile.budgetMinCents,
    budgetMaxCents: studentProfile.budgetMaxCents,
    currentRating: studentProfile.currentRating,
    credentialImportance: studentProfile.credentialImportance,
    playingStyle: studentProfile.playingStyle,
    assessmentData: studentProfile.assessmentData,
  };
}

function sortCoaches(arr: any[], sort: SortKey, matchScores?: Map<number, number> | null): any[] {
  // "Best Match" sorts by the precomputed score map (computed once in the
  // component so the same scores can label the cards). Falls through to the
  // default comparator when no scores are available (no profile).
  if (sort === "Best Match" && matchScores) {
    return [...arr].sort((a, b) => (matchScores.get(coachId(b)) ?? 0) - (matchScores.get(coachId(a)) ?? 0));
  }

  return [...arr].sort((a, b) => {
    const pa = a.coach_profiles;
    const pb = b.coach_profiles;
    switch (sort) {
      case "Top Rated":
        return parseFloat(pb?.averageRating ?? "0") - parseFloat(pa?.averageRating ?? "0");
      case "Price: Low to High":
        return (pa?.hourlyRateCents ?? 0) - (pb?.hourlyRateCents ?? 0);
      case "Most Lessons":
        return (pb?.totalLessons ?? 0) - (pa?.totalLessons ?? 0);
      case "Newest":
        return (b.users?.id ?? 0) - (a.users?.id ?? 0);
      default:
        return 0;
    }
  });
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CoachBrowse() {
  useDocumentTitle("Browse Chess Coaches · BooGMe");
  const [, setLocation] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [filter, setFilter] = useState<FilterKey>("All");
  const [sort, setSort] = useState<SortKey>("Top Rated");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const { user } = useAuth();
  const { data: coaches, isLoading } = trpc.coach.listActive.useQuery();
  const { data: studentProfile } = trpc.student.getProfile.useQuery(undefined, {
    enabled: !!user,
  });

  // Score every coach once when "Best Match" is active — reused for both the
  // sort order and the per-card match badge (no wasted re-scoring).
  const matchScores = useMemo(() => {
    if (sort !== "Best Match" || !studentProfile || !coaches) return null;
    const ranked = rankCoachesForStudent(coaches.map(toCoachForMatching), profileToStudent(studentProfile));
    return new Map(ranked.map((r) => [r.coachUserId, r.score]));
  }, [sort, studentProfile, coaches]);

  const filtered = useMemo(() => {
    if (!coaches) return [];
    const matched = coaches.filter((c: any) => matchesFilter(c, filter));
    return sortCoaches(matched, sort, matchScores);
  }, [coaches, filter, sort, matchScores]);

  if (isLoading) return <BrowseSkeleton />;

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation Header */}
      <div className="sticky top-0 z-50 border-b border-border/40 bg-background/95 backdrop-blur-xl">
        <div className="container flex items-center justify-between py-4">
          <button
            onClick={() => setLocation("/")}
            className="flex items-center gap-2 text-sm font-light text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back to Home</span>
          </button>
          <img
            src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663188415081/xRYfqyUGHSJUlDcu.png"
            alt="BooGMe"
            className="h-8 w-auto"
          />
          <button className="md:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            <Menu className="w-5 h-5" />
          </button>
          <div className="hidden md:block w-20" />
        </div>
      </div>

      {/* Hero bar */}
      <div className="border-b border-border/40">
        <div className="container py-10">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div>
              <h1 className="text-5xl font-bold tracking-tight mb-3">Find Your Chess Coach</h1>
              <p className="text-lg text-muted-foreground">
                Vetted coaches. Escrow-protected payments. Pay after the lesson.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {FILTER_OPTIONS.map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3.5 py-1.5 text-sm font-medium transition-colors rounded-sm ${
                    filter === f
                      ? "bg-orange-600 text-white"
                      : "bg-white/5 text-muted-foreground hover:text-foreground hover:bg-white/10"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <p className="mt-4 text-sm text-muted-foreground/60">
            {filtered.length} coach{filtered.length !== 1 ? "es" : ""} available
          </p>
        </div>
      </div>

      {/* Sort bar */}
      <div className="border-b border-border/20">
        <div className="container py-3 flex items-center justify-between">
          <div className="flex items-center gap-1 text-sm">
            <span className="text-muted-foreground mr-2">Sort by:</span>
            {SORT_OPTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setSort(s)}
                className={`px-2.5 py-1 text-sm transition-colors rounded-sm ${
                  sort === s ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-sm transition-colors ${
                viewMode === "grid" ? "text-foreground bg-white/10" : "text-muted-foreground hover:text-foreground"
              }`}
              title="Grid view"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded-sm transition-colors ${
                viewMode === "list" ? "text-foreground bg-white/10" : "text-muted-foreground hover:text-foreground"
              }`}
              title="List view"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Coach list */}
      <div className="container py-10">
        {filtered.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-xl text-muted-foreground mb-4">No coaches match your filters</p>
            <button onClick={() => setFilter("All")} className="text-orange-500 hover:text-orange-400 underline text-sm">
              Reset filters
            </button>
          </div>
        ) : (
          <div
            className={
              viewMode === "grid"
                ? "grid md:grid-cols-2 gap-5"
                : "flex flex-col gap-4"
            }
          >
            {filtered.map((coach: any) => (
              <CoachCard
                key={coach.users.id}
                coach={coach}
                viewMode={viewMode}
                matchScore={matchScores?.get(coach.users.id) ?? null}
              />
            ))}
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}

// ── Coach Card ───────────────────────────────────────────────────────────────

function CoachCard({ coach, viewMode, matchScore }: { coach: any; viewMode: "grid" | "list"; matchScore?: number | null }) {
  const [, setLocation] = useLocation();
  const user = coach.users;
  const profile = coach.coach_profiles;

  const hourlyRate = profile?.hourlyRateCents ? (profile.hourlyRateCents / 100).toFixed(0) : "50";
  const rating = profile?.averageRating ? parseFloat(profile.averageRating as string).toFixed(1) : null;
  const specialties = parseJsonArray(profile?.specialties);
  const photoUrl = profile?.profilePhotoUrl ?? user?.avatarUrl ?? null;
  const completeness = getCompleteness(user, profile);
  const score = completenessScore(completeness);
  const isFull = score === 4;
  const isSparse = score <= 1;

  const bio = user?.bio as string | null;
  const bioExcerpt = bio
    ? viewMode === "list"
      ? bio.slice(0, 120).trimEnd() + (bio.length > 120 ? "…" : "")
      : bio.slice(0, 80).trimEnd() + (bio.length > 80 ? "…" : "")
    : null;

  const maxSpecialties = viewMode === "list" ? 5 : 3;

  return (
    <div
      className={`flex overflow-hidden bg-[#111] hover:bg-[#161616] transition-all cursor-pointer rounded-sm group ${
        isFull ? "border-l-2 border-l-orange-600" : ""
      } ${isSparse ? "opacity-75" : ""}`}
      onClick={() => setLocation(`/coach/${user.id}`)}
    >
      {/* Left panel — photo / initials */}
      <div className={`relative shrink-0 ${viewMode === "list" ? "w-40" : "w-36"} bg-[#0d0d0d]`}>
        {/* Match-score badge — only in Best Match mode */}
        {matchScore != null && (
          <div className="absolute top-0 left-0 z-10 bg-orange-600 text-white text-xs font-bold px-2 py-1 rounded-br-sm">
            {matchScore}% match
          </div>
        )}
        {photoUrl ? (
          <img src={photoUrl} alt={user.name} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-3xl font-bold text-muted-foreground/40">
            {getInitials(user.name)}
          </div>
        )}
        {/* Title badge overlay */}
        {profile?.title && profile.title !== "none" && (
          <div className="absolute bottom-0 left-0 right-0 bg-black/70 py-1.5 px-3">
            <span className="text-orange-500 font-bold text-lg tracking-wide">{profile.title}</span>
          </div>
        )}
      </div>

      {/* Right panel — info */}
      <div className="flex-1 min-w-0 p-5 flex flex-col justify-between gap-3">
        <div className="space-y-2">
          {/* Name + FIDE */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-lg font-bold text-white truncate">{user.name}</h3>
              {profile?.fideRating && (
                <div className="flex items-center gap-1 mt-0.5">
                  <Trophy className="h-3.5 w-3.5 text-orange-500" />
                  <span className="text-sm font-semibold text-orange-500">{profile.fideRating} FIDE</span>
                </div>
              )}
            </div>
            <div className="text-right shrink-0">
              <div className="text-xl font-bold text-white">${hourlyRate}</div>
              <div className="text-[11px] text-muted-foreground">/hr</div>
            </div>
          </div>

          {/* Bio excerpt */}
          {bioExcerpt && (
            <p className="text-sm text-muted-foreground italic leading-snug">{bioExcerpt}</p>
          )}

          {/* Profile completeness dots */}
          <div className="flex items-center gap-3">
            {(["photo", "bio", "video", "availability"] as const).map((key) => (
              <div key={key} className="flex items-center gap-1">
                <div
                  className={`h-2 w-2 rounded-full ${completeness[key] ? "bg-orange-500" : "bg-white/10"}`}
                  title={`${key.charAt(0).toUpperCase() + key.slice(1)}: ${completeness[key] ? "set" : "missing"}`}
                />
                <span className="text-[10px] text-muted-foreground/50 hidden sm:inline">{key.charAt(0).toUpperCase() + key.slice(1)}</span>
              </div>
            ))}
          </div>

          {/* Specialties */}
          {specialties.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {specialties.slice(0, maxSpecialties).map((s: string) => (
                <span key={s} className="text-[11px] px-2 py-0.5 bg-white/5 text-muted-foreground rounded-sm">
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Bottom: Stats + CTA */}
        <div className="flex items-center justify-between pt-2 border-t border-white/5">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            {rating && (
              <span className="flex items-center gap-1">
                <Star className="h-3.5 w-3.5 fill-yellow-500 text-yellow-500" />
                <span className="text-white font-medium">{rating}</span>
              </span>
            )}
            <span>{profile?.totalLessons ?? 0} lessons</span>
            <span>{profile?.totalStudents ?? 0} students</span>
          </div>
          <span className="text-sm text-orange-500 font-medium flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            View Profile <ChevronRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function BrowseSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border/40">
        <div className="container py-10">
          <Skeleton className="h-14 w-96 mb-3" />
          <Skeleton className="h-6 w-full max-w-lg" />
        </div>
      </div>
      <div className="container py-10">
        <div className="grid md:grid-cols-2 gap-5">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex bg-[#111] rounded-sm overflow-hidden">
              <Skeleton className="w-36 h-48 rounded-none" />
              <div className="flex-1 p-5 space-y-3">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-5 w-16" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
