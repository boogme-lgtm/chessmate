/**
 * Coach earnings helpers (S46-4, S46-5) — pure, shared, unit-testable.
 */

/**
 * Lesson statuses whose coach payout is considered "pending" (escrowed and
 * owed to the coach): the student has paid (payment_collected / confirmed) or
 * the lesson is done and awaiting payout (completed). Released/cancelled/
 * refunded are excluded.
 */
export const COACH_PENDING_STATUSES = [
  "payment_collected",
  "confirmed",
  "completed",
] as const;

/**
 * Build the coach earnings summary from total (released) + pending (escrowed)
 * cents. percentToThreshold drives the payout-setup progress bar, so escrowed
 * money must count toward it (S46-5).
 */
export function buildCoachEarningsSummary(
  totalEarningsCents: number,
  pendingEarningsCents: number,
  thresholdCents: number = 10000
) {
  const combinedEarningsCents = totalEarningsCents + pendingEarningsCents;
  return {
    totalEarningsCents,
    pendingEarningsCents,
    combinedEarningsCents,
    thresholdCents,
    hasReachedThreshold: combinedEarningsCents >= thresholdCents,
    percentToThreshold: Math.min(
      100,
      Math.round((combinedEarningsCents / thresholdCents) * 100)
    ),
  };
}
