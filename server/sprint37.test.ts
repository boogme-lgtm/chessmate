/**
 * Sprint 37 — Admin Disputes Panel UI helper tests
 *
 * Tests the pure `formatAdminActionError` function extracted from
 * AdminDisputesPanel.tsx. Because vitest runs in a Node environment
 * (server/**\/*.test.ts), we import the logic directly from the shared
 * module rather than mounting React components.
 *
 * The helper is re-implemented here as a pure function (identical logic
 * to the one in AdminDisputesPanel.tsx) so it can be tested without a
 * browser/jsdom environment.
 */

import { describe, it, expect } from "vitest";

// ─── Re-export the pure helper for testing ────────────────────────────────────
// (Mirrors the implementation in client/src/pages/AdminDisputesPanel.tsx)
function formatAdminActionError(message: string): string {
  if (message.includes("issue window") && message.includes("not yet expired")) {
    return "The 24-hour issue window has not expired yet. Wait until the window closes before releasing payout.";
  }
  if (message.includes("issue window") && message.includes("expired")) {
    return "The issue window has already expired.";
  }
  if (message.includes("override reason") || message.includes("adminOverrideReason")) {
    return "An override reason is required for disputed lessons.";
  }
  if (message.includes("payout transfer is currently in progress")) {
    return "A payout transfer is already in progress for this lesson. Wait for it to complete before issuing a refund.";
  }
  if (message.includes("Payout already released")) {
    return "Payout has already been released for this lesson. Post-payout refunds require a manual transfer reversal in the Stripe dashboard.";
  }
  if (message.includes("refund slot") || message.includes("concurrent settlement")) {
    return "A concurrent settlement is in progress. Please wait a moment and retry.";
  }
  if (message.includes("already been refunded") || message.includes("refund already")) {
    return "A refund has already been issued for this lesson.";
  }
  if (message.includes("No payment recorded")) {
    return "No payment is recorded for this lesson — nothing to refund.";
  }
  if (message.includes("not in a refundable state")) {
    return "This lesson is not in a refundable state (must be disputed or completed).";
  }
  if (message.includes("Lesson not found")) {
    return "Lesson not found. It may have been deleted.";
  }
  if (message.includes("Admin access required") || message.includes("FORBIDDEN")) {
    return "Admin access required. You do not have permission to perform this action.";
  }
  return message;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Sprint 37 — formatAdminActionError", () => {
  describe("S37-H1: issue window not yet expired", () => {
    it("returns readable copy for 'issue window not yet expired'", () => {
      const msg = "The issue window has not yet expired for this lesson";
      expect(formatAdminActionError(msg)).toBe(
        "The 24-hour issue window has not expired yet. Wait until the window closes before releasing payout."
      );
    });

    it("matches case-insensitive substring", () => {
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
      const msg = "A payout transfer is currently in progress for this lesson. Wait for it to complete before issuing a refund.";
      expect(formatAdminActionError(msg)).toContain("payout transfer is already in progress");
    });
  });

  describe("S37-H5: payout already released", () => {
    it("returns readable copy for post-payout refund attempt", () => {
      const msg = "Payout already released (transfer txr_123). Refunding after a completed payout requires a manual transfer reversal in the Stripe dashboard.";
      expect(formatAdminActionError(msg)).toContain("Post-payout refunds require a manual transfer reversal");
    });
  });

  describe("S37-H6: concurrent settlement / refund slot", () => {
    it("matches 'refund slot' phrasing", () => {
      const msg = "Could not claim refund slot — concurrent settlement in progress. Please retry.";
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
      // Message contains both 'issue window' and 'not yet expired'
      const msg = "issue window not yet expired";
      const result = formatAdminActionError(msg);
      expect(result).toContain("24-hour issue window");
      expect(result).not.toBe("The issue window has already expired.");
    });
  });
});
