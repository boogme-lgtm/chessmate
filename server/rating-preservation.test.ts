/**
 * Sprint 2 — matching preferences must never clobber the student's rating.
 *
 * Runs the real router and the real db.ts student-profile helpers against an
 * in-memory stand-in for the MySQL driver (one student per test), so every
 * write path is exercised end to end: first questionnaire, dashboard rating,
 * Find Another Coach edits, guest-answer import at email verification,
 * matching reads, and writes that race each other.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SQL } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { appRouter } from "./routers";
import * as db from "./db";
import * as auth from "./auth";
import { assessmentDataSchema, mapAssessmentToProfile, type AssessmentData, type ValidatedAssessmentData } from "@shared/assessmentMapping";
import { STORED_PROFILE_INPUTS } from "@shared/assessmentProfileUpdate";
import { editableSavedAssessment } from "@shared/editableSavedAssessment";
import { answerQuestion, questionnaireSaveInput, startQuestionnaire } from "@shared/questionnaireDraft";
import { savedMatchingPreferences } from "@shared/savedMatchingPreferences";
import { toCoachForMatching } from "@shared/coachMatching";

type Row = Record<string, unknown>;
const store = vi.hoisted(() => ({
  profile: undefined as Record<string, unknown> | undefined,
  /** Runs after a read has taken its snapshot and before it returns, so a test can land a write in between. */
  afterRead: undefined as (() => unknown) | undefined,
  /** Report affected rows like a server without CLIENT_FOUND_ROWS: only rows whose values changed. */
  countChangedRowsOnly: false,
  lastUpdateGuard: [] as string[],
}));

// Column defaults of student_profiles for the fields these flows touch.
const emptyRow: Row = {
  id: 7, userId: 901, skillLevel: "beginner", currentRating: null, targetRating: null,
  primaryGoal: null, playingStyle: null, learningStyle: null, practiceSchedule: null,
  assessmentData: null, budgetMinCents: null, budgetMaxCents: null, credentialImportance: null, improvementAreas: null,
};

const dialect = new MySqlDialect();
/**
 * Applies an UPDATE's WHERE the way MySQL would for the clauses db.ts writes:
 * a conjunction of column comparisons with bound values (`=`, null-safe `<=>`,
 * byte-exact CAST(... AS BINARY)). Any other shape fails loudly.
 */
function rowMatches(row: Row, where: SQL): boolean {
  const { sql: text, params } = dialect.sqlToQuery(where);
  const columns = [...text.matchAll(/`student_profiles`\.`(\w+)`/g)].map(match => match[1]);
  if (columns.length !== params.length || /\b(or|not)\b/i.test(text)) throw new Error(`Unsupported WHERE in the test stand-in: ${text}`);
  store.lastUpdateGuard = columns;
  return columns.every((column, i) => (row[column] ?? null) === (params[i] ?? null));
}

vi.mock("drizzle-orm/mysql2", () => ({
  drizzle: () => ({
    select: () => ({ from: () => ({ where: () => ({ limit: async () => {
      const rows = store.profile ? [{ ...store.profile }] : [];
      await store.afterRead?.();
      return rows;
    } }) }) }),
    insert: () => ({ values: async (row: Row) => { store.profile = { ...emptyRow, ...row }; } }),
    update: () => ({
      set: (changes: Row) => ({
        where: async (where: SQL) => {
          // Like drizzle: undefined means "leave unchanged"; an empty SET is an error.
          const defined = Object.fromEntries(Object.entries(changes).filter(([, v]) => v !== undefined));
          if (!Object.keys(defined).length) throw new Error("No values to set");
          if (!store.profile || !rowMatches(store.profile, where)) return [{ affectedRows: 0 }];
          const changed = Object.entries(defined).some(([column, value]) => store.profile![column] !== value);
          store.profile = { ...store.profile, ...defined };
          return [{ affectedRows: store.countChangedRowsOnly && !changed ? 0 : 1 }];
        },
      }),
    }),
  }),
}));
vi.mock("./db", async importOriginal => ({
  ...(await importOriginal<typeof import("./db")>()),
  getActiveCoaches: vi.fn(), getUserById: vi.fn(), getWaitlistEntryByEmail: vi.fn(),
}));
vi.mock("./auth", async importOriginal => ({ ...(await importOriginal<typeof import("./auth")>()), verifyEmail: vi.fn() }));
vi.mock("./emailService");
vi.mock("./nurtureEmailScheduler");
vi.mock("./resendWelcomeEmails");

const student = { id: 901, role: "user", userType: "student", openId: "s", name: "Synthetic Student", email: "student@example.invalid" };
const contextFor = (user: unknown) => ({ user: user as any, req: { protocol: "https", headers: {} } as any, res: { setHeader: vi.fn() } as any });
const caller = () => appRouter.createCaller(contextFor(student));

