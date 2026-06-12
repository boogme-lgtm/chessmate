/**
 * Sprint 50 Fix-1 — Coach analysis access (S50-F1, S50-F2)
 *
 * Dual-role access: coaches on a lesson can create, save, byId, send, and list
 * analyses. Third-party callers (neither student nor coach) are rejected.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

vi.mock("./db");
vi.mock("./emailService");
vi.mock("./nurtureEmailScheduler");
vi.mock("./resendWelcomeEmails");

import * as db from "./db";

const student = { id: 1, role: "user", userType: "student", openId: "s", name: "Stu", email: "s@e.com" };
const coach = { id: 42, role: "user", userType: "coach", openId: "c", name: "Coach", email: "c@e.com" };
const outsider = { id: 99, role: "user", userType: "student", openId: "x", name: "X", email: "x@e.com" };
const lesson = { id: 7, studentId: 1, coachId: 42 };

function ctx(user: any): TrpcContext {
  return { user, req: { protocol: "https", headers: {} } as any, res: { setHeader: vi.fn() } as any };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.getLessonById).mockResolvedValue(lesson as any);
  vi.mocked(db.createPgnAnalysis).mockResolvedValue({ id: 10 });
  vi.mocked(db.createMessage).mockResolvedValue({ id: 1 } as any);
  vi.mocked(db.markPgnAnalysisSent).mockResolvedValue(undefined as any);
  vi.mocked(db.getUserById).mockResolvedValue({ id: 1, name: "Stu", email: "s@e.com" } as any);
});

describe("Sprint 50 Fix-1 — coach create", () => {
  it("coach on the lesson can create, studentId set to the lesson's student", async () => {
    const caller = appRouter.createCaller(ctx(coach));
    const res = await caller.analysis.create({ lessonId: 7, originalPgn: "1. e4 *", title: "T" });
    expect(res.id).toBe(10);
    const arg = vi.mocked(db.createPgnAnalysis).mock.calls[0][0];
    expect(arg.studentId).toBe(1); // lesson's student, NOT the coach
    expect(arg.coachId).toBe(42);
  });
});

describe("Sprint 50 Fix-1 — coach save + byId", () => {
  it("coach can save via the coach-scoped helper", async () => {
    vi.mocked(db.updatePgnAnalysis).mockResolvedValue(false); // student path misses
    vi.mocked(db.updatePgnAnalysisForCoach).mockResolvedValue(true); // coach path hits
    const caller = appRouter.createCaller(ctx(coach));
    const res = await caller.analysis.save({ id: 10, annotatedPgn: "1. e4 e5 *" });
    expect(res.ok).toBe(true);
    expect(db.updatePgnAnalysisForCoach).toHaveBeenCalledWith(10, 42, "1. e4 e5 *");
  });

  it("coach can byId via the coach-scoped helper", async () => {
    vi.mocked(db.getPgnAnalysisById).mockResolvedValue(null); // student path misses
    vi.mocked(db.getPgnAnalysisByIdForCoach).mockResolvedValue({ id: 10 } as any);
    const caller = appRouter.createCaller(ctx(coach));
    const res = await caller.analysis.byId({ id: 10 });
    expect(res.id).toBe(10);
  });
});

describe("Sprint 50 Fix-1 — bidirectional send", () => {
  const baseAnalysis = { id: 10, lessonId: 7, studentId: 1, coachId: 42, title: "G", originalPgn: "1. e4 *", annotatedPgn: "1. e4! *" };

  it("coach sends → recipient is the student", async () => {
    vi.mocked(db.getPgnAnalysisById).mockResolvedValue(null); // not the student
    vi.mocked(db.getPgnAnalysisByIdForCoach).mockResolvedValue(baseAnalysis as any);
    const caller = appRouter.createCaller(ctx(coach));
    const res = await caller.analysis.sendToCoach({ id: 10, note: "Review this" });
    expect(res.ok).toBe(true);
    const msgCalls = vi.mocked(db.createMessage).mock.calls.map(c => c[0]);
    expect(msgCalls[0]).toMatchObject({ contentType: "text", content: "Review this", senderId: 42 });
    expect(msgCalls[1]).toMatchObject({ contentType: "pgn", content: "1. e4! *", senderId: 42 });
    // Recipient email should be the student's
    await vi.waitFor(() => expect(db.getUserById).toHaveBeenCalledWith(1));
  });

  it("student sends → recipient is the coach (regression)", async () => {
    vi.mocked(db.getPgnAnalysisById).mockResolvedValue(baseAnalysis as any);
    const caller = appRouter.createCaller(ctx(student));
    const res = await caller.analysis.sendToCoach({ id: 10 });
    expect(res.ok).toBe(true);
    await vi.waitFor(() => expect(db.getUserById).toHaveBeenCalledWith(42));
  });
});

describe("Sprint 50 Fix-1 — third-party rejection", () => {
  it("outsider cannot create on someone else's lesson", async () => {
    const caller = appRouter.createCaller(ctx(outsider));
    await expect(caller.analysis.create({ lessonId: 7, originalPgn: "1. e4 *", title: "T" })).rejects.toThrow(/Not your lesson/);
  });

  it("outsider cannot save or byId", async () => {
    vi.mocked(db.updatePgnAnalysis).mockResolvedValue(false);
    vi.mocked(db.updatePgnAnalysisForCoach).mockResolvedValue(false);
    const caller = appRouter.createCaller(ctx(outsider));
    await expect(caller.analysis.save({ id: 10, annotatedPgn: "x" })).rejects.toThrow(/not found/i);

    vi.mocked(db.getPgnAnalysisById).mockResolvedValue(null);
    vi.mocked(db.getPgnAnalysisByIdForCoach).mockResolvedValue(null);
    await expect(caller.analysis.byId({ id: 10 })).rejects.toThrow(/not found/i);
  });
});
