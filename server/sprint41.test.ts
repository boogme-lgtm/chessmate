/**
 * Sprint 41 regression tests
 *
 * 1. Runtime export guard: asserts that db.clearLessonCheckoutSession is
 *    exported from server/db.ts and is callable. This test fails at runtime
 *    if the function is removed or renamed. NOTE: tsconfig.json excludes
 *    **\/*.test.ts, so tsc does not type-check this file; the compile-time
 *    signature guard lives in server/db.typecheck.ts (included by tsc).
 *
 * 2. Behavioral tests for the checkout-session cleanup path in
 *    handleCheckoutCompleted (webhooks.ts):
 *    - clearLessonCheckoutSession is called after updateLessonPaymentCollected
 *      on a successful paid checkout.
 *    - clearLessonCheckoutSession is NOT called when the lesson is not in
 *      pending_payment state (idempotency guard).
 *    - clearLessonCheckoutSession is NOT called when payment_status !== 'paid'.
 *    - clearLessonCheckoutSession is NOT called when lessonId is missing from
 *      metadata.
 *
 * Root-cause note (S41):
 *   The watch-mode tsc daemon was reporting "clearLessonCheckoutSession does
 *   not exist on type typeof db" because the tsBuildInfoFile was stored at
 *   ./node_modules/typescript/tsbuildinfo — inside node_modules, which is
 *   not tracked by git. When the Manus platform restored the project from a
 *   checkpoint and reinstalled node_modules, the old incremental cache from
 *   a previous session persisted (predating the function's addition to db.ts).
 *   The daemon then started against this stale cache and reported a false
 *   positive. Fix: tsBuildInfoFile moved to ./.tsbuildinfo (project root,
 *   covered by *.tsbuildinfo in .gitignore).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { clearLessonCheckoutSession } from "./db";

// ---------------------------------------------------------------------------
// S41-1: Runtime export guard — clearLessonCheckoutSession must be exported
//        from db. The compile-time signature check lives in db.typecheck.ts.
// ---------------------------------------------------------------------------

describe("S41-1: db.clearLessonCheckoutSession runtime export guard", () => {
  it("clearLessonCheckoutSession is exported from server/db and is callable", async () => {
    // Dynamic import proves the export exists at runtime. tsc does not
    // type-check *.test.ts files (excluded in tsconfig.json), so the
    // compile-time signature assertion is in server/db.typecheck.ts instead.
    const db = await import("./db");
    expect(typeof db.clearLessonCheckoutSession).toBe("function");
  });
});

// ---------------------------------------------------------------------------
// S41-2: Behavioral tests for handleCheckoutCompleted checkout-session cleanup
// ---------------------------------------------------------------------------

// We test the webhook handler in isolation by mocking all db and email calls.
vi.mock("./db");
vi.mock("./emailService");
vi.mock("./stripe", () => ({
  constructWebhookEvent: vi.fn(),
}));
vi.mock("./stripeConnect");

import * as db from "./db";
import * as stripeConnect from "./stripeConnect";
import { constructWebhookEvent } from "./stripe";
import { handleStripeWebhook } from "./webhooks";
import type { Request, Response } from "express";

// Helper to build a minimal Express Request/Response pair
function makeReqRes(body: unknown, signature = "sig_test") {
  const req = {
    headers: { "stripe-signature": signature },
    body,
  } as unknown as Request;

  const jsonBody: unknown[] = [];
  const statusCodes: number[] = [];
  const res = {
    json: (b: unknown) => { jsonBody.push(b); return res; },
    status: (code: number) => { statusCodes.push(code); return res; },
  } as unknown as Response;

  return { req, res, jsonBody, statusCodes };
}

// Helper to build a fake checkout.session.completed event
function makeCheckoutEvent(overrides: {
  lessonId?: string | null;
  paymentStatus?: string;
  paymentIntent?: string | null;
} = {}) {
  const {
    lessonId = "42",
    paymentStatus = "paid",
    paymentIntent = "pi_test_123",
  } = overrides;
  return {
    type: "checkout.session.completed",
    id: "evt_live_test",
    data: {
      object: {
        id: "cs_test_abc",
        payment_status: paymentStatus,
        payment_intent: paymentIntent,
        metadata: lessonId !== null ? { lessonId } : {},
      },
    },
  };
}

describe("S41-2: handleCheckoutCompleted — clearLessonCheckoutSession call behaviour", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: STRIPE_WEBHOOK_SECRET is set
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";

    // constructWebhookEvent returns whatever we pass as body
    vi.mocked(constructWebhookEvent).mockImplementation(
      (body: unknown) => body as ReturnType<typeof constructWebhookEvent>
    );

    // Default db mocks
    vi.mocked(db.getLessonById).mockResolvedValue({
      id: 42,
      status: "pending_payment",
      studentId: 1,
      coachId: 2,
      scheduledAt: new Date(),
      durationMinutes: 60,
      amountCents: 5000,
      coachPayoutCents: 4000,
    } as any);

    vi.mocked(db.updateLessonPaymentCollected).mockResolvedValue(undefined as any);
    vi.mocked(db.clearLessonCheckoutSession).mockResolvedValue(1);
    vi.mocked(db.getUserById).mockResolvedValue(null);
    // S-PAY-1: webhook resolves the backing charge before recording payment.
    vi.mocked(stripeConnect.getChargeIdForPaymentIntent).mockResolvedValue("ch_test_123");
  });

  it("S41-2a: calls clearLessonCheckoutSession after updateLessonPaymentCollected on paid checkout", async () => {
    const { req, res } = makeReqRes(makeCheckoutEvent());
    await handleStripeWebhook(req, res);

    expect(db.updateLessonPaymentCollected).toHaveBeenCalledWith(42, "pi_test_123", "ch_test_123");
    expect(db.clearLessonCheckoutSession).toHaveBeenCalledWith(42);
    // clearLessonCheckoutSession must be called AFTER updateLessonPaymentCollected
    const updateOrder = vi.mocked(db.updateLessonPaymentCollected).mock.invocationCallOrder[0];
    const clearOrder = vi.mocked(db.clearLessonCheckoutSession).mock.invocationCallOrder[0];
    expect(clearOrder).toBeGreaterThan(updateOrder!);
  });

  it("S41-2b: does NOT call clearLessonCheckoutSession when lesson is not in pending_payment state", async () => {
    vi.mocked(db.getLessonById).mockResolvedValue({
      id: 42,
      status: "payment_collected", // already processed
    } as any);

    const { req, res } = makeReqRes(makeCheckoutEvent());
    await handleStripeWebhook(req, res);

    expect(db.updateLessonPaymentCollected).not.toHaveBeenCalled();
    expect(db.clearLessonCheckoutSession).not.toHaveBeenCalled();
  });

  it("S41-2c: does NOT call clearLessonCheckoutSession when payment_status is not paid", async () => {
    const { req, res } = makeReqRes(makeCheckoutEvent({ paymentStatus: "unpaid" }));
    await handleStripeWebhook(req, res);

    expect(db.clearLessonCheckoutSession).not.toHaveBeenCalled();
  });

  it("S41-2d: does NOT call clearLessonCheckoutSession when lessonId is missing from metadata", async () => {
    const { req, res } = makeReqRes(makeCheckoutEvent({ lessonId: null }));
    await handleStripeWebhook(req, res);

    expect(db.clearLessonCheckoutSession).not.toHaveBeenCalled();
  });

  it("S41-2e: does NOT call clearLessonCheckoutSession when paymentIntent is null", async () => {
    const { req, res } = makeReqRes(makeCheckoutEvent({ paymentIntent: null }));
    await handleStripeWebhook(req, res);

    expect(db.updateLessonPaymentCollected).not.toHaveBeenCalled();
    expect(db.clearLessonCheckoutSession).not.toHaveBeenCalled();
  });
});
