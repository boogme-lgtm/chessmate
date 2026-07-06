/**
 * Sprint 44 — booking/payment notification emails
 *
 * Behavioral tests (db + emailService + stripe mocked):
 *   - S44-6: lesson.book sends the student a booking-RESERVED email at booking
 *            time, and does NOT email the coach (payment-first: coach is only
 *            notified after payment).
 *   - S44-7 + S44-8: a paid checkout.session.completed webhook sends BOTH the
 *            student payment confirmation and the coach booking notification.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./db");
vi.mock("./emailService");
vi.mock("./nurtureEmailScheduler");
vi.mock("./resendWelcomeEmails");
vi.mock("./stripe", () => ({ constructWebhookEvent: vi.fn() }));
vi.mock("./bookingService");

import * as db from "./db";
import * as bookingService from "./bookingService";
import * as emailService from "./emailService";
import { constructWebhookEvent } from "./stripe";
import { appRouter } from "./routers";
import { handleStripeWebhook } from "./webhooks";
import type { TrpcContext } from "./_core/context";
import type { Request, Response } from "express";

const student = { id: 1, name: "Stu Dent", email: "student@example.com" };
const coach = { id: 2, name: "Coach Cris", email: "coach@example.com" };

function studentCtx(): TrpcContext {
  return {
    user: { id: 1, role: "user", userType: "student", openId: "s", name: "Stu Dent", email: "student@example.com" } as any,
    req: { protocol: "https", headers: {} } as any,
    res: { setHeader: vi.fn() } as any,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.getUserById).mockImplementation(async (id: number) =>
    (id === 1 ? student : id === 2 ? coach : null) as any
  );
});

// ─── S44-6: booking-time student email ────────────────────────────────────────

describe("Sprint 44 — S44-6: lesson.book emails the student to complete payment", () => {
  beforeEach(() => {
    vi.mocked(db.getCoachProfileByUserId).mockResolvedValue({
      userId: 2,
      hourlyRateCents: 6000,
      pricingTier: "free",
      minAdvanceHours: 24,
      maxAdvanceDays: 30,
    } as any);
    vi.mocked(db.createLesson).mockResolvedValue({ id: 99, status: "pending_payment" } as any);
    vi.mocked(db.updateUserType).mockResolvedValue(undefined as any);
    // Slot is free by default — the double-booking guard is tested separately.
    vi.mocked(bookingService.isTimeSlotAvailable).mockResolvedValue(true);
  });

  it("S44-6a: sends a booking-reserved email to the student", async () => {
    const caller = appRouter.createCaller(studentCtx());
    const res = await caller.lesson.book({
      coachId: 2,
      scheduledAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      durationMinutes: 60,
      topic: "Endgames",
    });

    expect(res.success).toBe(true);
    expect(res.lessonId).toBe(99);

    // Email is fire-and-forget — wait for the microtask to flush.
    await vi.waitFor(() => {
      expect(emailService.sendEmail).toHaveBeenCalled();
    });
    expect(emailService.getStudentBookingReservedEmail).toHaveBeenCalled();
    const call = vi.mocked(emailService.sendEmail).mock.calls[0][0];
    expect(call.to).toBe("student@example.com");
  });

  it("S44-6b: does NOT email the coach at booking time (payment-first)", async () => {
    const caller = appRouter.createCaller(studentCtx());
    await caller.lesson.book({
      coachId: 2,
      scheduledAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      durationMinutes: 60,
    });

    await vi.waitFor(() => {
      expect(emailService.sendEmail).toHaveBeenCalled();
    });
    const recipients = vi.mocked(emailService.sendEmail).mock.calls.map((c) => c[0].to);
    expect(recipients).not.toContain("coach@example.com");
  });

  it("S44-6c: booking still succeeds even if the email send throws", async () => {
    vi.mocked(emailService.sendEmail).mockRejectedValueOnce(new Error("Resend down"));
    const caller = appRouter.createCaller(studentCtx());
    const res = await caller.lesson.book({
      coachId: 2,
      scheduledAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      durationMinutes: 60,
    });
    expect(res.success).toBe(true);
  });
});

// ─── S44-7 + S44-8: webhook emails after payment ─────────────────────────────

function makeReqRes(body: unknown, signature = "sig_test") {
  const req = { headers: { "stripe-signature": signature }, body } as unknown as Request;
  const res = {
    json: (b: unknown) => res,
    status: (_code: number) => res,
  } as unknown as Response;
  return { req, res };
}

function paidCheckoutEvent() {
  return {
    type: "checkout.session.completed",
    id: "evt_live_test",
    data: {
      object: {
        id: "cs_test_abc",
        payment_status: "paid",
        payment_intent: "pi_test_123",
        metadata: { lessonId: "42" },
      },
    },
  };
}

describe("Sprint 44 — S44-7/S44-8: webhook sends payment + coach emails", () => {
  beforeEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    vi.mocked(constructWebhookEvent).mockImplementation(
      (body: unknown) => body as ReturnType<typeof constructWebhookEvent>
    );
    vi.mocked(db.getLessonById).mockResolvedValue({
      id: 42,
      status: "pending_payment",
      studentId: 1,
      coachId: 2,
      scheduledAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      durationMinutes: 60,
      amountCents: 6000,
      coachPayoutCents: 5280,
    } as any);
    vi.mocked(db.updateLessonPaymentCollected).mockResolvedValue(undefined as any);
    vi.mocked(db.clearLessonCheckoutSession).mockResolvedValue(1 as any);
  });

  it("S44-8: sends a payment confirmation email to the student", async () => {
    const { req, res } = makeReqRes(paidCheckoutEvent());
    await handleStripeWebhook(req, res);

    const recipients = vi.mocked(emailService.sendEmail).mock.calls.map((c) => c[0].to);
    expect(recipients).toContain("student@example.com");
    expect(emailService.getStudentBookingConfirmationEmail).toHaveBeenCalled();
  });

  it("S44-7: sends a booking notification email to the coach", async () => {
    const { req, res } = makeReqRes(paidCheckoutEvent());
    await handleStripeWebhook(req, res);

    const recipients = vi.mocked(emailService.sendEmail).mock.calls.map((c) => c[0].to);
    expect(recipients).toContain("coach@example.com");
    expect(emailService.getCoachBookingNotificationEmail).toHaveBeenCalled();
  });
});
