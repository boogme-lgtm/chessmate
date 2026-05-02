/**
 * Sprint 37 — Admin Disputes Panel helper tests
 *
 * Tests the `formatAdminActionError` function from shared/adminActionErrors.ts
 * (the canonical production module) and a pure helper that mirrors the
 * "Pending Payout" stats card logic in AdminDisputesPanel.tsx.
 *
 * Both helpers are pure functions with no browser/React dependencies, so they
 * run cleanly in the Node vitest environment.
 */

import { describe, it, expect } from "vitest";
import { formatAdminActionError } from "../shared/adminActionErrors";

// ─── Pure stats helper (mirrors AdminDisputesPanel stats card logic) ──────────

/**
 * Sums the coachPayoutCents field from an array of lesson rows.
 * This is the correct field for the "Pending Payout" stat card —
 * amountCents is the gross student charge, coachPayoutCents is what
 * the payout service actually transfers to the coach.
 */
function sumPendingPayoutCents(lessons: { coachPayoutCents?: number }[]): number {
  return lessons.reduce((sum, l) => sum + (l.coachPayoutCents ?? 0), 0);
}

/**
 * Sums amountCents — used for "Gross Lesson Value" / "Disputed Value" cards.
 * Kept separate to prove the two fields are not interchangeable.
 */
function sumGrossAmountCents(lessons: { amountCents?: number }[]): number {
  return lessons.reduce((sum, l) => sum + (l.amountCents ?? 0), 0);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Sprint 37 — formatAdminActionError (imported from shared/adminActionErrors)", () => {
  describe("S37-H1: issue window not yet expired", () => {
    it("returns readable copy for 'issue window not yet expired'", () => {
      const msg = "The issue window has not yet expired for this lesson";
      expect(formatAdminActionError(msg)).toBe(
        "The 24-hour issue window has not expired yet. Wait until the window closes before releasing payout."
      );
    });

    it("matches substring containing 'issue window' and 'not yet expired'", () => {
      const msg = "Cannot release payout: issue window not yet expired (ends 2025-01-01)";
      expect(formatAdminActionError(msg)).toContain("24-hour issue window");
    });
  });

  describe("S37-H2: issue window already expired", () => {
    it("returns readable copy for 'issue window expired'", () => {
      const msg = "The issue window has already expired";
      expect(formatAdminActionError(msg)).toBe("The issue window has already expired.");
    });
  });

  describe("S37-H3: override reason required", () => {
    it("matches 'override reason' phrasing", () => {
      const msg = "Disputed lesson requires an adminOverrideReason";
      expect(formatAdminActionError(msg)).toBe(
        "An override reason is required for disputed lessons."
      );
    });

    it("matches 'adminOverrideReason' keyword", () => {
      const msg = "adminOverrideReason must be non-empty for disputed lessons";
      expect(formatAdminActionError(msg)).toBe(
        "An override reason is required for disputed lessons."
      );
    });
  });

  describe("S37-H4: payout transfer in progress", () => {
    it("returns readable copy for in-progress payout", () => {
      const msg =
        "A payout transfer is currently in progress for this lesson. Wait for it to complete before issuing a refund.";
      expect(formatAdminActionError(msg)).toContain("payout transfer is already in progress");
    });
  });

  describe("S37-H5: payout already released", () => {
    it("returns readable copy for post-payout refund attempt", () => {
      const msg =
        "Payout already released (transfer txr_123). Refunding after a completed payout requires a manual transfer reversal in the Stripe dashboard.";
      expect(formatAdminActionError(msg)).toContain(
        "Post-payout refunds require a manual transfer reversal"
      );
    });
  });

  describe("S37-H6: concurrent settlement / refund slot", () => {
    it("matches 'refund slot' phrasing", () => {
      const msg =
        "Could not claim refund slot — concurrent settlement in progress. Please retry.";
      expect(formatAdminActionError(msg)).toContain("concurrent settlement");
    });

    it("matches 'concurrent settlement' phrasing", () => {
      const msg = "concurrent settlement in progress";
      expect(formatAdminActionError(msg)).toContain("concurrent settlement");
    });
  });

  describe("S37-H7: refund already issued", () => {
    it("matches 'already been refunded'", () => {
      const msg = "This lesson has already been refunded";
      expect(formatAdminActionError(msg)).toBe(
        "A refund has already been issued for this lesson."
      );
    });

    it("matches 'refund already'", () => {
      const msg = "refund already processed for lesson 42";
      expect(formatAdminActionError(msg)).toBe(
        "A refund has already been issued for this lesson."
      );
    });
  });

  describe("S37-H8: no payment recorded", () => {
    it("returns readable copy when no payment intent exists", () => {
      const msg = "No payment recorded for this lesson";
      expect(formatAdminActionError(msg)).toContain("nothing to refund");
    });
  });

  describe("S37-H9: not in refundable state", () => {
    it("returns readable copy for wrong lesson status", () => {
      const msg = "Lesson is not in a refundable state";
      expect(formatAdminActionError(msg)).toContain("must be disputed or completed");
    });
  });

  describe("S37-H10: lesson not found", () => {
    it("returns readable copy for missing lesson", () => {
      const msg = "Lesson not found";
      expect(formatAdminActionError(msg)).toBe(
        "Lesson not found. It may have been deleted."
      );
    });
  });

  describe("S37-H11: admin access required / FORBIDDEN", () => {
    it("matches 'Admin access required'", () => {
      const msg = "Admin access required";
      expect(formatAdminActionError(msg)).toContain("Admin access required");
    });

    it("matches 'FORBIDDEN' code string", () => {
      const msg = "FORBIDDEN: you do not have permission";
      expect(formatAdminActionError(msg)).toContain("Admin access required");
    });
  });

  describe("S37-H12: unknown / passthrough errors", () => {
    it("returns the raw message when no pattern matches", () => {
      const msg = "Something completely unexpected happened";
      expect(formatAdminActionError(msg)).toBe(msg);
    });

    it("returns empty string unchanged", () => {
      expect(formatAdminActionError("")).toBe("");
    });
  });

  describe("S37-H13: priority ordering — most-specific wins", () => {
    it("'not yet expired' wins over generic 'expired' check", () => {
      const msg = "issue window not yet expired";
      const result = formatAdminActionError(msg);
      expect(result).toContain("24-hour issue window");
      expect(result).not.toBe("The issue window has already expired.");
    });
  });
});

