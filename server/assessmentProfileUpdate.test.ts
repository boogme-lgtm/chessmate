import { describe, expect, it } from "vitest";
import {
  mapAssessmentToProfile,
  PREFERENCE_COLUMN_SOURCES,
  skillLevelForRating,
  targetImprovementToward,
  type AssessmentData,
  type ValidatedAssessmentData,
} from "@shared/assessmentMapping";
import {
  assessmentChangesForProfile,
  ratingChangesForProfile,
  STORED_PROFILE_INPUTS,
  type StoredStudentProfile,
} from "@shared/assessmentProfileUpdate";
import { currentAssessmentAnswers, savedMatchingPreferences } from "@shared/savedMatchingPreferences";
import { editableSavedAssessment } from "@shared/editableSavedAssessment";
import { answerBaseline, answerQuestion, startQuestionnaire } from "@shared/questionnaireDraft";

// A completed questionnaire: 1400 on Lichess, aiming 200 higher (goal 1600).
const quiz: ValidatedAssessmentData = {
  rating: 1400, ratingSystem: "lichess", targetImprovement: 200, primaryGoal: "rating",
  teachingArchetype: "sage", styleIcon: "tal", lessonFrequency: "weekly", lessonFormat: "online",
  budgetMin: 40, budgetMax: 80, credentialImportance: "titled", improvementAreas: ["Endgame technique"],
};
const fromQuiz = () => ({ ...mapAssessmentToProfile(quiz) });
const ratingFields = ["currentRating", "skillLevel", "targetRating"] as const;
const answersIn = (changes: { assessmentData?: string }) => JSON.parse(changes.assessmentData!);
const apply = <T extends object>(profile: T, changes: object) => ({ ...profile, ...changes });

/** What the edit form does: prefill from the profile, answer, save with its baseline. */
function saveEdit(profile: StoredStudentProfile, edit: Partial<AssessmentData>) {
  let draft = startQuestionnaire(editableSavedAssessment(profile));
  for (const [key, value] of Object.entries(edit)) draft = answerQuestion(draft, key as keyof AssessmentData, value as never);
  return assessmentChangesForProfile(profile, draft.answers as ValidatedAssessmentData, { baseline: answerBaseline(draft) });
}

describe("skillLevelForRating", () => {
  it.each([[0, "beginner"], [999, "beginner"], [1000, "intermediate"], [1599, "intermediate"], [1600, "advanced"], [1999, "advanced"], [2000, "expert"]])(
    "%i → %s (same bands as the questionnaire mapping)", (rating, level) => {
      expect(skillLevelForRating(rating)).toBe(level);
      expect(mapAssessmentToProfile({ rating }).skillLevel).toBe(level);
    });
});

describe("targetImprovementToward", () => {
  it.each([[1600, 1400, 200], [1600, 1500, 100], [1600, 1600, 0], [1600, 1700, 0], [5000, 100, 2000]])(
    "goal %i from %i → +%i", (goal, rating, expected) => {
      expect(targetImprovementToward(goal, rating)).toBe(expected);
    });
});

describe("rating-only changes (dashboard, future rating sync)", () => {
  it("updates rating and skill band, keeps the goal, and keeps the saved answers in step", () => {
    const changes = ratingChangesForProfile(fromQuiz(), 1650);
    expect(changes).toMatchObject({ currentRating: 1650, skillLevel: "advanced" });
    expect(changes).not.toHaveProperty("targetRating");
    // The goal (1600) is reached: "+N" now says 0 to go.
    expect(answersIn(changes)).toEqual({ ...quiz, rating: 1650, targetImprovement: 0 });
    expect(answersIn(ratingChangesForProfile(fromQuiz(), 1500)).targetImprovement).toBe(100);
  });

  it("regression: anchors a +N goal saved before the profile had any rating", () => {
    const stub = { currentRating: null, targetRating: null, assessmentData: '{"targetImprovement":300}' };
    const changes = ratingChangesForProfile(stub, 1650);
    expect(changes).toMatchObject({ currentRating: 1650, skillLevel: "advanced", targetRating: 1950 });
    expect(answersIn(changes)).toEqual({ targetImprovement: 300, rating: 1650 });
  });

  it("adds the rating to saved answers that had none, but never invents answers or rewrites unreadable data", () => {
    expect(answersIn(ratingChangesForProfile({ assessmentData: '{"lessonFormat":"online"}' }, 1650))).toEqual({ lessonFormat: "online", rating: 1650 });
    for (const assessmentData of [null, undefined, "{", "[]", "null"]) {
      expect(ratingChangesForProfile({ assessmentData, targetRating: null }, 1650)).toEqual({ currentRating: 1650, skillLevel: "advanced" });
    }
    // A goal that came from a mapping default is not turned into a "+N" answer.
    expect(answersIn(ratingChangesForProfile(mapAssessmentToProfile({ rating: 1400 }), 1650))).toEqual({ rating: 1650 });
  });
});

