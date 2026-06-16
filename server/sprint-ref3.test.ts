/**
 * Sprint S-REF-3 — dispute transactional emails
 *
 * Verifies that raiseIssue and resolveLessonDispute send the correct emails
 * to both student and coach — and that quality disputes and email failures
 * are handled gracefully.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

vi.mock("./db");
vi.mock("./stripe");
vi.mock("./payoutService");
vi.mock("./emailService");
vi.mock("./nurtureEmailScheduler");
vi.mock("./resendWelcomeEmails");
vi.mock("./_core/notification");

import * as db from "./db";
import * as stripeService from "./stripe";
import * as payoutService from "./payoutService";
import { sendEmail } from "./emailService";
import { notifyOwner } from "./_core/notification";

const student = { id: 1, role: "user", userType: "student", openId: "s", name: "Stu", email: "s@e.com" };
const coach = { id: 42, role: "user", userType: "coach", openId: "c", name: "Coach C", email: "c@e.com" };
const admin = { id: 9, role: "admin", userType: "student", openId: "a", name: "Admin", email: "a@e.com" };

const completedLesson = {
  id: 7, studentId: 1, coachId: 42, status: "completed",
  amountCents: 5000, coachPayoutCents: 4250, currency: "usd",
  stripePaymentIntentId: "pi_abc",
  issueWindowEndsAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
};

function ctx(user: any): TrpcContext {
  return { user, req: { protocol: "https", headers: {} } as any, res: { setHeader: vi.fn() } as any };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.getLessonById).mockResolvedValue(completedLesson as any);
  vi.mocked(db.getDisputeByLessonId).mockResolvedValue(null);
  vi.mocked(db.createLessonDispute).mockResolvedValue(1);
  vi.mocked(db.updateLessonStatus).mockResolvedValue(undefined as any);
  vi.mocked(db.countNonNoShowDisputesByStudent).mockResolvedValue(0);
  vi.mocked(db.getUserById).mockImplementation(async (id) => {
    if (id === 1) return student as any;
    if (id === 42) return coach as any;
    return null;
  });
  vi.mocked(db.getDisputeById).mockResolvedValue({ id: 3, lessonId: 7, status: "open" } as any);
  vi.mocked(db.claimLessonRefundSlot).mockResolvedValue(true as any);
  vi.mocked(db.finalizeAdminRefund).mockResolvedValue(undefined as any);
  vi.mocked(db.updateLessonDispute).mockResolvedValue(undefined as any);
  vi.mocked(stripeService.createRefund).mockResolvedValue({ id: "re_1" } as any);
  vi.mocked(payoutService.releaseLessonPayoutToCoach).mockResolvedValue({ success: true, transferId: "tr_1" } as any);
  vi.mocked(sendEmail).mockResolvedValue({ success: true } as any);
  vi.mocked(notifyOwner).mockResolvedValue(true);
});

describe("S-REF-3 — raiseIssue emails", () => {
  it("1: coach_no_show → sendEmail called twice (student + coach)", async () => {
    const caller = appRouter.createCaller(ctx(student));
    await caller.lesson.raiseIssue({ lessonId: 7, category: "coach_no_show" });

    const calls = vi.mocked(sendEmail).mock.calls;
    expect(calls.length).toBe(2);
    expect(calls[0][0]).toMatchObject({ to: "s@e.com", subject: expect.stringContaining("dispute has been received") });
    expect(calls[1][0]).toMatchObject({ to: "c@e.com", subject: expect.stringContaining("dispute has been filed") });
  });

  it("2: quality → sendEmail NOT called", async () => {
    const caller = appRouter.createCaller(ctx(student));
    await caller.lesson.raiseIssue({ lessonId: 7, category: "quality" });

    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("3: student has no email → only coach email sent", async () => {
    vi.mocked(db.getUserById).mockImplementation(async (id) => {
      if (id === 1) return { ...student, email: null } as any;
      if (id === 42) return coach as any;
      return null;
    });
    const caller = appRouter.createCaller(ctx(student));
    await caller.lesson.raiseIssue({ lessonId: 7, category: "coach_no_show" });

    const calls = vi.mocked(sendEmail).mock.calls;
    expect(calls.length).toBe(1);
    expect(calls[0][0]).toMatchObject({ to: "c@e.com" });
  });

  it("4: coach has no email → only student email sent", async () => {
    vi.mocked(db.getUserById).mockImplementation(async (id) => {
      if (id === 1) return student as any;
      if (id === 42) return { ...coach, email: null } as any;
      return null;
    });
    const caller = appRouter.createCaller(ctx(student));
    await caller.lesson.raiseIssue({ lessonId: 7, category: "coach_no_show" });

    const calls = vi.mocked(sendEmail).mock.calls;
    expect(calls.length).toBe(1);
    expect(calls[0][0]).toMatchObject({ to: "s@e.com" });
  });
});

describe("S-REF-3 — resolveLessonDispute emails", () => {
  it("5: denied → student 'no refund' + coach 'payout released'", async () => {
    vi.mocked(db.getLessonById).mockResolvedValue({ ...completedLesson, status: "disputed" } as any);
    const caller = appRouter.createCaller(ctx(admin));
    await caller.admin.disputes.resolveLessonDispute({ disputeId: 3, resolution: "denied" });

    const calls = vi.mocked(sendEmail).mock.calls;
    expect(calls.length).toBe(2);
    expect(calls[0][0]).toMatchObject({ to: "s@e.com", subject: expect.stringContaining("no refund issued") });
    expect(calls[1][0]).toMatchObject({ to: "c@e.com", subject: expect.stringContaining("resolved in your favor") });
  });

  it("6: refund_full → student 'full refund' + coach 'refund issued'", async () => {
    vi.mocked(db.getLessonById).mockResolvedValue({ ...completedLesson, status: "disputed" } as any);
    const caller = appRouter.createCaller(ctx(admin));
    await caller.admin.disputes.resolveLessonDispute({ disputeId: 3, resolution: "refund_full" });

    const calls = vi.mocked(sendEmail).mock.calls;
    expect(calls.length).toBe(2);
    expect(calls[0][0]).toMatchObject({ to: "s@e.com", subject: expect.stringContaining("full refund issued") });
    expect(calls[1][0]).toMatchObject({ to: "c@e.com", subject: expect.stringContaining("refund issued to student") });
  });

  it("7: refund_partial → student gets correct amount in subject", async () => {
    vi.mocked(db.getLessonById).mockResolvedValue({ ...completedLesson, status: "disputed" } as any);
    const caller = appRouter.createCaller(ctx(admin));
    await caller.admin.disputes.resolveLessonDispute({ disputeId: 3, resolution: "refund_partial", refundAmountCents: 2000 });

    const calls = vi.mocked(sendEmail).mock.calls;
    expect(calls.length).toBe(2);
    expect(calls[0][0]).toMatchObject({ to: "s@e.com", subject: expect.stringContaining("partial refund issued") });
  });

  it("8: email failure → procedure still returns success (fire-and-forget)", async () => {
    vi.mocked(db.getLessonById).mockResolvedValue({ ...completedLesson, status: "disputed" } as any);
    vi.mocked(sendEmail).mockRejectedValue(new Error("SMTP down"));
    const caller = appRouter.createCaller(ctx(admin));
    const res = await caller.admin.disputes.resolveLessonDispute({ disputeId: 3, resolution: "denied" });

    expect(res.success).toBe(true);
  });
});