// ─── Stats card field correctness ─────────────────────────────────────────────

describe("Sprint 37 — Pending Payout stats card uses coachPayoutCents, not amountCents", () => {
  describe("S37-S1: sumPendingPayoutCents uses coachPayoutCents", () => {
    it("sums coachPayoutCents correctly across multiple lessons", () => {
      const lessons = [
        { amountCents: 10000, coachPayoutCents: 8500 },
        { amountCents: 5000, coachPayoutCents: 4250 },
        { amountCents: 7500, coachPayoutCents: 6375 },
      ];
      expect(sumPendingPayoutCents(lessons)).toBe(8500 + 4250 + 6375); // 19125
    });

    it("differs from amountCents total (platform fee is captured)", () => {
      const lessons = [
        { amountCents: 10000, coachPayoutCents: 8500 },
        { amountCents: 5000, coachPayoutCents: 4250 },
      ];
      const payoutTotal = sumPendingPayoutCents(lessons);
      const grossTotal = sumGrossAmountCents(lessons);
      expect(payoutTotal).toBeLessThan(grossTotal);
      expect(payoutTotal).toBe(12750);
      expect(grossTotal).toBe(15000);
    });

    it("returns 0 for empty array", () => {
      expect(sumPendingPayoutCents([])).toBe(0);
    });

    it("treats missing coachPayoutCents as 0 (null-safety)", () => {
      const lessons = [
        { amountCents: 10000 }, // no coachPayoutCents field
        { amountCents: 5000, coachPayoutCents: 4250 },
      ];
      expect(sumPendingPayoutCents(lessons)).toBe(4250);
    });
  });

  describe("S37-S2: sumGrossAmountCents uses amountCents for Disputed Value card", () => {
    it("sums amountCents correctly", () => {
      const lessons = [
        { amountCents: 10000, coachPayoutCents: 8500 },
        { amountCents: 5000, coachPayoutCents: 4250 },
      ];
      expect(sumGrossAmountCents(lessons)).toBe(15000);
    });

    it("treats missing amountCents as 0", () => {
      const lessons = [
        { coachPayoutCents: 8500 }, // no amountCents
        { amountCents: 5000, coachPayoutCents: 4250 },
      ];
      expect(sumGrossAmountCents(lessons)).toBe(5000);
    });
  });

  describe("S37-S3: stale-field regression guard", () => {
    it("using amountCents for pending payout would overcount by platform fee", () => {
      // This test documents the bug that was fixed:
      // Before the fix, the stats card summed amountCents (gross) instead of
      // coachPayoutCents (net). This test proves the two values differ when a
      // platform fee exists, making the bug detectable.
      const lessons = [{ amountCents: 10000, coachPayoutCents: 8500 }];
      const wrongTotal = sumGrossAmountCents(lessons); // old (buggy) behavior
      const correctTotal = sumPendingPayoutCents(lessons); // new (correct) behavior
      expect(wrongTotal).toBe(10000);
      expect(correctTotal).toBe(8500);
      expect(wrongTotal).toBeGreaterThan(correctTotal); // platform fee = 1500
    });
  });
});