// The first questionnaire: 1400 on Lichess, aiming 200 higher.
const quiz: ValidatedAssessmentData = {
  rating: 1400, ratingSystem: "lichess", targetImprovement: 200, primaryGoal: "rating", teachingArchetype: "sage",
  styleIcon: "tal", lessonFrequency: "weekly", lessonFormat: "online", budgetMin: 40, budgetMax: 80,
  credentialImportance: "titled", improvementAreas: ["Endgame technique"], timezone: "Europe/London",
};
const ratingState = () => ({ currentRating: store.profile?.currentRating, skillLevel: store.profile?.skillLevel, targetRating: store.profile?.targetRating });
const answers = () => JSON.parse(store.profile!.assessmentData as string);
const preference = (label: string) => savedMatchingPreferences(store.profile as any).find(row => row.label === label)?.value;
const prefill = async () => editableSavedAssessment(await caller().student.getProfile());

/** What Find Another Coach sends: prefill from the profile, answer, build the save request. */
async function editInput(edit: Partial<AssessmentData>) {
  let draft = startQuestionnaire(await prefill());
  for (const [key, value] of Object.entries(edit)) draft = answerQuestion(draft, key as keyof AssessmentData, value as never);
  return questionnaireSaveInput(draft, draft.answers as ValidatedAssessmentData);
}
const editPreferences = async (edit: Partial<AssessmentData>) => caller().student.saveQuizResults(await editInput(edit));

/** Pause the next profile read after it has taken its snapshot, until resume() is called. */
function pauseNextRead() {
  let reached!: () => void, resume!: () => void;
  const paused = new Promise<void>(r => { reached = r; });
  const resumed = new Promise<void>(r => { resume = r; });
  store.afterRead = async () => { store.afterRead = undefined; reached(); await resumed; };
  return { paused, resume };
}

beforeEach(() => {
  store.profile = undefined;
  store.afterRead = undefined;
  store.countChangedRowsOnly = false;
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
    // Skill band follows the rating; the student's own goal is kept (and now reached).
    expect(ratingState()).toEqual({ currentRating: 1650, skillLevel: "advanced", targetRating: 1600 });
    expect(preference("Rating answer")).toBe("1650 (Lichess)");

    expect(await prefill()).toMatchObject({ rating: 1650, targetImprovement: 0 });
    await editPreferences({ lessonFormat: "hybrid" });
    expect(ratingState()).toEqual({ currentRating: 1650, skillLevel: "advanced", targetRating: 1600 });
    expect(preference("Lesson format")).toBe("Hybrid");
    expect(preference("Rating answer")).toBe("1650 (Lichess)");
    expect(answers()).toMatchObject({ rating: 1650, targetImprovement: 0 });
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

  it("a client built before this fix (raw stored answers, no baseline) cannot revert a drifted rating or goal", async () => {
    // A row saved before this fix: the dashboard moved only currentRating.
    store.profile = { ...emptyRow, ...mapAssessmentToProfile(quiz), currentRating: 1650 };
    const oldForm = editableSavedAssessment(store.profile.assessmentData as string);
    expect(oldForm).toMatchObject({ rating: 1400, targetImprovement: 200 });
    await caller().student.saveQuizResults({ assessmentData: { ...oldForm, lessonFormat: "hybrid" } });
    expect(ratingState()).toEqual({ currentRating: 1650, skillLevel: "intermediate", targetRating: 1600 });
    expect(answers()).toMatchObject({ rating: 1650, targetImprovement: 0, lessonFormat: "hybrid" });
  });

  it("an untouched form never overwrites a rating or goal saved while it was open", async () => {
    await caller().student.saveQuizResults({ assessmentData: quiz });
    await caller().student.updateRating({ currentRating: 1500 });
    const input = await editInput({ lessonFormat: "hybrid" }); // opened at 1500, "+100"
    await caller().student.updateRating({ currentRating: 1550 }); // another tab
    await caller().student.saveQuizResults(input);
    expect(ratingState()).toEqual({ currentRating: 1550, skillLevel: "intermediate", targetRating: 1600 });
    expect(answers()).toMatchObject({ rating: 1550, targetImprovement: 50, lessonFormat: "hybrid" });
  });

  it("an explicit rating change in the form updates the rating and skill band and keeps the goal", async () => {
    await caller().student.saveQuizResults({ assessmentData: quiz });
    await caller().student.updateRating({ currentRating: 1650 });
    await editPreferences({ rating: 2050 });
    expect(ratingState()).toEqual({ currentRating: 2050, skillLevel: "expert", targetRating: 1600 });
    expect(preference("Rating answer")).toBe("2050 (Lichess)");
  });

  it("a target change restates the goal from the current rating", async () => {
    await caller().student.saveQuizResults({ assessmentData: quiz });
    await caller().student.updateRating({ currentRating: 1650 });
    await editPreferences({ targetImprovement: 300 });
    expect(ratingState()).toEqual({ currentRating: 1650, skillLevel: "advanced", targetRating: 1950 });
    expect(await prefill()).toMatchObject({ rating: 1650, targetImprovement: 300 });
  });
});

