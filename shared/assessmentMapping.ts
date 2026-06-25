/**
 * Assessment → Student Profile mapping.
 *
 * Maps the raw 20-question assessment answers to the structured
 * student_profiles columns. The raw blob is preserved as assessmentData
 * for future re-derivation; the derived enums are what matching queries.
 */

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

export function mapAssessmentToProfile(data: Partial<AssessmentData>): MappedProfile {
  const rating = data.rating ?? 1200;
  const targetImprovement = data.targetImprovement ?? 200;

  const skillLevel = SKILL_LEVEL_THRESHOLDS.find(([threshold]) => rating >= threshold)?.[1] ?? "beginner";

  return {
    skillLevel,
    currentRating: rating,
    targetRating: rating + targetImprovement,
    primaryGoal: GOAL_MAP[data.primaryGoal ?? ""] ?? "general",
    playingStyle: STYLE_ICON_MAP[data.styleIcon ?? ""] ?? "balanced",
    learningStyle: ARCHETYPE_MAP[data.teachingArchetype ?? ""] ?? "analytical",
    practiceSchedule: FREQUENCY_MAP[data.lessonFrequency ?? ""] ?? "regular",
    budgetMinCents: (data.budgetMin ?? 50) * 100,
    budgetMaxCents: (data.budgetMax ?? 100) * 100,
    credentialImportance: (["gm", "titled", "somewhat", "teaching", "notimportant"].includes(data.credentialImportance ?? "")
      ? data.credentialImportance as CredentialImportance
      : "somewhat"),
    improvementAreas: JSON.stringify(data.improvementAreas ?? []),
    assessmentData: JSON.stringify(data),
    assessmentCompletedAt: new Date(),
    assessmentVersion: 1,
  };
}
