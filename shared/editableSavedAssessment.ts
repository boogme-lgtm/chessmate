import { assessmentDataSchema, type ValidatedAssessmentData } from "./assessmentMapping";
import { savedAnswers, type SavedAnswersSource } from "./savedMatchingPreferences";

// Validate each original field independently so one malformed legacy answer
// cannot erase valid answers. Never prefill derived profile defaults. Pass the
// profile (not its stored JSON) so the rating prefills from its current rating.
export function editableSavedAssessment(source: SavedAnswersSource): ValidatedAssessmentData {
  const original = savedAnswers(source);
  const result: Record<string, unknown> = {};
  const numeric = new Set(["rating", "targetImprovement", "feedbackStyle", "budgetMin", "budgetMax", "techComfort"]);
  for (const [key, schema] of Object.entries(assessmentDataSchema.shape)) {
    if (!Object.hasOwn(original, key)) continue;
    const value = original[key];
    if (numeric.has(key) && (typeof value !== "number" || !Number.isFinite(value))) continue;
    const parsed = schema.safeParse(value);
    if (parsed.success && parsed.data !== undefined) result[key] = parsed.data;
  }
  return assessmentDataSchema.parse(result);
}
