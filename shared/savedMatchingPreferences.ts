import { isValidRating, isValidTargetImprovement, isValidTargetRating, targetImprovementToward } from "./assessmentMapping";

// Read the original answers, not derived profile columns: mapping fills missing
// columns with defaults, which must never be presented as answers the user gave.
export function readSavedAssessment(raw: string | null | undefined): Record<string, unknown> {
  try {
    const value = JSON.parse(raw ?? "null");
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

/** The parts of a student profile that describe their saved answers. */
export interface SavedAnswersProfile {
  assessmentData?: string | null;
  currentRating?: number | null;
  targetRating?: number | null;
}

/**
 * A student's saved answers as they stand now. The profile's currentRating is
 * the single source of truth for the rating: it also changes on the dashboard
 * (and, later, from synced chess.com/lichess ratings), so the rating answer is
 * always read from it and can never show a stale copy. The rating is included
 * only when the student gave one — a rating answer, or the dashboard rating of
 * a profile that has no questionnaire answers at all. A questionnaire saved
 * without a rating answer gets a default currentRating from the mapping, and a
 * default is never presented as the student's answer.
 *
 * Likewise targetRating is the source of truth for the student's goal, and a
 * "+N rating points" answer is shown as the distance from the current rating
 * to that goal (see targetImprovementToward), only when the student gave one.
 */
export function currentAssessmentAnswers(profile: SavedAnswersProfile | null | undefined): Record<string, unknown> {
  if (!profile) return {};
  const answers = readSavedAssessment(profile.assessmentData);
  const ratingGiven = profile.assessmentData == null || isValidRating(answers.rating);
  delete answers.rating;
  if (ratingGiven && isValidRating(profile.currentRating)) answers.rating = profile.currentRating;
  if (isValidTargetImprovement(answers.targetImprovement) && isValidRating(answers.rating) && isValidTargetRating(profile.targetRating)) {
    answers.targetImprovement = targetImprovementToward(profile.targetRating, answers.rating);
  }
  return answers;
}

/**
 * Saved answers from a profile (rating kept current, see above) or, for callers
 * holding only the stored JSON, exactly as stored.
 */
export type SavedAnswersSource = SavedAnswersProfile | string | null | undefined;

export function savedAnswers(source: SavedAnswersSource): Record<string, unknown> {
  return typeof source === "object" && source !== null ? currentAssessmentAnswers(source) : readSavedAssessment(source);
}

const labels: Record<string, Record<string, string>> = {
  primaryGoal: { rating: "Reach a specific rating target", competitive: "Competitive success", understanding: "Deep understanding", enjoyment: "Enjoyment", coaching: "Become a coach", intellectual: "Intellectual challenge" },
  teachingArchetype: { sage: "The Chess Sage", master: "The Disciplined Master", guide: "The Supportive Guide", innovator: "The Creative Innovator", coach: "The Motivational Coach" },
  lessonFrequency: { intensive: "3+ times per week", regular: "Twice per week", weekly: "Once per week", biweekly: "Every two weeks", flexible: "As needed for tournaments/events" },
  lessonFormat: { online: "Online only", inperson: "In-person only", hybrid: "Hybrid", flexible: "Flexible" },
  credentialImportance: { gm: "Very important (Grandmaster)", titled: "Prefer titled", somewhat: "Somewhat important", teaching: "Teaching matters more", notimportant: "Not important" },
  styleIcon: { tal: "Mikhail Tal", petrosian: "Tigran Petrosian", carlsen: "Magnus Carlsen", kasparov: "Garry Kasparov", fischer: "Bobby Fischer", karpov: "Anatoly Karpov", polgar: "Judit Polgar", mixed: "Not sure / Mix of styles" },
  ratingSystem: { fide: "FIDE", lichess: "Lichess", chesscom: "Chess.com", unrated: "Unrated" },
};

function answer(data: Record<string, unknown>, key: string): string | null {
  const value = data[key];
  if (Array.isArray(value)) {
    const strings = value.filter((v): v is string => typeof v === "string" && !!v.trim());
    return strings.length ? strings.join(", ") : null;
  }
  if (typeof value === "string" && value.trim()) {
    const choices = Object.hasOwn(labels, key) ? labels[key] : undefined;
    const label = choices && Object.hasOwn(choices, value) ? choices[value] : undefined;
    return typeof label === "string" ? label : value;
  }
  return null;
}

export function savedMatchingPreferences(source: SavedAnswersSource) {
  const data = savedAnswers(source);
  const rows = [
    ["Primary goal", answer(data, "primaryGoal")],
    ["Improvement areas", answer(data, "improvementAreas")],
    ["Teaching preference", answer(data, "teachingArchetype")],
    ["Playing inspiration", answer(data, "styleIcon")],
    ["Coach credentials", answer(data, "credentialImportance")],
    ["Lesson frequency", answer(data, "lessonFrequency")],
    ["Lesson format", answer(data, "lessonFormat")],
    ["Timezone", answer(data, "timezone")],
    ["Preferred times", answer(data, "availability")],
  ];
  const validNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;
  rows.push(["Rating answer", validNumber(data.rating)
    ? `${data.rating} (${answer(data, "ratingSystem") ?? "rating system not saved"})` : null]);
  rows.push(["Budget answer", validNumber(data.budgetMin) && validNumber(data.budgetMax) && data.budgetMax >= data.budgetMin
    ? `$${data.budgetMin}\u2013$${data.budgetMax} (saved range; pricing not verified)` : null]);
  return rows.map(([label, value]) => ({ label: label!, value: value ?? "Not saved" }));
}
