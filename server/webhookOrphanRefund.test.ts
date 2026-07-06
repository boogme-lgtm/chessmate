/**
 * Orphaned-payment auto-refund (audit HIGH webhooks.ts:136). If a lesson is
 * cancelled/declined while the student's Stripe checkout is still open, the
 * paid webhook must refund the orphaned payment instead of silently no-op'ing.
 * The refund fires only when no payment intent was ever recorded (a genuinely
 * orphaned payment), so normal retries and post-payment refunds can't double-refund.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./db");
vi.mock("./emailService");
vi.mock("./nurtureEmailScheduler");
vi.mock("./resendWelcomeEmails");
vi.mock("./stripe", () => ({
  constructWebhookEvent: vi.fn((body: unknown) => body),
  createRefund: vi.fn(async () => ({ id: "re_test" })),
}));
vi.mock("./stripeConnect", () => ({
  transferToCoach: vi.fn(),
  getChargeIdForPaymentIntent: vi.fn(async () => "ch_test"),
}));

import * as db from "./db";
import { createRefund } from "./stripe";
import { handleStripeWebhook } from "./webhooks";
import type { Request, Response } from "express";

function makeReqRes(body: unknown) {
  const req = { headers: { "stripe-signature": "sig_test" }, body } as unknown as Request;
  const res = { json: () => res, status: () => res } as unknown as Response;
  return { req, res };
}

function paidEvent(lessonId = 42, pi: string | null = "pi_orphan_1") {
  return {
    type: "checkout.session.completed",
    id: "evt_1",
    data: { object: { id: "cs_1", payment_status: "paid", payment_intent: pi, metadata: { lessonId: String(lessonId) } } },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
});

describe("webhook orphaned-payment refund", () => {
  it("refunds when a paid webhook arrives for a cancelled lesson with no recorded payment intent", async () => {
    vi.mocked(db.getLessonById).mockResolvedValue({
      id: 42, status: "cancelled", stripePaymentIntentId: null, studentId: 1, coachId: 2,
    } as any);
    const { req, res } = makeReqRes(paidEvent(42, "pi_orphan_1"));
    await handleStripeWebhook(req, res);
    expect(createRefund).toHaveBeenCalledWith(
      "pi_orphan_1", undefined, "requested_by_customer", "orphan_refund_lesson_42_pi_orphan_1"
    );
  });

  it("refunds a declined lesson orphaned payment too", async () => {
    vi.mocked(db.getLessonById).mockResolvedValue({
      id: 7, status: "declined", stripePaymentIntentId: null, studentId: 1, coachId: 2,
    } as any);
    const { req, res } = makeReqRes(paidEvent(7, "pi_orphan_2"));
    await handleStripeWebhook(req, res);
    expect(createRefund).toHaveBeenCalledTimes(1);
  });

  it("does NOT refund a cancelled lesson that already recorded a payment intent (normal retry)", async () => {
    vi.mocked(db.getLessonById).mockResolvedValue({
      id: 42, status: "cancelled", stripePaymentIntentId: "pi_already", studentId: 1, coachId: 2,
    } as any);
    const { req, res } = makeReqRes(paidEvent(42, "pi_orphan_1"));
    await handleStripeWebhook(req, res);
    expect(createRefund).not.toHaveBeenCalled();
  });

  it("does NOT refund a lesson in a forward state (payment already collected)", async () => {
    vi.mocked(db.getLessonById).mockResolvedValue({
      id: 42, status: "confirmed", stripePaymentIntentId: "pi_x", studentId: 1, coachId: 2,
    } as any);
    const { req, res } = makeReqRes(paidEvent(42, "pi_orphan_1"));
    await handleStripeWebhook(req, res);
    expect(createRefund).not.toHaveBeenCalled();
  });
});
