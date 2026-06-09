/**
 * Sprint 45 — cancellation policy + webhook registration
 *
 * S45-1 / S45-6: computeCancellationRefund (shared/cancellationPolicy.ts) is the
 *   single source of truth used by both db.claimLessonCancellation and
 *   db.cancelLesson. Tested directly (pure function).
 * S45-2: structural check that the Stripe webhook is registered with
 *   express.raw() on BOTH path spellings, before express.json().
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { computeCancellationRefund } from "../shared/cancellationPolicy";

const HOUR = 60 * 60 * 1000;

describe("Sprint 45 — computeCancellationRefund", () => {
  it("S45-1-1: paid lesson 2 hours away → 100% refund", () => {
    const r = computeCancellationRefund({
      amountCents: 6000,
      scheduledAt: new Date(Date.now() + 2 * HOUR),
      stripePaymentIntentId: "pi_123",
    });
    expect(r.wasPaid).toBe(true);
    expect(r.refundPercentage).toBe(100);
    expect(r.refundAmountCents).toBe(6000);
  });

  it("S45-1-2: paid lesson 30 minutes away → 0% refund", () => {
    const r = computeCancellationRefund({
      amountCents: 6000,
      scheduledAt: new Date(Date.now() + 30 * 60 * 1000),
      stripePaymentIntentId: "pi_123",
    });
    expect(r.refundPercentage).toBe(0);
    expect(r.refundAmountCents).toBe(0);
  });

  it("S45-1-3: exactly 1 hour away (not strictly > 1h) → 0% refund", () => {
    const r = computeCancellationRefund({
      amountCents: 6000,
      scheduledAt: new Date(Date.now() + HOUR),
      stripePaymentIntentId: "pi_123",
    });
    expect(r.refundPercentage).toBe(0);
  });

  it("S45-6-1: unpaid lesson (null payment intent) → free regardless of timing", () => {
    const farAway = computeCancellationRefund({
      amountCents: 6000,
      scheduledAt: new Date(Date.now() + 72 * HOUR),
      stripePaymentIntentId: null,
    });
    expect(farAway.wasPaid).toBe(false);
    expect(farAway.refundPercentage).toBe(0);
    expect(farAway.refundAmountCents).toBe(0);

    const soon = computeCancellationRefund({
      amountCents: 6000,
      scheduledAt: new Date(Date.now() + 10 * 60 * 1000),
      stripePaymentIntentId: undefined,
    });
    expect(soon.refundAmountCents).toBe(0);
  });
});

describe("Sprint 45 — S45-2: Stripe webhook raw-body registration", () => {
  const src = readFileSync(new URL("./_core/index.ts", import.meta.url), "utf8");

  it("registers both webhook paths with express.raw()", () => {
    expect(src).toContain(
      'app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), handleStripeWebhook)'
    );
    expect(src).toContain(
      'app.post("/api/webhooks/stripe", express.raw({ type: "application/json" }), handleStripeWebhook)'
    );
  });

  it("registers the raw webhook routes BEFORE express.json()", () => {
    const rawIdx = src.indexOf('express.raw({ type: "application/json" }), handleStripeWebhook');
    // Match the actual middleware call, not the word "express.json()" in comments.
    const jsonIdx = src.indexOf("app.use(express.json(");
    expect(rawIdx).toBeGreaterThan(-1);
    expect(jsonIdx).toBeGreaterThan(-1);
    expect(rawIdx).toBeLessThan(jsonIdx);
  });
});
