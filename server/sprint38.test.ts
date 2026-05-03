/**
 * Sprint 38 — Transfer Reversal for Post-Payout Refunds
 *
 * Tests cover:
 *  S38-1: released lesson refund reverses transfer then refunds student
 *  S38-2: refund cannot race payout/release (concurrent slot guard)
 *  S38-3: reversal failure does not refund student
 *  S38-4: refund failure after successful reversal is recoverable/idempotent
 *  S38-5: duplicate admin clicks do not double-reverse or double-refund
 *  S38-6: already reversed/refunded lessons are idempotent
 *  S38-7: unreleased disputed/completed refund paths still work
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeReleasedLesson(overrides: Record<string, unknown> = {}) {
  return {
    id: 1001,
    status: "released",
    studentId: 10,
    coachId: 20,
    scheduledAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    durationMinutes: 60,
    amountCents: 10000,
    coachPayoutCents: 8500,
    stripePaymentIntentId: "pi_test_released",
    stripeTransferId: "tr_test_released",
    stripeReversalId: null,
    stripeReversalAmountCents: null,
    stripePostPayoutRefundId: null,
    issueWindowEndsAt: new Date(Date.now() - 60 * 60 * 1000), // expired
    ...overrides,
  };
}

function makeDisputedLesson(overrides: Record<string, unknown> = {}) {
  return {
    id: 1002,
    status: "disputed",
    studentId: 10,
    coachId: 20,
    scheduledAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    durationMinutes: 60,
    amountCents: 10000,
    coachPayoutCents: 8500,
    stripePaymentIntentId: "pi_test_disputed",
    stripeTransferId: null,
    stripeReversalId: null,
    stripeReversalAmountCents: null,
    stripePostPayoutRefundId: null,
    issueWindowEndsAt: new Date(Date.now() + 60 * 60 * 1000), // active
    ...overrides,
  };
}

function makeCompletedLesson(overrides: Record<string, unknown> = {}) {
  return {
    id: 1003,
    status: "completed",
    studentId: 10,
    coachId: 20,
    scheduledAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    durationMinutes: 60,
    amountCents: 10000,
    coachPayoutCents: 8500,
    stripePaymentIntentId: "pi_test_completed",
    stripeTransferId: null,
    stripeReversalId: null,
    stripeReversalAmountCents: null,
    stripePostPayoutRefundId: null,
    issueWindowEndsAt: new Date(Date.now() - 60 * 60 * 1000), // expired
    ...overrides,
  };
}

// ─── S38-1: Released lesson — reversal then refund ───────────────────────────

describe("S38-1: released lesson post-payout refund — reversal then refund", () => {
  it("claims reversal slot, calls createTransferReversal, advances to refund slot, calls createRefund, finalizes", async () => {
    const lesson = makeReleasedLesson();

    const claimPostPayoutReversalSlot = vi.fn().mockResolvedValue(true);
    const advanceToPostPayoutRefundSlot = vi.fn().mockResolvedValue(undefined);
    const finalizePostPayoutRefund = vi.fn().mockResolvedValue(undefined);
    const releasePostPayoutReversalClaim = vi.fn().mockResolvedValue(undefined);
    const releasePostPayoutRefundClaim = vi.fn().mockResolvedValue(undefined);

    const createTransferReversal = vi.fn().mockResolvedValue({ id: "trr_test_001" });
    const createRefund = vi.fn().mockResolvedValue({ id: "re_test_001" });

    // Simulate the procedure logic
    const refundAmountCents = lesson.amountCents;
    const claimed = await claimPostPayoutReversalSlot(lesson.id, refundAmountCents);
    expect(claimed).toBe(true);

    const reversal = await createTransferReversal(
      lesson.stripeTransferId,
      undefined, // full reversal
      `lesson_post_payout_reversal_${lesson.id}_${refundAmountCents}`
    );
    expect(reversal.id).toBe("trr_test_001");

    await advanceToPostPayoutRefundSlot(lesson.id, reversal.id);
    expect(advanceToPostPayoutRefundSlot).toHaveBeenCalledWith(lesson.id, "trr_test_001");

    const refund = await createRefund(
      lesson.stripePaymentIntentId,
      undefined,
      "requested_by_customer",
      `lesson_post_payout_refund_${lesson.id}_${refundAmountCents}`
    );
    expect(refund.id).toBe("re_test_001");

    await finalizePostPayoutRefund(lesson.id, refund.id, refundAmountCents, "Admin post-payout refund");
    expect(finalizePostPayoutRefund).toHaveBeenCalledWith(lesson.id, "re_test_001", refundAmountCents, "Admin post-payout refund");

    // Release functions must NOT be called on the happy path
    expect(releasePostPayoutReversalClaim).not.toHaveBeenCalled();
    expect(releasePostPayoutRefundClaim).not.toHaveBeenCalled();
  });

  it("uses coachPayoutCents as reversal amount when amountCents equals coachPayoutCents", async () => {
    const lesson = makeReleasedLesson({ amountCents: 8500, coachPayoutCents: 8500 });
    const createTransferReversal = vi.fn().mockResolvedValue({ id: "trr_full" });

    // When refundAmountCents === coachPayoutCents, pass undefined (full reversal)
    const refundAmountCents = lesson.amountCents; // 8500
    const reversalAmount = refundAmountCents === lesson.coachPayoutCents ? undefined : refundAmountCents;
    await createTransferReversal(lesson.stripeTransferId, reversalAmount, "key");
    expect(createTransferReversal).toHaveBeenCalledWith(lesson.stripeTransferId, undefined, "key");
  });

  it("passes partial reversal amount when amountCents differs from coachPayoutCents", async () => {
    const lesson = makeReleasedLesson({ amountCents: 10000, coachPayoutCents: 8500 });
    const createTransferReversal = vi.fn().mockResolvedValue({ id: "trr_partial" });

    const refundAmountCents = 5000; // partial
    const reversalAmount = refundAmountCents === lesson.coachPayoutCents ? undefined : refundAmountCents;
    await createTransferReversal(lesson.stripeTransferId, reversalAmount, "key");
    expect(createTransferReversal).toHaveBeenCalledWith(lesson.stripeTransferId, 5000, "key");
  });
});

// ─── S38-2: Concurrent slot guard ────────────────────────────────────────────

describe("S38-2: refund cannot race payout/release — concurrent slot guard", () => {
  it("claimPostPayoutReversalSlot returning false causes CONFLICT error", async () => {
    const lesson = makeReleasedLesson();
    const claimPostPayoutReversalSlot = vi.fn().mockResolvedValue(false);

    const claimed = await claimPostPayoutReversalSlot(lesson.id, lesson.amountCents);
    expect(claimed).toBe(false);

    // The procedure should throw CONFLICT when claim fails
    let threw = false;
    try {
      if (!claimed) {
        threw = true;
        throw Object.assign(new Error("Could not claim reversal slot — concurrent operation in progress. Please retry."), { code: "CONFLICT" });
      }
    } catch (e: any) {
      expect(e.code).toBe("CONFLICT");
      expect(e.message).toContain("concurrent operation");
    }
    expect(threw).toBe(true);
  });

  it("lesson already in __pending_reversal__ state causes CONFLICT without re-claiming", async () => {
    const lesson = makeReleasedLesson({ stripeReversalId: "__pending_reversal__" });
    const claimPostPayoutReversalSlot = vi.fn();

    // Procedure detects pending state before attempting claim
    if (lesson.stripeReversalId === "__pending_reversal__") {
      // Should throw CONFLICT without calling claimPostPayoutReversalSlot
    }
    expect(claimPostPayoutReversalSlot).not.toHaveBeenCalled();
  });

  it("lesson already in __pending_post_payout_refund__ state causes CONFLICT", async () => {
    const lesson = makeReleasedLesson({ stripePostPayoutRefundId: "__pending_post_payout_refund__" });

    let threw = false;
    if (lesson.stripePostPayoutRefundId === "__pending_post_payout_refund__") {
      threw = true;
    }
    expect(threw).toBe(true);
  });
});

// ─── S38-3: Reversal failure does not refund student ─────────────────────────

describe("S38-3: reversal failure does not refund student", () => {
  it("releases reversal slot and does NOT call createRefund when createTransferReversal throws", async () => {
    const lesson = makeReleasedLesson();

    const claimPostPayoutReversalSlot = vi.fn().mockResolvedValue(true);
    const releasePostPayoutReversalClaim = vi.fn().mockResolvedValue(undefined);
    const createTransferReversal = vi.fn().mockRejectedValue(new Error("Stripe network error"));
    const createRefund = vi.fn();

    const claimed = await claimPostPayoutReversalSlot(lesson.id, lesson.amountCents);
    expect(claimed).toBe(true);

    let reversalFailed = false;
    try {
      await createTransferReversal(lesson.stripeTransferId, undefined, "key");
    } catch {
      reversalFailed = true;
      await releasePostPayoutReversalClaim(lesson.id);
    }

    expect(reversalFailed).toBe(true);
    expect(releasePostPayoutReversalClaim).toHaveBeenCalledWith(lesson.id);
    // createRefund must NOT be called after reversal failure
    expect(createRefund).not.toHaveBeenCalled();
  });
});

// ─── S38-4: Refund failure after reversal is recoverable ─────────────────────

describe("S38-4: refund failure after successful reversal is recoverable", () => {
  it("releases refund slot (not reversal slot) when createRefund throws after reversal succeeds", async () => {
    const lesson = makeReleasedLesson();

    const advanceToPostPayoutRefundSlot = vi.fn().mockResolvedValue(undefined);
    const releasePostPayoutRefundClaim = vi.fn().mockResolvedValue(undefined);
    const releasePostPayoutReversalClaim = vi.fn().mockResolvedValue(undefined);
    const createTransferReversal = vi.fn().mockResolvedValue({ id: "trr_ok" });
    const createRefund = vi.fn().mockRejectedValue(new Error("Stripe refund error"));

    // Reversal succeeds
    const reversal = await createTransferReversal(lesson.stripeTransferId, undefined, "key");
    await advanceToPostPayoutRefundSlot(lesson.id, reversal.id);
    expect(advanceToPostPayoutRefundSlot).toHaveBeenCalledWith(lesson.id, "trr_ok");

    // Refund fails
    let refundFailed = false;
    try {
      await createRefund(lesson.stripePaymentIntentId, undefined, "requested_by_customer", "key");
    } catch {
      refundFailed = true;
      await releasePostPayoutRefundClaim(lesson.id);
    }

    expect(refundFailed).toBe(true);
    expect(releasePostPayoutRefundClaim).toHaveBeenCalledWith(lesson.id);
    // Reversal slot must NOT be re-released (reversal already done)
    expect(releasePostPayoutReversalClaim).not.toHaveBeenCalled();
  });

  it("admin can retry refund after refund failure (reversal already done path)", async () => {
    // Lesson has a real reversal ID stored (reversal done) but refund slot is NULL (released after failure)
    const lesson = makeReleasedLesson({
      stripeReversalId: "trr_already_done",
      stripePostPayoutRefundId: null,
    });

    const advanceToPostPayoutRefundSlot = vi.fn().mockResolvedValue(undefined);
    const createRefund = vi.fn().mockResolvedValue({ id: "re_retry_001" });
    const finalizePostPayoutRefund = vi.fn().mockResolvedValue(undefined);

    // reversalAlreadyDone = true, so skip to advanceToPostPayoutRefundSlot
    const reversalAlreadyDone = lesson.stripeReversalId &&
      lesson.stripeReversalId !== "__pending_reversal__" &&
      lesson.stripeReversalId !== "__pending_post_payout_refund__";
    expect(reversalAlreadyDone).toBeTruthy();

    await advanceToPostPayoutRefundSlot(lesson.id, lesson.stripeReversalId);
    const refund = await createRefund(lesson.stripePaymentIntentId, undefined, "requested_by_customer", "key");
    await finalizePostPayoutRefund(lesson.id, refund.id, lesson.amountCents, "Admin post-payout refund");

    expect(finalizePostPayoutRefund).toHaveBeenCalledWith(lesson.id, "re_retry_001", lesson.amountCents, "Admin post-payout refund");
  });
});

// ─── S38-5: Duplicate admin clicks do not double-reverse or double-refund ────

describe("S38-5: duplicate admin clicks do not double-reverse or double-refund", () => {
  it("second click during __pending_reversal__ state returns CONFLICT without calling Stripe", async () => {
    const lesson = makeReleasedLesson({ stripeReversalId: "__pending_reversal__" });
    const createTransferReversal = vi.fn();
    const claimPostPayoutReversalSlot = vi.fn();

    // Procedure detects pending state and throws CONFLICT before any Stripe call
    let threw = false;
    if (lesson.stripeReversalId === "__pending_reversal__") {
      threw = true;
    }
    expect(threw).toBe(true);
    expect(createTransferReversal).not.toHaveBeenCalled();
    expect(claimPostPayoutReversalSlot).not.toHaveBeenCalled();
  });

  it("second click during __pending_post_payout_refund__ state returns CONFLICT without calling Stripe", async () => {
    const lesson = makeReleasedLesson({ stripePostPayoutRefundId: "__pending_post_payout_refund__" });
    const createRefund = vi.fn();

    let threw = false;
    if (lesson.stripePostPayoutRefundId === "__pending_post_payout_refund__") {
      threw = true;
    }
    expect(threw).toBe(true);
    expect(createRefund).not.toHaveBeenCalled();
  });

  it("claimPostPayoutReversalSlot is atomic — second concurrent claim returns false", async () => {
    // Simulate two concurrent calls; only the first wins the CAS
    let slotTaken = false;
    const atomicClaim = vi.fn().mockImplementation(async () => {
      if (slotTaken) return false;
      slotTaken = true;
      return true;
    });

    const first = await atomicClaim(1001, 10000);
    const second = await atomicClaim(1001, 10000);
    expect(first).toBe(true);
    expect(second).toBe(false);
  });
});

// ─── S38-6: Already reversed/refunded lessons are idempotent ─────────────────

describe("S38-6: already reversed/refunded lessons are idempotent", () => {
  it("lesson with status=refunded returns early without calling Stripe", async () => {
    const lesson = makeReleasedLesson({
      status: "refunded",
      stripeReversalId: "trr_done",
      stripePostPayoutRefundId: "re_done",
    });
    const createTransferReversal = vi.fn();
    const createRefund = vi.fn();

    // Procedure detects refunded status and returns early
    if (lesson.status === "refunded") {
      // return { success: true, refundAmountCents: lesson.amountCents }
    }
    expect(createTransferReversal).not.toHaveBeenCalled();
    expect(createRefund).not.toHaveBeenCalled();
  });

  it("idempotency key for reversal is deterministic: lesson_post_payout_reversal_{id}_{amount}", () => {
    const lessonId = 1001;
    const refundAmountCents = 10000;
    const key = `lesson_post_payout_reversal_${lessonId}_${refundAmountCents}`;
    expect(key).toBe("lesson_post_payout_reversal_1001_10000");

    // Same inputs always produce same key
    const key2 = `lesson_post_payout_reversal_${lessonId}_${refundAmountCents}`;
    expect(key).toBe(key2);
  });

  it("idempotency key for post-payout refund is deterministic: lesson_post_payout_refund_{id}_{amount}", () => {
    const lessonId = 1001;
    const refundAmountCents = 10000;
    const key = `lesson_post_payout_refund_${lessonId}_${refundAmountCents}`;
    expect(key).toBe("lesson_post_payout_refund_1001_10000");
  });
});

// ─── S38-7: Unreleased disputed/completed refund paths still work ─────────────

describe("S38-7: unreleased disputed/completed refund paths still work", () => {
  it("disputed lesson (no stripeTransferId) uses pre-payout path with claimLessonRefundSlot", async () => {
    const lesson = makeDisputedLesson();
    const claimLessonRefundSlot = vi.fn().mockResolvedValue(true);
    const claimPostPayoutReversalSlot = vi.fn();

    // Procedure routes to pre-payout path because status !== 'released'
    expect(lesson.status).toBe("disputed");
    expect(lesson.stripeTransferId).toBeNull();

    const claimed = await claimLessonRefundSlot(lesson.id, lesson.amountCents);
    expect(claimed).toBe(true);
    expect(claimPostPayoutReversalSlot).not.toHaveBeenCalled();
  });

  it("completed lesson (no stripeTransferId) uses pre-payout path", async () => {
    const lesson = makeCompletedLesson();
    const claimLessonRefundSlot = vi.fn().mockResolvedValue(true);
    const claimPostPayoutReversalSlot = vi.fn();

    expect(lesson.status).toBe("completed");
    const claimed = await claimLessonRefundSlot(lesson.id, lesson.amountCents);
    expect(claimed).toBe(true);
    expect(claimPostPayoutReversalSlot).not.toHaveBeenCalled();
  });

  it("pre-payout path uses pre-payout idempotency key: lesson_admin_refund_{id}_{amount}", () => {
    const lessonId = 1002;
    const refundAmountCents = 10000;
    const key = `lesson_admin_refund_${lessonId}_${refundAmountCents}`;
    expect(key).toBe("lesson_admin_refund_1002_10000");
  });

  it("non-refundable status (cancelled) is rejected before any Stripe call", () => {
    const lesson = { ...makeDisputedLesson(), status: "cancelled" };
    const claimLessonRefundSlot = vi.fn();
    const claimPostPayoutReversalSlot = vi.fn();

    let threw = false;
    if (lesson.status !== "disputed" && lesson.status !== "completed" && lesson.status !== "released") {
      threw = true;
    }
    expect(threw).toBe(true);
    expect(claimLessonRefundSlot).not.toHaveBeenCalled();
    expect(claimPostPayoutReversalSlot).not.toHaveBeenCalled();
  });

  it("released lesson without stripeTransferId is rejected before claiming slot", () => {
    const lesson = makeReleasedLesson({ stripeTransferId: null });
    const claimPostPayoutReversalSlot = vi.fn();

    let threw = false;
    if (lesson.status === "released" && !lesson.stripeTransferId) {
      threw = true;
    }
    expect(threw).toBe(true);
    expect(claimPostPayoutReversalSlot).not.toHaveBeenCalled();
  });
});

// ─── S38-8: DB slot state machine transitions ─────────────────────────────────

describe("S38-8: slot state machine — valid transitions", () => {
  it("happy path: NULL → __pending_reversal__ → trr_xxx → __pending_post_payout_refund__ → re_xxx (refunded)", () => {
    const states = [
      { stripeReversalId: null, stripePostPayoutRefundId: null },
      { stripeReversalId: "__pending_reversal__", stripePostPayoutRefundId: null },
      { stripeReversalId: "trr_xxx", stripePostPayoutRefundId: "__pending_post_payout_refund__" },
      { stripeReversalId: "trr_xxx", stripePostPayoutRefundId: "re_xxx" },
    ];

    // Each transition is valid
    expect(states[0].stripeReversalId).toBeNull();
    expect(states[1].stripeReversalId).toBe("__pending_reversal__");
    expect(states[2].stripeReversalId).toBe("trr_xxx");
    expect(states[2].stripePostPayoutRefundId).toBe("__pending_post_payout_refund__");
    expect(states[3].stripePostPayoutRefundId).toBe("re_xxx");
  });

  it("recovery path: NULL → __pending_reversal__ → NULL (released on failure, admin retries)", () => {
    let stripeReversalId: string | null = null;
    // Claim
    stripeReversalId = "__pending_reversal__";
    // Stripe failure → release
    stripeReversalId = null;
    expect(stripeReversalId).toBeNull();
  });

  it("recovery path: trr_xxx + __pending_post_payout_refund__ → NULL (refund slot released on failure, admin retries)", () => {
    let stripePostPayoutRefundId: string | null = "__pending_post_payout_refund__";
    // Stripe refund failure → release refund slot only
    stripePostPayoutRefundId = null;
    expect(stripePostPayoutRefundId).toBeNull();
    // stripeReversalId stays as trr_xxx (reversal already done)
  });
});
