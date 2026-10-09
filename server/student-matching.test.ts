import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import { authRouter } from "./authRouter";
import * as db from "./db";
import * as auth from "./auth";
import { mapAssessmentToProfile } from "@shared/assessmentMapping";
import { savedMatchingPreferences } from "@shared/savedMatchingPreferences";
import { scoreCoachForStudent, toCoachForMatching } from "@shared/coachMatching";

vi.mock("./db");
vi.mock("./auth");
vi.mock("./emailService");
vi.mock("./nurtureEmailScheduler");
vi.mock("./resendWelcomeEmails");

const user = { id: 901, name: "Synthetic Student", email: "student@example.invalid", openId: null, userType: "student" };
const context = () => ({ user: user as any, req: { protocol: "https", headers: {} } as any, res: { setHeader: vi.fn() } as any });
const answers = { primaryGoal: "rating", teachingArchetype: "sage", improvementAreas: ["Opening preparation", "Endgame technique", "Tactical calculation"], availability: ["Morning (9am-12pm)"], timezone: "America/New_York", lessonFrequency: "weekly", budgetMin: 40, budgetMax: 80 };
const coach = toCoachForMatching({ users: { id: 902, name: "Synthetic Coach" }, coach_profiles: { userId: 902, teachingStyle: "analytical", specialties: '["Openings","Endgames","Tactics"]', hourlyRateCents: 6000, availabilitySchedule: '{"monday":[{"start":"09:00","end":"12:00"}]}' } });

beforeEach(() => vi.resetAllMocks());

describe("saved matching preferences", () => {
  it.each(["__proto__", "constructor", "toString"])("renders inherited-property names as saved strings: %s", value => {
    const data = Object.fromEntries(["primaryGoal", "teachingArchetype", "lessonFrequency", "lessonFormat", "credentialImportance", "styleIcon", "ratingSystem"].map(key => [key, value]));
    const rows = savedMatchingPreferences(JSON.stringify({ ...data, rating: 1200 }));
    expect(rows.every(row => typeof row.value === "string")).toBe(true);
    expect(rows.find(row => row.label === "Primary goal")?.value).toBe(value);
    expect(rows.find(row => row.label === "Rating answer")?.value).toBe(`1200 (${value})`);
  });
  it("shows original answers, never derived defaults, with zero preserved", () => {
    const profile = mapAssessmentToProfile({ primaryGoal: "enjoyment", rating: 0, budgetMin: 0, budgetMax: 80 });
    const rows = Object.fromEntries(savedMatchingPreferences(profile.assessmentData).map(r => [r.label, r.value]));
    expect(profile.learningStyle).toBe("analytical");
    expect(rows["Teaching preference"]).toBe("Not saved");
    expect(rows["Primary goal"]).toBe("Enjoyment");
    expect(rows["Rating answer"]).toBe("0 (rating system not saved)");
    expect(rows["Budget answer"]).toBe("$0–$80 (saved range; pricing not verified)");
    expect(rows["Timezone"]).toBe("Not saved");
  });

  it.each([null, "{", "[]", "null", '{"availability":{},"budgetMin":null,"rating":"1200"}'])("handles incomplete/malformed saved data: %s", raw => {
    expect(savedMatchingPreferences(raw).every(r => r.value === "Not saved")).toBe(true);
  });

  it("does not make a price range from a missing endpoint or an inverted range", () => {
    for (const data of [{ budgetMin: 40 }, { budgetMin: 80, budgetMax: 40 }]) {
      expect(savedMatchingPreferences(JSON.stringify(data)).find(r => r.label === "Budget answer")?.value).toBe("Not saved");
    }
  });
});

