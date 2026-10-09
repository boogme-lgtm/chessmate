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
 * Single source of truth: the profile's currentRating. The questionnaire's
 * rating answer is a copy that both write paths keep equal to it, and readers
 * go through currentAssessmentAnswers (savedMatchingPreferences.ts), so legacy
 * rows saved before this rule still read correctly.
 */

import {
  isValidRating,
  mapAssessmentToProfile,
  PREFERENCE_COLUMN_SOURCES,
  skillLevelForRating,
  type MappedProfile,
  type PreferenceColumn,
  type ValidatedAssessmentData,
} from "./assessmentMapping";
import { currentAssessmentAnswers, readSavedAssessment } from "./savedMatchingPreferences";

/** The stored profile values these rules compare against. */
export interface StoredStudentProfile {
  currentRating?: number | null;
  assessmentData?: string | null;
}

export type StudentProfileChanges = Partial<MappedProfile>;

export interface AssessmentSaveOptions {
  /**
   * The rating the questionnaire started from — what the student saw before
   * editing — or null when it showed no saved rating. A submitted rating equal
   * to it was left untouched, so it never overwrites a rating that changed
   * meanwhile (dashboard in another tab, a future rating sync). Left undefined
   * by callers that cannot know it, such as clients built before this field.
   */
  ratingBaseline?: number | null;
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
 * Did the student actually change their rating in this questionnaire save?
 * Decided against the stored profile; a client baseline only tells the server
 * which value the form started from, i.e. what "left untouched" looks like.
 */
function ratingAnswerChanged(
  answer: number | undefined,
  current: number | null,
  savedAnswer: unknown,
  baseline: number | null | undefined,
): boolean {
  // A missing answer is never a change: no default may replace a rating.
  if (answer === undefined) return false;
  // Nothing stored to protect: the answer is the first rating we have.
  if (current === null) return true;
  if (answer === current) return false;
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
 *   (see ratingAnswerChanged); skillLevel is re-derived with it.
 * - targetRating is the student's goal, expressed in the questionnaire as
 *   "+N over my current rating". It is re-derived (current rating + N) only
 *   when this save changed the rating or the target answer; otherwise the
 *   stored goal is kept. A missing target answer never resets it.
 *
 * The stored rating answer is set to the resulting current rating, so the
 * saved answers and the profile agree after every save. A save without a
 * rating answer keeps the rating the student had already given.
 */
export function assessmentChangesForProfile(
  stored: StoredStudentProfile,
  answers: ValidatedAssessmentData,
  { ratingBaseline }: AssessmentSaveOptions = {},
): StudentProfileChanges {
  const storedAnswers = readSavedAssessment(stored.assessmentData);
  const current = isValidRating(stored.currentRating) ? stored.currentRating : null;

  const ratingChanged = ratingAnswerChanged(answers.rating, current, storedAnswers.rating, ratingBaseline);
  const rating = ratingChanged && answers.rating !== undefined ? answers.rating : current;

  const toSave: ValidatedAssessmentData = { ...answers };
  if (answers.rating !== undefined) {
    if (rating !== null) toSave.rating = rating;
  } else {
    const given = currentAssessmentAnswers(stored).rating;
    if (isValidRating(given)) toSave.rating = given;
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

  const target = toSave.targetImprovement;
  const targetChanged = target !== undefined && target !== storedAnswers.targetImprovement;
  if (target !== undefined && rating !== null && (ratingChanged || targetChanged)) {
    changes.targetRating = rating + target;
  }

  return changes;
}

/**
 * The columns to write when ONLY the student's current rating changes —
 * the dashboard rating today, synced chess.com/lichess ratings later.
 *
 * - skillLevel follows the rating: it is a band of the rating, never a
 *   choice, and keeping it would leave a 1650 player labelled intermediate.
 * - targetRating is kept: it is the student's own goal, which a new rating
 *   does not change (they may simply be closer to it, or past it).
 * - The saved rating answer is updated to match, so the questionnaire shows
 *   the same rating as the dashboard. Its rating system answer is kept. A
 *   profile with no stored answers gets none (answers are never invented),
 *   and unreadable stored data is left untouched.
 */
export function ratingChangesForProfile(stored: StoredStudentProfile, rating: number): StudentProfileChanges {
  const changes: StudentProfileChanges = { currentRating: rating, skillLevel: skillLevelForRating(rating) };
  const storedAnswers = stored.assessmentData == null ? null : parseAnswerObject(stored.assessmentData);
  if (storedAnswers) changes.assessmentData = JSON.stringify({ ...storedAnswers, rating });
  return changes;
}
