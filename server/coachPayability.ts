/**
 * Coach payability — the single source of truth for "can this coach receive
 * money from a student right now?".
 *
 * Every student → coach money flow (lesson bookings and checkout, tips,
 * storefront purchases, content requests, paid subscriptions, group lessons —
 * and future courses, pay-per-view video and file sales) MUST gate on
 * requirePayableCoach() BEFORE any Stripe Checkout Session is created or any
 * priced commitment is recorded. The webhook transfer backstops (tip refund,
 * owed-payout alert) stay as defense in depth, but they are not a substitute:
 * a coach who abandoned Stripe onboarding has an account id yet cannot
 * receive transfers.
 *
 * Semantics (users row):
 *  - closed (soft-deleted) account        → not payable
 *  - no stripeConnectAccountId            → not payable
 *  - stripeConnectOnboarded flag set      → payable (the account.updated
 *    webhook keeps it current, including flipping it back to false)
 *  - account id present but flag not set  → live Stripe check. Charges AND
 *    payouts enabled → persist the flag (self-heal for a missed webhook) and
 *    treat as payable. Anything else, including a Stripe error → NOT payable
 *    (fail closed).
 *
 * Public list endpoints use hasCompletedPayoutSetup() /
 * getAcceptingPaymentsByCoachId(): stored state only, never a Stripe call per
 * row. The server-side gate is always the authority.
 */

import { TRPCError } from "@trpc/server";
import { COACH_NOT_PAYABLE_MESSAGE } from "@shared/coachPayments";
import type { User } from "../drizzle/schema";
import * as db from "./db";
import * as stripeService from "./stripe";

/**
 * Student-facing rejection copy (shared so the client can recognise it).
 * Never include account ids or Stripe errors.
 */
export { COACH_NOT_PAYABLE_MESSAGE };

/**
 * Mock Connect accounts used by seeded/dev coaches (see the isTestAccount
 * branches in stripe.ts). Stripe has never heard of them, so a live status
 * check can only fail — they are payable exactly when the seed flagged them
 * onboarded.
 */
const TEST_CONNECT_ACCOUNT_PREFIX = "acct_test_coach_";

/**
 * Negative live-check results are cached briefly so a coach dashboard refetch
 * or a burst of rejected checkout attempts can't hammer the Stripe API. Never
 * delays a coach who finished onboarding: the webhook / confirm flow sets the
 * stored flag, which is consulted before this cache.
 */
const NEGATIVE_CHECK_TTL_MS = 30_000;
const NEGATIVE_CHECK_MAX_ENTRIES = 1_000;
const negativeChecks = new Map<string, { reason: CoachNotPayableReason; expiresAt: number }>();

/** Test hook: forget cached negative live-check results. */
export function resetCoachPayabilityCache(): void {
  negativeChecks.clear();
}

export type CoachPayoutState = {
  stripeConnectAccountId?: string | null;
  stripeConnectOnboarded?: boolean | number | null;
  deletedAt?: Date | null;
};

/**
 * Stored-state predicate (no Stripe call): an open account with a Connect
 * account that Stripe has confirmed can take charges and pay out. This is
 * what `acceptingPayments` means on public coach data.
 */
export function hasCompletedPayoutSetup(state: CoachPayoutState | null | undefined): boolean {
  return !!state?.stripeConnectAccountId && !!state.stripeConnectOnboarded && !state.deletedAt;
}

export type CoachNotPayableReason =
  | "coach_not_found"
  | "no_connect_account"
  | "onboarding_incomplete"
  | "stripe_unavailable";

export type CoachPayability =
  | { payable: true; coach: User; connectAccountId: string }
  | { payable: false; coach: User | null; reason: CoachNotPayableReason };

/**
 * Authoritative check, used by every money-moving procedure and by the coach's
 * own payout-setup status. May call Stripe (see module docs) and self-heals
 * the stored flag when Stripe reports the account fully enabled.
 */
