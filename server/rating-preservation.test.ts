/**
 * Sprint 2 — matching preferences must never clobber the student's rating.
 *
 * Runs the real router and the real db.ts student-profile helpers against an
 * in-memory stand-in for the MySQL driver (one student per test), so every
 * write path is exercised end to end: first questionnaire, dashboard rating,
 * Find Another Coach edits, guest-answer import and matching reads.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";
import { importGuestAssessment } from "./studentAssessment";
import { assessmentDataSchema, mapAssessmentToProfile, type ValidatedAssessmentData } from "@shared/assessmentMapping";
import { editableSavedAssessment } from "@shared/editableSavedAssessment";
import { savedMatchingPreferences } from "@shared/savedMatchingPreferences";
import { toCoachForMatching } from "@shared/coachMatching";

type Row = Record<string, unknown>;
const store = vi.hoisted(() => ({ profile: undefined as Record<string, unknown> | undefined }));

// Column defaults of student_profiles for the fields these flows touch.
const emptyRow: Row = {
  id: 7, userId: 901, skillLevel: "beginner", currentRating: null, targetRating: null,
  primaryGoal: null, playingStyle: null, learningStyle: null, practiceSchedule: null,
  assessmentData: null, budgetMinCents: null, budgetMaxCents: null, credentialImportance: null, improvementAreas: null,
};

vi.mock("drizzle-orm/mysql2", () => ({
  drizzle: () => ({
    select: () => ({ from: () => ({ where: () => ({ limit: async () => (store.profile ? [{ ...store.profile }] : []) }) }) }),
    insert: () => ({ values: async (row: Row) => { store.profile = { ...emptyRow, ...row }; } }),
    update: () => ({
      set: (changes: Row) => ({
        where: async () => {
          // Like drizzle: undefined means "leave unchanged"; an empty SET is an error.
          const defined = Object.fromEntries(Object.entries(changes).filter(([, v]) => v !== undefined));
          if (!Object.keys(defined).length) throw new Error("No values to set");
          store.profile = { ...store.profile, ...defined };
        },
      }),
    }),
  }),
}));
vi.mock("./db", async importOriginal => ({ ...(await importOriginal<typeof import("./db")>()), getActiveCoaches: vi.fn() }));
vi.mock("./emailService");
vi.mock("./nurtureEmailScheduler");
vi.mock("./resendWelcomeEmails");

const student = { id: 901, role: "user", userType: "student", openId: "s", name: "Synthetic Student", email: "student@example.invalid" };
const caller = () => appRouter.createCaller({ user: student as any, req: { protocol: "https", headers: {} } as any, res: { setHeader: vi.fn() } as any });

// The first questionnaire: 1400 on Lichess, aiming 200 higher.
const quiz: ValidatedAssessmentData = {
  rating: 1400, ratingSystem: "lichess", targetImprovement: 200, primaryGoal: "rating", teachingArchetype: "sage",
  styleIcon: "tal", lessonFrequency: "weekly", lessonFormat: "online", budgetMin: 40, budgetMax: 80,
  credentialImportance: "titled", improvementAreas: ["Endgame technique"], timezone: "Europe/London",
};
const ratingState = () => ({ currentRating: store.profile?.currentRating, skillLevel: store.profile?.skillLevel, targetRating: store.profile?.targetRating });
const preference = (label: string) => savedMatchingPreferences(store.profile as any).find(row => row.label === label)?.value;

/** What Find Another Coach does: prefill from the profile, edit, save. */
async function editPreferences(edit: Partial<ValidatedAssessmentData>) {
  const form = editableSavedAssessment(await caller().student.getProfile());
  return caller().student.saveQuizResults({ assessmentData: { ...form, ...edit }, ratingBaseline: form.rating ?? null });
}

beforeEach(() => {
  store.profile = undefined;
  vi.mocked(db.getActiveCoaches).mockReset();
});

describe("first questionnaire", () => {
  it.each([["a full questionnaire", quiz], ["no answers at all", {}]])("creates the full profile exactly as before (%s)", async (_label, answers) => {
    expect(await caller().student.saveQuizResults({ assessmentData: answers })).toEqual({ success: true });
    // The router maps the schema-parsed answers, as it always has.
    const { assessmentCompletedAt: _completedAt, ...expected } = mapAssessmentToProfile(assessmentDataSchema.parse(answers));
    expect(store.profile).toMatchObject({ ...expected, userId: 901 });
    expect(store.profile!.assessmentCompletedAt).toBeInstanceOf(Date);
  });
});

