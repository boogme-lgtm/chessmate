/**
 * Coach-student matching engine.
 *
 * Pure, deterministic scoring: no DB access, no side effects, fully
 * unit-testable. Every dimension is transparent — the reasons array
 * tells the student WHY a coach scored high.
 *
 * Total weight = 100. Scores are absolute (0-100), not relative rankings.
 *
 * IMPORTANT: this engine reconciles the assessment UI's vocabulary with the
 * coach-side vocabulary. Students answer in phrases ("Opening preparation",
 * "Evening (5pm-9pm)") and ratings in lichess/chess.com/FIDE; coaches store
 * canonical tags ("Openings") and 24h time slots. Both sides are normalized
 * to a shared vocabulary before comparison — never substring-matched raw.
 */

import type { AssessmentData } from "./assessmentMapping";

export interface CoachForMatching {
  userId: number;
  name: string;
  title: string | null;
  fideRating: number | null;
  specialties: string | null;
  teachingStyle: string | null;
  hourlyRateCents: number | null;
  availabilitySchedule: string | null;
  averageRating: string | null;
  totalLessons: number | null;
  totalStudents: number | null;
  totalReviews: number | null;
  profilePhotoUrl: string | null;
}

export interface StudentForMatching {
  learningStyle: string | null;
  improvementAreas: string | null;
  budgetMinCents: number | null;
  budgetMaxCents: number | null;
  currentRating: number | null;
  credentialImportance: string | null;
  playingStyle: string | null;
  assessmentData: string | null;
}

export interface DimensionScores {
  style: number;
  specialties: number;
  budget: number;
  ratingGap: number;
  credential: number;
  schedule: number;
  styleAlignment: number;
  experience: number;
}

export interface MatchResult {
  coachUserId: number;
  coachName: string;
  score: number;
  reasons: string[];
  breakdown: DimensionScores;
}

const WEIGHTS = {
  style: 20,
  specialties: 18,
  budget: 15,
  ratingGap: 15,
  credential: 10,
  schedule: 10,
  styleAlignment: 7,
  experience: 5,
} as const;

/**
 * Parse a JSON-encoded array, defensively. Returns [] for null, invalid JSON,
 * or any value that doesn't parse to an array (guards against malformed
 * persisted data — e.g. a string stored where an array was expected).
 */
export function parseJsonArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function parseAssessment(raw: string | null | undefined): Partial<AssessmentData> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Build a CoachForMatching from a Drizzle join row ({ coach_profiles, users })
 * or an already-flattened coach object. Single source of truth for the
 * coach→matching adapter, used by both server procedures and the client
 * browse page so the two surfaces can never diverge.
 */
export function toCoachForMatching(row: any): CoachForMatching {
  const p = row?.coach_profiles ?? row ?? {};
  const u = row?.users ?? {};
  return {
    userId: p.userId ?? u.id ?? row?.userId ?? 0,
    name: u.name ?? row?.name ?? "Coach",
    title: p.title ?? row?.title ?? null,
    fideRating: p.fideRating ?? row?.fideRating ?? null,
    specialties: p.specialties ?? row?.specialties ?? null,
    teachingStyle: p.teachingStyle ?? row?.teachingStyle ?? null,
    hourlyRateCents: p.hourlyRateCents ?? row?.hourlyRateCents ?? null,
    availabilitySchedule: p.availabilitySchedule ?? row?.availabilitySchedule ?? null,
    averageRating: p.averageRating ?? row?.averageRating ?? null,
    totalLessons: p.totalLessons ?? row?.totalLessons ?? null,
    totalStudents: p.totalStudents ?? row?.totalStudents ?? null,
    totalReviews: p.totalReviews ?? row?.totalReviews ?? null,
    profilePhotoUrl: p.profilePhotoUrl ?? row?.profilePhotoUrl ?? null,
  };
}

