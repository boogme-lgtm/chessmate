/**
 * shared/adminActionErrors.ts
 *
 * Maps tRPC error messages from admin dispute/payout procedures to
 * human-readable copy suitable for display in the Admin Disputes Panel.
 *
 * Kept in `shared/` so it can be imported by both the React frontend
 * (AdminDisputesPanel.tsx) and the Node test suite (server/sprint37.test.ts)
 * without pulling in any browser or React dependencies.
 */

/**
 * Converts a raw tRPC error message into admin-friendly UI copy.
 * Returns the original message unchanged when no pattern matches.
 */
export function formatAdminActionError(message: string): string {
  // Issue window checks — "not yet expired" must be tested before "expired"
  // to avoid the shorter substring matching first.
  if (message.includes("issue window") && message.includes("not yet expired")) {
    return "The 24-hour issue window has not expired yet. Wait until the window closes before releasing payout.";
  }
  if (message.includes("issue window") && message.includes("expired")) {
    return "The issue window has already expired.";
  }

  // Override reason required
  if (message.includes("override reason") || message.includes("adminOverrideReason")) {
    return "An override reason is required for disputed lessons.";
  }

  // Concurrent payout in progress
  if (message.includes("payout transfer is currently in progress")) {
    return "A payout transfer is already in progress for this lesson. Wait for it to complete before issuing a refund.";
  }

  // Payout already released — post-payout refund requires manual Stripe reversal
  if (message.includes("Payout already released")) {
    return "Payout has already been released for this lesson. Post-payout refunds require a manual transfer reversal in the Stripe dashboard.";
  }

  // Concurrent settlement / atomic refund-slot race
  if (message.includes("refund slot") || message.includes("concurrent settlement")) {
    return "A concurrent settlement is in progress. Please wait a moment and retry.";
  }

  // Refund already issued
  if (message.includes("already been refunded") || message.includes("refund already")) {
    return "A refund has already been issued for this lesson.";
  }

  // No payment intent on record
  if (message.includes("No payment recorded")) {
    return "No payment is recorded for this lesson — nothing to refund.";
  }

  // Wrong lesson status for refund
  if (message.includes("not in a refundable state")) {
    return "This lesson is not in a refundable state (must be disputed or completed).";
  }

  // Lesson deleted or never existed
  if (message.includes("Lesson not found")) {
    return "Lesson not found. It may have been deleted.";
  }

  // Auth / role errors
  if (message.includes("Admin access required") || message.includes("FORBIDDEN")) {
    return "Admin access required. You do not have permission to perform this action.";
  }

  // Fallback — return the raw message so nothing is silently swallowed
  return message;
}
