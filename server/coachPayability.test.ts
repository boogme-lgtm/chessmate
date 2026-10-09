/**
 * Sprint 1 — payment safety: a coach must be verifiably payable before any
 * student money moves.
 *
 * Covers the coachPayability helper (every branch), every gated money-flow
 * procedure (rejects a non-payable coach without creating a Stripe Checkout
 * Session and without leaving a claimed checkout slot; a payable coach still
 * works), the self-heal (bounded by a timeout, with an expiring negative
 * cache), expiry of an already-open checkout for a coach who can no longer be
 * paid, free storefront claims, the public `acceptingPayments` flag (never the
 * account id), and the coach-side payout-setup reminder.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TRPCError } from "@trpc/server";
import { TRPCClientError } from "@trpc/client";
import { isCoachNotPayableError } from "@shared/coachPayments";

vi.mock("./db");
vi.mock("./stripe");
vi.mock("./stripeConnect");
vi.mock("./emailService");
vi.mock("./nurtureEmailScheduler");
vi.mock("./resendWelcomeEmails");
vi.mock("./bookingService");
vi.mock("./email");
vi.mock("./_core/notification");

import * as db from "./db";
import * as stripeService from "./stripe";
import * as bookingService from "./bookingService";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import {
  COACH_NOT_PAYABLE_MESSAGE,
  LIVE_CHECK_TIMEOUT_MS,
  checkCoachPayability,
  getAcceptingPaymentsByCoachId,
  hasCompletedPayoutSetup,
  needsPayoutSetupReminder,
  requirePayableCoach,
  requirePayableCoachForOpenCheckout,
  resetCoachPayabilityCache,
} from "./coachPayability";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const student = { id: 1, role: "user", userType: "student", openId: "s", name: "Stu", email: "s@e.com" };
const coachBase = { id: 42, role: "user", userType: "coach", openId: "c", name: "Coach", email: "c@e.com" };
/** Stripe confirmed charges + payouts. */
const payableCoach = { ...coachBase, stripeConnectAccountId: "acct_1PayableCoach42", stripeConnectOnboarded: true };
/** Clicked "Set Up Stripe Payments" and abandoned onboarding. */
const pendingCoach = { ...coachBase, stripeConnectAccountId: "acct_1PayableCoach42", stripeConnectOnboarded: false };
/** Never started Stripe. */
const noAccountCoach = { ...coachBase, stripeConnectAccountId: null, stripeConnectOnboarded: false };

function ctx(user: any): TrpcContext {
  return { user, req: { protocol: "https", headers: {} } as any, res: { setHeader: vi.fn() } as any };
}

function useCoach(coach: any) {
  vi.mocked(db.getUserById).mockImplementation(async (id: number) => {
    if (id === student.id) return student as any;
    if (id === coachBase.id) return coach ?? undefined;
    return undefined;
  });
}

function stripeSays(chargesEnabled: boolean, payoutsEnabled: boolean) {
  vi.mocked(stripeService.getConnectAccountStatus).mockResolvedValue({
    id: "acct_1PayableCoach42", chargesEnabled, payoutsEnabled, detailsSubmitted: true, requirements: null,
  } as any);
}

async function expectNotPayable(promise: Promise<unknown>) {
  const err = await promise.then(() => null, (e) => e);
  expect(err).toBeInstanceOf(TRPCError);
  expect(err.code).toBe("PRECONDITION_FAILED");
  expect(err.message).toBe(COACH_NOT_PAYABLE_MESSAGE);
  // Never leak account ids or raw Stripe errors to students.
  expect(err.message).not.toMatch(/acct_|stripe error|no such/i);
}

const inDays = (d: number) => new Date(Date.now() + d * 24 * 60 * 60 * 1000);

beforeEach(() => {
  vi.resetAllMocks();
  resetCoachPayabilityCache();
  useCoach(payableCoach);
  stripeSays(false, false);
});

// ═════════════════════════════════════════════════════════════════════════════
// Helper
// ═════════════════════════════════════════════════════════════════════════════

describe("hasCompletedPayoutSetup (stored state, used for public data)", () => {
  it.each([
    [null, false],
    [{ stripeConnectAccountId: null, stripeConnectOnboarded: true }, false],
    [{ stripeConnectAccountId: "acct_x", stripeConnectOnboarded: false }, false],
    [{ stripeConnectAccountId: "acct_x", stripeConnectOnboarded: null }, false],
    [{ stripeConnectAccountId: "acct_x", stripeConnectOnboarded: true }, true],
    // Raw-SQL reads return TINYINT 1/0.
    [{ stripeConnectAccountId: "acct_x", stripeConnectOnboarded: 1 }, true],
    [{ stripeConnectAccountId: "acct_x", stripeConnectOnboarded: 0 }, false],
    // Closed (soft-deleted) accounts never accept payments.
    [{ stripeConnectAccountId: "acct_x", stripeConnectOnboarded: true, deletedAt: new Date() }, false],
  ])("%j → %s", (state, expected) => {
    expect(hasCompletedPayoutSetup(state as any)).toBe(expected);
  });
});