describe("one goal model on every screen", () => {
  const moveRating = {
    dashboard: (rating: number) => caller().student.updateRating({ currentRating: rating }),
    questionnaire: (rating: number) => editPreferences({ rating }),
  };

  it.each(Object.keys(moveRating) as (keyof typeof moveRating)[])("regression: the same rating changes leave the same goal and +N (%s)", async screen => {
    await caller().student.saveQuizResults({ assessmentData: quiz }); // goal 1600
    await moveRating[screen](1500);
    expect(ratingState().targetRating).toBe(1600);
    expect((await prefill()).targetImprovement).toBe(100);
    await moveRating[screen](1650);
    await moveRating[screen](1700);
    expect(ratingState()).toEqual({ currentRating: 1700, skillLevel: "advanced", targetRating: 1600 });
    expect(await prefill()).toMatchObject({ rating: 1700, targetImprovement: 0 });
  });

  it("regression: a +N goal saved before any rating is anchored once a rating arrives", async () => {
    await caller().student.updateChessProfiles({ lichessUsername: "synthetic-student" }); // no rating yet
    await editPreferences({ targetImprovement: 300 });
    expect(ratingState()).toEqual({ currentRating: null, skillLevel: "beginner", targetRating: null });
    expect(answers()).toEqual({ targetImprovement: 300 });

    await caller().student.updateRating({ currentRating: 1650 });
    expect(ratingState()).toEqual({ currentRating: 1650, skillLevel: "advanced", targetRating: 1950 });
    expect(await prefill()).toEqual({ rating: 1650, targetImprovement: 300 });
    // Later edits that leave the goal alone keep it.
    await editPreferences({ lessonFormat: "hybrid" });
    expect(ratingState().targetRating).toBe(1950);
  });
});

describe("profiles created from the dashboard rating (no saved answers)", () => {
  beforeEach(async () => {
    await caller().student.updateRating({ currentRating: 1650 });
    expect(store.profile).toMatchObject({ currentRating: 1650, skillLevel: "advanced", primaryGoal: "rating_improvement", assessmentData: null });
  });

  it("prefills and keeps the rating through an edit, without inventing other answers", async () => {
    expect(await prefill()).toEqual({ rating: 1650 });
    await editPreferences({ lessonFormat: "hybrid" });
    expect(ratingState()).toEqual({ currentRating: 1650, skillLevel: "advanced", targetRating: null });
    // Unanswered questions keep their stored values instead of mapped defaults.
    expect(store.profile).toMatchObject({ primaryGoal: "rating_improvement", budgetMinCents: null, budgetMaxCents: null, credentialImportance: null });
    expect(answers()).toEqual({ rating: 1650, lessonFormat: "hybrid" });
  });

  it("keeps the rating when an older client sends no rating answer at all", async () => {
    await caller().student.saveQuizResults({ assessmentData: { lessonFormat: "hybrid" } });
    expect(ratingState()).toEqual({ currentRating: 1650, skillLevel: "advanced", targetRating: null });
    expect(preference("Rating answer")).toBe("1650 (rating system not saved)");
  });

  it("a first +N answer sets the goal from the current rating", async () => {
    await editPreferences({ targetImprovement: 250 });
    expect(ratingState()).toEqual({ currentRating: 1650, skillLevel: "advanced", targetRating: 1900 });
  });

  it("the 1500–1599 band matches the questionnaire's skill bands", async () => {
    store.profile = undefined;
    await caller().student.updateRating({ currentRating: 1550 });
    expect(store.profile!.skillLevel).toBe("intermediate");
  });
});

