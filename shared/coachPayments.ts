/**
 * Shared copy for the "this coach can't take payments yet" state (Sprint 1
 * payment safety). The server rejects every paid action with
 * COACH_NOT_PAYABLE_MESSAGE (server/coachPayability.ts); the client matches on
 * it to refresh stale `acceptingPayments` flags, and uses the action-specific
 * copy below to explain disabled buttons before the student ever clicks.
 */

export const COACH_NOT_PAYABLE_MESSAGE =
  "This coach is finishing their payment setup and can't accept payments yet.";

/** Why a paid action is disabled, per action. */
export const PAYMENTS_PENDING_COPY = {
  booking: "Booking opens soon — this coach is finishing payment setup.",
  payment: "Payment opens soon — this coach is finishing payment setup.",
  purchase: "Purchases open soon — this coach is finishing payment setup.",
  tip: "Tips open soon — this coach is finishing payment setup.",
  contentRequest: "Requests open soon — this coach is finishing payment setup.",
  subscription: "Paid subscriptions open soon — this coach is finishing payment setup.",
} as const;

/** Short label for coach cards (browse, matching). */
export const PAYMENTS_PENDING_BADGE = "Booking opens soon";

/** True when a tRPC error is the server's coach-payability rejection. */
export function isCoachNotPayableError(err: unknown): boolean {
  return (err as { message?: unknown } | null | undefined)?.message === COACH_NOT_PAYABLE_MESSAGE;
}
