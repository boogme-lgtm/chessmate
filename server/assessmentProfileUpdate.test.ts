import { describe, expect, it } from "vitest";
import {
  mapAssessmentToProfile,
  PREFERENCE_COLUMN_SOURCES,
  skillLevelForRating,
  type ValidatedAssessmentData,
} from "@shared/assessmentMapping";
import { assessmentChangesForProfile, ratingChangesForProfile } from "@shared/assessmentProfileUpdate";
import { currentAssessmentAnswers, savedMatchingPreferences } from "@shared/savedMatchingPreferences";
import { editableSavedAssessment } from "@shared/editableSavedAssessment";

// A completed questionnaire: 1400 on Lichess, aiming 200 higher.
const quiz: ValidatedAssessmentData = {
  rating: 1400, ratingSystem: "lichess", targetImprovement: 200, primaryGoal: "rating",
  teachingArchetype: "sage", styleIcon: "tal", lessonFrequency: "weekly", lessonFormat: "online",
  budgetMin: 40, budgetMax: 80, credentialImportance: "titled", improvementAreas: ["Endgame technique"],
};
const fromQuiz = () => ({ ...mapAssessmentToProfile(quiz) });
const ratingFields = ["currentRating", "skillLevel", "targetRating"] as const;
const answersIn = (changes: { assessmentData?: string }) => JSON.parse(changes.assessmentData!);

describe("skillLevelForRating", () => {
  it.each([[0, "beginner"], [999, "beginner"], [1000, "intermediate"], [1599, "intermediate"], [1600, "advanced"], [1999, "advanced"], [2000, "expert"]])(
    "%i → %s (same bands as the questionnaire mapping)", (rating, level) => {
      expect(skillLevelForRating(rating)).toBe(level);
      expect(mapAssessmentToProfile({ rating }).skillLevel).toBe(level);
    });
});

describe("rating-only changes (dashboard, future rating sync)", () => {
  it("updates rating and skill band, keeps the target goal, and keeps the saved answer in step", () => {
    const changes = ratingChangesForProfile(fromQuiz(), 1650);
    expect(changes).toMatchObject({ currentRating: 1650, skillLevel: "advanced" });
    expect(changes).not.toHaveProperty("targetRating");
    expect(answersIn(changes)).toEqual({ ...quiz, rating: 1650 });
  });

  it("adds the rating to saved answers that had none, but never invents answers or rewrites unreadable data", () => {
    expect(answersIn(ratingChangesForProfile({ assessmentData: '{"lessonFormat":"online"}' }, 1650))).toEqual({ lessonFormat: "online", rating: 1650 });
    for (const assessmentData of [null, undefined, "{", "[]", "null"]) {
      expect(ratingChangesForProfile({ assessmentData }, 1650)).toEqual({ currentRating: 1650, skillLevel: "advanced" });
    }
  });
});

