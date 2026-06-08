/**
 * autoReleasePayout.test.ts
 *
 * Sprint 33 behavioral tests for the autoReleasePayouts scheduler job.
 *
 * Tests:
 *   S33-1: Eligible completed lesson after issue window is paid out
 *   S33-2: Lesson inside issue window is not paid out
 *   S33-3: Disputed lesson is not auto-paid (skipped by getCompletedLessonsReadyForPayout)
 *   S33-4: Existing __pending_refund__ blocks payout
 *   S33-5: Stripe failure releases the payout slot and does not mark released
 *   S33-6: Multiple eligible lessons continue after one failure
 *   S33-7: Scheduler does nothing when AUTO_RELEASE_PAYOUTS_ENABLED is false
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mock db module ────────────────────────────────────────────────────────────
vi.mock("./db", () => ({
  getCompletedLessonsReadyForPayout: vi.fn(),
  getLessonById: vi.fn(),
  getUserById: vi.fn(),
  claimLessonPayoutSlot: vi.fn(),
  finalizeLessonPayout: vi.fn(),
  releaseLessonPayoutSlot: vi.fn(),
  getDb: vi.fn(),
}));

// ── Mock stripeConnect ────────────────────────────────────────────────────────
vi.mock("./stripeConnect", () => ({
  transferToCoach: vi.fn(),
}));

import * as db from "./db";
import { transferToCoach } from "./stripeConnect";
import { autoReleasePayouts } from "./reminderScheduler";

// ── Helper factories ──────────────────────────────────────────────────────────
const pastDate = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
const futureDate = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours from now

function makeLesson(overrides: Record<string, unknown> = {}) {
  return {
    id: 100,
    status: "completed",
    coachId: 10,
    studentId: 20,
    stripePaymentIntentId: "pi_test_123",
    stripeTransferId: null,
    issueWindowEndsAt: pastDate,
    coachPayoutCents: 8000,
    currency: "usd",
    amountCents: 10000,
    ...overrides,
  };
}

function makeCoach(overrides: Record<string, unknown> = {}) {
  return {
    id: 10,
    stripeConnectAccountId: "acct_coach123",
    ...overrides,
  };
}

// ── Setup / teardown ──────────────────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
  // Default: AUTO_RELEASE_PAYOUTS_ENABLED = true for most tests
  process.env.AUTO_RELEASE_PAYOUTS_ENABLED = "true";
});

afterEach(() => {
  delete process.env.AUTO_RELEASE_PAYOUTS_ENABLED;
});

// ── Tests ─────────────────────────────────────────────────────────────────────
describe("autoReleasePayouts", () => {
  it("S33-1: releases payout for eligible completed lesson after issue window", async () => {
    const lesson = makeLesson();
    vi.mocked(db.getCompletedLessonsReadyForPayout).mockResolvedValue([lesson] as any);
    vi.mocked(db.getLessonById).mockResolvedValue(lesson as any);
    vi.mocked(db.getUserById).mockResolvedValue(makeCoach() as any);
    vi.mocked(db.claimLessonPayoutSlot).mockResolvedValue(true);
    vi.mocked(transferToCoach).mockResolvedValue({ success: true, transferId: "tr_abc123" } as any);
    vi.mocked(db.finalizeLessonPayout).mockResolvedValue(undefined);

    await autoReleasePayouts();

    expect(db.claimLessonPayoutSlot).toHaveBeenCalledWith(100);
    expect(transferToCoach).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: "lesson_payout_100",
        amountCents: 8000,
      })
    );
    expect(db.finalizeLessonPayout).toHaveBeenCalledWith(100, "tr_abc123");
    expect(db.releaseLessonPayoutSlot).not.toHaveBeenCalled();
  });

  it("S33-2: does not pay out a lesson whose issue window has not yet expired", async () => {
    // getCompletedLessonsReadyForPayout should already filter these out,
    // but we also test the service-level guard via a lesson with a future window.
    const lesson = makeLesson({ issueWindowEndsAt: futureDate });
    vi.mocked(db.getCompletedLessonsReadyForPayout).mockResolvedValue([lesson] as any);
    vi.mocked(db.getLessonById).mockResolvedValue(lesson as any);
    vi.mocked(db.getUserById).mockResolvedValue(makeCoach() as any);

    await autoReleasePayouts();

    // The service-level issueWindowEndsAt check should block payout
    expect(db.claimLessonPayoutSlot).not.toHaveBeenCalled();
    expect(transferToCoach).not.toHaveBeenCalled();
  });

  it("S33-3: does not auto-pay disputed lessons (they are excluded by the query)", async () => {
    // getCompletedLessonsReadyForPayout returns only 'completed' lessons with expired windows.
    // A disputed lesson should never appear in this list.
    vi.mocked(db.getCompletedLessonsReadyForPayout).mockResolvedValue([]);

    await autoReleasePayouts();

    expect(transferToCoach).not.toHaveBeenCalled();
  });

  it("S33-4: __pending_refund__ blocks payout with conflict result", async () => {
    const lesson = makeLesson({ stripeTransferId: "__pending_refund__" });
    vi.mocked(db.getCompletedLessonsReadyForPayout).mockResolvedValue([lesson] as any);
    vi.mocked(db.getLessonById).mockResolvedValue(lesson as any);

    await autoReleasePayouts();

    // Should not attempt to claim or transfer
    expect(db.claimLessonPayoutSlot).not.toHaveBeenCalled();
    expect(transferToCoach).not.toHaveBeenCalled();
    expect(db.finalizeLessonPayout).not.toHaveBeenCalled();
  });

  it("S33-5: Stripe failure releases payout slot and does not mark lesson released", async () => {
    const lesson = makeLesson();
    vi.mocked(db.getCompletedLessonsReadyForPayout).mockResolvedValue([lesson] as any);
    vi.mocked(db.getLessonById).mockResolvedValue(lesson as any);
    vi.mocked(db.getUserById).mockResolvedValue(makeCoach() as any);
    vi.mocked(db.claimLessonPayoutSlot).mockResolvedValue(true);
    vi.mocked(transferToCoach).mockResolvedValue({ success: false, error: "Network error" } as any);
    vi.mocked(db.releaseLessonPayoutSlot).mockResolvedValue(undefined);

    await autoReleasePayouts();

    expect(db.releaseLessonPayoutSlot).toHaveBeenCalledWith(100);
    expect(db.finalizeLessonPayout).not.toHaveBeenCalled();
  });

  it("S33-6: continues processing remaining lessons after one Stripe failure", async () => {
    const lesson1 = makeLesson({ id: 101 });
    const lesson2 = makeLesson({ id: 102 });
    vi.mocked(db.getCompletedLessonsReadyForPayout).mockResolvedValue([lesson1, lesson2] as any);

    // lesson1: getLessonById returns lesson1, lesson2: getLessonById returns lesson2
    vi.mocked(db.getLessonById)
      .mockResolvedValueOnce(lesson1 as any)
      .mockResolvedValueOnce(lesson2 as any);
    vi.mocked(db.getUserById).mockResolvedValue(makeCoach() as any);
    vi.mocked(db.claimLessonPayoutSlot).mockResolvedValue(true);

    // lesson1 fails, lesson2 succeeds
    vi.mocked(transferToCoach)
      .mockResolvedValueOnce({ success: false, error: "Stripe down" } as any)
      .mockResolvedValueOnce({ success: true, transferId: "tr_lesson2" } as any);
    vi.mocked(db.releaseLessonPayoutSlot).mockResolvedValue(undefined);
    vi.mocked(db.finalizeLessonPayout).mockResolvedValue(undefined);

    await autoReleasePayouts();

    // Both lessons were attempted
    expect(db.claimLessonPayoutSlot).toHaveBeenCalledTimes(2);
    // lesson1 slot released, lesson2 finalized
    expect(db.releaseLessonPayoutSlot).toHaveBeenCalledWith(101);
    expect(db.finalizeLessonPayout).toHaveBeenCalledWith(102, "tr_lesson2");
  });

  it("S33-7: does nothing when AUTO_RELEASE_PAYOUTS_ENABLED is not set to true", async () => {
    process.env.AUTO_RELEASE_PAYOUTS_ENABLED = "false";

    await autoReleasePayouts();

    expect(db.getCompletedLessonsReadyForPayout).not.toHaveBeenCalled();
    expect(transferToCoach).not.toHaveBeenCalled();
  });
});
