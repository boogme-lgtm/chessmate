/**
 * Sprint S-REF-1 — categorized dispute intake, quality gate, abuse flag
 *
 * Tests the upgraded raiseIssue procedure with structured categories,
 * description requirements, the quality non-refund gate, and abuse flagging.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

vi.mock("./db");
vi.mock("./emailService");
vi.mock("./nurtureEmailScheduler");
vi.mock("./resendWelcomeEmails");
vi.mock("./_core/notification");

import * as db from "./db";
import { notifyOwner } from "./_core/notification";

const student = { id: 1, role: "user", userType: "student", openId: "s", name: "Stu", email: "s@e.com" };
const completedLesson = {
  id: 7, studentId: 1, coachId: 42, status: "completed",
  issueWindowEndsAt: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12h from now
};
const expiredLesson = {
  id: 8, studentId: 1, coachId: 42, status: "completed",
  issueWindowEndsAt: new Date(Date.now() - 1000), // expired
};
const pendingLesson = { id: 9, studentId: 1, coachId: 42, status: "pending_payment" };

function ctx(user: any): TrpcContext {
  return { user, req: { protocol: "https", headers: {} } as any, res: { setHeader: vi.fn() } as any };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.getLessonById).mockResolvedValue(completedLesson as any);
  vi.mocked(db.getDisputeByLessonId).mockResolvedValue(null);
  vi.mocked(db.createLessonDispute).mockResolvedValue(1);
  vi.mocked(db.updateLessonStatus).mockResolvedValue(undefined as any);
  vi.mocked(db.getUserById).mockResolvedValue(student as any);
  vi.mocked(db.countNonNoShowDisputesByStudent).mockResolvedValue(0);
  vi.mocked(notifyOwner).mockResolvedValue(true);
});

describe("S-REF-1 — categorized dispute intake", () => {
  it("1: quality → policyGated, lesson stays completed, dispute has resolution feedback_only", async () => {
    const caller = appRouter.createCaller(ctx(student));
    const res = await caller.lesson.raiseIssue({
      lessonId: 7,
      category: "quality",
      description: "Wasn't great",
    });
    expect(res.policyGated).toBe(true);
    expect(res.success).toBe(true);
    expect(db.createLessonDispute).toHaveBeenCalledWith(expect.objectContaining({
      category: "quality",
      status: "resolved",
      resolution: "feedback_only",
    }));
    // Lesson status NOT changed to disputed
    expect(db.updateLessonStatus).not.toHaveBeenCalled();
  });

  it("2: coach_no_show with no description → succeeds", async () => {
    const caller = appRouter.createCaller(ctx(student));
    const res = await caller.lesson.raiseIssue({
      lessonId: 7,
      category: "coach_no_show",
    });
    expect(res.success).toBe(true);
    expect(res.policyGated).toBe(false);
    expect(db.updateLessonStatus).toHaveBeenCalledWith(7, "disputed", expect.anything());
  });

  it("3: coach_late_or_short with description < 20 chars → BAD_REQUEST", async () => {
    const caller = appRouter.createCaller(ctx(student));
    await expect(
      caller.lesson.raiseIssue({
        lessonId: 7,
        category: "coach_late_or_short",
        description: "too short",
      })
    ).rejects.toThrow(/at least 20 characters/);
  });

  it("4: technical_failure with valid description → success, lesson → disputed", async () => {
    const caller = appRouter.createCaller(ctx(student));
    const res = await caller.lesson.raiseIssue({
      lessonId: 7,
      category: "technical_failure",
      description: "The video call platform crashed repeatedly and we could not connect for the full hour",
    });
    expect(res.success).toBe(true);
    expect(res.policyGated).toBe(false);
    expect(db.updateLessonStatus).toHaveBeenCalledWith(7, "disputed", expect.anything());
    expect(db.createLessonDispute).toHaveBeenCalledWith(expect.objectContaining({
      category: "technical_failure",
      lessonId: 7,
      raisedBy: 1,
    }));
  });

  it("5: raise issue after window expired → PRECONDITION_FAILED", async () => {
    vi.mocked(db.getLessonById).mockResolvedValue(expiredLesson as any);
    const caller = appRouter.createCaller(ctx(student));
    await expect(
      caller.lesson.raiseIssue({ lessonId: 8, category: "coach_no_show" })
    ).rejects.toThrow(/issue window has expired/);
  });

  it("6: raise issue on non-completed lesson → PRECONDITION_FAILED", async () => {
    vi.mocked(db.getLessonById).mockResolvedValue(pendingLesson as any);
    const caller = appRouter.createCaller(ctx(student));
    await expect(
      caller.lesson.raiseIssue({ lessonId: 9, category: "coach_no_show" })
    ).rejects.toThrow(/only be raised for completed lessons/);
  });

  it("7: raise issue twice on same lesson → PRECONDITION_FAILED", async () => {
    vi.mocked(db.getDisputeByLessonId).mockResolvedValue({ id: 1 } as any);
    const caller = appRouter.createCaller(ctx(student));
    await expect(
      caller.lesson.raiseIssue({ lessonId: 7, category: "coach_no_show" })
    ).rejects.toThrow(/already been raised/);
  });

  it("8: student with 4 prior non-no-show disputes → abuseFlag: true", async () => {
    vi.mocked(db.countNonNoShowDisputesByStudent).mockResolvedValue(4);
    const caller = appRouter.createCaller(ctx(student));
    const res = await caller.lesson.raiseIssue({
      lessonId: 7,
      category: "coach_no_show",
    });
    expect(res.success).toBe(true);
    expect(db.createLessonDispute).toHaveBeenCalledWith(expect.objectContaining({
      abuseFlag: true,
    }));
    expect(notifyOwner).toHaveBeenCalledWith(expect.objectContaining({
      title: expect.stringContaining("Abuse Flag"),
    }));
  });

  it("9: student with 3 prior non-no-show disputes → abuseFlag: false (threshold is >3)", async () => {
    vi.mocked(db.countNonNoShowDisputesByStudent).mockResolvedValue(3);
    const caller = appRouter.createCaller(ctx(student));
    const res = await caller.lesson.raiseIssue({
      lessonId: 7,
      category: "not_as_described",
      description: "The coach advertised advanced endgame training but only covered basic openings",
    });
    expect(res.success).toBe(true);
    expect(db.createLessonDispute).toHaveBeenCalledWith(expect.objectContaining({
      abuseFlag: false,
    }));
  });
});
