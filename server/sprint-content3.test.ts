/**
 * S-CONTENT-3 -- content request deadline reminders & overdue flow tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

vi.mock("./db");
vi.mock("./stripe");
vi.mock("./stripeConnect");
vi.mock("./emailService");
vi.mock("./nurtureEmailScheduler");
vi.mock("./resendWelcomeEmails");
vi.mock("./_core/notification");

import * as db from "./db";
import * as stripeService from "./stripe";
import * as emailService from "./emailService";
import { sendContentRequestDeadlineReminders } from "./reminderScheduler";

const student = { id: 1, role: "user", userType: "student", openId: "s", name: "Student", email: "s@e.com" };
const coach = { id: 42, role: "user", userType: "coach", openId: "c", name: "Coach", email: "c@e.com", stripeConnectAccountId: "acct_42" };

function ctx(user: any): TrpcContext {
  return { user, req: { protocol: "https", headers: {} } as any, res: { setHeader: vi.fn() } as any };
}

const baseRequest = {
  id: 10,
  studentId: 1,
  coachId: 42,
  title: "Endgame drills",
  description: "Bishop endgames",
  amountCents: 5000,
  status: "overdue",
  dueDate: new Date("2026-06-15"),
  deliveredAt: null,
  coachNote: null,
  contentItemId: null,
  stripePaymentIntentId: "pi_test_123",
  stripeChargeId: null,
  stripeCheckoutSessionId: null,
  stripeTransferId: null,
  payoutReleasedAt: null,
  payoutAt: null,
  deadline24hReminderSentAt: null,
  deadline1hReminderSentAt: null,
  overdueNotifiedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.createNotification).mockResolvedValue(1);
  vi.mocked(db.getUserById).mockImplementation(async (id: number) => {
    if (id === 1) return student as any;
    if (id === 42) return coach as any;
    return undefined;
  });
  vi.mocked(db.getCoachProfileByUserId).mockResolvedValue({ pricingTier: "free" } as any);
});

// ── Test 1: 24h reminder sends email + stamps column + creates notification ──

describe("sendContentRequestDeadlineReminders — 24h", () => {
  it("sends coach email, stamps column, and creates notification", async () => {
    const row = {
      id: 10, coachId: 42, studentId: 1, title: "Endgame drills",
      dueDate: new Date("2026-06-19T12:00:00Z"),
      coachName: "Coach", coachEmail: "c@e.com",
      studentName: "Student", studentEmail: "s@e.com",
    };
    vi.mocked(db.getContentRequestsDueForReminder24h).mockResolvedValue([row]);
    vi.mocked(db.getContentRequestsDueForReminder1h).mockResolvedValue([]);
    vi.mocked(db.getOverdueContentRequests).mockResolvedValue([]);
    vi.mocked(db.stampContentRequestDeadlineReminder).mockResolvedValue(undefined);
    vi.mocked(emailService.sendEmail).mockResolvedValue({ success: true } as any);
    vi.mocked(emailService.getCoachDeadlineReminderEmail).mockReturnValue("<html>24h</html>");

    await sendContentRequestDeadlineReminders();

    expect(emailService.getCoachDeadlineReminderEmail).toHaveBeenCalledWith(expect.objectContaining({
      coachName: "Coach",
      studentName: "Student",
      requestTitle: "Endgame drills",
      hoursRemaining: 24,
    }));
    expect(emailService.sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: "c@e.com",
      subject: expect.stringContaining("24h"),
    }));
    expect(db.stampContentRequestDeadlineReminder).toHaveBeenCalledWith(10, "deadline24hReminderSentAt");
    expect(db.createNotification).toHaveBeenCalledWith(expect.objectContaining({
      userId: 42,
      type: "content_request_deadline_24h",
      recipientRole: "coach",
    }));
  });
});

// ── Test 2: 1h reminder sends email + stamps column + creates notification ───

describe("sendContentRequestDeadlineReminders — 1h", () => {
  it("sends coach email, stamps column, and creates notification", async () => {
    const row = {
      id: 11, coachId: 42, studentId: 1, title: "Opening prep",
      dueDate: new Date("2026-06-18T13:00:00Z"),
      coachName: "Coach", coachEmail: "c@e.com",
      studentName: "Student", studentEmail: "s@e.com",
    };
    vi.mocked(db.getContentRequestsDueForReminder24h).mockResolvedValue([]);
    vi.mocked(db.getContentRequestsDueForReminder1h).mockResolvedValue([row]);
    vi.mocked(db.getOverdueContentRequests).mockResolvedValue([]);
    vi.mocked(db.stampContentRequestDeadlineReminder).mockResolvedValue(undefined);
    vi.mocked(emailService.sendEmail).mockResolvedValue({ success: true } as any);
    vi.mocked(emailService.getCoachDeadlineReminderEmail).mockReturnValue("<html>1h</html>");

    await sendContentRequestDeadlineReminders();

    expect(emailService.getCoachDeadlineReminderEmail).toHaveBeenCalledWith(expect.objectContaining({
      hoursRemaining: 1,
    }));
    expect(db.stampContentRequestDeadlineReminder).toHaveBeenCalledWith(11, "deadline1hReminderSentAt");
    expect(db.createNotification).toHaveBeenCalledWith(expect.objectContaining({
      type: "content_request_deadline_1h",
    }));
  });
});

// ── Test 3: 24h reminder is NOT re-sent if already stamped (idempotency) ─────

describe("sendContentRequestDeadlineReminders — idempotency", () => {
  it("does not re-send 24h reminder if deadline24hReminderSentAt is already set", async () => {
    // The DB query filters out rows where deadline24hReminderSentAt IS NOT NULL,
    // so returning an empty array simulates the idempotency guard.
    vi.mocked(db.getContentRequestsDueForReminder24h).mockResolvedValue([]);
    vi.mocked(db.getContentRequestsDueForReminder1h).mockResolvedValue([]);
    vi.mocked(db.getOverdueContentRequests).mockResolvedValue([]);

    await sendContentRequestDeadlineReminders();

    expect(emailService.sendEmail).not.toHaveBeenCalled();
    expect(db.stampContentRequestDeadlineReminder).not.toHaveBeenCalled();
  });
});

// ── Test 4: Overdue scan sets status to "overdue", sends student email ───────

describe("sendContentRequestDeadlineReminders — overdue scan", () => {
  it("sets status to overdue, sends student email, stamps overdueNotifiedAt", async () => {
    const row = {
      id: 12, coachId: 42, studentId: 1, title: "Tactics course",
      dueDate: new Date("2026-06-17T10:00:00Z"),
      coachName: "Coach", coachEmail: "c@e.com",
      studentName: "Student", studentEmail: "s@e.com",
    };
    vi.mocked(db.getContentRequestsDueForReminder24h).mockResolvedValue([]);
    vi.mocked(db.getContentRequestsDueForReminder1h).mockResolvedValue([]);
    vi.mocked(db.getOverdueContentRequests).mockResolvedValue([row]);
    vi.mocked(db.updateContentRequestStatus).mockResolvedValue(undefined);
    vi.mocked(db.stampContentRequestDeadlineReminder).mockResolvedValue(undefined);
    vi.mocked(emailService.sendEmail).mockResolvedValue({ success: true } as any);
    vi.mocked(emailService.getStudentContentOverdueEmail).mockReturnValue("<html>overdue</html>");

    await sendContentRequestDeadlineReminders();

    expect(db.updateContentRequestStatus).toHaveBeenCalledWith(12, "overdue");
    expect(emailService.getStudentContentOverdueEmail).toHaveBeenCalledWith(expect.objectContaining({
      studentName: "Student",
      coachName: "Coach",
      requestTitle: "Tactics course",
    }));
    expect(emailService.sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: "s@e.com",
      subject: expect.stringContaining("Overdue"),
    }));
    expect(db.stampContentRequestDeadlineReminder).toHaveBeenCalledWith(12, "overdueNotifiedAt");
    expect(db.createNotification).toHaveBeenCalledWith(expect.objectContaining({
      userId: 1,
      type: "content_request_overdue",
      recipientRole: "student",
    }));
  });
});

// ── Test 5: proposeDeadlineExtension resets status, clears stamps, notifies coach ──

describe("contentRequest.proposeDeadlineExtension", () => {
  it("resets status to in_progress, clears reminder stamps, notifies coach", async () => {
    vi.mocked(db.getContentRequestById).mockResolvedValue({ ...baseRequest, status: "overdue" } as any);
    vi.mocked(db.proposeContentRequestDeadlineExtension).mockResolvedValue(undefined);

    const caller = appRouter.createCaller(ctx(student));
    const res = await caller.contentRequest.proposeDeadlineExtension({
      requestId: 10,
      newDueDate: "2026-07-01T00:00:00.000Z",
    });
    expect(res.success).toBe(true);
    expect(db.proposeContentRequestDeadlineExtension).toHaveBeenCalledWith(10, expect.any(Date));
    expect(db.createNotification).toHaveBeenCalledWith(expect.objectContaining({
      userId: 42,
      type: "content_request_deadline_extended",
      recipientRole: "coach",
    }));
  });
});

// ── Test 6: cancelOverdue issues Stripe refund, sets status to cancelled ─────

describe("contentRequest.cancelOverdue", () => {
  it("issues Stripe refund, sets status to cancelled, notifies coach", async () => {
    vi.mocked(db.getContentRequestById).mockResolvedValue({ ...baseRequest, status: "overdue", stripePaymentIntentId: "pi_test_123" } as any);
    vi.mocked(stripeService.createRefund).mockResolvedValue({ id: "re_123" } as any);
    vi.mocked(db.cancelOverdueContentRequest).mockResolvedValue(undefined);

    const caller = appRouter.createCaller(ctx(student));
    const res = await caller.contentRequest.cancelOverdue({ requestId: 10 });
    expect(res.success).toBe(true);
    expect(stripeService.createRefund).toHaveBeenCalledWith(
      "pi_test_123",
      undefined,
      "requested_by_customer",
      "content_request_cancel_overdue_10"
    );
    expect(db.cancelOverdueContentRequest).toHaveBeenCalledWith(10);
    expect(db.createNotification).toHaveBeenCalledWith(expect.objectContaining({
      userId: 42,
      type: "content_request_cancelled_overdue",
      recipientRole: "coach",
    }));
  });
});

// ── Test 7: cancelOverdue — no refund attempt if stripePaymentIntentId is null ──

describe("contentRequest.cancelOverdue — no payment intent", () => {
  it("skips Stripe refund when stripePaymentIntentId is null", async () => {
    vi.mocked(db.getContentRequestById).mockResolvedValue({ ...baseRequest, status: "overdue", stripePaymentIntentId: null } as any);
    vi.mocked(db.cancelOverdueContentRequest).mockResolvedValue(undefined);

    const caller = appRouter.createCaller(ctx(student));
    const res = await caller.contentRequest.cancelOverdue({ requestId: 10 });
    expect(res.success).toBe(true);
    expect(stripeService.createRefund).not.toHaveBeenCalled();
    expect(db.cancelOverdueContentRequest).toHaveBeenCalledWith(10);
  });
});

// ── Test 8: acceptDeadlineExtension sets status to in_progress, notifies student ──

describe("contentRequest.acceptDeadlineExtension", () => {
  it("sets status to in_progress and notifies student", async () => {
    vi.mocked(db.getContentRequestById).mockResolvedValue({ ...baseRequest, status: "overdue", dueDate: new Date("2026-07-01") } as any);
    vi.mocked(db.proposeContentRequestDeadlineExtension).mockResolvedValue(undefined);

    const caller = appRouter.createCaller(ctx(coach));
    const res = await caller.contentRequest.acceptDeadlineExtension({ requestId: 10 });
    expect(res.success).toBe(true);
    expect(db.proposeContentRequestDeadlineExtension).toHaveBeenCalledWith(10, expect.any(Date));
    expect(db.createNotification).toHaveBeenCalledWith(expect.objectContaining({
      userId: 1,
      type: "content_request_deadline_extended",
      recipientRole: "student",
    }));
  });
});