describe("writes that race each other on one profile", () => {
  const edit = { teachingArchetype: "guide", lessonFormat: "hybrid", timezone: "America/New_York", availability: ["Evening (5pm-9pm)"] };

  it("guards exactly the stored values the update rules read", async () => {
    await caller().student.saveQuizResults({ assessmentData: quiz });
    await db.updateStudentRating(901, 1650);
    expect(store.lastUpdateGuard).toEqual(["userId", ...STORED_PROFILE_INPUTS]);
  });

  it("regression: a rating change never puts back answers saved after it read the profile", async () => {
    await caller().student.saveQuizResults({ assessmentData: quiz });
    const read = pauseNextRead();
    const ratingWrite = db.updateStudentRating(901, 1650); // the dashboard, or a future rating sync
    await read.paused;
    expect(await editPreferences(edit)).toMatchObject({ success: true }); // the Find Another Coach save commits
    read.resume();
    await ratingWrite;
    expect(answers()).toEqual({ ...quiz, ...edit, rating: 1650, targetImprovement: 0 });
    expect(store.profile).toMatchObject({ learningStyle: "visual", currentRating: 1650, skillLevel: "advanced", targetRating: 1600 });
    expect(preference("Teaching preference")).toBe("The Supportive Guide");
  });

  it("a preference save is recomputed when a rating change lands between its read and its write", async () => {
    await caller().student.saveQuizResults({ assessmentData: quiz });
    const input = await editInput({ lessonFormat: "hybrid" }); // opened at 1400, "+200"
    const read = pauseNextRead();
    const save = caller().student.saveQuizResults(input);
    await read.paused;
    await caller().student.updateRating({ currentRating: 1650 });
    read.resume();
    await save;
    expect(ratingState()).toEqual({ currentRating: 1650, skillLevel: "advanced", targetRating: 1600 });
    expect(answers()).toMatchObject({ rating: 1650, targetImprovement: 0, lessonFormat: "hybrid" });
  });

  it("guards the rating column too: a profile without answers whose rating moved mid-save", async () => {
    await caller().student.updateRating({ currentRating: 1650 });
    const input = await editInput({ lessonFormat: "hybrid" });
    const read = pauseNextRead();
    const save = caller().student.saveQuizResults(input);
    await read.paused;
    await db.updateStudentRating(901, 1700); // changes currentRating only: there are no answers yet
    read.resume();
    await save;
    expect(ratingState()).toEqual({ currentRating: 1700, skillLevel: "advanced", targetRating: null });
    expect(answers()).toEqual({ rating: 1700, lessonFormat: "hybrid" });
  });

  it("gives up rather than writing over a profile that keeps changing", async () => {
    await caller().student.saveQuizResults({ assessmentData: quiz });
    let reads = 0;
    store.afterRead = () => { reads++; store.profile = { ...store.profile, assessmentData: JSON.stringify({ ...quiz, lessonFormat: `concurrent-${reads}` }) }; };
    await expect(db.updateStudentRating(901, 1650)).rejects.toThrow(/kept changing/);
    store.afterRead = undefined;
    expect(reads).toBeGreaterThan(1);
    expect(store.profile!.currentRating).toBe(1400);
    expect(answers().lessonFormat).toBe(`concurrent-${reads}`);
  });

  it("treats a write that changes nothing as done on a server that counts only changed rows", async () => {
    store.countChangedRowsOnly = true;
    await caller().student.saveQuizResults({ assessmentData: quiz });
    await caller().student.updateRating({ currentRating: 1650 });
    const before = { ...store.profile };
    await expect(caller().student.updateRating({ currentRating: 1650 })).resolves.toEqual({ success: true });
    expect(store.profile).toEqual(before);
  });
});

describe("guest answers imported at email verification", () => {
  /** Verify the student's email while the waitlist holds `guest` answers. */
  async function verifyEmailWith(guest: ValidatedAssessmentData) {
    vi.mocked(auth.verifyEmail).mockResolvedValue({ success: true, userId: student.id });
    vi.mocked(db.getUserById).mockResolvedValue(student as any);
    vi.mocked(db.getWaitlistEntryByEmail).mockResolvedValue({ assessmentData: JSON.stringify(guest) } as any);
    const failures = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await appRouter.createCaller(contextFor(null)).auth.verifyEmail({ token: "synthetic-verification-token" });
      // The import's failures are logged, not thrown: none may hide behind a pass.
      expect(failures).not.toHaveBeenCalled();
    } finally { failures.mockRestore(); }
    expect(db.getWaitlistEntryByEmail).toHaveBeenCalledWith(student.email);
  }

  it("regression: fill a profile that has a rating but never replace the rating", async () => {
    await caller().student.updateRating({ currentRating: 1650 });
    await verifyEmailWith(quiz);
    // The guest's "+200" goal is set relative to the rating the profile has.
    expect(ratingState()).toEqual({ currentRating: 1650, skillLevel: "advanced", targetRating: 1850 });
    expect(store.profile).toMatchObject({ learningStyle: "analytical", budgetMinCents: 4000 });
    expect(answers()).toMatchObject({ rating: 1650, targetImprovement: 200, lessonFormat: "online" });
  });

  it("regression: never replace answers the student already saved", async () => {
    await caller().student.saveQuizResults({ assessmentData: { ...quiz, rating: 1800, lessonFormat: "hybrid" } });
    const before = { ...store.profile };
    await verifyEmailWith(quiz);
    expect(store.profile).toEqual(before);
  });

  it("create the full profile when there is none", async () => {
    await verifyEmailWith(quiz);
    expect(store.profile).toMatchObject({ currentRating: 1400, skillLevel: "intermediate", targetRating: 1600 });
    expect(answers()).toEqual(quiz);
  });
});
