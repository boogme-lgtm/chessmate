/**
 * Cancellation refund policy (S45-1, S45-6) — pure, shared, unit-testable.
 *
 * Policy:
 *   - A lesson that was never paid (no Stripe payment intent) is always free to
 *     cancel — there is nothing to refund (refundPercentage = 0).
 *   - A paid lesson cancelled MORE than 1 hour before its start → 100% refund.
 *   - A paid lesson cancelled within the final hour → 0% refund.
 *
 * The 1-hour threshold is strict (> 1 hour), matching the server CAS and the
 * client countdown UI.
 */
export function computeCancellationRefund(params: {
  amountCents: number;
  scheduledAt: Date | string | number;
  stripePaymentIntentId: string | null | undefined;
  now?: Date;
}): { wasPaid: boolean; refundPercentage: number; refundAmountCents: number } {
  const now = params.now ?? new Date();
  const lessonTime = new Date(params.scheduledAt);
  const hoursUntilLesson = (lessonTime.getTime() - now.getTime()) / (1000 * 60 * 60);

  const wasPaid = !!params.stripePaymentIntentId;
  let refundPercentage = 0;
  if (wasPaid && hoursUntilLesson > 1) {
    refundPercentage = 100;
  }

  const refundAmountCents = Math.round((params.amountCents * refundPercentage) / 100);
  return { wasPaid, refundPercentage, refundAmountCents };
}
