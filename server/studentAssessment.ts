/**
 * Persisting questionnaire answers to student profiles. Every path that saves
 * answers goes through here, so the first save and every later save follow the
 * same rules (shared/assessmentProfileUpdate.ts).
 */

import * as db from "./db";
import { mapAssessmentToProfile, type ValidatedAssessmentData } from "@shared/assessmentMapping";
import { assessmentChangesForProfile, type AssessmentSaveOptions } from "@shared/assessmentProfileUpdate";

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
  const existing = await db.getStudentProfileByUserId(userId);
  if (!existing) {
    await db.createStudentProfile({ userId, ...mapAssessmentToProfile(answers) });
    return {};
  }
  await db.updateStudentProfile(userId, assessmentChangesForProfile(existing, answers, options));
  return { profileId: existing.id };
}

/**
 * Move answers a guest gave before signing up into their new profile. They
 * predate the account, so they only fill what is empty: a profile that already
 * has saved answers keeps them, and an existing rating is never replaced.
 */
export async function importGuestAssessment(userId: number, answers: ValidatedAssessmentData): Promise<void> {
  const existing = await db.getStudentProfileByUserId(userId);
  if (!existing) {
    await db.createStudentProfile({ userId, ...mapAssessmentToProfile(answers) });
    return;
  }
  if (existing.assessmentData != null) return;
  // Treat the guest rating as untouched: it fills a missing rating only.
  await db.updateStudentProfile(userId, assessmentChangesForProfile(existing, answers, { ratingBaseline: answers.rating ?? null }));
}