describe("checkCoachPayability", () => {
  it("unknown coach → not payable, no Stripe call", async () => {
    useCoach(null);
    expect(await checkCoachPayability(42)).toMatchObject({ payable: false, reason: "coach_not_found" });
    expect(stripeService.getConnectAccountStatus).not.toHaveBeenCalled();
  });

  it("closed (soft-deleted) account → not payable even when flagged onboarded", async () => {
    useCoach({ ...payableCoach, deletedAt: new Date() });
    expect(await checkCoachPayability(42)).toMatchObject({ payable: false, reason: "coach_not_found" });
    await expect(requirePayableCoach(42)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(stripeService.getConnectAccountStatus).not.toHaveBeenCalled();
  });

  it("no Connect account → not payable, no Stripe call", async () => {
    useCoach(noAccountCoach);
    expect(await checkCoachPayability(42)).toMatchObject({ payable: false, reason: "no_connect_account" });
    expect(stripeService.getConnectAccountStatus).not.toHaveBeenCalled();
  });

  it("onboarded flag set → payable from stored state, no Stripe call", async () => {
    const res = await checkCoachPayability(42);
    expect(res).toMatchObject({ payable: true, connectAccountId: "acct_1PayableCoach42" });
    expect(stripeService.getConnectAccountStatus).not.toHaveBeenCalled();
    expect(db.updateUserStripeConnectAccount).not.toHaveBeenCalled();
  });

  it("account but flag unset, Stripe now enabled → payable and self-heals the flag", async () => {
    useCoach(pendingCoach);
    stripeSays(true, true);
    const res = await checkCoachPayability(42);
    expect(res).toMatchObject({ payable: true, connectAccountId: "acct_1PayableCoach42" });
    // Bounded: a degraded Stripe API can't hold a payment or the dashboard.
    expect(stripeService.getConnectAccountStatus).toHaveBeenCalledWith("acct_1PayableCoach42", { timeoutMs: LIVE_CHECK_TIMEOUT_MS });
    expect(db.updateUserStripeConnectAccount).toHaveBeenCalledWith(42, "acct_1PayableCoach42", true);
  });

  it("self-heal persist failure still trusts the live Stripe answer", async () => {
    useCoach(pendingCoach);
    stripeSays(true, true);
    vi.mocked(db.updateUserStripeConnectAccount).mockRejectedValue(new Error("db write failed"));
    expect(await checkCoachPayability(42)).toMatchObject({ payable: true });
  });

  it.each([
    [false, false],
    [true, false],
    [false, true],
  ])("account but flag unset, Stripe charges=%s payouts=%s → not payable, flag untouched", async (charges, payouts) => {
    useCoach(pendingCoach);
    stripeSays(charges, payouts);
    expect(await checkCoachPayability(42)).toMatchObject({ payable: false, reason: "onboarding_incomplete" });
    expect(db.updateUserStripeConnectAccount).not.toHaveBeenCalled();
  });

  it("Stripe error → fails closed", async () => {
    useCoach(pendingCoach);
    vi.mocked(stripeService.getConnectAccountStatus).mockRejectedValue(new Error("Stripe error: No such account acct_1PayableCoach42"));
    expect(await checkCoachPayability(42)).toMatchObject({ payable: false, reason: "stripe_unavailable" });
    expect(db.updateUserStripeConnectAccount).not.toHaveBeenCalled();
  });

  it("Stripe returning nothing usable → fails closed", async () => {
    useCoach(pendingCoach);
    vi.mocked(stripeService.getConnectAccountStatus).mockResolvedValue(undefined as any);
    expect(await checkCoachPayability(42)).toMatchObject({ payable: false });
  });

  it("seeded acct_test_coach_ accounts follow the stored flag and never hit Stripe", async () => {
    useCoach({ ...coachBase, stripeConnectAccountId: "acct_test_coach_120001", stripeConnectOnboarded: true });
    expect(await checkCoachPayability(42)).toMatchObject({ payable: true, connectAccountId: "acct_test_coach_120001" });
    useCoach({ ...coachBase, stripeConnectAccountId: "acct_test_coach_120001", stripeConnectOnboarded: false });
    expect(await checkCoachPayability(42)).toMatchObject({ payable: false, reason: "onboarding_incomplete" });
    expect(stripeService.getConnectAccountStatus).not.toHaveBeenCalled();
  });

  it("briefly caches a negative live check, but a set flag always wins", async () => {
    useCoach(pendingCoach);
    await checkCoachPayability(42);
    await checkCoachPayability(42);
    expect(stripeService.getConnectAccountStatus).toHaveBeenCalledTimes(1);

    // Webhook / confirm flow set the flag → payable immediately.
    useCoach(payableCoach);
    expect(await checkCoachPayability(42)).toMatchObject({ payable: true });

    // Cache reset → live check runs again.
    useCoach(pendingCoach);
    resetCoachPayabilityCache();
    stripeSays(true, true);
    expect(await checkCoachPayability(42)).toMatchObject({ payable: true });
    expect(stripeService.getConnectAccountStatus).toHaveBeenCalledTimes(2);
  });

  describe("with a clock", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("a cached negative result expires after 30s, so a coach whose webhook was lost still self-heals", async () => {
      useCoach(pendingCoach);
      expect(await checkCoachPayability(42)).toMatchObject({ payable: false, reason: "onboarding_incomplete" });

      // Stripe finishes verifying the account, but the account.updated webhook is lost.
      stripeSays(true, true);
      vi.advanceTimersByTime(29_999);
      expect(await checkCoachPayability(42)).toMatchObject({ payable: false });
      expect(stripeService.getConnectAccountStatus).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(2);
      expect(await checkCoachPayability(42)).toMatchObject({ payable: true, connectAccountId: "acct_1PayableCoach42" });
      expect(stripeService.getConnectAccountStatus).toHaveBeenCalledTimes(2);
      expect(db.updateUserStripeConnectAccount).toHaveBeenCalledWith(42, "acct_1PayableCoach42", true);
    });

    it("a hung Stripe call fails closed after the live-check timeout instead of hanging", async () => {
      useCoach(pendingCoach);
      vi.mocked(stripeService.getConnectAccountStatus).mockReturnValue(new Promise(() => {}));
      const pending = checkCoachPayability(42);
      await vi.advanceTimersByTimeAsync(LIVE_CHECK_TIMEOUT_MS);
      expect(await pending).toMatchObject({ payable: false, reason: "stripe_unavailable" });
      expect(db.updateUserStripeConnectAccount).not.toHaveBeenCalled();

      // The money gate rejects with the friendly message, not a hang or a raw error.
      resetCoachPayabilityCache();
      const gate = requirePayableCoach(42).then(() => null, (e) => e);
      await vi.advanceTimersByTimeAsync(LIVE_CHECK_TIMEOUT_MS);
      const err = await gate;
      expect(err).toMatchObject({ code: "PRECONDITION_FAILED", message: COACH_NOT_PAYABLE_MESSAGE });
    });
  });
});

