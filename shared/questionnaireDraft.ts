/**
 * A questionnaire being answered: the answers it started from (saved answers
 * prefilled for an edit, or the signup defaults) and the answers now.
 *
 * Both halves matter for a save. The server keeps the profile's rating and
 * goal unless the student actually moved those answers, and it can only tell
 * that from where the form started — so the starting answers are part of the
 * draft itself rather than a separate copy beside it, and every save request
 * is built here (see assessmentProfileUpdate.ts for the server side).
 */

import type { AssessmentData, ValidatedAssessmentData } from "./assessmentMapping";
import type { AnswerBaseline } from "./assessmentProfileUpdate";

export type QuestionnaireAnswers = Partial<AssessmentData>;

export interface QuestionnaireDraft {
  readonly startedFrom: QuestionnaireAnswers;
  readonly answers: QuestionnaireAnswers;
}

export function startQuestionnaire(answers: QuestionnaireAnswers): QuestionnaireDraft {
  return { startedFrom: answers, answers };
}

export function answerQuestion<K extends keyof AssessmentData>(
  draft: QuestionnaireDraft,
  key: K,
  value: AssessmentData[K],
): QuestionnaireDraft {
  return { ...draft, answers: { ...draft.answers, [key]: value } };
}

/**
 * The max for a numeric answer's slider: its usual range, stretched to reach
 * the value the draft started from. A slider clamps every interaction to its
 * max, so a saved value above the usual range (a dashboard rating, an older
 * answer) would otherwise drop as soon as the student touched the slider.
 */
export function sliderMax(draft: QuestionnaireDraft, key: "rating" | "targetImprovement", usualMax: number): number {
  return Math.max(usualMax, draft.startedFrom[key] ?? 0);
}

/** What the draft started from, for the answers the profile also changes. */
export function answerBaseline(draft: QuestionnaireDraft): AnswerBaseline {
  return {
    rating: draft.startedFrom.rating ?? null,
    targetImprovement: draft.startedFrom.targetImprovement ?? null,
  };
}

/** The student.saveQuizResults input for a draft whose answers were validated. */
export function questionnaireSaveInput(draft: QuestionnaireDraft, assessmentData: ValidatedAssessmentData) {
  return { assessmentData, baseline: answerBaseline(draft) };
}
