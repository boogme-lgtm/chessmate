/**
 * Failed-tip refund (audit HIGH routers.ts:2905). When a paid tip can't be
 * delivered to the coach — no Connect account, or a failed transfer — the
 * student's charge used to be stranded in a terminal 'failed' state (and a
 * re-tip opened a double charge). It must now be refunded.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./db");
vi.mock("./emailService");
vi.mock("./nurtureEmailScheduler");
vi.mock("./resendWelcomeEmails");
vi.mock("./stripe", () => ({
  constructWebhookEvent: vi.fn((body: unknown) => body),
  createRefund: vi.fn(async () => ({ id: "re_tip" })),
}));
vi.mock("./stripeConnect", () => ({
  transferToCoach: vi.fn(),
  getChargeIdForPaymentIntent: vi.fn(async () => "ch_x"),
}));

import * as db from "./db";
import { createRefund } from "./stripe";
import { transferToCoach } from "./stripeConnect";
import { handleStripeWebhook } from "./webhooks";
import type { Request, Response } from "express";

function makeReqRes(body: unknown) {
  const req = { headers: { "stripe-signature": "sig" }, body } as unknown as Request;
  const res = { json: () => res, status: () => res } as unknown as Response;
  return { req, res };
}

function tipEvent(pi = "pi_tip_1") {
  return {
    type: "checkout.session.completed",
    id: "evt_tip",
    data: { object: { id: "cs_tip", payment_status: "paid", payment_intent: pi, metadata: { type: "tip", tipId: "5" } } },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  vi.mocked(db.getTipByCheckoutSession).mockResolvedValue({
    id: 5, status: "pending", coachId: 2, lessonId: 9, amountCents: 500, studentId: 1,
  } as any);
  vi.mocked(db.updateTipStatus).mockResolvedValue(undefined as any);
});

describe("failed-tip refund", () => {
  it("refunds the student when the coach has no Connect account", async () => {
    vi.mocked(db.getUserById).mockResolvedValue({ id: 2, stripeConnectAccountId: null } as any);
    const { req, res } = makeReqRes(tipEvent("pi_tip_1"));
    await handleStripeWebhook(req, res);
    expect(createRefund).toHaveBeenCalledWith("pi_tip_1", undefined, "requested_by_customer", "tip_refund_5");
    expect(db.updateTipStatus).toHaveBeenCalledWith(5, "failed");
  });

  it("refunds the student when the coach transfer fails", async () => {
    vi.mocked(db.getUserById).mockResolvedValue({ id: 2, stripeConnectAccountId: "acct_ok" } as any);
    vi.mocked(transferToCoach).mockResolvedValue({ success: false, error: "insufficient funds" } as any);
    const { req, res } = makeReqRes(tipEvent("pi_tip_2"));
    await handleStripeWebhook(req, res);
    expect(createRefund).toHaveBeenCalledWith("pi_tip_2", undefined, "requested_by_customer", "tip_refund_5");
    expect(db.updateTipStatus).toHaveBeenCalledWith(5, "failed");
  });

  it("does NOT refund when the transfer succeeds", async () => {
    vi.mocked(db.getUserById).mockResolvedValue({ id: 2, stripeConnectAccountId: "acct_ok" } as any);
    vi.mocked(transferToCoach).mockResolvedValue({ success: true, transferId: "tr_1" } as any);
    const { req, res } = makeReqRes(tipEvent("pi_tip_3"));
    await handleStripeWebhook(req, res);
    expect(createRefund).not.toHaveBeenCalled();
    expect(db.updateTipStatus).toHaveBeenCalledWith(5, "transferred", expect.anything());
  });
});