// ── Specialty reconciliation ────────────────────────────────────────────────
// Both student improvement-area phrases and coach specialty labels canonicalize
// to a shared set of slugs via keyword matching, so "Opening preparation" and
// "Openings" both resolve to ["openings"]. Each input can yield multiple slugs
// (e.g. "Tactical calculation" → tactics + calculation).

const SPECIALTY_KEYWORDS: [RegExp, string[]][] = [
  [/open/i, ["openings"]],
  [/middlegame|middle game/i, ["middlegame"]],
  [/endgame/i, ["endgames"]],
  [/tactic/i, ["tactics"]],
  [/calcul/i, ["calculation"]],
  [/position/i, ["positional"]],
  [/strateg/i, ["strategy"]],
  [/attack|defen/i, ["attack-defense"]],
  [/time\s*manage/i, ["time-management"]],
  [/tournament/i, ["tournament-prep"]],
  [/blitz|rapid/i, ["blitz-rapid"]],
  [/classical/i, ["classical"]],
  [/begin|kid/i, ["beginners"]],
  [/psych|mental/i, ["psychology"]],
  [/analys/i, ["analysis", "calculation"]],
];

function canonicalizeArea(value: string): string[] {
  const slugs = new Set<string>();
  for (const [re, mapped] of SPECIALTY_KEYWORDS) {
    if (re.test(value)) mapped.forEach((m) => slugs.add(m));
  }
  // Fall back to a normalized slug so unknown vocab still compares deterministically.
  if (slugs.size === 0) slugs.add(value.toLowerCase().trim());
  return Array.from(slugs);
}

function canonicalizeAreas(values: string[]): Set<string>[] {
  return values.map(canonicalizeArea).map((s) => new Set(s));
}

function countAreaOverlap(studentAreas: string[], coachSpecialties: string[]): number {
  const studentSlugs = canonicalizeAreas(studentAreas);
  const coachSlugs = new Set(coachSpecialties.flatMap(canonicalizeArea));
  return studentSlugs.filter((set) => Array.from(set).some((slug) => coachSlugs.has(slug))).length;
}

// ── Rating normalization ────────────────────────────────────────────────────
// Coach ratings are FIDE. Student ratings come from lichess/chess.com/FIDE,
// which run higher than FIDE for the same player. Normalize the student rating
// to a FIDE-equivalent before computing the gap. These offsets are rough
// directional approximations, not exact conversions.

export function normalizeToFide(rating: number, system: string | null | undefined): number {
  const s = (system ?? "fide").toLowerCase();
  let fideEquiv = rating;
  if (s === "lichess") fideEquiv = rating - 150;
  else if (s === "chesscom" || s === "chess.com") fideEquiv = rating - 100;
  return Math.max(100, fideEquiv);
}

// ── Schedule reconciliation ─────────────────────────────────────────────────
// Student availability is selected as time-of-day labels; coach availability is
// stored as { day: { enabled, slots: [{ start: "HH:MM", end: "HH:MM" }] } }.
// Both reduce to a set of time-of-day buckets (+ a weekend flag) for comparison.

type TimeBucket = "earlymorning" | "morning" | "afternoon" | "evening" | "latenight";

const BUCKET_RANGES: Record<TimeBucket, [number, number]> = {
  earlymorning: [6, 9],
  morning: [9, 12],
  afternoon: [12, 17],
  evening: [17, 21],
  latenight: [21, 24],
};

const WEEKEND_DAYS = new Set(["saturday", "sunday", "sat", "sun"]);

function hhmmToHour(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]) + Number(m[2]) / 60;
  return Number.isFinite(h) ? h : null;
}

interface CoachAvailability {
  buckets: Set<TimeBucket>;
  weekend: boolean;
  hasAny: boolean;
}