describe("questionnaire saves onto an existing profile", () => {
  it("regression: a dashboard rating survives an edit that only changes lesson format", () => {
    let profile = fromQuiz();
    profile = apply(profile, ratingChangesForProfile(profile, 1650));
    expect(editableSavedAssessment(profile)).toMatchObject({ rating: 1650, targetImprovement: 0 }); // prefilled from the profile

    const changes = saveEdit(profile, { lessonFormat: "hybrid" });
    for (const field of ratingFields) expect(changes).not.toHaveProperty(field);
    expect(answersIn(changes)).toEqual({ ...quiz, rating: 1650, targetImprovement: 0, lessonFormat: "hybrid" });
    expect(apply(profile, changes)).toMatchObject({ currentRating: 1650, skillLevel: "advanced", targetRating: 1600 });
  });

  it("keeps the rating and goal when an older client sends back the stale stored answers (legacy drifted row)", () => {
    // Saved before this fix: dashboard moved the rating, answers still say 1400 and +200.
    const legacy = { ...fromQuiz(), currentRating: 1650 };
    const oldClientForm = editableSavedAssessment(legacy.assessmentData); // raw answers, no baseline
    expect(oldClientForm).toMatchObject({ rating: 1400, targetImprovement: 200 });
    const changes = assessmentChangesForProfile(legacy, { ...oldClientForm, lessonFormat: "hybrid" });
    for (const field of ratingFields) expect(changes).not.toHaveProperty(field);
    expect(answersIn(changes)).toMatchObject({ rating: 1650, targetImprovement: 0 }); // answers reconciled to the profile
  });

  it("never writes the 1200 default when the rating answer is missing, and keeps the rating and goal already given", () => {
    const profile = { ...fromQuiz(), currentRating: 1650 };
    const { rating: _rating, targetImprovement: _target, ...withoutRating } = quiz;
    const baselines = [undefined, { rating: null, targetImprovement: null }, { rating: 1650, targetImprovement: 0 }];
    for (const baseline of baselines) {
      const changes = assessmentChangesForProfile(profile, { ...withoutRating, lessonFormat: "hybrid" }, { baseline });
      for (const field of ratingFields) expect(changes).not.toHaveProperty(field);
      expect(answersIn(changes)).toMatchObject({ rating: 1650, targetImprovement: 0 });
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

  it("applies an explicit rating change and its skill band, and keeps the goal like a dashboard change does", () => {
    const changes = saveEdit(fromQuiz(), { rating: 2050 });
    expect(changes).toMatchObject({ currentRating: 2050, skillLevel: "expert" });
    expect(changes).not.toHaveProperty("targetRating");
    expect(answersIn(changes)).toMatchObject({ rating: 2050, targetImprovement: 0 });
    // Same rating move from the dashboard: same stored goal and same "+N".
    const dashboard = ratingChangesForProfile(fromQuiz(), 2050);
    expect(dashboard).not.toHaveProperty("targetRating");
    expect(answersIn(dashboard).targetImprovement).toBe(answersIn(changes).targetImprovement);
  });

  it("restates the goal as new rating + N when both answers change", () => {
    const changes = saveEdit(fromQuiz(), { rating: 1500, targetImprovement: 300 });
    expect(changes).toMatchObject({ currentRating: 1500, skillLevel: "intermediate", targetRating: 1800 });
    expect(answersIn(changes)).toMatchObject({ rating: 1500, targetImprovement: 300 });
  });

  it("keeps a stored goal when the rating changes but no target answer was given", () => {
    const { targetImprovement: _omitted, ...noTarget } = quiz;
    const changes = assessmentChangesForProfile(fromQuiz(), { ...noTarget, rating: 1500 }, { baseline: { rating: 1400, targetImprovement: null } });
    expect(changes).toMatchObject({ currentRating: 1500, skillLevel: "intermediate" });
    expect(changes).not.toHaveProperty("targetRating");
    expect(answersIn(changes).targetImprovement).toBe(100); // the "+N" already given is kept, from the new rating
  });

  it("restates the goal from the CURRENT rating when only the target answer changes", () => {
    const profile = apply(fromQuiz(), ratingChangesForProfile(fromQuiz(), 1650));
    const changes = saveEdit(profile, { targetImprovement: 300 });
    expect(changes.targetRating).toBe(1950);
    expect(changes).not.toHaveProperty("currentRating");
    expect(changes).not.toHaveProperty("skillLevel");
  });

  it("an untouched form never overwrites a rating that changed while it was open", () => {
    const profile = apply(fromQuiz(), ratingChangesForProfile(fromQuiz(), 1700));
    // The form opened at 1650 ("+0"); the dashboard (or a sync) then set 1700.
    const changes = assessmentChangesForProfile(profile, { ...quiz, rating: 1650, targetImprovement: 0 }, { baseline: { rating: 1650, targetImprovement: 0 } });
    for (const field of ratingFields) expect(changes).not.toHaveProperty(field);
    expect(answersIn(changes).rating).toBe(1700);
  });

  it("an untouched \"+N\" never restates the goal when the rating changed while the form was open", () => {
    const at1500 = apply(fromQuiz(), ratingChangesForProfile(fromQuiz(), 1500));
    const form = startQuestionnaire(editableSavedAssessment(at1500)); // shows 1500, "+100"
    const at1550 = apply(at1500, ratingChangesForProfile(at1500, 1550)); // now "+50"
    const changes = assessmentChangesForProfile(at1550, { ...form.answers, lessonFormat: "hybrid" } as ValidatedAssessmentData, { baseline: answerBaseline(form) });
    for (const field of ratingFields) expect(changes).not.toHaveProperty(field);
    expect(answersIn(changes)).toMatchObject({ rating: 1550, targetImprovement: 50 });
  });

  it("honours a deliberate change back to the old answer's value when the client reports its baseline", () => {
    const legacy = { ...fromQuiz(), currentRating: 1650 };
    const changes = assessmentChangesForProfile(legacy, { ...quiz, rating: 1400 }, { baseline: { rating: 1650, targetImprovement: 0 } });
    expect(changes).toMatchObject({ currentRating: 1400, skillLevel: "intermediate" });
  });

  it("a rating answer fills a profile that has no current rating, anchoring its +N goal", () => {
    const changes = assessmentChangesForProfile({ currentRating: null, assessmentData: null }, { rating: 900 }, { baseline: { rating: null, targetImprovement: null } });
    expect(changes).toMatchObject({ currentRating: 900, skillLevel: "beginner" });
    expect(changes).not.toHaveProperty("targetRating");
    // A "+N" saved before any rating: the first rating anchors the goal.
    const stub = { currentRating: null, targetRating: null, assessmentData: '{"targetImprovement":300}' };
    expect(saveEdit(stub, { rating: 1200 })).toMatchObject({ currentRating: 1200, targetRating: 1500 });
  });

  it("writes only the preference columns whose questions were answered", () => {
    // A profile created from the dashboard rating: no answers, no budget yet.
    const stored = { currentRating: 1650, assessmentData: null, primaryGoal: "rating_improvement", budgetMinCents: null };
    const changes = assessmentChangesForProfile(stored, { rating: 1650, lessonFormat: "hybrid" }, { baseline: { rating: 1650, targetImprovement: null } });
    expect(Object.keys(changes).sort()).toEqual(["assessmentCompletedAt", "assessmentData", "assessmentVersion"]);

    const answered = assessmentChangesForProfile(stored, { primaryGoal: "competitive", budgetMin: 30, improvementAreas: [] });
    expect(answered).toMatchObject({ primaryGoal: "tournament_prep", budgetMinCents: 3000, improvementAreas: "[]" });
    expect(answered).not.toHaveProperty("budgetMaxCents");
    expect(answered).not.toHaveProperty("credentialImportance");
  });

  it("re-maps every answered preference exactly like a first save would", () => {
    const changes = assessmentChangesForProfile(fromQuiz(), quiz, { baseline: { rating: 1400, targetImprovement: 200 } });
    const mapped = mapAssessmentToProfile(quiz);
    for (const column of Object.keys(PREFERENCE_COLUMN_SOURCES) as (keyof typeof PREFERENCE_COLUMN_SOURCES)[]) {
      expect(changes[column]).toEqual(mapped[column]);
    }
  });
});

describe("the stored values the rules read", () => {
  // db.ts guards exactly STORED_PROFILE_INPUTS when it writes the result, so a
  // rule reading any other column would compute from an unguarded value.
  const onlyInputs = (profile: object) => new Proxy(profile, {
    get(target, key) {
      if (typeof key === "string" && !(STORED_PROFILE_INPUTS as string[]).includes(key)) throw new Error(`reads unguarded column ${key}`);
      return Reflect.get(target, key);
    },
  });

  it("are exactly the guarded columns", () => {
    expect([...STORED_PROFILE_INPUTS].sort()).toEqual(["assessmentData", "currentRating", "targetRating"]);
    const profile = apply(fromQuiz(), { id: 7, userId: 901, totalXp: 50 });
    expect(() => ratingChangesForProfile(onlyInputs(profile), 1650)).not.toThrow();
    expect(() => assessmentChangesForProfile(onlyInputs(profile), { ...quiz, rating: 1500, targetImprovement: 300 }, { baseline: { rating: 1400, targetImprovement: 200 } })).not.toThrow();
  });
});

describe("reading saved answers through the profile", () => {
  it("shows and prefills the profile's current rating and goal, never a stale answer", () => {
    const legacy = { ...fromQuiz(), currentRating: 1650 };
    expect(currentAssessmentAnswers(legacy)).toMatchObject({ rating: 1650, targetImprovement: 0 });
    expect(editableSavedAssessment(legacy)).toMatchObject({ rating: 1650, targetImprovement: 0 });
    expect(savedMatchingPreferences(legacy).find(r => r.label === "Rating answer")?.value).toBe("1650 (Lichess)");
    expect(currentAssessmentAnswers({ ...fromQuiz(), currentRating: 1450 }).targetImprovement).toBe(150);
  });

  it("shows a saved \"+N\" as given when there is no goal or rating to measure it from", () => {
    expect(currentAssessmentAnswers({ currentRating: null, targetRating: null, assessmentData: '{"targetImprovement":300}' })).toEqual({ targetImprovement: 300 });
    expect(currentAssessmentAnswers({ ...fromQuiz(), targetRating: null }).targetImprovement).toBe(200);
  });

  it("shows the dashboard rating of a profile without questionnaire answers", () => {
    const dashboardOnly = { currentRating: 1650, assessmentData: null };
    expect(editableSavedAssessment(dashboardOnly)).toEqual({ rating: 1650 });
    expect(savedMatchingPreferences(dashboardOnly).find(r => r.label === "Rating answer")?.value).toBe("1650 (rating system not saved)");
  });

  it("never presents the mapping's default rating or goal as an answer", () => {
    const savedWithoutRating = mapAssessmentToProfile({ lessonFormat: "online" }); // currentRating 1200, targetRating 1400 by default
    expect(savedWithoutRating).toMatchObject({ currentRating: 1200, targetRating: 1400 });
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
