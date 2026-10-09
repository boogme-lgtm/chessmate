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
 *
 * mapAssessmentToProfile builds a complete NEW profile (defaults included).
 * Saving answers onto an existing profile goes through
 * assessmentProfileUpdate.ts instead, so an edit never resets stored values.
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

/** Upper bound for any stored rating (assessment answer or profile column). */
export const MAX_RATING = 4000;

/**
 * The range of ratings a student can enter themselves (dashboard input and
 * questionnaire slider). Stored ratings may still exceed it up to MAX_RATING
 * (API saves, older answers), so an input must also reach a stored value.
 */
export const MIN_STUDENT_RATING = 100;
export const MAX_STUDENT_RATING = 3200;

/** Upper bound for the "+N rating points" target answer. */
export const MAX_TARGET_IMPROVEMENT = 2000;

/** A usable rating: a finite number within the bounds the schema accepts. */
export function isValidRating(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= MAX_RATING;
}

/** A usable "+N rating points" target answer. */
export function isValidTargetImprovement(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= MAX_TARGET_IMPROVEMENT;
}

/** A usable stored goal (targetRating): a rating plus a target, so it may pass MAX_RATING. */
export function isValidTargetRating(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

/**
 * The "+N rating points" answer that expresses a goal from a rating: the
 * distance still to go, 0 once the goal is reached. The goal (targetRating) is
 * the source of truth; this is how the questionnaire shows it.
 */
export function targetImprovementToward(targetRating: number, rating: number): number {
  return Math.min(MAX_TARGET_IMPROVEMENT, Math.max(0, targetRating - rating));
}

/**
 * Boundary schema for assessment submissions. Coerces numerics, bounds string
 * and array sizes, and STRIPS unknown keys (default zod behavior) so a client
 * cannot smuggle an oversized blob through extra fields. Validate with this at
 * every entry point (saveQuizResults, waitlist.join, migration).
 */
export const assessmentDataSchema = z.object({
  rating: z.coerce.number().min(0).max(MAX_RATING).optional(),
  ratingSystem: z.string().max(32).optional(),
  yearsPlaying: z.string().max(64).optional(),
  competitiveExperience: z.array(z.string().max(128)).max(20).optional(),
  improvementAreas: z.array(z.string().max(128)).max(10).optional(),
  primaryGoal: z.string().max(64).optional(),
  timeline: z.string().max(64).optional(),
  targetImprovement: z.coerce.number().min(0).max(MAX_TARGET_IMPROVEMENT).optional(),
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

export type SkillLevel = "beginner" | "intermediate" | "advanced" | "expert";
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

/**
 * Profile columns that each come from exactly one questionnaire answer. The
 * rating columns (currentRating, skillLevel, targetRating) and the stored
 * assessment itself are handled separately, because the current rating also
 * changes outside the questionnaire. Typed as a full Record so a new mapped
 * column cannot be added without naming the answer it comes from.
 */
export type PreferenceColumn = Exclude<
  keyof MappedProfile,
  "skillLevel" | "currentRating" | "targetRating" | "assessmentData" | "assessmentCompletedAt" | "assessmentVersion"
>;
export const PREFERENCE_COLUMN_SOURCES: Record<PreferenceColumn, keyof AssessmentData> = {
  primaryGoal: "primaryGoal",
  playingStyle: "styleIcon",
  learningStyle: "teachingArchetype",
  practiceSchedule: "lessonFrequency",
  budgetMinCents: "budgetMin",
  budgetMaxCents: "budgetMax",
  credentialImportance: "credentialImportance",
  improvementAreas: "improvementAreas",
};

const ASSESSMENT_VERSION = 1;

const SKILL_LEVEL_THRESHOLDS: [number, SkillLevel][] = [
  [2000, "expert"],
  [1600, "advanced"],
  [1000, "intermediate"],
  [0, "beginner"],
];

/** The skill band for a rating. The only place skill levels are derived. */
export function skillLevelForRating(rating: number): SkillLevel {
  return SKILL_LEVEL_THRESHOLDS.find(([threshold]) => rating >= threshold)?.[1] ?? "beginner";
}

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
  const rating = clamp(num(d.rating, 1200), 0, MAX_RATING);
  const targetImprovement = clamp(num(d.targetImprovement, 200), 0, MAX_TARGET_IMPROVEMENT);
  const budgetMin = clamp(num(d.budgetMin, 50), 0, 100000);
  const budgetMax = clamp(num(d.budgetMax, 100), 0, 100000);

  const skillLevel = skillLevelForRating(rating);
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
