import { describe, expect, it, vi } from "vitest";
import { editableSavedAssessment } from "../shared/editableSavedAssessment";
import { appRouter } from "./routers";
import * as db from "./db";
import { mapAssessmentToProfile } from "../shared/assessmentMapping";

vi.mock("./db");

it("updates the existing profile then reads recommendations from saved answers", async () => {
  const answers = { primaryGoal: "rating", rating: 0, budgetMin: 0, budgetMax: 80, timezone: "Europe/London" };
  let profile = { id: 7, userId: 901, ...mapAssessmentToProfile(answers) };
  vi.mocked(db.getStudentProfileByUserId).mockImplementation(async () => profile as any);
  vi.mocked(db.updateStudentProfile).mockImplementation(async (_id, changes) => { profile = { ...profile, ...changes }; });
  vi.mocked(db.getActiveCoaches).mockResolvedValue([]);
  const caller = appRouter.createCaller({ user: { id: 901, userType: "both" } as any, req: {} as any, res: {} as any });
  const edited = { ...editableSavedAssessment(profile.assessmentData), primaryGoal: "enjoyment" };
  await caller.student.saveQuizResults({ assessmentData: edited });
  expect(JSON.parse((await caller.student.getProfile())!.assessmentData!)).toEqual(edited);
  expect(await caller.match.getMatchedCoaches()).toEqual([]);
  expect(db.updateStudentProfile).toHaveBeenCalledTimes(1);
  expect(db.createStudentProfile).not.toHaveBeenCalled();
  expect(db.upsertCoachMatch).not.toHaveBeenCalled();
});

describe("prefilling the original questionnaire", () => {
  it("preserves zero and all valid saved fields without derived defaults", () => {
    const answers = { rating: 0, feedbackStyle: 0, budgetMin: 0, budgetMax: 80, primaryGoal: "enjoyment", availability: [], timezone: "Europe/London" };
    expect(editableSavedAssessment(JSON.stringify(answers))).toEqual(answers);
  });
  it.each([null, "{", "null", "[]"])("keeps missing or malformed data empty: %s", raw => {
    expect(editableSavedAssessment(raw)).toEqual({});
  });
  it("drops only invalid fields and does not coerce missing numerics to zero", () => {
    expect(editableSavedAssessment(JSON.stringify({ rating: null, techComfort: "5", availability: {}, primaryGoal: "rating", budgetMax: 80, unknown: true }))).toEqual({ primaryGoal: "rating", budgetMax: 80 });
  });
});