function parseCoachAvailability(raw: string | null): CoachAvailability {
  const result: CoachAvailability = { buckets: new Set(), weekend: false, hasAny: false };
  if (!raw) return result;
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return result;
  }
  if (!parsed || typeof parsed !== "object") return result;

  for (const [day, value] of Object.entries(parsed)) {
    const d = value as any;
    if (!d?.enabled) continue;
    const slots: any[] = Array.isArray(d.slots) ? d.slots : [];
    for (const slot of slots) {
      // Slots are { start, end } objects; tolerate a bare "HH:MM-HH:MM" string too.
      let start: number | null = null;
      let end: number | null = null;
      if (slot && typeof slot === "object") {
        start = typeof slot.start === "string" ? hhmmToHour(slot.start) : null;
        end = typeof slot.end === "string" ? hhmmToHour(slot.end) : null;
      } else if (typeof slot === "string" && slot.includes("-")) {
        const [a, b] = slot.split("-");
        start = hhmmToHour(a);
        end = hhmmToHour(b);
      }
      if (start == null || end == null || end <= start) continue;
      result.hasAny = true;
      if (WEEKEND_DAYS.has(day.toLowerCase())) result.weekend = true;
      for (const [bucket, [bStart, bEnd]] of Object.entries(BUCKET_RANGES)) {
        if (start < bEnd && end > bStart) result.buckets.add(bucket as TimeBucket);
      }
    }
  }
  return result;
}

function studentAvailabilityToken(label: string): TimeBucket | "weekend" | "flexible" | null {
  const l = label.toLowerCase();
  if (l.includes("flexible")) return "flexible";
  if (l.includes("weekend")) return "weekend";
  if (l.includes("early morning")) return "earlymorning";
  if (l.includes("morning")) return "morning";
  if (l.includes("afternoon")) return "afternoon";
  if (l.includes("evening")) return "evening";
  if (l.includes("late night") || l.includes("night")) return "latenight";
  return null;
}

// ── Dimension scorers. Each returns { score, real } so reasons only surface
//    when the dimension was judged on actual data (not a neutral default). ──

interface DimScore { score: number; real: boolean; }

function scoreStyle(studentStyle: string | null, coachStyle: string | null): DimScore {
  if (!studentStyle || !coachStyle) return { score: WEIGHTS.style * 0.5, real: false };
  if (studentStyle === coachStyle) return { score: WEIGHTS.style, real: true };
  const compatible: Record<string, string[]> = {
    analytical: ["visual"],
    visual: ["analytical", "interactive"],
    interactive: ["visual", "competitive"],
    competitive: ["interactive"],
  };
  if (compatible[studentStyle]?.includes(coachStyle)) return { score: WEIGHTS.style * 0.6, real: true };
  return { score: 0, real: true };
}

function scoreSpecialties(studentAreas: string[], coachSpecialties: string[]): DimScore {
  if (studentAreas.length === 0 || coachSpecialties.length === 0) {
    return { score: WEIGHTS.specialties * 0.4, real: false };
  }
  const overlap = countAreaOverlap(studentAreas, coachSpecialties);
  if (overlap >= 3) return { score: WEIGHTS.specialties, real: true };
  if (overlap === 2) return { score: WEIGHTS.specialties * 0.83, real: true };
  if (overlap === 1) return { score: WEIGHTS.specialties * 0.55, real: true };
  return { score: 0, real: true };
}

function scoreBudget(coachRateCents: number | null, minCents: number | null, maxCents: number | null): DimScore {
  if (coachRateCents == null || minCents == null || maxCents == null) {
    return { score: WEIGHTS.budget * 0.5, real: false };
  }
  if (coachRateCents >= minCents && coachRateCents <= maxCents) return { score: WEIGHTS.budget, real: true };
  if (coachRateCents < minCents) return { score: WEIGHTS.budget * 0.8, real: true };
  const overRatio = maxCents > 0 ? (coachRateCents - maxCents) / maxCents : 1;
  if (overRatio <= 0.2) return { score: WEIGHTS.budget * 0.53, real: true };
  return { score: 0, real: true };
}

