/**
 * shared/adminActionErrors.ts
 *
 * Maps tRPC error messages from admin dispute/payout procedures to
 * human-readable copy suitable for display in the Admin Disputes Panel.
 *
 * Kept in `shared/` so it can be imported by both the React frontend
 * (AdminDisputesPanel.tsx) and the Node test suite (server/sprint37.test.ts)
 * without pulling in any browser or React dependencies.
 *
 * Matching strategy:
 *   - Normalize the input to lowercase once at the top.
 *   - Test the normalized string for substrings.
 *   - More-specific patterns are tested before shorter / more-generic ones
 *     to avoid false matches (e.g. "not yet expired" before "expired").
 *   - Returned copy strings are never lowercased — they are display strings.
 */

/**
 * Converts a raw tRPC error message into admin-friendly UI copy.
 * Returns the original message unchanged when no pattern matches.
 */
export function formatAdminActionError(message: string): string {
  const n = message.toLowerCase(); // normalize once

  // ── Issue window ──────────────────────────────────────────────────────────
  // "not yet expired" and "not expired yet" must be tested before the shorter
  // "expired" substring to prevent the wrong branch from matching first.
  if (n.includes("issue window") && (n.includes("not yet expired") || n.includes("not expired yet"))) {
    return "The 24-hour issue window has not expired yet. Wait until the window closes before releasing payout.";
  }
  // payoutService: "Issue window has not expired yet. Payout available after <ISO>"
  if (n.includes("not expired yet") || n.includes("not yet expired")) {
    return "The 24-hour issue window has not expired yet. Wait until the window closes before releasing payout.";
  }
  if (n.includes("issue window") && n.includes("expired")) {
    return "The issue window has already expired.";
  }

  // ── No issue window set ───────────────────────────────────────────────────
  // payoutService: "Lesson has no issue window set — cannot safely release payout"
  if (n.includes("no issue window set") || (n.includes("no issue window") && n.includes("cannot"))) {
    return "This lesson has no issue window recorded. Payout cannot be released automatically — please investigate before proceeding.";
  }

  // ── Override reason required ──────────────────────────────────────────────
  // payoutService: "Admin override reason is required for disputed lessons"
  if (n.includes("override reason") || n.includes("adminoverridereason")) {
    return "An override reason is required for disputed lessons.";
  }

  // ── Refund in progress (blocks payout) ───────────────────────────────────
  // routers.ts refundStudent: "A refund is currently in progress for this lesson. Payout cannot proceed until the refund is resolved."
  if (n.includes("refund is currently in progress")) {
    return "A refund is currently in progress for this lesson. Payout cannot proceed until the refund is resolved.";
  }

  // ── Payout in progress (blocks refund) ───────────────────────────────────
  // routers.ts refundStudent: "A payout transfer is currently in progress for this lesson. Wait for it to complete before issuing a refund."
  // payoutService: "Payout is already in progress. Please try again in a moment."
  if (n.includes("payout transfer is currently in progress")) {
    return "A payout transfer is already in progress for this lesson. Wait for it to complete before issuing a refund.";
  }
  if (n.includes("payout is already in progress")) {
    return "A payout is already in progress for this lesson. Please try again in a moment.";
  }

  // ── Payout already released ───────────────────────────────────────────────
  // routers.ts refundStudent: "Payout already released (transfer txr_…). Refunding after …"
  // payoutService: "Payout already claimed by a concurrent request."
  if (n.includes("payout already released")) {
    return "Payout has already been released for this lesson. Post-payout refunds require a manual transfer reversal in the Stripe dashboard.";
  }
  if (n.includes("payout already claimed")) {
    return "Payout was claimed by a concurrent request. Please refresh and retry.";
  }

  // ── S38 Post-payout reversal slot ────────────────────────────────────────
  // routers.ts: "Could not claim reversal slot — concurrent operation in progress. Please retry."
  if (n.includes("claim reversal slot")) {
    return "Could not start the transfer reversal — a concurrent operation is in progress. Please wait a moment and retry.";
  }

  // ── S38 Stripe transfer reversal failed ──────────────────────────────────
  // routers.ts: "Stripe transfer reversal failed: <msg>. The reversal slot has been released — please retry."
  if (n.includes("transfer reversal failed")) {
    return "The Stripe transfer reversal failed. The slot has been released — please retry. If the problem persists, check the Stripe dashboard.";
  }

  // ── S38 Could not advance to refund slot after reversal ───────────────────
  // routers.ts: "Could not advance to refund slot after reversal — concurrent operation detected. Please retry."
  if (n.includes("advance to refund slot after reversal")) {
    return "Transfer reversed successfully, but could not advance to the refund step — a concurrent operation was detected. Please retry.";
  }

  // ── S38 Retry amount conflicts with stored intended amount ────────────────
  // routers.ts: "Retry amount X conflicts with the stored intended refund amount Y. Omit amountCents to use the original amount."
  if (n.includes("conflicts with the stored intended refund amount")) {
    return "The refund amount you entered conflicts with the original intended refund amount for this lesson. Leave the amount blank to use the original amount.";
  }

  // ── S38 Could not claim refund slot for retry ─────────────────────────────
  // routers.ts: "Could not claim refund slot for retry — concurrent operation in progress. Please retry."
  if (n.includes("claim refund slot for retry")) {
    return "Could not claim the refund slot for retry — a concurrent operation is in progress. Please wait a moment and retry.";
  }

  // ── S38 Stripe refund failed after transfer reversal ─────────────────────
  // routers.ts: "Stripe refund failed after transfer reversal: <msg>. The transfer has been reversed. Please retry to complete the student refund."
  if (n.includes("refund failed after transfer reversal")) {
    return "The Stripe refund failed after the transfer was already reversed. The coach transfer has been reversed — please retry to complete the student refund. If the problem persists, check the Stripe dashboard.";
  }

  // ── S38 Finalize CAS miss after Stripe refund ─────────────────────────────
  // routers.ts: "Finalize failed after Stripe refund (CAS miss) — the refund may have been processed by a concurrent operation. Please check the lesson status."
  if (n.includes("finalize failed after stripe refund") || (n.includes("cas miss") && n.includes("refund"))) {
    return "The Stripe refund was processed, but the lesson status could not be finalized (possible concurrent operation). Please check the lesson status before retrying.";
  }

  // ── Concurrent settlement / atomic refund-slot race ───────────────────────
  // routers.ts refundStudent: "Could not claim refund slot — concurrent settlement in progress. Please retry."
  if (n.includes("refund slot") || n.includes("concurrent settlement")) {
    return "A concurrent settlement is in progress. Please wait a moment and retry.";
  }

  // ── Refund already issued ─────────────────────────────────────────────────
  if (n.includes("already been refunded") || n.includes("refund already")) {
    return "A refund has already been issued for this lesson.";
  }

  // ── No payment on record ──────────────────────────────────────────────────
  if (n.includes("no payment recorded")) {
    return "No payment is recorded for this lesson — nothing to refund.";
  }

  // ── Wrong lesson status ───────────────────────────────────────────────────
  // payoutService: "Lesson is not in a payable state (status: …)"
  if (n.includes("not in a payable state")) {
    return "This lesson is not in a payable state. Only completed or disputed lessons are eligible for payout.";
  }
  // routers.ts refundStudent: "Lesson is not in a refundable state"
  if (n.includes("not in a refundable state")) {
    return "This lesson is not in a refundable state (must be disputed or completed).";
  }

  // ── Coach missing Stripe Connect ─────────────────────────────────────────
  if (n.includes("connected stripe account") || n.includes("stripe connect")) {
    return "The coach does not have a connected Stripe account. They must complete Stripe onboarding before a payout can be released.";
  }

  // ── Lesson not found ──────────────────────────────────────────────────────
  if (n.includes("lesson not found")) {
    return "Lesson not found. It may have been deleted.";
  }

  // ── Auth / role errors ────────────────────────────────────────────────────
  if (n.includes("admin access required") || n.includes("forbidden")) {
    return "Admin access required. You do not have permission to perform this action.";
  }

  // ── Fallback — return the raw message so nothing is silently swallowed ────
  return message;
}