describe("dashboard rating, then a Find Another Coach edit", () => {
  it("regression: 1650 survives an edit of lesson format only; skill band and goal are unchanged", async () => {
    await caller().student.saveQuizResults({ assessmentData: quiz });
    expect(ratingState()).toEqual({ currentRating: 1400, skillLevel: "intermediate", targetRating: 1600 });

    await caller().student.updateRating({ currentRating: 1650 });
    // Skill band follows the rating; the student's own target is kept.
    expect(ratingState()).toEqual({ currentRating: 1650, skillLevel: "advanced", targetRating: 1600 });
    expect(preference("Rating answer")).toBe("1650 (Lichess)");

    expect(editableSavedAssessment(await caller().student.getProfile()).rating).toBe(1650);
    await editPreferences({ lessonFormat: "hybrid" });
    expect(ratingState()).toEqual({ currentRating: 1650, skillLevel: "advanced", targetRating: 1600 });
    expect(preference("Lesson format")).toBe("Hybrid");
    expect(preference("Rating answer")).toBe("1650 (Lichess)");
    expect(JSON.parse(store.profile!.assessmentData as string).rating).toBe(1650);
  });

  it("matching ranks with the up-to-date rating", async () => {
    await caller().student.saveQuizResults({ assessmentData: quiz });
    await caller().student.updateRating({ currentRating: 1650 });
    await editPreferences({ lessonFormat: "hybrid" });
    // FIDE 2200 is 700 above 1650 Lichess (≈1500 FIDE): the full rating-fit score.
    // Against the old 1400 answer (≈1250 FIDE) the gap would be 950 → 12.
    const coach = { users: { id: 902, name: "Synthetic Coach" }, coach_profiles: { userId: 902, fideRating: 2200 } };
    vi.mocked(db.getActiveCoaches).mockResolvedValue([coach] as any);
    const [match] = await caller().match.getMatchedCoaches();
    expect(match.breakdown.ratingGap).toBe(15);
    expect(match.coachUserId).toBe(toCoachForMatching(coach).userId);
  });

  it("a client built before this fix (raw stored answers, no baseline) cannot revert a drifted rating", async () => {
    // A row saved before this fix: the dashboard moved only currentRating.
    store.profile = { ...emptyRow, ...mapAssessmentToProfile(quiz), currentRating: 1650 };
    const oldForm = editableSavedAssessment(store.profile.assessmentData as string);
    expect(oldForm.rating).toBe(1400);
    await caller().student.saveQuizResults({ assessmentData: { ...oldForm, lessonFormat: "hybrid" } });
    expect(ratingState()).toEqual({ currentRating: 1650, skillLevel: "intermediate", targetRating: 1600 });
    expect(JSON.parse(store.profile!.assessmentData as string)).toMatchObject({ rating: 1650, lessonFormat: "hybrid" });
  });

  it("an untouched form never overwrites a rating saved while it was open", async () => {
    await caller().student.saveQuizResults({ assessmentData: quiz });
    await caller().student.updateRating({ currentRating: 1650 });
    const form = editableSavedAssessment(await caller().student.getProfile());
    await caller().student.updateRating({ currentRating: 1700 }); // another tab
    await caller().student.saveQuizResults({ assessmentData: { ...form, lessonFormat: "hybrid" }, ratingBaseline: form.rating });
    expect(store.profile!.currentRating).toBe(1700);
  });

  it("an explicit rating change in the form updates the rating, skill band and +N target", async () => {
    await caller().student.saveQuizResults({ assessmentData: quiz });
    await caller().student.updateRating({ currentRating: 1650 });
    await editPreferences({ rating: 2050 });
    expect(ratingState()).toEqual({ currentRating: 2050, skillLevel: "expert", targetRating: 2250 });
    expect(preference("Rating answer")).toBe("2050 (Lichess)");
  });

  it("a target-only change re-derives the goal from the current rating", async () => {
    await caller().student.saveQuizResults({ assessmentData: quiz });
    await caller().student.updateRating({ currentRating: 1650 });
    await editPreferences({ targetImprovement: 300 });
    expect(ratingState()).toEqual({ currentRating: 1650, skillLevel: "advanced", targetRating: 1950 });
  });
});

describe("profiles created from the dashboard rating (no saved answers)", () => {
  beforeEach(async () => {
    await caller().student.updateRating({ currentRating: 1650 });
    expect(store.profile).toMatchObject({ currentRating: 1650, skillLevel: "advanced", primaryGoal: "rating_improvement", assessmentData: null });
  });

  it("prefills and keeps the rating through an edit, without inventing other answers", async () => {
    expect(editableSavedAssessment(await caller().student.getProfile())).toEqual({ rating: 1650 });
    await editPreferences({ lessonFormat: "hybrid" });
    expect(ratingState()).toEqual({ currentRating: 1650, skillLevel: "advanced", targetRating: null });
    // Unanswered questions keep their stored values instead of mapped defaults.
    expect(store.profile).toMatchObject({ primaryGoal: "rating_improvement", budgetMinCents: null, budgetMaxCents: null, credentialImportance: null });
    expect(JSON.parse(store.profile!.assessmentData as string)).toEqual({ rating: 1650, lessonFormat: "hybrid" });
  });

  it("keeps the rating when an older client sends no rating answer at all", async () => {
    await caller().student.saveQuizResults({ assessmentData: { lessonFormat: "hybrid" } });
    expect(ratingState()).toEqual({ currentRating: 1650, skillLevel: "advanced", targetRating: null });
    expect(preference("Rating answer")).toBe("1650 (rating system not saved)");
  });

  it("the 1500–1599 band matches the questionnaire's skill bands", async () => {
    store.profile = undefined;
    await caller().student.updateRating({ currentRating: 1550 });
    expect(store.profile!.skillLevel).toBe("intermediate");
  });
});

describe("guest answers imported at email verification", () => {
  it("fill an empty profile but never replace its rating", async () => {
    await caller().student.updateRating({ currentRating: 1650 });
    await importGuestAssessment(901, quiz);
    // The guest's "+200" goal is set relative to the rating the profile has.
    expect(ratingState()).toEqual({ currentRating: 1650, skillLevel: "advanced", targetRating: 1850 });
    expect(store.profile).toMatchObject({ learningStyle: "analytical", budgetMinCents: 4000 });
  });

  it("never replace answers the student already saved", async () => {
    await caller().student.saveQuizResults({ assessmentData: { ...quiz, rating: 1800, lessonFormat: "hybrid" } });
    const before = { ...store.profile };
    await importGuestAssessment(901, quiz);
    expect(store.profile).toEqual(before);
  });

  it("create the full profile when there is none", async () => {
    await importGuestAssessment(901, quiz);
    expect(store.profile).toMatchObject({ currentRating: 1400, skillLevel: "intermediate", targetRating: 1600 });
  });
});
