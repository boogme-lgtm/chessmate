/**
 * Sprint 37 — Admin Disputes Panel helper tests
 *
 * Tests the `formatAdminActionError` function from shared/adminActionErrors.ts
 * (the canonical production module) and a pure helper that mirrors the
 * "Pending Payout" stats card logic in AdminDisputesPanel.tsx.
 *
 * All backend error strings are taken verbatim from:
 *   - server/payoutService.ts  (reason: "…")
 *   - server/routers.ts        (TRPCError message: "…")
 */

import { describe, it, expect } from "vitest";
import { formatAdminActionError } from "../shared/adminActionErrors";

// ─── Pure stats helpers (mirrors AdminDisputesPanel stats card logic) ─────────

function sumPendingPayoutCents(lessons: { coachPayoutCents?: number }[]): number {
  return lessons.reduce((sum, l) => sum + (l.coachPayoutCents ?? 0), 0);
}

function sumGrossAmountCents(lessons: { amountCents?: number }[]): number {
  return lessons.reduce((sum, l) => sum + (l.amountCents ?? 0), 0);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Sprint 37 — formatAdminActionError (exact backend strings)", () => {

  // ── Issue window: exact payoutService string ──────────────────────────────
  describe("S37-E1: issue window not expired yet (exact payoutService message)", () => {
    it("matches exact payoutService string with ISO timestamp", () => {
      const msg = "Issue window has not expired yet. Payout available after 2026-05-03T12:00:00.000Z.";
      const result = formatAdminActionError(msg);
      expect(result).toBe(
        "The 24-hour issue window has not expired yet. Wait until the window closes before releasing payout."
      );
    });

    it("matches 'not yet expired' word order (alternative phrasing)", () => {
      const msg = "The issue window has not yet expired for this lesson";
      expect(formatAdminActionError(msg)).toBe(
        "The 24-hour issue window has not expired yet. Wait until the window closes before releasing payout."
      );
    });

    it("does NOT match the generic 'expired' branch", () => {
      const msg = "Issue window has not expired yet. Payout available after 2026-05-03T12:00:00.000Z.";
      expect(formatAdminActionError(msg)).not.toBe("The issue window has already expired.");
    });
  });

  // ── No issue window set ───────────────────────────────────────────────────
  describe("S37-E2: no issue window set (exact payoutService message)", () => {
    it("matches exact payoutService string", () => {
      const msg = "Lesson has no issue window set — cannot safely release payout";
      const result = formatAdminActionError(msg);
      expect(result).toContain("no issue window recorded");
    });

    it("returns copy that does not say 'payout released'", () => {
      const msg = "Lesson has no issue window set — cannot safely release payout";
      expect(formatAdminActionError(msg)).not.toContain("has been released");
    });
  });

  // ── Payout already in progress ────────────────────────────────────────────
  describe("S37-E3: payout already in progress (exact payoutService message)", () => {
    it("matches exact payoutService string", () => {
      const msg = "Payout is already in progress. Please try again in a moment.";
      const result = formatAdminActionError(msg);
      expect(result).toContain("already in progress");
    });
  });

  // ── Refund in progress (blocks payout) ───────────────────────────────────
  describe("S37-E4: refund in progress blocking payout (exact routers.ts message)", () => {
    it("matches exact routers.ts string", () => {
      const msg = "A refund is currently in progress for this lesson. Payout cannot proceed until the refund is resolved.";
      const result = formatAdminActionError(msg);
      expect(result).toContain("refund is currently in progress");
    });
  });

  // ── Payout transfer in progress (blocks refund) ───────────────────────────
  describe("S37-E5: payout transfer in progress blocking refund (exact routers.ts message)", () => {
    it("matches exact routers.ts string", () => {
      const msg = "A payout transfer is currently in progress for this lesson. Wait for it to complete before issuing a refund.";
      const result = formatAdminActionError(msg);
      expect(result).toContain("payout transfer is already in progress");
    });
  });

  // ── Payout already released ───────────────────────────────────────────────
  describe("S37-E6: payout already released (exact routers.ts message)", () => {
    it("matches exact routers.ts string with transfer ID", () => {
      const msg = "Payout already released (transfer txr_abc123). Refunding after a completed payout requires a manual transfer reversal in the Stripe dashboard.";
      const result = formatAdminActionError(msg);
      expect(result).toContain("Post-payout refunds require a manual transfer reversal");
    });
  });

  // ── Payout already claimed (concurrent) ──────────────────────────────────
  describe("S37-E7: payout already claimed by concurrent request (exact payoutService message)", () => {
    it("matches exact payoutService string", () => {
      const msg = "Payout already claimed by a concurrent request.";
      const result = formatAdminActionError(msg);
      expect(result).toContain("concurrent request");
    });
  });

  // ── Concurrent settlement / refund slot ──────────────────────────────────
  describe("S37-E8: concurrent settlement (exact routers.ts message)", () => {
    it("matches exact routers.ts string", () => {
      const msg = "Could not claim refund slot — concurrent settlement in progress. Please retry.";
      const result = formatAdminActionError(msg);
      expect(result).toContain("concurrent settlement");
    });
  });

  // ── Override reason required ──────────────────────────────────────────────
  describe("S37-E9: override reason required (exact payoutService message)", () => {
    it("matches exact payoutService string", () => {
      const msg = "Admin override reason is required for disputed lessons";
      const result = formatAdminActionError(msg);
      expect(result).toBe("An override reason is required for disputed lessons.");
    });
  });

  // ── No payment recorded ───────────────────────────────────────────────────
  describe("S37-E10: no payment recorded (exact payoutService message)", () => {
    it("matches exact payoutService string", () => {
      const msg = "No payment recorded for this lesson";
      const result = formatAdminActionError(msg);
      expect(result).toContain("nothing to refund");
    });
  });

  // ── Not in payable state ──────────────────────────────────────────────────
  describe("S37-E11: not in payable state (exact payoutService message)", () => {
    it("matches exact payoutService string with status", () => {
      const msg = "Lesson is not in a payable state (status: cancelled)";
      const result = formatAdminActionError(msg);
      expect(result).toContain("not in a payable state");
    });
  });

  // ── Not in refundable state ───────────────────────────────────────────────
  describe("S37-E12: not in refundable state (exact routers.ts message)", () => {
    it("matches exact routers.ts string", () => {
      const msg = "Lesson is not in a refundable state";
      const result = formatAdminActionError(msg);
      expect(result).toContain("must be disputed or completed");
    });
  });

  // ── Lesson not found ──────────────────────────────────────────────────────
  describe("S37-E13: lesson not found", () => {
    it("matches exact string", () => {
      const msg = "Lesson not found";
      expect(formatAdminActionError(msg)).toBe("Lesson not found. It may have been deleted.");
    });
  });

  // ── Admin access required ─────────────────────────────────────────────────
  describe("S37-E14: admin access required / FORBIDDEN", () => {
    it("matches 'Admin access required'", () => {
      const msg = "Admin access required";
      expect(formatAdminActionError(msg)).toContain("Admin access required");
    });

    it("matches 'FORBIDDEN' code string", () => {
      const msg = "FORBIDDEN: you do not have permission";
      expect(formatAdminActionError(msg)).toContain("Admin access required");
    });
  });

  // ── Passthrough / fallback ────────────────────────────────────────────────
  describe("S37-E15: unknown / passthrough errors", () => {
    it("returns the raw message when no pattern matches", () => {
      const msg = "Something completely unexpected happened";
      expect(formatAdminActionError(msg)).toBe(msg);
    });

    it("returns empty string unchanged", () => {
      expect(formatAdminActionError("")).toBe("");
    });
  });

  // ── Priority ordering ─────────────────────────────────────────────────────
  describe("S37-E16: priority ordering — most-specific wins", () => {
    it("'not expired yet' wins over generic 'expired' check", () => {
      const msg = "Issue window has not expired yet. Payout available after 2026-01-01T00:00:00.000Z.";
      const result = formatAdminActionError(msg);
      expect(result).toContain("24-hour issue window");
      expect(result).not.toBe("The issue window has already expired.");
    });

    it("'refund is currently in progress' wins over generic 'in progress'", () => {
      const msg = "A refund is currently in progress for this lesson. Payout cannot proceed until the refund is resolved.";
      const result = formatAdminActionError(msg);
      expect(result).toContain("refund is currently in progress");
      // Must NOT match the payout-in-progress branch
      expect(result).not.toContain("payout transfer is already in progress");
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
      expect(sumPendingPayoutCents(lessons)).toBe(8500 + 4250 + 6375);
    });

    it("differs from amountCents total (platform fee is captured)", () => {
      const lessons = [
        { amountCents: 10000, coachPayoutCents: 8500 },
        { amountCents: 5000, coachPayoutCents: 4250 },
      ];
      expect(sumPendingPayoutCents(lessons)).toBeLessThan(sumGrossAmountCents(lessons));
      expect(sumPendingPayoutCents(lessons)).toBe(12750);
      expect(sumGrossAmountCents(lessons)).toBe(15000);
    });

    it("returns 0 for empty array", () => {
      expect(sumPendingPayoutCents([])).toBe(0);
    });

    it("treats missing coachPayoutCents as 0 (null-safety)", () => {
      const lessons = [
        { amountCents: 10000 },
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
        { coachPayoutCents: 8500 },
        { amountCents: 5000, coachPayoutCents: 4250 },
      ];
      expect(sumGrossAmountCents(lessons)).toBe(5000);
    });
  });

  describe("S37-S3: stale-field regression guard", () => {
    it("using amountCents for pending payout would overcount by platform fee", () => {
      const lessons = [{ amountCents: 10000, coachPayoutCents: 8500 }];
      const wrongTotal = sumGrossAmountCents(lessons);
      const correctTotal = sumPendingPayoutCents(lessons);
      expect(wrongTotal).toBe(10000);
      expect(correctTotal).toBe(8500);
      expect(wrongTotal).toBeGreaterThan(correctTotal);
    });
  });
});