describe("recommendation explanations preserve scores without claiming availability", () => {
  it.each(["1e999", "5000", "-1e999", "null", '"1200"'])("does not justify a rating explanation from invalid legacy input %s", rawRating => {
    const profile = { ...mapAssessmentToProfile({}), assessmentData: `{"rating":${rawRating},"ratingSystem":"fide"}` };
    const result = scoreCoachForStudent({ ...coach, fideRating: 1700 }, profile);
    expect(result.breakdown.ratingGap).toBe(15); // Keep the existing mapped-default score.
    expect(result.reasons).not.toContain("Right skill level to challenge and teach you");
  });
  // No date is picked to guess offsets. This also covers the weeks when London
  // and New York switch DST on different dates, and winter/summer offset changes.
  it.each([
    [undefined, undefined], ["Invalid/Zone", "America/New_York"],
    ["America/New_York", "Invalid/Zone"], ["", ""],
    ["America/New_York", "America/New_York"], ["America/New_York", "Europe/London"],
    ["Asia/Kolkata", "America/Los_Angeles"], ["Pacific/Kiritimati", "Pacific/Honolulu"],
  ])("suppresses overlap/price claims for student=%s, coach=%s", (studentZone, coachZone) => {
    const profile = mapAssessmentToProfile({ availability: answers.availability, timezone: studentZone, budgetMin: 40, budgetMax: 80 });
    const result = scoreCoachForStudent({ ...coach, timezone: coachZone } as typeof coach, profile);
    expect(result.breakdown.schedule).toBe(10); // Existing local-bucket heuristic is unchanged.
    expect(result.breakdown.budget).toBe(15);
    expect(result.reasons).toEqual(["No specific preference match established"]);
  });

  it("does not turn incomplete assessment defaults into personal match reasons", () => {
    expect(scoreCoachForStudent(coach, mapAssessmentToProfile({})).reasons).toEqual(["No specific preference match established"]);
    const result = scoreCoachForStudent(coach, mapAssessmentToProfile(answers));
    expect(result.reasons).toContain("Teaching style aligns with your learning preference");
    expect(result.reasons).toContain("Specializes in your improvement areas");
    expect(result.reasons.join(" ")).not.toMatch(/available|budget/i);
  });

  it.each(["wrong shape", {}, [null, 42]])("does not crash on malformed legacy availability %j", availability => {
    expect(() => scoreCoachForStudent(coach, { ...mapAssessmentToProfile({}), assessmentData: JSON.stringify({ availability, ratingSystem: 123 }) })).not.toThrow();
  });
});

describe("existing profile and recommendation reads", () => {
  it.each([false, true])("guest answers survive verification into a profile (existing=%s), then repeated dashboard reads", async existing => {
    let stored: any = existing ? { userId: user.id } : undefined;
    vi.mocked(db.getStudentProfileByUserId).mockImplementation(async () => stored);
    vi.mocked(db.getUserById).mockResolvedValue(user as any);
    vi.mocked(auth.verifyEmail).mockResolvedValue({ success: true, userId: user.id });
    vi.mocked(db.getWaitlistEntryByEmail).mockResolvedValue({ assessmentData: JSON.stringify(answers) } as any);
    vi.mocked(db.createStudentProfile).mockImplementation(async value => { stored = value; return 1; });
    vi.mocked(db.updateStudentProfileFromStored).mockImplementation(async (_id, _reads, changesFor) => {
      if (!stored) return undefined;
      const changes = changesFor(stored);
      if (changes) stored = { ...stored, ...changes };
      return stored;
    });
    await authRouter.createCaller(context()).verifyEmail({ token: "synthetic-verification-token" });
    expect(JSON.parse(stored.assessmentData)).toEqual(answers);
    const migratedBytes = stored.assessmentData;
    vi.mocked(db.getActiveCoaches).mockResolvedValue([]);
    vi.clearAllMocks();
    const caller = appRouter.createCaller(context());
    for (let i = 0; i < 3; i++) {
      const profile = await caller.student.getProfile();
      expect(profile?.assessmentData).toBe(migratedBytes);
      expect(savedMatchingPreferences(profile?.assessmentData).find(r => r.label === "Timezone")?.value).toBe("America/New_York");
      expect(await caller.match.getMatchedCoaches()).toEqual([]);
    }
    expect(db.createStudentProfile).not.toHaveBeenCalled();
    expect(db.updateStudentProfile).not.toHaveBeenCalled();
    expect(db.updateStudentProfileFromStored).not.toHaveBeenCalled();
    expect(db.upsertCoachMatch).not.toHaveBeenCalled();
  });

  it("distinguishes request failures from empty responses and safely retries without writes", async () => {
    const profile = mapAssessmentToProfile(answers);
    vi.mocked(db.getStudentProfileByUserId).mockResolvedValue(profile as any);
    vi.mocked(db.getActiveCoaches).mockRejectedValueOnce(new Error("synthetic unavailable")).mockResolvedValueOnce([]).mockResolvedValue([{ ...coach }] as any);
    const caller = appRouter.createCaller(context());
    await expect(caller.match.getMatchedCoaches()).rejects.toThrow("synthetic unavailable");
    expect(await caller.match.getMatchedCoaches()).toEqual([]);
    expect((await caller.match.getMatchedCoaches())[0].reasons).toContain("Specializes in your improvement areas");
    expect(db.updateStudentProfile).not.toHaveBeenCalled();
    expect(db.updateStudentProfileFromStored).not.toHaveBeenCalled();
    expect(db.upsertCoachMatch).not.toHaveBeenCalled();
    expect(profile.assessmentData).toBe(JSON.stringify(answers));
  });

  it("returns no profile / no recommendations without creating answers", async () => {
    vi.mocked(db.getStudentProfileByUserId).mockResolvedValue(undefined);
    const caller = appRouter.createCaller(context());
    expect(await caller.student.getProfile()).toBeNull();
    expect(await caller.match.getMatchedCoaches()).toEqual([]);
    expect(db.getActiveCoaches).not.toHaveBeenCalled();
    expect(db.createStudentProfile).not.toHaveBeenCalled();
  });
});