function scoreRatingGap(studentFideRating: number | null, coachFideRating: number | null): DimScore {
  if (studentFideRating == null || coachFideRating == null) {
    return { score: WEIGHTS.ratingGap * 0.53, real: false };
  }
  const gap = coachFideRating - studentFideRating;
  if (gap < 200) return { score: WEIGHTS.ratingGap * 0.33, real: true };
  if (gap < 400) return { score: WEIGHTS.ratingGap * 0.67, real: true };
  if (gap <= 800) return { score: WEIGHTS.ratingGap, real: true };
  if (gap <= 1200) return { score: WEIGHTS.ratingGap * 0.8, real: true };
  return { score: WEIGHTS.ratingGap * 0.53, real: true };
}

const TITLE_TIER: Record<string, number> = {
  GM: 5, WGM: 5, IM: 4, WIM: 4, FM: 3, WFM: 3, CM: 2, WCM: 2, none: 1,
};
const CRED_MIN_TIER: Record<string, number> = {
  gm: 5, titled: 3, somewhat: 2, teaching: 1, notimportant: 1,
};

function scoreCredential(importance: string | null, coachTitle: string | null): DimScore {
  // null = student never stated a preference (e.g. legacy profile) → neutral,
  // NOT full credit. Explicit "notimportant"/"teaching" → full credit.
  if (importance == null) return { score: WEIGHTS.credential * 0.6, real: false };
  if (importance === "notimportant" || importance === "teaching") return { score: WEIGHTS.credential, real: true };
  const minTier = CRED_MIN_TIER[importance] ?? 2;
  const coachTier = TITLE_TIER[coachTitle ?? "none"] ?? 1;
  if (coachTier >= minTier) return { score: WEIGHTS.credential, real: true };
  if (coachTier >= minTier - 1) return { score: WEIGHTS.credential * 0.5, real: true };
  return { score: 0, real: true };
}

function scoreSchedule(studentAvailability: string[] | undefined, coachSchedule: string | null): DimScore {
  if (!studentAvailability?.length || !coachSchedule) return { score: WEIGHTS.schedule * 0.7, real: false };
  const coach = parseCoachAvailability(coachSchedule);
  if (!coach.hasAny) return { score: WEIGHTS.schedule * 0.7, real: false };

  const hasOverlap = studentAvailability.some((label) => {
    const token = studentAvailabilityToken(label);
    if (token === null) return false;
    if (token === "flexible") return coach.hasAny;
    if (token === "weekend") return coach.weekend;
    return coach.buckets.has(token);
  });
  return { score: hasOverlap ? WEIGHTS.schedule : WEIGHTS.schedule * 0.3, real: true };
}

const STYLE_SPECIALTIES: Record<string, string[]> = {
  aggressive: ["tactics", "openings", "attack-defense"],
  positional: ["positional", "strategy", "endgames"],
  balanced: ["openings", "endgames", "tactics", "positional"],
  defensive: ["endgames", "positional", "attack-defense"],
};

function scoreStyleAlignment(studentStyle: string | null, coachSpecialties: string[]): DimScore {
  if (!studentStyle || coachSpecialties.length === 0) return { score: WEIGHTS.styleAlignment * 0.5, real: false };
  const preferred = STYLE_SPECIALTIES[studentStyle] ?? [];
  if (preferred.length === 0) return { score: WEIGHTS.styleAlignment * 0.5, real: false };
  const coachSlugs = new Set(coachSpecialties.flatMap(canonicalizeArea));
  const overlap = preferred.filter((p) => coachSlugs.has(p)).length;
  if (overlap >= 2) return { score: WEIGHTS.styleAlignment, real: true };
  if (overlap === 1) return { score: WEIGHTS.styleAlignment * 0.7, real: true };
  return { score: WEIGHTS.styleAlignment * 0.3, real: true };
}

function scoreExperience(coach: CoachForMatching): DimScore {
  const rating = parseFloat(coach.averageRating ?? "0");
  const lessons = coach.totalLessons ?? 0;
  const reviews = coach.totalReviews ?? 0;
  let s = 0;
  if (rating >= 4.5) s += 2;
  else if (rating >= 4.0) s += 1;
  if (lessons >= 50) s += 1.5;
  else if (lessons >= 10) s += 0.75;
  if (reviews >= 10) s += 1.5;
  else if (reviews >= 3) s += 0.75;
  const real = lessons > 0 || reviews > 0;
  return { score: Math.min(s, WEIGHTS.experience), real };
}

