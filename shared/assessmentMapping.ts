/**
 * Assessment → Student Profile mapping.
 *
 * Maps the raw 20-question assessment answers to the structured
 * student_profiles columns. The raw blob is preserved as assessmentData
 * for future re-derivation; the derived enums are what matching queries.
 *
 * All numeric inputs are coerced and clamped defensively: the assessment can
 * arrive un-schema-validated (the waitlist→profile migration JSON.parses a
 * blob captured by a public endpoint), so this function never trusts types.
 */

import { z } from "zod";

export interface AssessmentData {
  rating: number;
  ratingSystem: string;
  yearsPlaying: string;
  competitiveExperience: string[];
  improvementAreas: string[];

  primaryGoal: string;
  timeline: string;
  targetImprovement: number;

  teachingArchetype: string;
  learningMethods: string[];
  feedbackStyle: number;
  lessonPace: string;

  budgetMin: number;
  budgetMax: number;
  lessonFrequency: string;
  timezone: string;
  availability: string[];
  lessonFormat: string;

  communicationPreference: string;
  motivations: string[];
  techComfort: number;
  styleIcon: string;
  credentialImportance: string;
}

/**
 * Boundary schema for assessment submissions. Coerces numerics, bounds string
 * and array sizes, and STRIPS unknown keys (default zod behavior) so a client
 * cannot smuggle an oversized blob through extra fields. Validate with this at
 * every entry point (saveQuizResults, waitlist.join, migration).
 */
export const assessmentDataSchema = z.object({
  rating: z.coerce.number().min(0).max(4000).optional(),
  ratingSystem: z.string().max(32).optional(),
  yearsPlaying: z.string().max(64).optional(),
  competitiveExperience: z.array(z.string().max(128)).max(20).optional(),
  improvementAreas: z.array(z.string().max(128)).max(10).optional(),
  primaryGoal: z.string().max(64).optional(),
  timeline: z.string().max(64).optional(),
  targetImprovement: z.coerce.number().min(0).max(2000).optional(),
  teachingArchetype: z.string().max(64).optional(),
  learningMethods: z.array(z.string().max(128)).max(20).optional(),
  feedbackStyle: z.coerce.number().min(0).max(10).optional(),
  lessonPace: z.string().max(64).optional(),
  budgetMin: z.coerce.number().min(0).max(100000).optional(),
  budgetMax: z.coerce.number().min(0).max(100000).optional(),
  lessonFrequency: z.string().max(64).optional(),
  timezone: z.string().max(64).optional(),
  availability: z.array(z.string().max(128)).max(20).optional(),
  lessonFormat: z.string().max(64).optional(),
  communicationPreference: z.string().max(64).optional(),
  motivations: z.array(z.string().max(128)).max(20).optional(),
  techComfort: z.coerce.number().min(0).max(10).optional(),
  styleIcon: z.string().max(64).optional(),
  credentialImportance: z.string().max(32).optional(),
});

export type ValidatedAssessmentData = z.infer<typeof assessmentDataSchema>;

type SkillLevel = "beginner" | "intermediate" | "advanced" | "expert";
type PrimaryGoal = "rating_improvement" | "tournament_prep" | "openings" | "tactics" | "endgames" | "general";
type PlayingStyle = "aggressive" | "positional" | "balanced" | "defensive";
type LearningStyle = "visual" | "interactive" | "analytical" | "competitive";
type PracticeSchedule = "casual" | "regular" | "serious" | "intensive";
type CredentialImportance = "gm" | "titled" | "somewhat" | "teaching" | "notimportant";

export interface MappedProfile {
  skillLevel: SkillLevel;
  currentRating: number;
  targetRating: number;
  primaryGoal: PrimaryGoal;
  playingStyle: PlayingStyle;
  learningStyle: LearningStyle;
  practiceSchedule: PracticeSchedule;
  budgetMinCents: number;
  budgetMaxCents: number;
  credentialImportance: CredentialImportance;
  improvementAreas: string;
  assessmentData: string;
  assessmentCompletedAt: Date;
  assessmentVersion: number;
}

const ASSESSMENT_VERSION = 1;

const SKILL_LEVEL_THRESHOLDS: [number, SkillLevel][] = [
  [2000, "expert"],
  [1600, "advanced"],
  [1000, "intermediate"],
  [0, "beginner"],
];

const GOAL_MAP: Record<string, PrimaryGoal> = {
  rating: "rating_improvement",
  competitive: "tournament_prep",
  understanding: "openings",
  enjoyment: "general",
  coaching: "general",
  intellectual: "general",
};

const STYLE_ICON_MAP: Record<string, PlayingStyle> = {
  tal: "aggressive",
  kasparov: "aggressive",
  polgar: "aggressive",
  fischer: "balanced",
  carlsen: "balanced",
  mixed: "balanced",
  petrosian: "defensive",
  karpov: "positional",
};

const ARCHETYPE_MAP: Record<string, LearningStyle> = {
  sage: "analytical",
  master: "analytical",
  guide: "visual",
  innovator: "interactive",
  coach: "competitive",
};

const FREQUENCY_MAP: Record<string, PracticeSchedule> = {
  intensive: "intensive",
  regular: "serious",
  weekly: "regular",
  biweekly: "casual",
  flexible: "casual",
};

/** Coerce to a finite number, or fall back to the default. */
function num(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function mapAssessmentToProfile(data: Partial<AssessmentData> | ValidatedAssessmentData): MappedProfile {
  const d = (data ?? {}) as Partial<AssessmentData>;
  const rating = clamp(num(d.rating, 1200), 0, 4000);
  const targetImprovement = clamp(num(d.targetImprovement, 200), 0, 2000);
  const budgetMin = clamp(num(d.budgetMin, 50), 0, 100000);
  const budgetMax = clamp(num(d.budgetMax, 100), 0, 100000);

  const skillLevel = SKILL_LEVEL_THRESHOLDS.find(([threshold]) => rating >= threshold)?.[1] ?? "beginner";
  const improvementAreas = Array.isArray(d.improvementAreas)
    ? d.improvementAreas.filter((x) => typeof x === "string")
    : [];

  return {
    skillLevel,
    currentRating: rating,
    targetRating: rating + targetImprovement,
    primaryGoal: GOAL_MAP[d.primaryGoal ?? ""] ?? "general",
    playingStyle: STYLE_ICON_MAP[d.styleIcon ?? ""] ?? "balanced",
    learningStyle: ARCHETYPE_MAP[d.teachingArchetype ?? ""] ?? "analytical",
    practiceSchedule: FREQUENCY_MAP[d.lessonFrequency ?? ""] ?? "regular",
    budgetMinCents: Math.round(budgetMin * 100),
    budgetMaxCents: Math.round(budgetMax * 100),
    credentialImportance: (["gm", "titled", "somewhat", "teaching", "notimportant"].includes(d.credentialImportance ?? "")
      ? d.credentialImportance as CredentialImportance
      : "somewhat"),
    improvementAreas: JSON.stringify(improvementAreas),
    assessmentData: JSON.stringify(data ?? {}),
    assessmentCompletedAt: new Date(),
    assessmentVersion: ASSESSMENT_VERSION,
  };
}