export async function checkCoachPayability(coachUserId: number): Promise<CoachPayability> {
  const coach = (await db.getUserById(coachUserId)) ?? null;
  // A closed account can't receive money, whatever its Stripe flags say.
  if (!coach || coach.deletedAt) return { payable: false, coach: null, reason: "coach_not_found" };

  const accountId = coach.stripeConnectAccountId;
  if (!accountId) return { payable: false, coach, reason: "no_connect_account" };

  if (coach.stripeConnectOnboarded) {
    return { payable: true, coach, connectAccountId: accountId };
  }

  if (accountId.startsWith(TEST_CONNECT_ACCOUNT_PREFIX)) {
    return { payable: false, coach, reason: "onboarding_incomplete" };
  }

  const cached = negativeChecks.get(accountId);
  if (cached && cached.expiresAt > Date.now()) {
    return { payable: false, coach, reason: cached.reason };
  }

  let enabled: boolean;
  try {
    const status = await stripeService.getConnectAccountStatus(accountId);
    enabled = !!status?.chargesEnabled && !!status?.payoutsEnabled;
  } catch (err: any) {
    console.error(`[coachPayability] Stripe status check failed for coach ${coach.id}: ${err?.message ?? err}`);
    rememberNegative(accountId, "stripe_unavailable");
    return { payable: false, coach, reason: "stripe_unavailable" };
  }

  if (!enabled) {
    rememberNegative(accountId, "onboarding_incomplete");
    return { payable: false, coach, reason: "onboarding_incomplete" };
  }

  // Stripe says the account is fully enabled but our flag missed it (webhook
  // lost or not yet delivered) — persist it so the next check is local. A
  // failed write doesn't change the answer: Stripe just confirmed it live.
  negativeChecks.delete(accountId);
  try {
    await db.updateUserStripeConnectAccount(coach.id, accountId, true);
    console.log(`[coachPayability] Coach ${coach.id} stripeConnectOnboarded self-healed to true from a live Stripe check`);
  } catch (err) {
    console.error(`[coachPayability] Failed to persist self-healed onboarding flag for coach ${coach.id}:`, err);
  }
  return { payable: true, coach: { ...coach, stripeConnectOnboarded: true }, connectAccountId: accountId };
}

function rememberNegative(accountId: string, reason: CoachNotPayableReason) {
  if (negativeChecks.size >= NEGATIVE_CHECK_MAX_ENTRIES) negativeChecks.clear();
  negativeChecks.set(accountId, { reason, expiresAt: Date.now() + NEGATIVE_CHECK_TTL_MS });
}

/**
 * Gate for every student → coach money flow. Returns the coach and the
 * verified Connect account id, or throws a student-safe TRPCError:
 * NOT_FOUND for an unknown coach, PRECONDITION_FAILED (COACH_NOT_PAYABLE_MESSAGE)
 * otherwise. Callers that claimed a checkout slot must release it on throw.
 */
export async function requirePayableCoach(
  coachUserId: number,
): Promise<{ coach: User; connectAccountId: string }> {
  const result = await checkCoachPayability(coachUserId);
  if (result.payable) {
    return { coach: result.coach, connectAccountId: result.connectAccountId };
  }
  if (result.reason === "coach_not_found") {
    throw new TRPCError({ code: "NOT_FOUND", message: "Coach not found" });
  }
  console.warn(`[coachPayability] Blocked a payment to coach ${coachUserId} (${result.reason})`);
  throw new TRPCError({ code: "PRECONDITION_FAILED", message: COACH_NOT_PAYABLE_MESSAGE });
}

/**
 * Batch, stored-state-only lookup for public listings (browse, profile,
 * storefront, matching). Unknown ids map to false. A lookup failure degrades
 * to "not accepting payments" rather than failing the listing — the payment
 * gate re-checks authoritatively anyway.
 */
export async function getAcceptingPaymentsByCoachId(coachUserIds: number[]): Promise<Map<number, boolean>> {
  const ids = Array.from(new Set(coachUserIds.filter((id) => Number.isInteger(id) && id > 0)));
  const result = new Map<number, boolean>(ids.map((id) => [id, false]));
  if (ids.length === 0) return result;
  try {
    const rows = (await db.getCoachPayoutStates(ids)) ?? [];
    for (const row of rows) result.set(row.id, hasCompletedPayoutSetup(row));
  } catch (err) {
    console.error("[coachPayability] Payout-state lookup failed; treating coaches as not accepting payments:", err);
  }
  return result;
}

/** Decorate public rows with `acceptingPayments` (one batched query). */
export async function withAcceptingPayments<T extends object>(
  rows: T[],
  coachIdOf: (row: T) => number | null | undefined,
): Promise<Array<T & { acceptingPayments: boolean }>> {
  const byCoach = await getAcceptingPaymentsByCoachId(
    rows.map((row) => coachIdOf(row)).filter((id): id is number => typeof id === "number"),
  );
  return rows.map((row) => {
    const coachId = coachIdOf(row);
    return { ...row, acceptingPayments: coachId != null && byCoach.get(coachId) === true };
  });
}

/**
 * Whether to remind a coach to finish payout setup. A live coach who can't be
 * paid is turning students away, so the reminder applies regardless of
 * earnings; before going live it follows the earn-first payout threshold.
 */
export function needsPayoutSetupReminder(state: {
  acceptingPayments: boolean;
  profileLive: boolean;
  hasReachedThreshold: boolean;
}): boolean {
  return !state.acceptingPayments && (state.profileLive || state.hasReachedThreshold);
}
