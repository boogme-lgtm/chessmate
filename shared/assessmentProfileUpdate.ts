/**
 * Writing to an EXISTING student profile.
 *
 * mapAssessmentToProfile builds a whole new profile and fills every missing
 * answer with a default. Applied to an existing profile, that silently resets
 * whatever a partial edit did not mention — most visibly the rating: a student
 * who set 1650 on the dashboard and then changed only their lesson format got
 * their old answer (or 1200) back. The functions here decide, by comparing with
 * what is stored, which columns a write may change.
 *
 * Single sources of truth: the profile's currentRating for the rating, and its
 * targetRating for the student's goal. The questionnaire's rating and
 * "+N rating points" answers are how it shows them: both write paths keep the
 * stored answers equal to them, and readers go through currentAssessmentAnswers
 * (savedMatchingPreferences.ts), so legacy rows saved before this rule still
 * read correctly.
 *
 * The goal model, shared by both write paths: targetRating is an absolute
 * goal. A new rating — from the dashboard, a synced platform rating or the
 * questionnaire's rating question — never moves it (the student is simply
 * closer to it, or past it); only a changed "+N" answer restates it, as the
 * resulting rating + N. A goal stated before any rating existed is anchored as
 * rating + N as soon as a rating arrives.
 *
 * These functions are pure. A write computed from a stored row is valid only
 * while the columns they read (STORED_PROFILE_INPUTS) are unchanged, so the
 * database layer applies them with a compare-and-set on exactly those columns.
 */

import { z } from "zod";
import {
  isValidRating,
  isValidTargetImprovement,
  isValidTargetRating,
  mapAssessmentToProfile,
  MAX_RATING,
  MAX_TARGET_IMPROVEMENT,
  PREFERENCE_COLUMN_SOURCES,
  skillLevelForRating,
  targetImprovementToward,
  type MappedProfile,
  type PreferenceColumn,
  type ValidatedAssessmentData,
} from "./assessmentMapping";
import { currentAssessmentAnswers, readSavedAssessment } from "./savedMatchingPreferences";

/** The stored profile values these rules compare against. */
export interface StoredStudentProfile {
  currentRating?: number | null;
  targetRating?: number | null;
  assessmentData?: string | null;
}

/**
 * Every stored column the rules below read. Typed as a full Record so a rule
 * cannot start reading a column without it being guarded on write.
 */
const STORED_INPUT_COLUMNS: Record<keyof StoredStudentProfile, true> = {
  currentRating: true,
  targetRating: true,
  assessmentData: true,
};
export const STORED_PROFILE_INPUTS = Object.keys(STORED_INPUT_COLUMNS) as (keyof StoredStudentProfile)[];

export type StudentProfileChanges = Partial<MappedProfile>;

/**
 * The answers a questionnaire started from that the profile also changes
 * outside it (the rating, and the "+N" goal shown relative to it); null when
 * the form showed none. An answer still equal to its starting value was left
 * untouched, so it never overwrites a value that changed meanwhile (dashboard
 * in another tab, a future rating sync).
 */
export const answerBaselineSchema = z.object({
  rating: z.number().min(0).max(MAX_RATING).nullable(),
  targetImprovement: z.number().min(0).max(MAX_TARGET_IMPROVEMENT).nullable(),
});
export type AnswerBaseline = z.infer<typeof answerBaselineSchema>;

export interface AssessmentSaveOptions {
  /** Left undefined by callers that cannot know it, such as clients built before it. */
  baseline?: AnswerBaseline;
}

