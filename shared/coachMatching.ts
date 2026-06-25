/**
 * Coach-student matching engine.
 *
 * Pure, deterministic scoring: no DB access, no side effects, fully
 * unit-testable. Every dimension is transparent — the reasons array
 * tells the student WHY a coach scored high.
 *
 * Total weight = 100. Scores are absolute (0-100), not relative rankings.
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

function parseJsonArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

function parseAssessment(raw: string | null | undefined): Partial<AssessmentData> | null {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function scoreStyle(studentStyle: string | null, coachStyle: string | null): number {
  if (!studentStyle || !coachStyle) return WEIGHTS.style * 0.5;
  if (studentStyle === coachStyle) return WEIGHTS.style;
  const compatible: Record<string, string[]> = {
    analytical: ["visual"],
    visual: ["analytical", "interactive"],
    interactive: ["visual", "competitive"],
    competitive: ["interactive"],
  };
  if (compatible[studentStyle]?.includes(coachStyle)) return WEIGHTS.style * 0.6;
  return 0;
}

function scoreSpecialties(studentAreas: string[], coachSpecialties: string[]): number {
  if (studentAreas.length === 0 || coachSpecialties.length === 0) return WEIGHTS.specialties * 0.4;
  const sLower = studentAreas.map(s => s.toLowerCase());
  const cLower = coachSpecialties.map(s => s.toLowerCase());
  const overlap = sLower.filter(s => cLower.some(c => c.includes(s) || s.includes(c))).length;
  if (overlap >= 3) return WEIGHTS.specialties;
  if (overlap === 2) return WEIGHTS.specialties * 0.83;
  if (overlap === 1) return WEIGHTS.specialties * 0.55;
  return 0;
}

function scoreBudget(coachRateCents: number | null, minCents: number | null, maxCents: number | null): number {
  if (!coachRateCents || !minCents || !maxCents) return WEIGHTS.budget * 0.5;
  if (coachRateCents >= minCents && coachRateCents <= maxCents) return WEIGHTS.budget;
  if (coachRateCents < minCents) return WEIGHTS.budget * 0.8;
  const overRatio = (coachRateCents - maxCents) / maxCents;
  if (overRatio <= 0.2) return WEIGHTS.budget * 0.53;
  return 0;
}

function scoreRatingGap(studentRating: number | null, coachFideRating: number | null): number {
  if (!studentRating || !coachFideRating) return WEIGHTS.ratingGap * 0.53;
  const gap = coachFideRating - studentRating;
  if (gap < 200) return WEIGHTS.ratingGap * 0.33;
  if (gap < 400) return WEIGHTS.ratingGap * 0.67;
  if (gap <= 800) return WEIGHTS.ratingGap;
  if (gap <= 1200) return WEIGHTS.ratingGap * 0.8;
  return WEIGHTS.ratingGap * 0.53;
}

const TITLE_TIER: Record<string, number> = {
  GM: 5, WGM: 5, IM: 4, WIM: 4, FM: 3, WFM: 3, CM: 2, WCM: 2, none: 1,
};
const CRED_MIN_TIER: Record<string, number> = {
  gm: 5, titled: 3, somewhat: 2, teaching: 1, notimportant: 1,
};

function scoreCredential(importance: string | null, coachTitle: string | null): number {
  if (!importance || importance === "notimportant" || importance === "teaching") return WEIGHTS.credential;
  const minTier = CRED_MIN_TIER[importance] ?? 2;
  const coachTier = TITLE_TIER[coachTitle ?? "none"] ?? 1;
  if (coachTier >= minTier) return WEIGHTS.credential;
  if (coachTier >= minTier - 1) return WEIGHTS.credential * 0.5;
  return 0;
}

function parseScheduleSlots(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    const slots: string[] = [];
    for (const day of Object.values(parsed)) {
      const d = day as any;
      if (d?.enabled && Array.isArray(d?.slots)) slots.push(...d.slots);
      if (d?.enabled && typeof d?.start === "string") slots.push(`${d.start}-${d.end}`);
    }
    return slots;
  } catch { return []; }
}

function scoreSchedule(assessment: Partial<AssessmentData> | null, coachSchedule: string | null): number {
  if (!assessment?.availability?.length || !coachSchedule) return WEIGHTS.schedule * 0.7;
  const coachSlots = parseScheduleSlots(coachSchedule);
  if (coachSlots.length === 0) return WEIGHTS.schedule * 0.7;
  const studentSlots = assessment.availability;
  const hasOverlap = studentSlots.some(slot =>
    coachSlots.some(cs => cs.toLowerCase().includes(slot.toLowerCase()) || slot.toLowerCase().includes(cs.toLowerCase()))
  );
  return hasOverlap ? WEIGHTS.schedule : WEIGHTS.schedule * 0.3;
}

const STYLE_SPECIALTIES: Record<string, string[]> = {
  aggressive: ["tactics", "openings", "attack"],
  positional: ["positional", "strategy", "endgames"],
  balanced: ["openings", "endgames", "tactics", "positional"],
  defensive: ["endgames", "positional", "defense"],
};

function scoreStyleAlignment(studentStyle: string | null, coachSpecialties: string[]): number {
  if (!studentStyle || coachSpecialties.length === 0) return WEIGHTS.styleAlignment * 0.5;
  const preferred = STYLE_SPECIALTIES[studentStyle] ?? [];
  const cLower = coachSpecialties.map(s => s.toLowerCase());
  const overlap = preferred.filter(p => cLower.some(c => c.includes(p))).length;
  if (overlap >= 2) return WEIGHTS.styleAlignment;
  if (overlap === 1) return WEIGHTS.styleAlignment * 0.7;
  return WEIGHTS.styleAlignment * 0.3;
}

function scoreExperience(coach: CoachForMatching): number {
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
  return Math.min(s, WEIGHTS.experience);
}

function topReasons(breakdown: DimensionScores): string[] {
  const dimensionLabels: Record<keyof DimensionScores, string> = {
    style: "Teaching style aligns with your learning preference",
    specialties: "Specializes in your improvement areas",
    budget: "Within your budget range",
    ratingGap: "Right skill level to challenge and teach you",
    credential: "Meets your credential preferences",
    schedule: "Available when you are",
    styleAlignment: "Playing style complements your chess personality",
    experience: "Proven track record with students",
  };
  const sorted = (Object.entries(breakdown) as [keyof DimensionScores, number][])
    .filter(([key]) => breakdown[key] > WEIGHTS[key] * 0.5)
    .sort(([, a], [, b]) => b - a);
  return sorted.slice(0, 3).map(([key]) => dimensionLabels[key]);
}

export function scoreCoachForStudent(coach: CoachForMatching, student: StudentForMatching): MatchResult {
  const assessment = parseAssessment(student.assessmentData);
  const coachSpecialties = parseJsonArray(coach.specialties);
  const studentAreas = parseJsonArray(student.improvementAreas);

  const breakdown: DimensionScores = {
    style: Math.round(scoreStyle(student.learningStyle, coach.teachingStyle)),
    specialties: Math.round(scoreSpecialties(studentAreas, coachSpecialties)),
    budget: Math.round(scoreBudget(coach.hourlyRateCents, student.budgetMinCents, student.budgetMaxCents)),
    ratingGap: Math.round(scoreRatingGap(student.currentRating, coach.fideRating)),
    credential: Math.round(scoreCredential(student.credentialImportance, coach.title)),
    schedule: Math.round(scoreSchedule(assessment, coach.availabilitySchedule)),
    styleAlignment: Math.round(scoreStyleAlignment(student.playingStyle, coachSpecialties)),
    experience: Math.round(scoreExperience(coach)),
  };

  const score = Object.values(breakdown).reduce((sum, v) => sum + v, 0);
  const reasons = topReasons(breakdown);

  return {
    coachUserId: coach.userId,
    coachName: coach.name,
    score: Math.min(100, Math.max(0, score)),
    reasons: reasons.length > 0 ? reasons : ["Available on BooGMe"],
    breakdown,
  };
}

export function rankCoachesForStudent(
  coaches: CoachForMatching[],
  student: StudentForMatching
): MatchResult[] {
  return coaches
    .map(coach => scoreCoachForStudent(coach, student))
    .sort((a, b) => b.score - a.score);
}