const DIMENSION_LABELS: Record<keyof DimensionScores, string> = {
  style: "Teaching style aligns with your learning preference",
  specialties: "Specializes in your improvement areas",
  budget: "Within your budget range",
  ratingGap: "Right skill level to challenge and teach you",
  credential: "Meets your credential preferences",
  schedule: "Available when you are",
  styleAlignment: "Playing style complements your chess personality",
  experience: "Proven track record with students",
};

/**
 * Surface up to 3 reasons, but ONLY for dimensions judged on real data and
 * scoring a genuine match (≥70% of the dimension's weight). This prevents
 * fabricated reasons like "Within your budget range" when no budget was given.
 */
function topReasons(
  breakdown: DimensionScores,
  real: Record<keyof DimensionScores, boolean>
): string[] {
  return (Object.entries(breakdown) as [keyof DimensionScores, number][])
    .filter(([key, value]) => real[key] && value >= WEIGHTS[key] * 0.7)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([key]) => DIMENSION_LABELS[key]);
}

export function scoreCoachForStudent(coach: CoachForMatching, student: StudentForMatching): MatchResult {
  const assessment = parseAssessment(student.assessmentData);
  const coachSpecialties = parseJsonArray(coach.specialties);
  const studentAreas = parseJsonArray(student.improvementAreas);
  const studentFide =
    student.currentRating == null
      ? null
      : normalizeToFide(student.currentRating, assessment?.ratingSystem);

  const dims = {
    style: scoreStyle(student.learningStyle, coach.teachingStyle),
    specialties: scoreSpecialties(studentAreas, coachSpecialties),
    budget: scoreBudget(coach.hourlyRateCents, student.budgetMinCents, student.budgetMaxCents),
    ratingGap: scoreRatingGap(studentFide, coach.fideRating),
    credential: scoreCredential(student.credentialImportance, coach.title),
    schedule: scoreSchedule(assessment?.availability, coach.availabilitySchedule),
    styleAlignment: scoreStyleAlignment(student.playingStyle, coachSpecialties),
    experience: scoreExperience(coach),
  };

  const breakdown: DimensionScores = {
    style: Math.round(dims.style.score),
    specialties: Math.round(dims.specialties.score),
    budget: Math.round(dims.budget.score),
    ratingGap: Math.round(dims.ratingGap.score),
    credential: Math.round(dims.credential.score),
    schedule: Math.round(dims.schedule.score),
    styleAlignment: Math.round(dims.styleAlignment.score),
    experience: Math.round(dims.experience.score),
  };
  const real = {
    style: dims.style.real,
    specialties: dims.specialties.real,
    budget: dims.budget.real,
    ratingGap: dims.ratingGap.real,
    credential: dims.credential.real,
    schedule: dims.schedule.real,
    styleAlignment: dims.styleAlignment.real,
    experience: dims.experience.real,
  };

  // Sum the raw (unrounded) scores, then clamp — avoids per-dimension rounding
  // pushing the displayed total above 100.
  const rawTotal = Object.values(dims).reduce((sum, d) => sum + d.score, 0);
  const score = Math.min(100, Math.max(0, Math.round(rawTotal)));
  const reasons = topReasons(breakdown, real);

  return {
    coachUserId: coach.userId,
    coachName: coach.name,
    score,
    reasons: reasons.length > 0 ? reasons : ["Available on BooGMe"],
    breakdown,
  };
}

export function rankCoachesForStudent(
  coaches: CoachForMatching[],
  student: StudentForMatching
): MatchResult[] {
  return coaches
    .map((coach) => scoreCoachForStudent(coach, student))
    .sort((a, b) => b.score - a.score);
}