describe("requirePayableCoach", () => {
  it("returns the coach and the verified Connect account id", async () => {
    const res = await requirePayableCoach(42);
    expect(res.connectAccountId).toBe("acct_1PayableCoach42");
    expect(res.coach.id).toBe(42);
  });

  it("throws a friendly, non-leaky PRECONDITION_FAILED for every not-payable reason", async () => {
    for (const coach of [noAccountCoach, pendingCoach]) {
      resetCoachPayabilityCache();
      useCoach(coach);
      await expectNotPayable(requirePayableCoach(42));
    }
    resetCoachPayabilityCache();
    useCoach(pendingCoach);
    vi.mocked(stripeService.getConnectAccountStatus).mockRejectedValue(new Error("Stripe error: No such account acct_1PayableCoach42"));
    await expectNotPayable(requirePayableCoach(42));
  });

  it("throws NOT_FOUND for an unknown coach", async () => {
    useCoach(null);
    await expect(requirePayableCoach(42)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("is recognised by the client (which refreshes stale flags on it) — and nothing else is", async () => {
    useCoach(pendingCoach);
    const serverErr = await requirePayableCoach(42).then(() => null, (e) => e);
    expect(isCoachNotPayableError(serverErr)).toBe(true);
    // As the browser sees it after the tRPC round trip.
    expect(isCoachNotPayableError(new TRPCClientError(serverErr.message))).toBe(true);
    for (const other of [
      new TRPCClientError("Coach not found"),
      new Error("Failed to fetch"),
      { message: undefined },
      null,
      undefined,
    ]) {
      expect(isCoachNotPayableError(other)).toBe(false);
    }
  });
});

describe("requirePayableCoachForOpenCheckout", () => {
  it("leaves the open session alone for a payable coach", async () => {
    expect(await requirePayableCoachForOpenCheckout(42, "cs_open")).toMatchObject({ connectAccountId: "acct_1PayableCoach42" });
    expect(stripeService.expireCheckoutSession).not.toHaveBeenCalled();
  });

  it.each([
    ["no Stripe account", noAccountCoach],
    ["abandoned Stripe onboarding", pendingCoach],
    ["a closed account", { ...payableCoach, deletedAt: new Date() }],
  ])("expires the open session for a coach with %s, then rejects", async (_label, coach) => {
    useCoach(coach);
    await expect(requirePayableCoachForOpenCheckout(42, "cs_open")).rejects.toBeInstanceOf(TRPCError);
    expect(stripeService.expireCheckoutSession).toHaveBeenCalledWith("cs_open");
  });

  it("still rejects with the friendly message when the expiry itself fails", async () => {
    useCoach(pendingCoach);
    vi.mocked(stripeService.expireCheckoutSession).mockRejectedValue(new Error("Stripe error: session cs_open is complete"));
    await expectNotPayable(requirePayableCoachForOpenCheckout(42, "cs_open"));
  });

  it("does not expire anything on an unexpected failure that says nothing about the coach", async () => {
    vi.mocked(db.getUserById).mockRejectedValue(new Error("db down"));
    await expect(requirePayableCoachForOpenCheckout(42, "cs_open")).rejects.toThrow("db down");
    expect(stripeService.expireCheckoutSession).not.toHaveBeenCalled();
  });
});

describe("getAcceptingPaymentsByCoachId (batched, stored state only)", () => {
  it("maps every requested id, de-duplicates, and defaults unknown ids to false", async () => {
    vi.mocked(db.getCoachPayoutStates).mockResolvedValue([
      { id: 42, stripeConnectAccountId: "acct_a", stripeConnectOnboarded: true, deletedAt: null },
      { id: 43, stripeConnectAccountId: "acct_b", stripeConnectOnboarded: false, deletedAt: null },
      { id: 44, stripeConnectAccountId: null, stripeConnectOnboarded: true, deletedAt: null },
      { id: 46, stripeConnectAccountId: "acct_c", stripeConnectOnboarded: true, deletedAt: new Date() },
    ]);
    const map = await getAcceptingPaymentsByCoachId([42, 43, 44, 45, 46, 42, -1, 0]);
    expect(Object.fromEntries(map)).toEqual({ 42: true, 43: false, 44: false, 45: false, 46: false });
    expect(db.getCoachPayoutStates).toHaveBeenCalledTimes(1);
    expect(db.getCoachPayoutStates).toHaveBeenCalledWith([42, 43, 44, 45, 46]);
    expect(stripeService.getConnectAccountStatus).not.toHaveBeenCalled();
  });

  it("skips the query for an empty list", async () => {
    expect((await getAcceptingPaymentsByCoachId([])).size).toBe(0);
    expect(db.getCoachPayoutStates).not.toHaveBeenCalled();
  });

  it("degrades to not-accepting (never throws) when the lookup fails", async () => {
    vi.mocked(db.getCoachPayoutStates).mockRejectedValue(new Error("db down"));
    expect(Object.fromEntries(await getAcceptingPaymentsByCoachId([42]))).toEqual({ 42: false });
  });
});

describe("needsPayoutSetupReminder", () => {
  it.each([
    [{ acceptingPayments: true, profileLive: true, hasReachedThreshold: true }, false],
    [{ acceptingPayments: false, profileLive: true, hasReachedThreshold: false }, true],
    [{ acceptingPayments: false, profileLive: false, hasReachedThreshold: true }, true],
    [{ acceptingPayments: false, profileLive: false, hasReachedThreshold: false }, false],
  ])("%j → %s", (state, expected) => {
    expect(needsPayoutSetupReminder(state)).toBe(expected);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Gated money flows
// ═════════════════════════════════════════════════════════════════════════════

describe("lesson.book", () => {
  beforeEach(() => {
    vi.mocked(db.getCoachProfileByUserId).mockResolvedValue({
      userId: 42, hourlyRateCents: 6000, pricingTier: "free", minAdvanceHours: 24, maxAdvanceDays: 30,
    } as any);
    vi.mocked(db.createLesson).mockResolvedValue({ id: 99, status: "pending_payment" } as any);
    vi.mocked(bookingService.isTimeSlotAvailable).mockResolvedValue(true);
  });

  it.each([
    ["no Stripe account", noAccountCoach],
    ["abandoned Stripe onboarding", pendingCoach],
  ])("rejects a booking request for a coach with %s — no reservation is created", async (_label, coach) => {
    useCoach(coach);
    await expectNotPayable(
      appRouter.createCaller(ctx(student)).lesson.book({ coachId: 42, scheduledAt: inDays(7), durationMinutes: 60 }),
    );
    expect(db.createLesson).not.toHaveBeenCalled();
    expect(bookingService.isTimeSlotAvailable).not.toHaveBeenCalled();
  });

  it("books normally with a payable coach", async () => {
    const res = await appRouter.createCaller(ctx(student)).lesson.book({ coachId: 42, scheduledAt: inDays(7), durationMinutes: 60 });
    expect(res.success).toBe(true);
    expect(db.createLesson).toHaveBeenCalled();
  });

  it("books after a self-heal (webhook missed, Stripe now enabled)", async () => {
    useCoach(pendingCoach);
    stripeSays(true, true);
    const res = await appRouter.createCaller(ctx(student)).lesson.book({ coachId: 42, scheduledAt: inDays(7), durationMinutes: 60 });
    expect(res.success).toBe(true);
    expect(db.updateUserStripeConnectAccount).toHaveBeenCalledWith(42, "acct_1PayableCoach42", true);
  });
});

describe("payment.createCheckout (lesson)", () => {
  const lesson = {
    id: 100, studentId: 1, coachId: 42, status: "pending_payment", amountCents: 5000, currency: "USD",
    stripeCheckoutSessionId: null as string | null, checkoutAttempt: 0, scheduledAt: new Date(), durationMinutes: 60,
  };
  let slot: string | null;

  beforeEach(() => {
    slot = null;
    vi.mocked(db.getLessonById).mockResolvedValue({ ...lesson } as any);
    vi.mocked(db.claimLessonCheckoutSlot).mockImplementation(async () => {
      if (slot !== null) return false;
      slot = "__pending__";
      return true;
    });
    vi.mocked(db.clearLessonCheckoutSession).mockImplementation(async () => { slot = null; return 1; });
    vi.mocked(db.setLessonCheckoutSession).mockImplementation(async (_id, sessionId) => { slot = sessionId; });
    vi.mocked(db.getCoachProfileByUserId).mockResolvedValue({ pricingTier: "free" } as any);
    vi.mocked(stripeService.createLessonCheckoutSession).mockResolvedValue({ id: "cs_new", url: "https://checkout.stripe.com/new" } as any);
  });

  it.each([
    ["no Stripe account", noAccountCoach],
    ["abandoned Stripe onboarding", pendingCoach],
  ])("rejects a coach with %s, creates no session and releases the claimed slot", async (_label, coach) => {
    useCoach(coach);
    await expectNotPayable(appRouter.createCaller(ctx(student)).payment.createCheckout({ lessonId: 100 }));
    expect(db.claimLessonCheckoutSlot).toHaveBeenCalledWith(100);
    expect(db.clearLessonCheckoutSession).toHaveBeenCalledWith(100);
    expect(slot).toBeNull();
    expect(stripeService.createLessonCheckoutSession).not.toHaveBeenCalled();
    expect(db.setLessonCheckoutSession).not.toHaveBeenCalled();
  });

  it("fails closed (slot released) when Stripe can't confirm the account", async () => {
    useCoach(pendingCoach);
    vi.mocked(stripeService.getConnectAccountStatus).mockRejectedValue(new Error("Stripe API down"));
    await expectNotPayable(appRouter.createCaller(ctx(student)).payment.createCheckout({ lessonId: 100 }));
    expect(slot).toBeNull();
    expect(stripeService.createLessonCheckoutSession).not.toHaveBeenCalled();
  });

  it("creates the session for a payable coach with the verified account id", async () => {
    const res = await appRouter.createCaller(ctx(student)).payment.createCheckout({ lessonId: 100 });
    expect(res.url).toBe("https://checkout.stripe.com/new");
    expect(stripeService.createLessonCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({ coachConnectAccountId: "acct_1PayableCoach42", lessonId: 100 }),
    );
    expect(slot).toBe("cs_new");
  });

  it("self-heals a missed webhook and proceeds", async () => {
    useCoach(pendingCoach);
    stripeSays(true, true);
    const res = await appRouter.createCaller(ctx(student)).payment.createCheckout({ lessonId: 100 });
    expect(res.url).toBe("https://checkout.stripe.com/new");
    expect(db.updateUserStripeConnectAccount).toHaveBeenCalledWith(42, "acct_1PayableCoach42", true);
  });

  it("never hands back an existing open session once the coach is no longer payable — and expires it at Stripe", async () => {
    useCoach(pendingCoach);
    vi.mocked(db.getLessonById).mockResolvedValue({ ...lesson, stripeCheckoutSessionId: "cs_open_old" } as any);
    vi.mocked(stripeService.retrieveCheckoutSession).mockResolvedValue({ id: "cs_open_old", status: "open", url: "https://checkout.stripe.com/old" } as any);
    await expectNotPayable(appRouter.createCaller(ctx(student)).payment.createCheckout({ lessonId: 100 }));
    // The link can't be paid from another tab or the browser history either.
    expect(stripeService.expireCheckoutSession).toHaveBeenCalledWith("cs_open_old");
    // The slot keeps the session id; the next attempt replaces the expired session.
    expect(db.clearLessonCheckoutSessionIfMatches).not.toHaveBeenCalled();
    expect(db.claimLessonCheckoutSlot).not.toHaveBeenCalled();
    expect(stripeService.createLessonCheckoutSession).not.toHaveBeenCalled();
  });

  it("replaces the expired session with a fresh one once the coach can be paid again", async () => {
    slot = "cs_open_old";
    vi.mocked(db.getLessonById).mockResolvedValue({ ...lesson, stripeCheckoutSessionId: "cs_open_old" } as any);
    vi.mocked(stripeService.retrieveCheckoutSession).mockResolvedValue({ id: "cs_open_old", status: "expired", url: null } as any);
    vi.mocked(db.clearLessonCheckoutSessionIfMatches).mockImplementation(async (_id, expected) => {
      if (slot !== expected) return { cleared: false, checkoutAttempt: 0 };
      slot = null;
      return { cleared: true, checkoutAttempt: 1 };
    });
    const res = await appRouter.createCaller(ctx(student)).payment.createCheckout({ lessonId: 100 });
    expect(res.url).toBe("https://checkout.stripe.com/new");
    // A new attempt number → a new idempotency key, never a replay of the expired session.
    expect(stripeService.createLessonCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: "lesson_checkout_100_v1" }),
    );
    expect(slot).toBe("cs_new");
  });

  it("still returns an existing open session for a payable coach", async () => {
    vi.mocked(db.getLessonById).mockResolvedValue({ ...lesson, stripeCheckoutSessionId: "cs_open_old" } as any);
    vi.mocked(stripeService.retrieveCheckoutSession).mockResolvedValue({ id: "cs_open_old", status: "open", url: "https://checkout.stripe.com/old" } as any);
    const res = await appRouter.createCaller(ctx(student)).payment.createCheckout({ lessonId: 100 });
    expect(res.url).toBe("https://checkout.stripe.com/old");
    expect(stripeService.expireCheckoutSession).not.toHaveBeenCalled();
  });
});

describe("tip.createCheckout", () => {
  beforeEach(() => {
    vi.mocked(db.getLessonById).mockResolvedValue({ id: 7, studentId: 1, coachId: 42, status: "completed", currency: "USD" } as any);
    vi.mocked(db.getTipByLessonAndStudent).mockResolvedValue({ id: 5, status: "pending" } as any);
    vi.mocked(stripeService.createTipCheckoutSession).mockResolvedValue({ id: "cs_tip", url: "https://checkout.stripe.com/tip" } as any);
  });

  it("rejects a non-payable coach with no Stripe session and no side effects on the previous tip", async () => {
    useCoach(pendingCoach);
    await expectNotPayable(appRouter.createCaller(ctx(student)).tip.createCheckout({ lessonId: 7, tipAmountCents: 500 }));
    expect(stripeService.createTipCheckoutSession).not.toHaveBeenCalled();
    expect(db.deleteTip).not.toHaveBeenCalled();
    expect(db.createTip).not.toHaveBeenCalled();
  });

  it("still reports an already-paid tip as a conflict first", async () => {
    useCoach(pendingCoach);
    vi.mocked(db.getTipByLessonAndStudent).mockResolvedValue({ id: 5, status: "paid" } as any);
    await expect(appRouter.createCaller(ctx(student)).tip.createCheckout({ lessonId: 7, tipAmountCents: 500 }))
      .rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("works for a payable coach", async () => {
    const res = await appRouter.createCaller(ctx(student)).tip.createCheckout({ lessonId: 7, tipAmountCents: 500 });
    expect(res.url).toBe("https://checkout.stripe.com/tip");
    expect(db.deleteTip).toHaveBeenCalledWith(5);
    expect(db.createTip).toHaveBeenCalled();
  });
});

describe("content.createStorefrontCheckout", () => {
  beforeEach(() => {
    vi.mocked(db.getContentItemById).mockResolvedValue({
      id: 100, coachId: 42, title: "Caro-Kann Masterclass", accessType: "public", published: true, priceCents: 2900, currency: "USD",
    } as any);
    vi.mocked(db.userHasContentAccess).mockResolvedValue(false);
    vi.mocked(stripeService.createContentItemCheckoutSession).mockResolvedValue({ url: "https://checkout.stripe.com/item" } as any);
  });

  it("rejects a non-payable coach without creating a Stripe session", async () => {
    useCoach(pendingCoach);
    await expectNotPayable(appRouter.createCaller(ctx(student)).content.createStorefrontCheckout({ contentItemId: 100 }));
    expect(stripeService.createContentItemCheckoutSession).not.toHaveBeenCalled();
  });

  it("works for a payable coach", async () => {
    const res = await appRouter.createCaller(ctx(student)).content.createStorefrontCheckout({ contentItemId: 100 });
    expect(res.url).toBe("https://checkout.stripe.com/item");
  });
});

describe("content.claimFree (free storefront items stay open)", () => {
  const freeItem = { id: 101, coachId: 42, title: "Free sampler", accessType: "public", published: true, priceCents: 0, currency: "USD" };

  beforeEach(() => {
    vi.mocked(db.getContentItemById).mockResolvedValue({ ...freeItem } as any);
    vi.mocked(db.userHasContentAccess).mockResolvedValue(false);
    vi.mocked(db.recordFreeContentUnlock).mockResolvedValue(true);
  });

  it.each([
    ["no Stripe account", noAccountCoach],
    ["abandoned Stripe onboarding", pendingCoach],
  ])("adds a free item to the library even while the coach has %s — no money, no Stripe", async (_label, coach) => {
    useCoach(coach);
    const res = await appRouter.createCaller(ctx(student)).content.claimFree({ contentItemId: 101 });
    expect(res).toEqual({ alreadyOwned: false });
    expect(db.recordFreeContentUnlock).toHaveBeenCalledWith({ contentItemId: 101, userId: 1 });
    expect(stripeService.createContentItemCheckoutSession).not.toHaveBeenCalled();
    expect(stripeService.getConnectAccountStatus).not.toHaveBeenCalled();
  });

  it("is idempotent for an item the student can already open", async () => {
    vi.mocked(db.userHasContentAccess).mockResolvedValue(true);
    expect(await appRouter.createCaller(ctx(student)).content.claimFree({ contentItemId: 101 })).toEqual({ alreadyOwned: true });
    expect(db.recordFreeContentUnlock).not.toHaveBeenCalled();

    // A concurrent claim that won the race.
    vi.mocked(db.userHasContentAccess).mockResolvedValue(false);
    vi.mocked(db.recordFreeContentUnlock).mockResolvedValue(false);
    expect(await appRouter.createCaller(ctx(student)).content.claimFree({ contentItemId: 101 })).toEqual({ alreadyOwned: true });
  });

  it.each([
    ["a paid item", { priceCents: 2900 }],
    ["an unpublished item", { published: false }],
    ["a private item", { accessType: "student_only" }],
  ])("refuses %s", async (_label, override) => {
    vi.mocked(db.getContentItemById).mockResolvedValue({ ...freeItem, ...override } as any);
    await expect(appRouter.createCaller(ctx(student)).content.claimFree({ contentItemId: 101 }))
      .rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.recordFreeContentUnlock).not.toHaveBeenCalled();
  });

  it("requires a session", async () => {
    await expect(appRouter.createCaller(ctx(null)).content.claimFree({ contentItemId: 101 }))
      .rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

describe("contentRequest", () => {
  const quoted = { id: 10, studentId: 1, coachId: 42, title: "Endgame drills", status: "quoted", amountCents: 5000 };

  it("create: rejects a non-payable coach before anything is recorded or sent", async () => {
    useCoach(noAccountCoach);
    await expectNotPayable(appRouter.createCaller(ctx(student)).contentRequest.create({ coachId: 42, title: "Endgame drills" }));
    expect(db.createContentRequest).not.toHaveBeenCalled();
    expect(db.createNotification).not.toHaveBeenCalled();
  });

  it("create: works for a payable coach", async () => {
    vi.mocked(db.createContentRequest).mockResolvedValue(11);
    const res = await appRouter.createCaller(ctx(student)).contentRequest.create({ coachId: 42, title: "Endgame drills" });
    expect(res).toEqual({ success: true, id: 11 });
  });

  it("acceptQuote: keeps the quote open while the coach can't be paid", async () => {
    useCoach(pendingCoach);
    vi.mocked(db.getContentRequestById).mockResolvedValue(quoted as any);
    await expectNotPayable(appRouter.createCaller(ctx(student)).contentRequest.acceptQuote({ requestId: 10 }));
    expect(db.acceptContentRequestQuote).not.toHaveBeenCalled();
  });

  it("acceptQuote: works for a payable coach", async () => {
    vi.mocked(db.getContentRequestById).mockResolvedValue(quoted as any);
    await appRouter.createCaller(ctx(student)).contentRequest.acceptQuote({ requestId: 10 });
    expect(db.acceptContentRequestQuote).toHaveBeenCalledWith(10);
  });

  describe("createCheckout", () => {
    const pending = { ...quoted, status: "pending_payment", stripeCheckoutSessionId: null as string | null, updatedAt: new Date() };
    let slot: string | null;

    beforeEach(() => {
      slot = null;
      vi.mocked(db.getContentRequestById).mockResolvedValue({ ...pending } as any);
      vi.mocked(db.claimContentRequestCheckoutSlot).mockImplementation(async () => {
        if (slot !== null) return false;
        slot = "__pending__";
        return true;
      });
      vi.mocked(db.clearContentRequestCheckoutSession).mockImplementation(async () => { slot = null; });
      vi.mocked(db.setContentRequestCheckoutSession).mockImplementation(async (_id, sessionId) => { slot = sessionId; });
      vi.mocked(stripeService.createContentRequestCheckoutSession).mockResolvedValue({ id: "cs_cr", url: "https://checkout.stripe.com/cr" } as any);
    });

    it("rejects a non-payable coach, creates no session and releases the claimed slot", async () => {
      useCoach(pendingCoach);
      await expectNotPayable(appRouter.createCaller(ctx(student)).contentRequest.createCheckout({ requestId: 10 }));
      expect(db.claimContentRequestCheckoutSlot).toHaveBeenCalledWith(10);
      expect(db.clearContentRequestCheckoutSession).toHaveBeenCalledWith(10);
      expect(slot).toBeNull();
      expect(stripeService.createContentRequestCheckoutSession).not.toHaveBeenCalled();
    });

    it("never hands back an existing open session once the coach is no longer payable — and expires it at Stripe", async () => {
      useCoach(pendingCoach);
      vi.mocked(db.getContentRequestById).mockResolvedValue({ ...pending, stripeCheckoutSessionId: "cs_open_old" } as any);
      vi.mocked(stripeService.retrieveCheckoutSession).mockResolvedValue({ status: "open", url: "https://checkout.stripe.com/old" } as any);
      await expectNotPayable(appRouter.createCaller(ctx(student)).contentRequest.createCheckout({ requestId: 10 }));
      expect(stripeService.expireCheckoutSession).toHaveBeenCalledWith("cs_open_old");
      expect(db.clearContentRequestCheckoutSessionIfMatches).not.toHaveBeenCalled();
      expect(stripeService.createContentRequestCheckoutSession).not.toHaveBeenCalled();
    });

    it("still returns an existing open session for a payable coach", async () => {
      vi.mocked(db.getContentRequestById).mockResolvedValue({ ...pending, stripeCheckoutSessionId: "cs_open_old" } as any);
      vi.mocked(stripeService.retrieveCheckoutSession).mockResolvedValue({ status: "open", url: "https://checkout.stripe.com/old" } as any);
      const res = await appRouter.createCaller(ctx(student)).contentRequest.createCheckout({ requestId: 10 });
      expect(res.url).toBe("https://checkout.stripe.com/old");
      expect(stripeService.expireCheckoutSession).not.toHaveBeenCalled();
    });

    it("replaces an expired session with a fresh one (its own idempotency key, so Stripe can't replay the expired one)", async () => {
      slot = "cs_open_old";
      vi.mocked(db.getContentRequestById).mockResolvedValue({ ...pending, stripeCheckoutSessionId: "cs_open_old" } as any);
      vi.mocked(stripeService.retrieveCheckoutSession).mockResolvedValue({ status: "expired", url: null } as any);
      vi.mocked(db.clearContentRequestCheckoutSessionIfMatches).mockImplementation(async (_id, expected) => {
        if (slot !== expected) return false;
        slot = null;
        return true;
      });
      const res = await appRouter.createCaller(ctx(student)).contentRequest.createCheckout({ requestId: 10 });
      expect(res.url).toBe("https://checkout.stripe.com/cr");
      expect(db.clearContentRequestCheckoutSessionIfMatches).toHaveBeenCalledWith(10, "cs_open_old");
      expect(stripeService.createContentRequestCheckoutSession).toHaveBeenCalledWith(
        expect.objectContaining({ idempotencyKey: "content_request_checkout_10_after_cs_open_old" }),
      );
      expect(slot).toBe("cs_cr");
    });

    it("does not create a second session when a concurrent request already replaced the expired one", async () => {
      slot = "cs_concurrent";
      vi.mocked(db.getContentRequestById).mockResolvedValue({ ...pending, stripeCheckoutSessionId: "cs_open_old" } as any);
      vi.mocked(stripeService.retrieveCheckoutSession).mockResolvedValue({ status: "expired", url: null } as any);
      vi.mocked(db.clearContentRequestCheckoutSessionIfMatches).mockResolvedValue(false);
      await expect(appRouter.createCaller(ctx(student)).contentRequest.createCheckout({ requestId: 10 }))
        .rejects.toMatchObject({ code: "CONFLICT" });
      expect(stripeService.createContentRequestCheckoutSession).not.toHaveBeenCalled();
      expect(slot).toBe("cs_concurrent");
    });

    it("works for a payable coach with the verified account id", async () => {
      const res = await appRouter.createCaller(ctx(student)).contentRequest.createCheckout({ requestId: 10 });
      expect(res.url).toBe("https://checkout.stripe.com/cr");
      expect(stripeService.createContentRequestCheckoutSession).toHaveBeenCalledWith(
        expect.objectContaining({
          coachConnectAccountId: "acct_1PayableCoach42",
          idempotencyKey: "content_request_checkout_10",
        }),
      );
      expect(slot).toBe("cs_cr");
    });
  });
});

describe("coachSubscription.subscribe", () => {
  function settings(monthlyPriceCents: number) {
    vi.mocked(db.getCoachSubscriptionSettings).mockResolvedValue({
      id: 1, coachId: 42, enabled: true, monthlyPriceCents, description: null, createdAt: new Date(), updatedAt: new Date(),
    });
  }

  it("rejects a paid subscription to a non-payable coach", async () => {
    useCoach(noAccountCoach);
    settings(500);
    await expectNotPayable(appRouter.createCaller(ctx(student)).coachSubscription.subscribe({ coachId: 42 }));
    expect(db.subscribeToCoach).not.toHaveBeenCalled();
  });

  it("free follows stay open to a non-payable coach", async () => {
    useCoach(noAccountCoach);
    settings(0);
    vi.mocked(db.subscribeToCoach).mockResolvedValue(10);
    const res = await appRouter.createCaller(ctx(student)).coachSubscription.subscribe({ coachId: 42 });
    expect(res.success).toBe(true);
    expect(stripeService.getConnectAccountStatus).not.toHaveBeenCalled();
  });

  it("paid subscription works for a payable coach", async () => {
    settings(500);
    vi.mocked(db.subscribeToCoach).mockResolvedValue(10);
    const res = await appRouter.createCaller(ctx(student)).coachSubscription.subscribe({ coachId: 42 });
    expect(res.success).toBe(true);
    expect(db.subscribeToCoach).toHaveBeenCalledWith(1, 42, 500);
  });
});

describe("groupLesson", () => {
  it("create: rejects a non-payable coach before anything is inserted", async () => {
    useCoach(pendingCoach);
    const execute = vi.fn();
    vi.mocked(db.getDb).mockResolvedValue({ execute } as any);
    vi.mocked(db.getCoachProfileByUserId).mockResolvedValue({ hourlyRateCents: 6000, pricingTier: "free" } as any);
    await expectNotPayable(appRouter.createCaller(ctx(student)).groupLesson.create({
      coachId: 42, scheduledAt: inDays(7), durationMinutes: 60, maxParticipants: 4,
    }));
    expect(execute).not.toHaveBeenCalled();
  });

  it("join: rejects a non-payable coach before the participant is inserted", async () => {
    useCoach(pendingCoach);
    const execute = vi.fn().mockResolvedValueOnce([[{ id: 3, coachId: 42, status: "forming", maxParticipants: 4 }]]);
    vi.mocked(db.getDb).mockResolvedValue({ execute } as any);
    await expectNotPayable(appRouter.createCaller(ctx(student)).groupLesson.join({ inviteToken: "a".repeat(48) }));
    expect(execute).toHaveBeenCalledTimes(1); // the lookup only — no INSERT
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Public coach data: acceptingPayments, never the account id
// ═════════════════════════════════════════════════════════════════════════════

describe("public coach data exposes acceptingPayments (stored state, no Stripe calls)", () => {
  beforeEach(() => {
    vi.mocked(db.getCoachPayoutStates).mockResolvedValue([
      { id: 42, stripeConnectAccountId: "acct_1PayableCoach42", stripeConnectOnboarded: true, deletedAt: null },
      { id: 43, stripeConnectAccountId: "acct_1PendingCoach43", stripeConnectOnboarded: false, deletedAt: null },
    ]);
  });

  function expectNoPayoutSecrets(value: unknown) {
    const json = JSON.stringify(value);
    expect(json).not.toMatch(/stripeConnect|acct_/);
  }

  const rows = [
    { users: { id: 42, name: "Payable" }, coach_profiles: { userId: 42, averageRating: "4.9" } },
    { users: { id: 43, name: "Pending" }, coach_profiles: { userId: 43, averageRating: "4.5" } },
  ];

  it("coach.listActive (browse)", async () => {
    vi.mocked(db.getActiveCoaches).mockResolvedValue(rows as any);
    const res = await appRouter.createCaller(ctx(null)).coach.listActive();
    expect(res.map((r) => [r.users.id, r.acceptingPayments])).toEqual([[42, true], [43, false]]);
    // Coaches are never hidden — the pending one is still listed.
    expect(res).toHaveLength(2);
    expect(db.getCoachPayoutStates).toHaveBeenCalledTimes(1);
    expect(stripeService.getConnectAccountStatus).not.toHaveBeenCalled();
    expectNoPayoutSecrets(res);
  });

  it("coach.list", async () => {
    vi.mocked(db.getAvailableCoaches).mockResolvedValue(rows as any);
    const res = await appRouter.createCaller(ctx(null)).coach.list();
    expect(res.map((r) => r.acceptingPayments)).toEqual([true, false]);
    expectNoPayoutSecrets(res);
  });

  it.each([
    [rows[0], true],
    [rows[1], false],
  ])("coach.getProfile (coach %#)", async (row, expected) => {
    vi.mocked(db.getCoachWithUser).mockResolvedValue(row as any);
    const res = await appRouter.createCaller(ctx(null)).coach.getProfile({ userId: row.users.id });
    expect(res.acceptingPayments).toBe(expected);
    expectNoPayoutSecrets(res);
  });

  it("coach.getById (public profile)", async () => {
    vi.mocked(db.getPublicUserById).mockResolvedValue({ id: 42, name: "Payable", bio: "GM" } as any);
    vi.mocked(db.getCoachProfileByUserId).mockResolvedValue({ userId: 42, hourlyRateCents: 6000 } as any);
    const res = await appRouter.createCaller(ctx(null)).coach.getById({ id: 42 });
    expect(res?.acceptingPayments).toBe(true);
    expect(res).not.toHaveProperty("stripeConnectAccountId");
    expect(res).not.toHaveProperty("stripeConnectOnboarded");
    expectNoPayoutSecrets(res);
    expect(stripeService.getConnectAccountStatus).not.toHaveBeenCalled();
  });

  it("coach.getById reports a coach who abandoned Stripe onboarding as not accepting payments", async () => {
    // Has a Connect account id (the pre-sprint rule would have said "payable"),
    // but Stripe never confirmed charges + payouts.
    vi.mocked(db.getUserById).mockImplementation(async (id: number) =>
      id === 43 ? ({ ...pendingCoach, id: 43, stripeConnectAccountId: "acct_1PendingCoach43" } as any) : undefined);
    vi.mocked(db.getPublicUserById).mockResolvedValue({ id: 43, name: "Pending", bio: "IM" } as any);
    vi.mocked(db.getCoachProfileByUserId).mockResolvedValue({ userId: 43, hourlyRateCents: 6000 } as any);
    const res = await appRouter.createCaller(ctx(null)).coach.getById({ id: 43 });
    expect(res?.acceptingPayments).toBe(false);
    expectNoPayoutSecrets(res);
    expect(stripeService.getConnectAccountStatus).not.toHaveBeenCalled();
  });

  it("coach.acceptingPayments (dashboard batch lookup) needs a session", async () => {
    const caller = appRouter.createCaller(ctx(student));
    const res = await caller.coach.acceptingPayments({ coachIds: [42, 43, 44] });
    expect(res).toEqual({ 42: true, 43: false, 44: false });
    await expect(caller.coach.acceptingPayments({ coachIds: [] })).rejects.toThrow();
    await expect(caller.coach.acceptingPayments({ coachIds: Array.from({ length: 101 }, (_, i) => i + 1) })).rejects.toThrow();
    // No anonymous enumeration of who finished Stripe onboarding.
    await expect(appRouter.createCaller(ctx(null)).coach.acceptingPayments({ coachIds: [42] }))
      .rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("content.list (storefront listing)", async () => {
    const execute = vi.fn().mockResolvedValue([[
      { id: 1, coachId: 42, title: "Paid course", priceCents: 2900 },
      { id: 2, coachId: 43, title: "Another", priceCents: 900 },
    ]]);
    vi.mocked(db.getDb).mockResolvedValue({ execute } as any);
    const res = await appRouter.createCaller(ctx(null)).content.list({ limit: 20 });
    expect(res.map((i: any) => [i.id, i.acceptingPayments])).toEqual([[1, true], [2, false]]);
    expectNoPayoutSecrets(res);
  });

  it.each([
    [42, true],
    [43, false],
  ])("content.getById (item detail, coach %i)", async (coachId, expected) => {
    const execute = vi.fn().mockResolvedValue([[{ id: 2, coachId, priceCents: 900, storageKey: "k" }]]);
    vi.mocked(db.getDb).mockResolvedValue({ execute } as any);
    const res = await appRouter.createCaller(ctx(null)).content.getById({ id: 2 });
    expect(res.acceptingPayments).toBe(expected);
    expect(res.storageKey).toBeUndefined();
  });

  it("match.getMatchedCoaches and match.generateMatches", async () => {
    vi.mocked(db.getStudentProfileByUserId).mockResolvedValue({ userId: 1, learningStyle: "analytical" } as any);
    vi.mocked(db.getActiveCoaches).mockResolvedValue(rows as any);
    const caller = appRouter.createCaller(ctx(student));
    for (const res of [await caller.match.getMatchedCoaches(), await caller.match.generateMatches()]) {
      expect(new Map(res.map((m) => [m.coachUserId, m.acceptingPayments]))).toEqual(new Map([[42, true], [43, false]]));
      expectNoPayoutSecrets(res);
    }
  });

  it("student.getMatches", async () => {
    vi.mocked(db.getMatchesForStudent).mockResolvedValue([{ coach_matches: { id: 1 }, ...rows[0] }] as any);
    const res = await appRouter.createCaller(ctx(student)).student.getMatches();
    expect(res[0].acceptingPayments).toBe(true);
    expectNoPayoutSecrets(res);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Coach side: payout-setup reminder + flag stays in step with Stripe
// ═════════════════════════════════════════════════════════════════════════════

describe("coach payout-setup status", () => {
  function earnings(hasReachedThreshold: boolean) {
    vi.mocked(db.getCoachEarningsSummary).mockResolvedValue({
      totalEarningsCents: 0, pendingEarningsCents: 0, combinedEarningsCents: 0, thresholdCents: 10000,
      hasReachedThreshold, percentToThreshold: 0, contentEarningsCents: 0,
    });
  }
  function live(profileActive: boolean) {
    vi.mocked(db.getCoachProfileByUserId).mockResolvedValue({ userId: 42, profileActive } as any);
  }
  const coachCaller = () => appRouter.createCaller(ctx(coachBase));

  it("a live coach who can't be paid is reminded even below the earnings threshold", async () => {
    useCoach(pendingCoach);
    earnings(false);
    live(true);
    const res = await coachCaller().coach.getEarnings();
    expect(res).toMatchObject({
      acceptingPayments: false, stripeOnboarded: false, payoutSetupStarted: true, profileLive: true, needsOnboarding: true,
    });
    expect(await coachCaller().coach.checkOnboardingRequired()).toEqual({ required: true, reason: "profile_live" });
  });

  it("a payable coach is never reminded", async () => {
    earnings(true);
    live(true);
    const res = await coachCaller().coach.getEarnings();
    expect(res).toMatchObject({ acceptingPayments: true, stripeOnboarded: true, needsOnboarding: false });
    expect(await coachCaller().coach.checkOnboardingRequired()).toEqual({ required: false, reason: "already_onboarded" });
  });

  it("before going live, the earn-first threshold still applies", async () => {
    useCoach(noAccountCoach);
    live(false);
    earnings(false);
    expect((await coachCaller().coach.getEarnings()).needsOnboarding).toBe(false);
    vi.mocked(db.hasCoachReachedPayoutThreshold).mockResolvedValue(false);
    expect(await coachCaller().coach.checkOnboardingRequired()).toEqual({ required: false, reason: "below_threshold" });

    earnings(true);
    expect(await coachCaller().coach.getEarnings()).toMatchObject({ needsOnboarding: true, payoutSetupStarted: false });
    vi.mocked(db.hasCoachReachedPayoutThreshold).mockResolvedValue(true);
    expect(await coachCaller().coach.checkOnboardingRequired()).toEqual({ required: true, reason: "threshold_reached" });
  });

  it("the dashboard self-heals a missed webhook", async () => {
    useCoach(pendingCoach);
    stripeSays(true, true);
    earnings(false);
    live(true);
    expect(await coachCaller().coach.getEarnings()).toMatchObject({ acceptingPayments: true, needsOnboarding: false });
    expect(db.updateUserStripeConnectAccount).toHaveBeenCalledWith(42, "acct_1PayableCoach42", true);
  });

  it("the dashboard still answers (fail closed) when Stripe hangs", async () => {
    vi.useFakeTimers();
    try {
      useCoach(pendingCoach);
      vi.mocked(stripeService.getConnectAccountStatus).mockReturnValue(new Promise(() => {}));
      earnings(false);
      live(true);
      const pending = coachCaller().coach.getEarnings();
      await vi.advanceTimersByTimeAsync(LIVE_CHECK_TIMEOUT_MS);
      expect(await pending).toMatchObject({ acceptingPayments: false, needsOnboarding: true });
    } finally {
      vi.useRealTimers();
    }
  });

  it("confirmStripeOnboarded keeps the stored flag in step with Stripe in both directions", async () => {
    // Flagged onboarded, but Stripe has since disabled payouts → flip to false.
    stripeSays(true, false);
    expect(await coachCaller().coach.confirmStripeOnboarded()).toEqual({ onboarded: false });
    expect(db.updateUserStripeConnectAccount).toHaveBeenCalledWith(42, "acct_1PayableCoach42", false);

    vi.mocked(db.updateUserStripeConnectAccount).mockClear();
    useCoach(pendingCoach);
    stripeSays(true, true);
    expect(await coachCaller().coach.confirmStripeOnboarded()).toEqual({ onboarded: true });
    expect(db.updateUserStripeConnectAccount).toHaveBeenCalledWith(42, "acct_1PayableCoach42", true);

    // Already in step → no write.
    vi.mocked(db.updateUserStripeConnectAccount).mockClear();
    useCoach(payableCoach);
    await coachCaller().coach.confirmStripeOnboarded();
    expect(db.updateUserStripeConnectAccount).not.toHaveBeenCalled();
  });
});
