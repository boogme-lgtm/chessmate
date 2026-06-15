/**
 * Sprint S-PAY-1 — charge-sourced coach payouts
 *
 * Root cause: stripe.transfers.create() without source_transaction pulls from
 * the platform's AVAILABLE balance. In test mode payments never settle to
 * available balance, so payouts failed with balance_insufficient. The fix
 * stores the charge backing each payment and passes it as source_transaction,
 * which pulls from that specific charge — no available balance required.
 *
 * Verifies:
 *   1. checkout.session.completed stores stripeChargeId on the lesson
 *   2. payment_intent.succeeded (backup path) stores the charge from latest_charge
 *   3. releaseLessonPayoutToCoach passes sourceTransaction: chargeId to transferToCoach
 *   4. lesson transitions to released after a successful charge-sourced transfer
 *   5. a lesson with no stored charge still attempts the transfer (null fallback)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./db");
vi.mock("./stripeConnect");
vi.mock("./stripe");
vi.mock("./emailService");
vi.mock("./nurtureEmailScheduler");
vi.mock("./resendWelcomeEmails");

import * as db from "./db";
import * as stripeConnect from "./stripeConnect";
import * as stripeService from "./stripe";
import { releaseLessonPayoutToCoach } from "./payoutService";
import { handleStripeWebhook } from "./webhooks";

const past = new Date(Date.now() - 60_000); // issue window expired

function payableLesson(overrides: Record<string, any> = {}) {
  return {
    id: 330001,
    status: "completed",
    issueWindowEndsAt: past,
    stripePaymentIntentId: "pi_abc",
    stripeChargeId: "ch_abc",
    stripeTransferId: null,
    coachId: 42,
    studentId: 1,
    coachPayoutCents: 4250,
    currency: "usd",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.getUserById).mockImplementation(async (id: number) =>
    (id === 42 ? { id: 42, stripeConnectAccountId: "acct_coach_42" } : { id }) as any
  );
  vi.mocked(db.finalizeLessonPayout).mockResolvedValue(undefined as any);
  vi.mocked(db.releaseLessonPayoutSlot).mockResolvedValue(undefined as any);
  vi.mocked(db.claimLessonPayoutSlot).mockResolvedValue(true);
});

describe("S-PAY-1 — payout uses source_transaction", () => {
  it("passes sourceTransaction: chargeId to transferToCoach and releases", async () => {
    const lesson = payableLesson();
    vi.mocked(db.getLessonById).mockResolvedValue(lesson as any);
    vi.mocked(stripeConnect.transferToCoach).mockResolvedValue({
      success: true,
      transferId: "tr_123",
    } as any);

    const res = await releaseLessonPayoutToCoach({ lessonId: 330001 });

    expect(res.success).toBe(true);
    expect(stripeConnect.transferToCoach).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: "acct_coach_42",
        amountCents: 4250,
        sourceTransaction: "ch_abc",
      })
    );
    // Lesson transitions to released only after a successful transfer.
    expect(db.finalizeLessonPayout).toHaveBeenCalledWith(330001, "tr_123");
  });

  it("falls back to null sourceTransaction when no charge is stored", async () => {
    const lesson = payableLesson({ stripeChargeId: null });
    vi.mocked(db.getLessonById).mockResolvedValue(lesson as any);
    vi.mocked(stripeConnect.transferToCoach).mockResolvedValue({
      success: true,
      transferId: "tr_456",
    } as any);

    const res = await releaseLessonPayoutToCoach({ lessonId: 330001 });

    expect(res.success).toBe(true);
    expect(stripeConnect.transferToCoach).toHaveBeenCalledWith(
      expect.objectContaining({ sourceTransaction: null })
    );
  });

  it("does not finalize when the transfer fails (slot released for retry)", async () => {
    const lesson = payableLesson();
    vi.mocked(db.getLessonById).mockResolvedValue(lesson as any);
    vi.mocked(stripeConnect.transferToCoach).mockResolvedValue({
      success: false,
      error: "You have insufficient available funds in your Stripe account.",
    } as any);

    const res = await releaseLessonPayoutToCoach({ lessonId: 330001 });

    expect(res.success).toBe(false);
    expect(db.finalizeLessonPayout).not.toHaveBeenCalled();
    expect(db.releaseLessonPayoutSlot).toHaveBeenCalledWith(330001);
  });
});

describe("S-PAY-1 — webhook stores the charge", () => {
  function runWebhook(eventObject: any, eventType: string) {
    const mockReq = { body: Buffer.from("x"), headers: { "stripe-signature": "sig" } };
    const mockRes = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    vi.mocked(stripeService.constructWebhookEvent).mockReturnValue({
      type: eventType,
      id: "evt_pay1",
      data: { object: eventObject },
    } as any);
    return handleStripeWebhook(mockReq as any, mockRes as any);
  }

  it("checkout.session.completed resolves and stores stripeChargeId", async () => {
    vi.mocked(db.getLessonById).mockResolvedValue(
      payableLesson({ status: "pending_payment" }) as any
    );
    vi.mocked(db.updateLessonPaymentCollected).mockResolvedValue(undefined as any);
    vi.mocked(db.clearLessonCheckoutSession).mockResolvedValue(undefined as any);
    vi.mocked(stripeConnect.getChargeIdForPaymentIntent).mockResolvedValue("ch_resolved");

    await runWebhook(
      {
        id: "cs_1",
        metadata: { lessonId: "330001" },
        payment_status: "paid",
        payment_intent: "pi_abc",
      },
      "checkout.session.completed"
    );

    expect(stripeConnect.getChargeIdForPaymentIntent).toHaveBeenCalledWith("pi_abc");
    expect(db.updateLessonPaymentCollected).toHaveBeenCalledWith(330001, "pi_abc", "ch_resolved");
  });

  it("payment_intent.succeeded stores the charge from latest_charge (no extra API call)", async () => {
    vi.mocked(db.getLessonByPaymentIntent).mockResolvedValue(
      payableLesson({ status: "pending_payment" }) as any
    );
    vi.mocked(db.updateLessonPaymentCollected).mockResolvedValue(undefined as any);

    await runWebhook(
      { id: "pi_abc", latest_charge: "ch_latest" },
      "payment_intent.succeeded"
    );

    expect(db.updateLessonPaymentCollected).toHaveBeenCalledWith(330001, "pi_abc", "ch_latest");
    // The backup path reads latest_charge off the event — no retrieve round-trip.
    expect(stripeConnect.getChargeIdForPaymentIntent).not.toHaveBeenCalled();
  });
});
