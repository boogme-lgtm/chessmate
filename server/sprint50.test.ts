/**
 * Sprint 50 — analysis router (PGN self-analysis sessions)
 *
 * Behavioral tests via appRouter.createCaller with the db module mocked:
 *   - create derives the coach from the LESSON (never trusts client input)
 *     and rejects non-participants.
 *   - save is ownership-scoped (NOT_FOUND when the WHERE matches no row).
 *   - sendToCoach requires lesson + coach context, posts the note as a text
 *     message and the PGN as a pgn message, then marks the analysis sent.
 *   - byId / myAnalyses are ownership-scoped.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

vi.mock("./db");
vi.mock("./emailService");
vi.mock("./nurtureEmailScheduler");
vi.mock("./resendWelcomeEmails");

import * as db from "./db";
import * as emailService from "./emailService";

const student = { id: 1, role: "user", userType: "student", openId: "s", name: "Stu", email: "s@example.com" };

function ctx(user: any = student): TrpcContext {
  return {
    user,
    req: { protocol: "https", headers: {} } as any,
    res: { setHeader: vi.fn() } as any,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Sprint 50 — analysis.create", () => {
  it("S50-1: derives coachId from the lesson server-side", async () => {
    vi.mocked(db.getLessonById).mockResolvedValue({ id: 7, studentId: 1, coachId: 42 } as any);
    vi.mocked(db.createPgnAnalysis).mockResolvedValue({ id: 99 });

    const caller = appRouter.createCaller(ctx());
    const res = await caller.analysis.create({
      lessonId: 7,
      originalPgn: "1. e4 e5 *",
      title: "My game",
    });

    expect(res.id).toBe(99);
    const arg = vi.mocked(db.createPgnAnalysis).mock.calls[0][0];
    expect(arg.coachId).toBe(42); // from the lesson, not the client
    expect(arg.studentId).toBe(1);
    expect(arg.status).toBe("draft");
  });

  it("S50-2: rejects creation against someone else's lesson", async () => {
    vi.mocked(db.getLessonById).mockResolvedValue({ id: 7, studentId: 999, coachId: 42 } as any);
    const caller = appRouter.createCaller(ctx());
    await expect(
      caller.analysis.create({ lessonId: 7, originalPgn: "1. e4 *", title: "x" })
    ).rejects.toThrow(/Not your lesson/);
    expect(db.createPgnAnalysis).not.toHaveBeenCalled();
  });

  it("S50-3: standalone analysis (no lesson) has null coach", async () => {
    vi.mocked(db.createPgnAnalysis).mockResolvedValue({ id: 5 });
    const caller = appRouter.createCaller(ctx());
    await caller.analysis.create({ originalPgn: "1. d4 *", title: "Standalone" });
    expect(db.getLessonById).not.toHaveBeenCalled();
    expect(vi.mocked(db.createPgnAnalysis).mock.calls[0][0].coachId).toBeNull();
  });
});

describe("Sprint 50 — analysis.save", () => {
  it("S50-4: NOT_FOUND when the ownership-scoped update matches nothing", async () => {
    vi.mocked(db.updatePgnAnalysis).mockResolvedValue(false);
    const caller = appRouter.createCaller(ctx());
    await expect(caller.analysis.save({ id: 1, annotatedPgn: "1. e4 *" })).rejects.toThrow(
      /not found/i
    );
  });

  it("S50-5: saves through the ownership-scoped helper", async () => {
    vi.mocked(db.updatePgnAnalysis).mockResolvedValue(true);
    const caller = appRouter.createCaller(ctx());
    const res = await caller.analysis.save({ id: 1, annotatedPgn: "1. e4 e5 *" });
    expect(res.ok).toBe(true);
    expect(db.updatePgnAnalysis).toHaveBeenCalledWith(1, 1, "1. e4 e5 *");
  });
});

describe("Sprint 50 — analysis.sendToCoach", () => {
  const baseAnalysis = {
    id: 3,
    lessonId: 7,
    studentId: 1,
    coachId: 42,
    title: "Endgame review",
    originalPgn: "1. e4 *",
    annotatedPgn: "1. e4 {good} *",
  };

  beforeEach(() => {
    vi.mocked(db.createMessage).mockResolvedValue({ id: 1 } as any);
    vi.mocked(db.markPgnAnalysisSent).mockResolvedValue(undefined as any);
    vi.mocked(db.getUserById).mockResolvedValue({ id: 42, name: "Coach", email: "c@example.com" } as any);
  });

  it("S50-6: posts note as text + PGN as pgn message, then marks sent", async () => {
    vi.mocked(db.getPgnAnalysisById).mockResolvedValue(baseAnalysis as any);
    const caller = appRouter.createCaller(ctx());
    const res = await caller.analysis.sendToCoach({ id: 3, note: "Please look at move 12" });

    expect(res.ok).toBe(true);
    const calls = vi.mocked(db.createMessage).mock.calls.map((c) => c[0]);
    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatchObject({ lessonId: 7, contentType: "text", content: "Please look at move 12" });
    expect(calls[1]).toMatchObject({ lessonId: 7, contentType: "pgn", content: "1. e4 {good} *" });
    expect(db.markPgnAnalysisSent).toHaveBeenCalledWith(3, "1. e4 {good} *");
  });

  it("S50-7: no note → only the pgn message", async () => {
    vi.mocked(db.getPgnAnalysisById).mockResolvedValue(baseAnalysis as any);
    const caller = appRouter.createCaller(ctx());
    await caller.analysis.sendToCoach({ id: 3 });
    const calls = vi.mocked(db.createMessage).mock.calls.map((c) => c[0]);
    expect(calls).toHaveLength(1);
    expect(calls[0].contentType).toBe("pgn");
  });

  it("S50-8: falls back to originalPgn when never annotated", async () => {
    vi.mocked(db.getPgnAnalysisById).mockResolvedValue({ ...baseAnalysis, annotatedPgn: null } as any);
    const caller = appRouter.createCaller(ctx());
    await caller.analysis.sendToCoach({ id: 3 });
    expect(vi.mocked(db.createMessage).mock.calls[0][0].content).toBe("1. e4 *");
  });

  it("S50-9: BAD_REQUEST without lesson or coach context", async () => {
    vi.mocked(db.getPgnAnalysisById).mockResolvedValue({ ...baseAnalysis, lessonId: null } as any);
    const caller = appRouter.createCaller(ctx());
    await expect(caller.analysis.sendToCoach({ id: 3 })).rejects.toThrow(/No lesson context/);

    vi.mocked(db.getPgnAnalysisById).mockResolvedValue({ ...baseAnalysis, coachId: null } as any);
    await expect(caller.analysis.sendToCoach({ id: 3 })).rejects.toThrow(/No coach context/);
    expect(db.createMessage).not.toHaveBeenCalled();
  });

  it("S50-10: sends the coach a best-effort email (not notifyOwner)", async () => {
    vi.mocked(db.getPgnAnalysisById).mockResolvedValue(baseAnalysis as any);
    const caller = appRouter.createCaller(ctx());
    await caller.analysis.sendToCoach({ id: 3 });
    await vi.waitFor(() => {
      expect(emailService.sendEmail).toHaveBeenCalled();
    });
    expect(vi.mocked(emailService.sendEmail).mock.calls[0][0].to).toBe("c@example.com");
  });
});

describe("Sprint 50 — analysis.byId / myAnalyses", () => {
  it("S50-11: byId is ownership-scoped", async () => {
    vi.mocked(db.getPgnAnalysisById).mockResolvedValue(null);
    const caller = appRouter.createCaller(ctx());
    await expect(caller.analysis.byId({ id: 1 })).rejects.toThrow(/not found/i);
    expect(db.getPgnAnalysisById).toHaveBeenCalledWith(1, 1);
  });

  it("S50-12: myAnalyses lists the caller's sessions", async () => {
    vi.mocked(db.listPgnAnalysesByStudent).mockResolvedValue([{ id: 1 }, { id: 2 }] as any);
    const caller = appRouter.createCaller(ctx());
    const res = await caller.analysis.myAnalyses();
    expect(res).toHaveLength(2);
    expect(db.listPgnAnalysesByStudent).toHaveBeenCalledWith(1);
  });
});
