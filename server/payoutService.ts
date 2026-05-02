/**
 * payoutService.ts
 *
 * Shared payout release logic used by:
 *   - admin.disputes.releasePayout (manual admin trigger)
 *   - autoReleasePayouts scheduler (automated 30-min cron)
 *
 * All settlement safeguards live here once so they cannot diverge.
 *
 * Sprint 35: The override decision is now FULLY SERVICE-OWNED.
 * Callers pass adminOverrideReason (or nothing). The service reads
 * the lesson itself and computes whether the issue window can be skipped:
 *
 *   skipWindow = lesson.status === "disputed" && !!adminOverrideReason?.trim()
 *
 * A completed lesson ALWAYS enforces issueWindowEndsAt, even if
 * adminOverrideReason is provided. Disputed lessons require adminOverrideReason
 * to skip the window. Auto-release never passes adminOverrideReason, so it
 * never skips the window.
 */

import * as db from "./db";
import { transferToCoach } from "./stripeConnect";

export type PayoutReleaseInput = {
  lessonId: number;
  /**
   * Required when releasing a disputed lesson (admin override).
   * Auto-release never passes this — it must always enforce the window.
   *
   * The service computes skipWindow from its OWN lesson read:
   *   skipWindow = lesson.status === "disputed" && !!adminOverrideReason?.trim()
   *
   * Callers MUST NOT pass skipIssueWindowCheck — the service owns that decision.
   */
  adminOverrideReason?: string;
};

export type PayoutReleaseResult =
  | { success: true; transferId: string; alreadyReleased?: boolean }
  | { success: false; conflict: true; reason: string }
  | { success: false; precondition: true; reason: string }
  | { success: false; stripeError: true; reason: string };

/**
 * Attempt to release the coach payout for a lesson.
 *
 * Returns a typed result instead of throwing so callers (especially the
 * scheduler) can decide how to handle each outcome without try/catch.
 *
 * All existing safeguards are preserved:
 *   - issueWindowEndsAt enforcement (always for completed; skippable only for
 *     disputed with a non-empty adminOverrideReason)
 *   - disputed lessons without adminOverrideReason → precondition failure
 *   - stripePaymentIntentId required
 *   - coach Stripe Connect account required
 *   - claimLessonPayoutSlot CAS
 *   - __pending_refund__ conflict
 *   - __pending_payout__ conflict
 *   - deterministic Stripe idempotency key: lesson_payout_{lessonId}
 *   - finalizeLessonPayout only after Stripe success
 *   - releaseLessonPayoutSlot on Stripe failure
 */
export async function releaseLessonPayoutToCoach(
  input: PayoutReleaseInput
): Promise<PayoutReleaseResult> {
  const lesson = await db.getLessonById(input.lessonId);
  if (!lesson) {
    return { success: false, precondition: true, reason: "Lesson not found" };
  }

  // Only completed or disputed lessons can be paid out
  if (lesson.status !== "completed" && lesson.status !== "disputed") {
    return {
      success: false,
      precondition: true,
      reason: `Lesson is not in a payable state (status: ${lesson.status})`,
    };
  }

  // Sprint 35: Compute override decision using the SERVICE's own lesson read.
  // A completed lesson ALWAYS enforces the window — adminOverrideReason is ignored.
  // A disputed lesson may skip the window only with a non-empty adminOverrideReason.
  const isDisputed = lesson.status === "disputed";
  const hasOverrideReason = !!input.adminOverrideReason?.trim();
  const skipWindow = isDisputed && hasOverrideReason;

  // Disputed lessons require an explicit admin override reason to proceed.
  if (isDisputed && !hasOverrideReason) {
    return {
      success: false,
      precondition: true,
      reason: "Admin override reason is required for disputed lessons",
    };
  }

  if (!lesson.stripePaymentIntentId) {
    return {
      success: false,
      precondition: true,
      reason: "No payment recorded for this lesson",
    };
  }

  // S31-3: __pending_refund__ means an admin refund is in-flight — payout must not proceed.
  if (lesson.stripeTransferId === "__pending_refund__") {
    return {
      success: false,
      conflict: true,
      reason: "A refund is currently in progress for this lesson. Payout cannot proceed until the refund is resolved.",
    };
  }

  // __pending_payout__: another releasePayout call is in-flight.
  if (lesson.stripeTransferId === "__pending_payout__") {
    return {
      success: false,
      conflict: true,
      reason: "Payout is already in progress. Please try again in a moment.",
    };
  }

  // Idempotent: if already released with a real transfer ID, return success.
  if (lesson.stripeTransferId) {
    return { success: true, transferId: lesson.stripeTransferId, alreadyReleased: true };
  }

  // Issue window enforcement.
  // skipWindow is only true for disputed + non-empty adminOverrideReason (computed above).
  // Completed lessons always enforce the window regardless of adminOverrideReason.
  if (!skipWindow) {
    if (!lesson.issueWindowEndsAt) {
      return {
        success: false,
        precondition: true,
        reason: "Lesson has no issue window set — cannot safely release payout",
      };
    }
    if (new Date() < lesson.issueWindowEndsAt) {
      return {
        success: false,
        precondition: true,
        reason: `Issue window has not expired yet. Payout available after ${lesson.issueWindowEndsAt.toISOString()}.`,
      };
    }
  }

  // Look up coach's connected account
  const coach = await db.getUserById(lesson.coachId);
  if (!coach?.stripeConnectAccountId) {
    return {
      success: false,
      precondition: true,
      reason: "Coach does not have a connected Stripe account",
    };
  }

  // Atomic CAS — claim the payout slot before touching Stripe.
  const claimed = await db.claimLessonPayoutSlot(input.lessonId);
  if (!claimed) {
    return {
      success: false,
      conflict: true,
      reason: "Payout already claimed by a concurrent request.",
    };
  }

  // Transfer coach payout to their connected account.
  // Deterministic idempotency key so Stripe deduplicates retries.
  const idempotencyKey = `lesson_payout_${lesson.id}`;
  const result = await transferToCoach({
    accountId: coach.stripeConnectAccountId,
    amountCents: lesson.coachPayoutCents,
    currency: lesson.currency || "usd",
    description: `Payout for lesson #${lesson.id}`,
    idempotencyKey,
    metadata: {
      lessonId: lesson.id.toString(),
      coachId: lesson.coachId.toString(),
      studentId: lesson.studentId.toString(),
      ...(input.adminOverrideReason ? { adminOverrideReason: input.adminOverrideReason } : {}),
    },
  });

  if (!result.success) {
    // Release the slot so admin/scheduler can retry
    await db.releaseLessonPayoutSlot(input.lessonId);
    return {
      success: false,
      stripeError: true,
      reason: result.error ?? "Transfer failed",
    };
  }

  // Finalize: replace placeholder with real transfer ID and mark released
  await db.finalizeLessonPayout(input.lessonId, result.transferId!);

  return { success: true, transferId: result.transferId! };
}