describe("questionnaire saves onto an existing profile", () => {
  it("regression: a dashboard rating survives an edit that only changes lesson format", () => {
    let profile = fromQuiz();
    profile = { ...profile, ...ratingChangesForProfile(profile, 1650) };
    const form = editableSavedAssessment(profile);
    expect(form.rating).toBe(1650); // prefilled from the profile, not the old answer

    const changes = assessmentChangesForProfile(profile, { ...form, lessonFormat: "hybrid" }, { ratingBaseline: form.rating });
    for (const field of ratingFields) expect(changes).not.toHaveProperty(field);
    expect(answersIn(changes)).toEqual({ ...quiz, rating: 1650, lessonFormat: "hybrid" });
    const after = { ...profile, ...changes };
    expect(after).toMatchObject({ currentRating: 1650, skillLevel: "advanced", targetRating: 1600 });
  });

  it("keeps the rating when an older client sends back the stale stored answer (legacy drifted row)", () => {
    // Saved before this fix: dashboard moved the rating, answers still say 1400.
    const legacy = { ...fromQuiz(), currentRating: 1650 };
    const oldClientForm = editableSavedAssessment(legacy.assessmentData); // raw answers, no baseline
    expect(oldClientForm.rating).toBe(1400);
    const changes = assessmentChangesForProfile(legacy, { ...oldClientForm, lessonFormat: "hybrid" });
    for (const field of ratingFields) expect(changes).not.toHaveProperty(field);
    expect(answersIn(changes).rating).toBe(1650); // answers reconciled to the profile
  });

  it("never writes the 1200 default when the rating answer is missing, and keeps the rating already given", () => {
    const profile = { ...fromQuiz(), currentRating: 1650 };
    const { rating: _omitted, ...withoutRating } = quiz;
    for (const options of [{}, { ratingBaseline: null }, { ratingBaseline: 1650 }]) {
      const changes = assessmentChangesForProfile(profile, { ...withoutRating, lessonFormat: "hybrid" }, options);
      for (const field of ratingFields) expect(changes).not.toHaveProperty(field);
      expect(answersIn(changes).rating).toBe(1650);
    }
    // A dashboard-only profile edited by a client that sent no rating answer.
    const dashboardOnly = assessmentChangesForProfile({ currentRating: 1650, assessmentData: null }, { lessonFormat: "hybrid" });
    expect(dashboardOnly).not.toHaveProperty("currentRating");
    expect(answersIn(dashboardOnly)).toEqual({ lessonFormat: "hybrid", rating: 1650 });
    // A mapped default (no rating was ever given) is not promoted to an answer.
    const defaulted = assessmentChangesForProfile(mapAssessmentToProfile({ lessonFormat: "online" }), { lessonFormat: "hybrid" });
    expect(defaulted).not.toHaveProperty("currentRating");
    expect(answersIn(defaulted)).toEqual({ lessonFormat: "hybrid" });
  });

  it("applies an explicit rating change, re-deriving skill band and the +N target", () => {
    const changes = assessmentChangesForProfile(fromQuiz(), { ...quiz, rating: 2050 }, { ratingBaseline: 1400 });
    expect(changes).toMatchObject({ currentRating: 2050, skillLevel: "expert", targetRating: 2250 });
    expect(answersIn(changes).rating).toBe(2050);
  });

  it("keeps a stored goal when the rating changes but no target answer was given", () => {
    const { targetImprovement: _omitted, ...noTarget } = quiz;
    const changes = assessmentChangesForProfile(fromQuiz(), { ...noTarget, rating: 1500 }, { ratingBaseline: 1400 });
    expect(changes).toMatchObject({ currentRating: 1500, skillLevel: "intermediate" });
    expect(changes).not.toHaveProperty("targetRating");
  });

  it("re-derives the target from the CURRENT rating when only the target answer changes", () => {
    const profile = { ...fromQuiz(), ...ratingChangesForProfile(fromQuiz(), 1650) };
    const changes = assessmentChangesForProfile(profile, { ...editableSavedAssessment(profile), targetImprovement: 300 }, { ratingBaseline: 1650 });
    expect(changes.targetRating).toBe(1950);
    expect(changes).not.toHaveProperty("currentRating");
    expect(changes).not.toHaveProperty("skillLevel");
  });

  it("an untouched form never overwrites a rating that changed while it was open", () => {
    const profile = { ...fromQuiz(), ...ratingChangesForProfile(fromQuiz(), 1700) };
    // The form opened at 1650; the dashboard (or a sync) then set 1700.
    const changes = assessmentChangesForProfile(profile, { ...quiz, rating: 1650 }, { ratingBaseline: 1650 });
    for (const field of ratingFields) expect(changes).not.toHaveProperty(field);
    expect(answersIn(changes).rating).toBe(1700);
  });

  it("honours a deliberate change back to the old answer's value when the client reports its baseline", () => {
    const legacy = { ...fromQuiz(), currentRating: 1650 };
    const changes = assessmentChangesForProfile(legacy, { ...quiz, rating: 1400 }, { ratingBaseline: 1650 });
    expect(changes).toMatchObject({ currentRating: 1400, skillLevel: "intermediate" });
  });

  it("a rating answer fills a profile that has no current rating", () => {
    const changes = assessmentChangesForProfile({ currentRating: null, assessmentData: null }, { rating: 900 }, { ratingBaseline: null });
    expect(changes).toMatchObject({ currentRating: 900, skillLevel: "beginner" });
  });

  it("writes only the preference columns whose questions were answered", () => {
    // A profile created from the dashboard rating: no answers, no budget yet.
    const stored = { currentRating: 1650, assessmentData: null, primaryGoal: "rating_improvement", budgetMinCents: null };
    const changes = assessmentChangesForProfile(stored, { rating: 1650, lessonFormat: "hybrid" }, { ratingBaseline: 1650 });
    expect(Object.keys(changes).sort()).toEqual(["assessmentCompletedAt", "assessmentData", "assessmentVersion"]);

    const answered = assessmentChangesForProfile(stored, { primaryGoal: "competitive", budgetMin: 30, improvementAreas: [] });
    expect(answered).toMatchObject({ primaryGoal: "tournament_prep", budgetMinCents: 3000, improvementAreas: "[]" });
    expect(answered).not.toHaveProperty("budgetMaxCents");
    expect(answered).not.toHaveProperty("credentialImportance");
  });

  it("re-maps every answered preference exactly like a first save would", () => {
    const changes = assessmentChangesForProfile(fromQuiz(), quiz, { ratingBaseline: 1400 });
    const mapped = mapAssessmentToProfile(quiz);
    for (const column of Object.keys(PREFERENCE_COLUMN_SOURCES) as (keyof typeof PREFERENCE_COLUMN_SOURCES)[]) {
      expect(changes[column]).toEqual(mapped[column]);
    }
  });
});

