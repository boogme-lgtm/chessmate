/**
 * Persisting questionnaire answers to student profiles. Every path that saves
 * answers goes through here, so the first save and every later save follow the
 * same rules (shared/assessmentProfileUpdate.ts). Updates are applied with
 * db.updateStudentProfileFromStored, a compare-and-set on the stored values
 * those rules read, so a concurrent rating change is never overwritten with
 * answers computed before it.
 */

import * as db from "./db";
import { mapAssessmentToProfile, type ValidatedAssessmentData } from "@shared/assessmentMapping";
import {
  assessmentChangesForProfile,
  STORED_PROFILE_INPUTS,
  type AssessmentSaveOptions,
} from "@shared/assessmentProfileUpdate";

/**
 * Save a student's answers. The first save creates the full profile from them
 * (defaults included, as it always has). Later saves change only what the
 * answers changed, so a partial edit never resets the rating or other stored
 * values.
 */
export async function saveStudentAssessment(
  userId: number,
  answers: ValidatedAssessmentData,
  options: AssessmentSaveOptions = {},
): Promise<{ profileId?: number }> {
  const existing = await db.updateStudentProfileFromStored(userId, STORED_PROFILE_INPUTS, stored =>
    assessmentChangesForProfile(stored, answers, options));
  if (existing) return { profileId: existing.id };
  await db.createStudentProfile({ userId, ...mapAssessmentToProfile(answers) });
  return {};
}

/**
 * Move answers a guest gave before signing up into their new profile. They
 * predate the account, so they only fill what is empty: a profile that already
 * has saved answers keeps them, and an existing rating or goal is never
 * replaced.
 */
export async function importGuestAssessment(userId: number, answers: ValidatedAssessmentData): Promise<void> {
  const existing = await db.updateStudentProfileFromStored(userId, STORED_PROFILE_INPUTS, stored =>
    stored.assessmentData != null ? null : assessmentChangesForProfile(stored, answers, {
      // Treat the guest answers as untouched: they fill missing values only.
      baseline: { rating: answers.rating ?? null, targetImprovement: answers.targetImprovement ?? null },
    }));
  if (!existing) await db.createStudentProfile({ userId, ...mapAssessmentToProfile(answers) });
}