/** Parse stored answers only when they are a well-formed JSON object. */
function parseAnswerObject(raw: string): Record<string, unknown> | null {
  try {
    const value = JSON.parse(raw);
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

function copyColumn<K extends keyof MappedProfile>(to: StudentProfileChanges, from: MappedProfile, column: K) {
  to[column] = from[column];
}

/**
 * Did the student actually change a profile-backed answer (rating, "+N") in
 * this questionnaire save? Decided against the stored profile; a client
 * baseline only tells the server which value the form started from, i.e. what
 * "left untouched" looks like.
 */
function answerEdited(
  answer: number | undefined,
  shown: unknown,
  savedAnswer: unknown,
  baseline: number | null | undefined,
): boolean {
  // A missing answer is never a change: no default may replace a stored value.
  if (answer === undefined) return false;
  if (answer === shown) return false;
  // The client says what its form started from; unmoved means unchanged.
  if (baseline !== undefined) return answer !== baseline;
  // Older clients prefilled the stored answer, which could lag behind the
  // profile. Sending it back unchanged is not an edit.
  return answer !== savedAnswer;
}

/**
 * The columns to write when a student saves questionnaire answers onto their
 * existing profile (Find Another Coach edits, older clients, migrated guest
 * answers). The answers replace the stored assessment, but derived columns
 * change only where the answers say so:
 *
 * - A preference column is written only when its answer is present. An
 *   unanswered question keeps the stored value instead of a mapped default.
 * - currentRating changes only when the rating answer was really changed
 *   (see answerEdited), or fills a profile without one; skillLevel follows.
 * - targetRating follows the goal model above: it changes only when the "+N"
 *   answer was really changed (goal = resulting rating + N), or is anchored
 *   when the profile has no goal yet. A rating change alone keeps it, exactly
 *   like a rating change on the dashboard.
 *
 * The stored rating and "+N" answers are set from the resulting rating and
 * goal, so the saved answers and the profile agree after every save. A save
 * without one of these answers keeps the one the student had already given.
 */
export function assessmentChangesForProfile(
  stored: StoredStudentProfile,
  answers: ValidatedAssessmentData,
  { baseline }: AssessmentSaveOptions = {},
): StudentProfileChanges {
  const storedAnswers = readSavedAssessment(stored.assessmentData);
  const shown = currentAssessmentAnswers(stored);
  const current = isValidRating(stored.currentRating) ? stored.currentRating : null;
  const storedGoal = isValidTargetRating(stored.targetRating) ? stored.targetRating : null;

  // Nothing stored to protect: a rating answer is the first rating we have.
  const ratingChanged = answers.rating !== undefined
    && (current === null || answerEdited(answers.rating, current, storedAnswers.rating, baseline?.rating));
  const rating = ratingChanged && answers.rating !== undefined ? answers.rating : current;

  const targetChanged = answerEdited(answers.targetImprovement, shown.targetImprovement, storedAnswers.targetImprovement, baseline?.targetImprovement);
  const target = answers.targetImprovement ?? (isValidTargetImprovement(shown.targetImprovement) ? shown.targetImprovement : undefined);
  const goal = target !== undefined && rating !== null && (targetChanged || storedGoal === null)
    ? rating + target
    : storedGoal;

  const toSave: ValidatedAssessmentData = { ...answers };
  if (answers.rating !== undefined || isValidRating(shown.rating)) {
    if (rating !== null) toSave.rating = rating;
  }
  if (target !== undefined) {
    toSave.targetImprovement = goal !== null && rating !== null ? targetImprovementToward(goal, rating) : target;
  }
  const mapped = mapAssessmentToProfile(toSave);

  const changes: StudentProfileChanges = {
    assessmentData: mapped.assessmentData,
    assessmentCompletedAt: mapped.assessmentCompletedAt,
    assessmentVersion: mapped.assessmentVersion,
  };
  for (const column of Object.keys(PREFERENCE_COLUMN_SOURCES) as PreferenceColumn[]) {
    if (toSave[PREFERENCE_COLUMN_SOURCES[column]] !== undefined) copyColumn(changes, mapped, column);
  }

  if (ratingChanged && rating !== null) {
    changes.currentRating = rating;
    changes.skillLevel = skillLevelForRating(rating);
  }
  if (goal !== null && goal !== storedGoal) changes.targetRating = goal;

  return changes;
}

/**
 * The columns to write when ONLY the student's current rating changes —
 * the dashboard rating today, synced chess.com/lichess ratings later.
 *
 * - skillLevel follows the rating: it is a band of the rating, never a
 *   choice, and keeping it would leave a 1650 player labelled intermediate.
 * - targetRating is kept: it is the student's own goal, which a new rating
 *   does not change (they may simply be closer to it, or past it). A "+N"
 *   goal saved before the profile had a rating is anchored to this rating.
 * - The saved rating and "+N" answers are updated to match, so the
 *   questionnaire shows the same rating and goal as the profile. Its rating
 *   system answer is kept. A profile with no stored answers gets none
 *   (answers are never invented), and unreadable stored data is left untouched.
 */
export function ratingChangesForProfile(stored: StoredStudentProfile, rating: number): StudentProfileChanges {
  const changes: StudentProfileChanges = { currentRating: rating, skillLevel: skillLevelForRating(rating) };
  const storedAnswers = stored.assessmentData == null ? null : parseAnswerObject(stored.assessmentData);
  if (!storedAnswers) return changes;

  const target = isValidTargetImprovement(storedAnswers.targetImprovement) ? storedAnswers.targetImprovement : null;
  let goal = isValidTargetRating(stored.targetRating) ? stored.targetRating : null;
  if (goal === null && target !== null) {
    goal = rating + target;
    changes.targetRating = goal;
  }
  const updatedAnswers: Record<string, unknown> = { ...storedAnswers, rating };
  if (target !== null && goal !== null) updatedAnswers.targetImprovement = targetImprovementToward(goal, rating);
  changes.assessmentData = JSON.stringify(updatedAnswers);
  return changes;
}