describe("reading saved answers through the profile", () => {
  it("shows and prefills the profile's current rating, never a stale answer", () => {
    const legacy = { ...fromQuiz(), currentRating: 1650 };
    expect(currentAssessmentAnswers(legacy).rating).toBe(1650);
    expect(editableSavedAssessment(legacy).rating).toBe(1650);
    expect(savedMatchingPreferences(legacy).find(r => r.label === "Rating answer")?.value).toBe("1650 (Lichess)");
  });

  it("shows the dashboard rating of a profile without questionnaire answers", () => {
    const dashboardOnly = { currentRating: 1650, assessmentData: null };
    expect(editableSavedAssessment(dashboardOnly)).toEqual({ rating: 1650 });
    expect(savedMatchingPreferences(dashboardOnly).find(r => r.label === "Rating answer")?.value).toBe("1650 (rating system not saved)");
  });

  it("never presents the mapping's default rating as an answer", () => {
    const savedWithoutRating = mapAssessmentToProfile({ lessonFormat: "online" }); // currentRating defaults to 1200
    expect(savedWithoutRating.currentRating).toBe(1200);
    expect(currentAssessmentAnswers(savedWithoutRating)).toEqual({ lessonFormat: "online" });
    expect(savedMatchingPreferences(savedWithoutRating).every(r => r.value === "Not saved" || r.label === "Lesson format")).toBe(true);
  });

  it.each([null, undefined, -1, 5000, Number.NaN])("drops the rating when the profile has no usable current rating (%s)", currentRating => {
    expect(currentAssessmentAnswers({ ...fromQuiz(), currentRating })).not.toHaveProperty("rating");
  });

  it("handles missing or malformed profiles like missing answers", () => {
    for (const profile of [null, undefined, { assessmentData: "{" }, { assessmentData: "[]", currentRating: 1500 }]) {
      expect(editableSavedAssessment(profile)).toEqual({});
    }
  });
});
