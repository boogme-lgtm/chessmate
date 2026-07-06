/**
 * Unit tests for slotHasConflict — the pure slot-conflict decision behind
 * lesson.book's double-booking guard. Covers the overlap math, the status
 * exclusions (declined/cancel_pending free the slot; decline_pending does NOT),
 * and the checkout-hold expiry (never-started vs mid-checkout).
 */

import { describe, it, expect } from "vitest";
import { slotHasConflict, PENDING_HOLD_MS, STRIPE_SESSION_MAX_MS } from "./bookingService";

const NOW = 1_700_000_000_000; // fixed reference instant
const at = (h: number) => new Date(`2026-01-01T${String(h).padStart(2, "0")}:00:00Z`);

function lesson(over: Partial<any> = {}): any {
  return {
    status: "confirmed",
    scheduledAt: at(10),
    durationMinutes: 60,
    createdAt: new Date(NOW),
    stripeCheckoutSessionId: null,
    ...over,
  };
}

describe("slotHasConflict — overlap math", () => {
  it("detects an exact overlap", () => {
    expect(slotHasConflict([lesson({ scheduledAt: at(10) })], at(10), 60, NOW)).toBe(true);
  });
  it("detects a partial overlap (existing 10-11, new 10:30-11:30)", () => {
    const newStart = new Date(at(10).getTime() + 30 * 60000);
    expect(slotHasConflict([lesson({ scheduledAt: at(10) })], newStart, 60, NOW)).toBe(true);
  });
  it("allows back-to-back touching slots (10-11 then 11-12)", () => {
    expect(slotHasConflict([lesson({ scheduledAt: at(10) })], at(11), 60, NOW)).toBe(false);
  });
  it("allows a non-overlapping slot", () => {
    expect(slotHasConflict([lesson({ scheduledAt: at(10) })], at(14), 60, NOW)).toBe(false);
  });
});

describe("slotHasConflict — status exclusions", () => {
  it("a confirmed lesson blocks", () => {
    expect(slotHasConflict([lesson({ status: "confirmed" })], at(10), 60, NOW)).toBe(true);
  });
  it("cancelled / refunded / declined free the slot", () => {
    for (const status of ["cancelled", "refunded", "declined"]) {
      expect(slotHasConflict([lesson({ status })], at(10), 60, NOW)).toBe(false);
    }
  });
  it("cancel_pending frees the slot (always finalizes to cancelled)", () => {
    expect(slotHasConflict([lesson({ status: "cancel_pending" })], at(10), 60, NOW)).toBe(false);
  });
  it("decline_pending KEEPS blocking (can bounce back to payment_collected)", () => {
    expect(slotHasConflict([lesson({ status: "decline_pending" })], at(10), 60, NOW)).toBe(true);
  });
  it("payment_collected blocks", () => {
    expect(slotHasConflict([lesson({ status: "payment_collected" })], at(10), 60, NOW)).toBe(true);
  });
});

describe("slotHasConflict — checkout-hold expiry", () => {
  const base = { status: "pending_payment", scheduledAt: at(10) };

  it("a fresh unpaid hold (no session) blocks", () => {
    const l = lesson({ ...base, createdAt: new Date(NOW - 60_000), stripeCheckoutSessionId: null });
    expect(slotHasConflict([l], at(10), 60, NOW)).toBe(true);
  });
  it("an abandoned hold (no session, older than 15 min) frees the slot", () => {
    const l = lesson({ ...base, createdAt: new Date(NOW - PENDING_HOLD_MS - 1), stripeCheckoutSessionId: null });
    expect(slotHasConflict([l], at(10), 60, NOW)).toBe(false);
  });
  it("a mid-checkout hold (has session, 16 min old) STILL blocks — prevents double payment", () => {
    const l = lesson({ ...base, createdAt: new Date(NOW - 16 * 60_000), stripeCheckoutSessionId: "cs_live" });
    expect(slotHasConflict([l], at(10), 60, NOW)).toBe(true);
  });
  it("a stale checkout hold (has session, older than 24h) frees the slot", () => {
    const l = lesson({ ...base, createdAt: new Date(NOW - STRIPE_SESSION_MAX_MS - 1), stripeCheckoutSessionId: "cs_dead" });
    expect(slotHasConflict([l], at(10), 60, NOW)).toBe(false);
  });
});
