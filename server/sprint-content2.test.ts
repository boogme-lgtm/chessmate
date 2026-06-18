/**
 * S-CONTENT-2 -- content request escrow pipeline tests
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
  dueDate: new Date("2026-07-01"),
  coachNote: "Will cover key positions",
  contentItemId: null,
  stripePaymentIntentId: null,
  stripeChargeId: null,
  stripeCheckoutSessionId: null,
  payoutReleasedAt: null,
  payoutAt: null,
  deliveredAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
  // Default mocks for fire-and-forget notifications
  vi.mocked(db.createNotification).mockResolvedValue(1);
  vi.mocked(db.getUserById).mockImplementation(async (id: number) => {
    if (id === 1) return student as any;
    if (id === 42) return coach as any;
    return undefined;
  });
  vi.mocked(db.getCoachProfileByUserId).mockResolvedValue({ pricingTier: "free" } as any);
});

// ── Test 1: quote sets status to "quoted" ─────────────────────────────────

describe("contentRequest.quote", () => {
  it("sets status to quoted with price/date/note", async () => {
    vi.mocked(db.getContentRequestById).mockResolvedValue({ ...baseRequest, status: "queued" } as any);
    vi.mocked(db.quoteContentRequest).mockResolvedValue(undefined as any);
    const caller = appRouter.createCaller(ctx(coach));
    const res = await caller.contentRequest.quote({
      requestId: 10,
      amountCents: 5000,
      dueDate: "2026-07-01T00:00:00.000Z",
      coachNote: "Will cover key positions",
    });
    expect(res.success).toBe(true);
    expect(db.quoteContentRequest).toHaveBeenCalledWith(10, expect.objectContaining({
      amountCents: 5000,
      dueDate: expect.any(Date),
      coachNote: "Will cover key positions",
    }));
    expect(db.createNotification).toHaveBeenCalledWith(expect.objectContaining({
      userId: 1,
      type: "content_request_quoted",
    }));
  });
});

// ── Test 2: acceptQuote transitions quoted -> pending_payment ──────────────

describe("contentRequest.acceptQuote", () => {
  it("moves quoted -> pending_payment and notifies coach", async () => {
    vi.mocked(db.getContentRequestById).mockResolvedValue({ ...baseRequest, status: "quoted" } as any);
    vi.mocked(db.acceptContentRequestQuote).mockResolvedValue(undefined as any);
    const caller = appRouter.createCaller(ctx(student));
    const res = await caller.contentRequest.acceptQuote({ requestId: 10 });
    expect(res.success).toBe(true);
    expect(db.acceptContentRequestQuote).toHaveBeenCalledWith(10);
    expect(db.createNotification).toHaveBeenCalledWith(expect.objectContaining({
      userId: 42,
      type: "content_request_accepted",
      recipientRole: "coach",
    }));
  });
});

// ── Test 3: rejectQuote transitions quoted -> queued, clears price ─────────

describe("contentRequest.rejectQuote", () => {
  it("moves quoted -> queued and clears price", async () => {
    vi.mocked(db.getContentRequestById).mockResolvedValue({ ...baseRequest, status: "quoted" } as any);
    vi.mocked(db.rejectContentRequestQuote).mockResolvedValue(undefined as any);
    const caller = appRouter.createCaller(ctx(student));
    const res = await caller.contentRequest.rejectQuote({ requestId: 10 });
    expect(res.success).toBe(true);
    expect(db.rejectContentRequestQuote).toHaveBeenCalledWith(10);
    expect(db.createNotification).toHaveBeenCalledWith(expect.objectContaining({
      userId: 42,
      type: "new_content_request",
    }));
  });
});

// ── Test 4: createCheckout requires pending_payment, returns URL ───────────

describe("contentRequest.createCheckout", () => {
  it("requires pending_payment and returns Stripe URL", async () => {
    vi.mocked(db.getContentRequestById).mockResolvedValue({
      ...baseRequest,
      status: "pending_payment",
      amountCents: 5000,
    } as any);
    vi.mocked(db.claimContentRequestCheckoutSlot).mockResolvedValue(true);
    vi.mocked(db.setContentRequestCheckoutSession).mockResolvedValue(undefined as any);

    const { createContentRequestCheckoutSession } = await import("./stripe");
    vi.mocked(createContentRequestCheckoutSession).mockResolvedValue({
      id: "cs_test_123",
      url: "https://checkout.stripe.com/test",
    } as any);

    const caller = appRouter.createCaller(ctx(student));
    const res = await caller.contentRequest.createCheckout({ requestId: 10 });
    expect(res.url).toBe("https://checkout.stripe.com/test");
    expect(db.claimContentRequestCheckoutSlot).toHaveBeenCalledWith(10);
    expect(db.setContentRequestCheckoutSession).toHaveBeenCalledWith(10, "cs_test_123");
  });
});

// ── Test 5: startWork requires payment_collected, rejects queued ───────────

describe("contentRequest.startWork", () => {
  it("requires payment_collected status", async () => {
    vi.mocked(db.getContentRequestById).mockResolvedValue({ ...baseRequest, status: "payment_collected" } as any);
    vi.mocked(db.startContentRequestWork).mockResolvedValue(undefined as any);
    const caller = appRouter.createCaller(ctx(coach));
    const res = await caller.contentRequest.startWork({ requestId: 10 });
    expect(res.success).toBe(true);
    expect(db.startContentRequestWork).toHaveBeenCalledWith(10);
  });

  it("rejects queued status", async () => {
    vi.mocked(db.getContentRequestById).mockResolvedValue({ ...baseRequest, status: "queued" } as any);
    const caller = appRouter.createCaller(ctx(coach));
    await expect(caller.contentRequest.startWork({ requestId: 10 }))
      .rejects.toThrow(/Cannot start work until the student has paid/);
    expect(db.startContentRequestWork).not.toHaveBeenCalled();
  });
});

// ── Test 6: markDelivered requires in_progress, sets deliveredAt + payoutAt ──

describe("contentRequest.markDelivered", () => {
  it("requires in_progress, notifies student", async () => {
    vi.mocked(db.getContentRequestById).mockResolvedValue({ ...baseRequest, status: "in_progress" } as any);
    vi.mocked(db.deliverContentRequest).mockResolvedValue(undefined as any);
    const caller = appRouter.createCaller(ctx(coach));
    const res = await caller.contentRequest.markDelivered({ requestId: 10 });
    expect(res.success).toBe(true);
    expect(db.deliverContentRequest).toHaveBeenCalledWith(10);
    expect(db.createNotification).toHaveBeenCalledWith(expect.objectContaining({
      userId: 1,
      type: "content_delivered",
      recipientRole: "student",
    }));
  });

  it("rejects queued status", async () => {
    vi.mocked(db.getContentRequestById).mockResolvedValue({ ...baseRequest, status: "queued" } as any);
    const caller = appRouter.createCaller(ctx(coach));
    await expect(caller.contentRequest.markDelivered({ requestId: 10 }))
      .rejects.toThrow(/Can only mark in-progress or overdue requests as delivered/);
  });
});

// ── Test 7: payout skips if window not expired ────────────────────────────

describe("releaseContentRequestPayoutToCoach", () => {
  it("skips if payout window has not expired", async () => {
    const { releaseContentRequestPayoutToCoach } = await import("./contentRequestPayoutService");
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
    vi.mocked(db.getContentRequestById).mockResolvedValue({
      ...baseRequest,
      status: "delivered",
      payoutAt: futureDate,
      payoutReleasedAt: null,
      stripeChargeId: "ch_test",
    } as any);
    const result = await releaseContentRequestPayoutToCoach(10);
    expect(result.success).toBe(false);
    expect(result.reason).toMatch(/not expired/);
  });

  it("releases a charge-sourced transfer and marks payout released (happy path)", async () => {
    const { releaseContentRequestPayoutToCoach } = await import("./contentRequestPayoutService");
    const { stripe } = await import("./stripe");
    const pastDate = new Date(Date.now() - 60 * 1000);
    vi.mocked(db.getContentRequestById).mockResolvedValue({
      ...baseRequest, status: "delivered", payoutAt: pastDate, payoutReleasedAt: null,
      stripeChargeId: "ch_abc", amountCents: 5000,
    } as any);
    vi.mocked(db.getCoachProfileByUserId).mockResolvedValue({ pricingTier: "free" } as any);
    vi.mocked(db.markContentRequestPayoutReleased).mockResolvedValue(undefined as any);
    vi.mocked((stripe as any).transfers.create).mockResolvedValue({ id: "tr_xyz" } as any);

    const result = await releaseContentRequestPayoutToCoach(10);
    expect(result.success).toBe(true);
    // free tier = 12% → coach gets 88% of 5000 = 4400
    expect((stripe as any).transfers.create).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 4400, source_transaction: "ch_abc" }),
      expect.objectContaining({ idempotencyKey: "content_request_payout_10" }),
    );
    expect(db.markContentRequestPayoutReleased).toHaveBeenCalledWith(10, "tr_xyz");
  });

  it("C1: PI-only row (null charge) resolves the charge lazily, not stranded", async () => {
    const { releaseContentRequestPayoutToCoach } = await import("./contentRequestPayoutService");
    const { stripe } = await import("./stripe");
    const { getChargeIdForPaymentIntent } = await import("./stripeConnect");
    const pastDate = new Date(Date.now() - 60 * 1000);
    vi.mocked(db.getContentRequestById).mockResolvedValue({
      ...baseRequest, status: "delivered", payoutAt: pastDate, payoutReleasedAt: null,
      stripeChargeId: null, stripePaymentIntentId: "pi_abc", amountCents: 5000,
    } as any);
    vi.mocked(db.getCoachProfileByUserId).mockResolvedValue({ pricingTier: "free" } as any);
    vi.mocked(db.setContentRequestChargeId).mockResolvedValue(undefined as any);
    vi.mocked(db.markContentRequestPayoutReleased).mockResolvedValue(undefined as any);
    vi.mocked(getChargeIdForPaymentIntent).mockResolvedValue("ch_resolved");
    vi.mocked((stripe as any).transfers.create).mockResolvedValue({ id: "tr_2" } as any);

    const result = await releaseContentRequestPayoutToCoach(10);
    expect(result.success).toBe(true);
    expect(getChargeIdForPaymentIntent).toHaveBeenCalledWith("pi_abc");
    expect(db.setContentRequestChargeId).toHaveBeenCalledWith(10, "ch_resolved");
    expect((stripe as any).transfers.create).toHaveBeenCalledWith(
      expect.objectContaining({ source_transaction: "ch_resolved" }),
      expect.objectContaining({ idempotencyKey: "content_request_payout_10" }),
    );
  });

  it("idempotency: skips if payout already released", async () => {
    const { releaseContentRequestPayoutToCoach } = await import("./contentRequestPayoutService");
    vi.mocked(db.getContentRequestById).mockResolvedValue({
      ...baseRequest, status: "delivered", payoutAt: new Date(Date.now() - 1000),
      payoutReleasedAt: new Date(), stripeChargeId: "ch_abc",
    } as any);
    const result = await releaseContentRequestPayoutToCoach(10);
    expect(result.success).toBe(false);
    expect(result.reason).toMatch(/already released/);
  });
});

// ── Test 8: Webhook content_request checkout transitions pending_payment -> payment_collected ──

describe("webhook: content_request checkout", () => {
  it("transitions pending_payment -> payment_collected and notifies coach", async () => {
    // Set the webhook secret so the handler doesn't bail out
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";

    const { constructWebhookEvent } = await import("./stripe");
    vi.mocked(constructWebhookEvent).mockReturnValue({
      id: "evt_content_req_001",  // must NOT start with "evt_test_" to avoid test-event early return
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_content_123",
          metadata: { type: "content_request", requestId: "10" },
          payment_status: "paid",
          payment_intent: "pi_content_456",
        },
      },
    } as any);

    vi.mocked(db.getContentRequestById).mockResolvedValue({
      ...baseRequest,
      status: "pending_payment",
    } as any);
    vi.mocked(db.markContentRequestPaymentCollected).mockResolvedValue(undefined as any);

    const { getChargeIdForPaymentIntent } = await import("./stripeConnect");
    vi.mocked(getChargeIdForPaymentIntent).mockResolvedValue("ch_content_789");

    const { handleStripeWebhook } = await import("./webhooks");
    const req = {
      body: "raw-body",
      headers: { "stripe-signature": "sig_test" },
    } as any;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as any;

    await handleStripeWebhook(req, res);

    expect(db.markContentRequestPaymentCollected).toHaveBeenCalledWith(10, "pi_content_456", "ch_content_789");
    expect(db.createNotification).toHaveBeenCalledWith(expect.objectContaining({
      userId: 42,
      type: "content_request_payment_collected",
      recipientRole: "coach",
    }));
    expect(res.json).toHaveBeenCalledWith({ received: true });
  });
});
