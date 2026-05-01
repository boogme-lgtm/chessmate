/**
 * Security Patch Tests — Behavioral Tests (Round 3)
 *
 * These tests call actual tRPC procedures and webhook handlers with mocked
 * DB and Stripe responses. They verify security invariants end-to-end rather
 * than checking source strings.
 *
 * Coverage:
 *  - payment.createCheckout: rejects non-pending_payment, idempotent (no duplicate sessions)
 *  - checkout.session.completed webhook: only transitions pending_payment → payment_collected
 *  - lesson.confirmCompletion: rejects unpaid, requires stripePaymentIntentId
 *  - content.recordPurchase: rejects missing metadata, wrong user, wrong item, wrong amount/currency, duplicate PI
 *  - referral.recordSignup: uses ctx.user.id, blocks self-referral, handles duplicate
 *  - user.deleteAccount: requires password for password-backed users
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TRPCError } from '@trpc/server';

// ─── Module mocks ─────────────────────────────────────────────────────────────
vi.mock("./db");
vi.mock("./emailService");
vi.mock("./nurtureEmailScheduler");
vi.mock("./resendWelcomeEmails");
vi.mock("./stripe");
vi.mock("./storage");
vi.mock("./aiVettingService");
vi.mock("./email");
vi.mock("./_core/notification");
vi.mock("./auth");
vi.mock("./stripeConnect");

import { appRouter } from "./routers";
import * as db from "./db";
import * as stripeService from "./stripe";
import * as stripeConnect from "./stripeConnect";
import type { TrpcContext } from "./_core/context";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createContext(overrides: Partial<NonNullable<TrpcContext["user"]>> = {}): TrpcContext {
  const user = {
    id: 1,
    openId: "test-openid",
    name: "Test User",
    email: "test@example.com",
    password: null,
    emailVerified: true,
    emailVerificationToken: null,
    emailVerificationExpires: null,
    passwordResetToken: null,
    passwordResetExpires: null,
    loginMethod: "manus",
    role: "user" as const,
    userType: "student" as const,
    stripeCustomerId: null,
    stripeConnectAccountId: null,
    stripeConnectOnboarded: false,
    avatarUrl: null,
    bio: null,
    country: null,
    timezone: null,
    notificationPreferences: null,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as any,
    res: { setHeader: vi.fn() } as any,
  };
}

function makeLessonRow(overrides: Record<string, any> = {}) {
  return {
    id: 100,
    studentId: 1,
    coachId: 2,
    status: "pending_payment",
    amountCents: 5000,
    currency: "USD",
    stripePaymentIntentId: null,
    stripeCheckoutSessionId: null,
    checkoutAttempt: 0,
    scheduledAt: new Date(),
    durationMinutes: 60,
    ...overrides,
  };
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  // Default: getDb returns a mock database object
  vi.mocked(db.getDb).mockResolvedValue({
    execute: vi.fn().mockResolvedValue([[], []]),
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue([{ insertId: 1 }]),
  } as any);
});

// ═══════════════════════════════════════════════════════════════════════════════
// payment.createCheckout
// ═══════════════════════════════════════════════════════════════════════════════

describe("payment.createCheckout", () => {
  it("rejects when lesson status is not 'pending_payment'", async () => {
    vi.mocked(db.getLessonById).mockResolvedValue(makeLessonRow({ status: "confirmed" }));
    const caller = appRouter.createCaller(createContext());

    await expect(caller.payment.createCheckout({ lessonId: 100 }))
      .rejects.toThrow("Cannot create checkout");
  });

  it("rejects when lesson status is 'payment_collected' (already paid)", async () => {
    vi.mocked(db.getLessonById).mockResolvedValue(makeLessonRow({ status: "payment_collected" }));
    const caller = appRouter.createCaller(createContext());

    await expect(caller.payment.createCheckout({ lessonId: 100 }))
      .rejects.toThrow("Cannot create checkout");
  });

  it("rejects when lesson status is 'released'", async () => {
    vi.mocked(db.getLessonById).mockResolvedValue(makeLessonRow({ status: "released" }));
    const caller = appRouter.createCaller(createContext());

    await expect(caller.payment.createCheckout({ lessonId: 100 }))
      .rejects.toThrow("Cannot create checkout");
  });

  it("rejects when lesson status is 'declined'", async () => {
    vi.mocked(db.getLessonById).mockResolvedValue(makeLessonRow({ status: "declined" }));
    const caller = appRouter.createCaller(createContext());

    await expect(caller.payment.createCheckout({ lessonId: 100 }))
      .rejects.toThrow("Cannot create checkout");
  });

  it("rejects when lesson status is 'refunded'", async () => {
    vi.mocked(db.getLessonById).mockResolvedValue(makeLessonRow({ status: "refunded" }));
    const caller = appRouter.createCaller(createContext());

    await expect(caller.payment.createCheckout({ lessonId: 100 }))
      .rejects.toThrow("Cannot create checkout");
  });

  it("returns existing open checkout session (idempotency)", async () => {
    vi.mocked(db.getLessonById).mockResolvedValue(
      makeLessonRow({ stripeCheckoutSessionId: "cs_existing_123" })
    );
    vi.mocked(stripeService.retrieveCheckoutSession).mockResolvedValue({
      id: "cs_existing_123",
      status: "open",
      url: "https://checkout.stripe.com/existing",
    } as any);

    const caller = appRouter.createCaller(createContext());
    const result = await caller.payment.createCheckout({ lessonId: 100 });

    expect(result.url).toBe("https://checkout.stripe.com/existing");
    // Should NOT create a new session
    expect(stripeService.createLessonCheckoutSession).not.toHaveBeenCalled();
  });

  it("creates new session when existing session is expired", async () => {
    vi.mocked(db.getLessonById).mockResolvedValue(
      makeLessonRow({ stripeCheckoutSessionId: "cs_expired_123" })
    );
    vi.mocked(stripeService.retrieveCheckoutSession).mockResolvedValue({
      id: "cs_expired_123",
      status: "expired",
      url: null,
    } as any);
    // R7: Now uses conditional clear that returns { cleared, checkoutAttempt }
    vi.mocked(db.clearLessonCheckoutSessionIfMatches).mockResolvedValue({ cleared: true, checkoutAttempt: 1 });
    vi.mocked(db.claimLessonCheckoutSlot).mockResolvedValue(true);
    vi.mocked(db.getUserById).mockResolvedValue({
      id: 2, name: "Coach", email: "coach@test.com",
      stripeConnectAccountId: "acct_coach123",
    } as any);
    vi.mocked(db.getCoachProfileByUserId).mockResolvedValue({ pricingTier: "standard" } as any);
    vi.mocked(stripeService.createLessonCheckoutSession).mockResolvedValue({
      id: "cs_new_456",
      url: "https://checkout.stripe.com/new",
    } as any);
    vi.mocked(db.setLessonCheckoutSession).mockResolvedValue(undefined);

    const caller = appRouter.createCaller(createContext());
    const result = await caller.payment.createCheckout({ lessonId: 100 });

    expect(result.url).toBe("https://checkout.stripe.com/new");
    // R7: Conditional clear was called with the expected session ID
    expect(db.clearLessonCheckoutSessionIfMatches).toHaveBeenCalledWith(100, "cs_expired_123");
    expect(db.claimLessonCheckoutSlot).toHaveBeenCalledWith(100);
    expect(stripeService.createLessonCheckoutSession).toHaveBeenCalled();
    expect(db.setLessonCheckoutSession).toHaveBeenCalledWith(100, "cs_new_456");
  });

  it("creates new session and persists session ID for pending_payment lesson without existing session", async () => {
    vi.mocked(db.getLessonById).mockResolvedValue(makeLessonRow());
    vi.mocked(db.claimLessonCheckoutSlot).mockResolvedValue(true);
    vi.mocked(db.getUserById).mockResolvedValue({
      id: 2, name: "Coach", email: "coach@test.com",
      stripeConnectAccountId: "acct_coach123",
    } as any);
    vi.mocked(db.getCoachProfileByUserId).mockResolvedValue({ pricingTier: "standard" } as any);
    vi.mocked(stripeService.createLessonCheckoutSession).mockResolvedValue({
      id: "cs_fresh_789",
      url: "https://checkout.stripe.com/fresh",
    } as any);
    vi.mocked(db.setLessonCheckoutSession).mockResolvedValue(undefined);

    const caller = appRouter.createCaller(createContext());
    const result = await caller.payment.createCheckout({ lessonId: 100 });

    expect(result.url).toBe("https://checkout.stripe.com/fresh");
    expect(db.claimLessonCheckoutSlot).toHaveBeenCalledWith(100);
    expect(db.setLessonCheckoutSession).toHaveBeenCalledWith(100, "cs_fresh_789");
  });

  // R4-1: Completed session must NOT be cleared or replaced
  it("throws PRECONDITION_FAILED when existing session is complete (payment processing)", async () => {
    vi.mocked(db.getLessonById).mockResolvedValue(
      makeLessonRow({ stripeCheckoutSessionId: "cs_complete_001" })
    );
    vi.mocked(stripeService.retrieveCheckoutSession).mockResolvedValue({
      id: "cs_complete_001",
      status: "complete",
      url: null,
    } as any);

    const caller = appRouter.createCaller(createContext());
    await expect(caller.payment.createCheckout({ lessonId: 100 }))
      .rejects.toMatchObject({
        code: "PRECONDITION_FAILED",
        message: expect.stringContaining("Payment is already processing"),
      });

    // Must NOT clear the session or create a new one
    expect(db.clearLessonCheckoutSession).not.toHaveBeenCalled();
    expect(stripeService.createLessonCheckoutSession).not.toHaveBeenCalled();
  });

  // R4-2: Concurrent race — second caller loses the CAS and gets CONFLICT
  it("rejects concurrent duplicate checkout when claimLessonCheckoutSlot returns false", async () => {
    vi.mocked(db.getLessonById).mockResolvedValue(makeLessonRow());
    // First call claimed the slot; this simulates the second concurrent call
    vi.mocked(db.claimLessonCheckoutSlot).mockResolvedValue(false);
    // The race winner already persisted a session
    vi.mocked(db.getLessonById).mockResolvedValueOnce(makeLessonRow());
    // Second getLessonById call (re-read after losing race) returns the winner's session
    vi.mocked(db.getLessonById).mockResolvedValueOnce(
      makeLessonRow({ stripeCheckoutSessionId: "cs_winner_session" })
    );
    vi.mocked(stripeService.retrieveCheckoutSession).mockResolvedValue({
      id: "cs_winner_session",
      status: "open",
      url: "https://checkout.stripe.com/winner",
    } as any);

    const caller = appRouter.createCaller(createContext());
    const result = await caller.payment.createCheckout({ lessonId: 100 });

    // Should return the winner's session URL instead of creating a new one
    expect(result.url).toBe("https://checkout.stripe.com/winner");
    // Must NOT call createLessonCheckoutSession (no duplicate session)
    expect(stripeService.createLessonCheckoutSession).not.toHaveBeenCalled();
  });

  // R4-2: Concurrent race — when race winner's session can't be retrieved, throw CONFLICT
  it("throws CONFLICT when race loser cannot retrieve winner's session", async () => {
    vi.mocked(db.getLessonById)
      .mockResolvedValueOnce(makeLessonRow()) // initial read
      .mockResolvedValueOnce(makeLessonRow({ stripeCheckoutSessionId: "cs_winner_gone" })); // re-read after losing
    vi.mocked(db.claimLessonCheckoutSlot).mockResolvedValue(false);
    vi.mocked(stripeService.retrieveCheckoutSession).mockRejectedValue(new Error("not found"));

    const caller = appRouter.createCaller(createContext());
    await expect(caller.payment.createCheckout({ lessonId: 100 }))
      .rejects.toMatchObject({
        code: "CONFLICT",
        message: expect.stringContaining("Another checkout is being created"),
      });

    expect(stripeService.createLessonCheckoutSession).not.toHaveBeenCalled();
  });

  // R4-2: Idempotency key is passed to Stripe with version component
  it("passes versioned idempotencyKey keyed by lesson ID and attempt to createLessonCheckoutSession", async () => {
    vi.mocked(db.getLessonById).mockResolvedValue(makeLessonRow());
    vi.mocked(db.claimLessonCheckoutSlot).mockResolvedValue(true);
    vi.mocked(db.getUserById).mockResolvedValue({
      id: 2, name: "Coach", email: "coach@test.com",
      stripeConnectAccountId: "acct_coach123",
    } as any);
    vi.mocked(db.getCoachProfileByUserId).mockResolvedValue({ pricingTier: "standard" } as any);
    vi.mocked(stripeService.createLessonCheckoutSession).mockResolvedValue({
      id: "cs_idem_001",
      url: "https://checkout.stripe.com/idem",
    } as any);
    vi.mocked(db.setLessonCheckoutSession).mockResolvedValue(undefined);

    const caller = appRouter.createCaller(createContext());
    await caller.payment.createCheckout({ lessonId: 100 });

    expect(stripeService.createLessonCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: "lesson_checkout_100_v0" })
    );
  });

  // R5-3: After clearing an expired session, idempotency key uses incremented attempt
  it("uses incremented checkoutAttempt in idempotency key after expired session clear", async () => {
    // Lesson had a previous expired session that was cleared (attempt is now 2)
    vi.mocked(db.getLessonById).mockResolvedValue(makeLessonRow({ checkoutAttempt: 2 }));
    vi.mocked(db.claimLessonCheckoutSlot).mockResolvedValue(true);
    vi.mocked(db.getUserById).mockResolvedValue({
      id: 2, name: "Coach", email: "coach@test.com",
      stripeConnectAccountId: "acct_coach123",
    } as any);
    vi.mocked(db.getCoachProfileByUserId).mockResolvedValue({ pricingTier: "standard" } as any);
    vi.mocked(stripeService.createLessonCheckoutSession).mockResolvedValue({
      id: "cs_idem_v2",
      url: "https://checkout.stripe.com/v2",
    } as any);
    vi.mocked(db.setLessonCheckoutSession).mockResolvedValue(undefined);

    const caller = appRouter.createCaller(createContext());
    await caller.payment.createCheckout({ lessonId: 100 });

    expect(stripeService.createLessonCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: "lesson_checkout_100_v2" })
    );
  });

  // R5-2: __pending__ slot returns CONFLICT without calling Stripe or clearing
  it("returns CONFLICT for __pending__ slot without calling retrieveCheckoutSession or clearLessonCheckoutSession", async () => {
    vi.mocked(db.getLessonById).mockResolvedValue(
      makeLessonRow({ stripeCheckoutSessionId: "__pending__" })
    );

    const caller = appRouter.createCaller(createContext());
    await expect(caller.payment.createCheckout({ lessonId: 100 }))
      .rejects.toMatchObject({
        code: "CONFLICT",
        message: expect.stringContaining("Checkout is already being created"),
      });

    // Must NOT call Stripe retrieve, clear, or create
    expect(stripeService.retrieveCheckoutSession).not.toHaveBeenCalled();
    expect(db.clearLessonCheckoutSession).not.toHaveBeenCalled();
    expect(stripeService.createLessonCheckoutSession).not.toHaveBeenCalled();
  });

  // R5-1: CAS uses Drizzle schema reference (compile-time verified)
  it("claimLessonCheckoutSlot uses Drizzle column reference (schema-safe)", async () => {
    // This test verifies the CAS function is called and returns the expected result.
    // The actual column name correctness is enforced by TypeScript at compile time
    // since we use `lessons.stripeCheckoutSessionId` Drizzle reference.
    vi.mocked(db.getLessonById).mockResolvedValue(makeLessonRow());
    vi.mocked(db.claimLessonCheckoutSlot).mockResolvedValue(true);
    vi.mocked(db.getUserById).mockResolvedValue({
      id: 2, name: "Coach", email: "coach@test.com",
      stripeConnectAccountId: "acct_coach123",
    } as any);
    vi.mocked(db.getCoachProfileByUserId).mockResolvedValue({ pricingTier: "standard" } as any);
    vi.mocked(stripeService.createLessonCheckoutSession).mockResolvedValue({
      id: "cs_cas_001",
      url: "https://checkout.stripe.com/cas",
    } as any);
    vi.mocked(db.setLessonCheckoutSession).mockResolvedValue(undefined);

    const caller = appRouter.createCaller(createContext());
    await caller.payment.createCheckout({ lessonId: 100 });

    // CAS was called with the lesson ID
    expect(db.claimLessonCheckoutSlot).toHaveBeenCalledWith(100);
    // Session was persisted after creation
    expect(db.setLessonCheckoutSession).toHaveBeenCalledWith(100, "cs_cas_001");
  });

  // R6-3 / R7: Expired session cleared — uses fresh attempt value (not stale in-memory)
  it("clears expired session and uses fresh incremented attempt in idempotency key", async () => {
    // Lesson has checkoutAttempt=1 in memory, but after clear it becomes 2 in DB
    vi.mocked(db.getLessonById).mockResolvedValue(
      makeLessonRow({ stripeCheckoutSessionId: "cs_expired_001", checkoutAttempt: 1 })
    );
    vi.mocked(stripeService.retrieveCheckoutSession).mockResolvedValue({
      id: "cs_expired_001",
      status: "expired",
      url: null,
    } as any);
    // R7: clearLessonCheckoutSessionIfMatches returns { cleared: true, checkoutAttempt: 2 }
    vi.mocked(db.clearLessonCheckoutSessionIfMatches).mockResolvedValue({ cleared: true, checkoutAttempt: 2 });
    vi.mocked(db.claimLessonCheckoutSlot).mockResolvedValue(true);
    vi.mocked(db.getUserById).mockResolvedValue({
      id: 2, name: "Coach", email: "coach@test.com",
      stripeConnectAccountId: "acct_coach123",
    } as any);
    vi.mocked(db.getCoachProfileByUserId).mockResolvedValue({ pricingTier: "standard" } as any);
    vi.mocked(stripeService.createLessonCheckoutSession).mockResolvedValue({
      id: "cs_new_after_expiry",
      url: "https://checkout.stripe.com/new",
    } as any);
    vi.mocked(db.setLessonCheckoutSession).mockResolvedValue(undefined);

    const caller = appRouter.createCaller(createContext());
    const result = await caller.payment.createCheckout({ lessonId: 100 });

    expect(result.url).toBe("https://checkout.stripe.com/new");
    // R7: Conditional clear was called with expected session ID
    expect(db.clearLessonCheckoutSessionIfMatches).toHaveBeenCalledWith(100, "cs_expired_001");
    // CRITICAL: idempotency key uses v2 (fresh from DB), NOT v1 (stale in-memory)
    expect(stripeService.createLessonCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: "lesson_checkout_100_v2" })
    );
  });

  // R6-3: First-time checkout with no prior session still uses in-memory attempt (v0)
  it("first-time checkout with no prior session uses in-memory checkoutAttempt (v0)", async () => {
    vi.mocked(db.getLessonById).mockResolvedValue(makeLessonRow({ checkoutAttempt: 0 }));
    vi.mocked(db.claimLessonCheckoutSlot).mockResolvedValue(true);
    vi.mocked(db.getUserById).mockResolvedValue({
      id: 2, name: "Coach", email: "coach@test.com",
      stripeConnectAccountId: "acct_coach123",
    } as any);
    vi.mocked(db.getCoachProfileByUserId).mockResolvedValue({ pricingTier: "standard" } as any);
    vi.mocked(stripeService.createLessonCheckoutSession).mockResolvedValue({
      id: "cs_first_time",
      url: "https://checkout.stripe.com/first",
    } as any);
    vi.mocked(db.setLessonCheckoutSession).mockResolvedValue(undefined);

    const caller = appRouter.createCaller(createContext());
    await caller.payment.createCheckout({ lessonId: 100 });

    // freshAttempt is null (no clearing happened), so uses in-memory value
    expect(stripeService.createLessonCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: "lesson_checkout_100_v0" })
    );
    // clearLessonCheckoutSession was never called
    expect(db.clearLessonCheckoutSession).not.toHaveBeenCalled();
  });

  // R4-2: Concurrent loser with __pending__ winner gets CONFLICT
  it("concurrent loser gets CONFLICT when winner slot is still __pending__", async () => {
    vi.mocked(db.getLessonById)
      .mockResolvedValueOnce(makeLessonRow()) // initial read: no session
      .mockResolvedValueOnce(makeLessonRow({ stripeCheckoutSessionId: "__pending__" })); // re-read after losing
    vi.mocked(db.claimLessonCheckoutSlot).mockResolvedValue(false);

    const caller = appRouter.createCaller(createContext());
    await expect(caller.payment.createCheckout({ lessonId: 100 }))
      .rejects.toMatchObject({
        code: "CONFLICT",
        message: expect.stringContaining("Another checkout is being created"),
      });

    // Must NOT try to retrieve __pending__ from Stripe
    expect(stripeService.retrieveCheckoutSession).not.toHaveBeenCalled();
    expect(stripeService.createLessonCheckoutSession).not.toHaveBeenCalled();
  });

  // R7-3: Two concurrent requests both observe the same expired session;
  // the second conditional clear must fail and must not create a second Stripe Checkout Session.
  it("concurrent expired-session race: second request gets CONFLICT when conditional clear fails", async () => {
    // Both requests read the same expired session
    vi.mocked(db.getLessonById).mockResolvedValue(
      makeLessonRow({ stripeCheckoutSessionId: "cs_expired_race", checkoutAttempt: 1 })
    );
    vi.mocked(stripeService.retrieveCheckoutSession).mockResolvedValue({
      id: "cs_expired_race",
      status: "expired",
      url: null,
    } as any);
    // Conditional clear fails (0 rows affected) because request A already cleared it
    vi.mocked(db.clearLessonCheckoutSessionIfMatches).mockResolvedValue({ cleared: false, checkoutAttempt: 0 });
    // After failing, re-read shows __pending__ (request A claimed the slot)
    vi.mocked(db.getLessonById).mockResolvedValueOnce(
      makeLessonRow({ stripeCheckoutSessionId: "cs_expired_race", checkoutAttempt: 1 })
    ).mockResolvedValueOnce(
      makeLessonRow({ stripeCheckoutSessionId: "__pending__", checkoutAttempt: 2 })
    );

    const caller = appRouter.createCaller(createContext());
    await expect(caller.payment.createCheckout({ lessonId: 100 }))
      .rejects.toMatchObject({
        code: "CONFLICT",
        message: expect.stringContaining("Another checkout is being created"),
      });

    // CRITICAL: Must NOT create a second Stripe Checkout Session
    expect(stripeService.createLessonCheckoutSession).not.toHaveBeenCalled();
    // Must NOT call claimLessonCheckoutSlot (never reached)
    expect(db.claimLessonCheckoutSlot).not.toHaveBeenCalled();
  });

  // R7-3: Concurrent expired-session race where second request finds a new open session from request A
  it("concurrent expired-session race: second request returns new open session URL when available", async () => {
    vi.mocked(db.getLessonById)
      .mockResolvedValueOnce(
        makeLessonRow({ stripeCheckoutSessionId: "cs_expired_race2", checkoutAttempt: 1 })
      )
      // After conditional clear fails, re-read shows request A's new session
      .mockResolvedValueOnce(
        makeLessonRow({ stripeCheckoutSessionId: "cs_new_from_A", checkoutAttempt: 2 })
      );
    // First retrieve: expired
    vi.mocked(stripeService.retrieveCheckoutSession)
      .mockResolvedValueOnce({
        id: "cs_expired_race2",
        status: "expired",
        url: null,
      } as any)
      // Second retrieve: request A's new session is open
      .mockResolvedValueOnce({
        id: "cs_new_from_A",
        status: "open",
        url: "https://checkout.stripe.com/from_A",
      } as any);
    // Conditional clear fails (request A already cleared)
    vi.mocked(db.clearLessonCheckoutSessionIfMatches).mockResolvedValue({ cleared: false, checkoutAttempt: 0 });

    const caller = appRouter.createCaller(createContext());
    const result = await caller.payment.createCheckout({ lessonId: 100 });

    // Returns request A's session URL instead of creating a duplicate
    expect(result.url).toBe("https://checkout.stripe.com/from_A");
    // Must NOT create a second Stripe Checkout Session
    expect(stripeService.createLessonCheckoutSession).not.toHaveBeenCalled();
  });

  // R8: Transient Stripe error does NOT clear the session or create a new one
  it("transient Stripe retrieve error does not clear session or create new checkout", async () => {
    vi.mocked(db.getLessonById).mockResolvedValue(
      makeLessonRow({ stripeCheckoutSessionId: "cs_live_session" })
    );
    // Simulate a transient network/rate-limit error (not a resource_missing error)
    const transientError = new Error("Request failed");
    (transientError as any).type = "StripeConnectionError";
    (transientError as any).statusCode = 500;
    vi.mocked(stripeService.retrieveCheckoutSession).mockRejectedValue(transientError);

    const caller = appRouter.createCaller(createContext());
    await expect(caller.payment.createCheckout({ lessonId: 100 }))
      .rejects.toMatchObject({
        code: "PRECONDITION_FAILED",
        message: expect.stringContaining("Unable to verify checkout status"),
      });

    // CRITICAL: Must NOT clear the session, claim a slot, or create a new session
    expect(db.clearLessonCheckoutSessionIfMatches).not.toHaveBeenCalled();
    expect(db.claimLessonCheckoutSlot).not.toHaveBeenCalled();
    expect(stripeService.createLessonCheckoutSession).not.toHaveBeenCalled();
  });

  // R8: Rate limit error does NOT clear the session
  it("Stripe rate limit error does not clear session or create new checkout", async () => {
    vi.mocked(db.getLessonById).mockResolvedValue(
      makeLessonRow({ stripeCheckoutSessionId: "cs_rate_limited" })
    );
    const rateLimitError = new Error("Rate limit exceeded");
    (rateLimitError as any).type = "StripeRateLimitError";
    (rateLimitError as any).statusCode = 429;
    vi.mocked(stripeService.retrieveCheckoutSession).mockRejectedValue(rateLimitError);

    const caller = appRouter.createCaller(createContext());
    await expect(caller.payment.createCheckout({ lessonId: 100 }))
      .rejects.toMatchObject({
        code: "PRECONDITION_FAILED",
        message: expect.stringContaining("Unable to verify checkout status"),
      });

    expect(db.clearLessonCheckoutSessionIfMatches).not.toHaveBeenCalled();
    expect(db.claimLessonCheckoutSlot).not.toHaveBeenCalled();
    expect(stripeService.createLessonCheckoutSession).not.toHaveBeenCalled();
  });

  // R8: Missing/invalid session (resource_missing) CAN be conditionally cleared and recreated
  it("Stripe resource_missing error conditionally clears and recreates session", async () => {
    vi.mocked(db.getLessonById).mockResolvedValue(
      makeLessonRow({ stripeCheckoutSessionId: "cs_deleted_session" })
    );
    const notFoundError = new Error("No such checkout session");
    (notFoundError as any).type = "StripeInvalidRequestError";
    (notFoundError as any).statusCode = 404;
    (notFoundError as any).code = "resource_missing";
    vi.mocked(stripeService.retrieveCheckoutSession).mockRejectedValue(notFoundError);
    vi.mocked(db.clearLessonCheckoutSessionIfMatches).mockResolvedValue({ cleared: true, checkoutAttempt: 1 });
    vi.mocked(db.claimLessonCheckoutSlot).mockResolvedValue(true);
    vi.mocked(db.getUserById).mockResolvedValue({
      id: 2, name: "Coach", email: "coach@test.com",
      stripeConnectAccountId: "acct_coach123",
    } as any);
    vi.mocked(db.getCoachProfileByUserId).mockResolvedValue({ pricingTier: "standard" } as any);
    vi.mocked(stripeService.createLessonCheckoutSession).mockResolvedValue({
      id: "cs_replacement",
      url: "https://checkout.stripe.com/replacement",
    } as any);
    vi.mocked(db.setLessonCheckoutSession).mockResolvedValue(undefined);

    const caller = appRouter.createCaller(createContext());
    const result = await caller.payment.createCheckout({ lessonId: 100 });

    expect(result.url).toBe("https://checkout.stripe.com/replacement");
    // Conditional clear was called with the expected session ID
    expect(db.clearLessonCheckoutSessionIfMatches).toHaveBeenCalledWith(100, "cs_deleted_session");
    expect(db.claimLessonCheckoutSlot).toHaveBeenCalledWith(100);
    expect(stripeService.createLessonCheckoutSession).toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// checkout.session.completed webhook (via handleStripeWebhook)
// ═══════════════════════════════════════════════════════════════════════════════

describe("checkout.session.completed webhook", () => {
  // We test the handleStripeWebhook function directly
  let handleStripeWebhook: typeof import("./webhooks").handleStripeWebhook;

  beforeEach(async () => {
    // Import the webhook handler (it imports from mocked modules)
    const webhooks = await import("./webhooks");
    handleStripeWebhook = webhooks.handleStripeWebhook;
    // Mock constructWebhookEvent to bypass signature verification
    vi.mocked(stripeService.constructWebhookEvent).mockImplementation(
      (_body, _sig, _secret) => ({
        id: "evt_real_123",
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_test_session",
            payment_status: "paid",
            payment_intent: "pi_test_123",
            metadata: { lessonId: "100" },
          },
        },
      } as any)
    );
  });

  function createWebhookReqRes(body: any = {}) {
    const req = {
      body: JSON.stringify(body),
      headers: { "stripe-signature": "sig_test_valid" },
    } as any;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as any;
    return { req, res };
  }

  it("transitions pending_payment lesson to payment_collected", async () => {
    vi.mocked(db.getLessonById).mockResolvedValue(makeLessonRow({ status: "pending_payment" }));
    vi.mocked(db.updateLessonPaymentCollected).mockResolvedValue(undefined);
    vi.mocked(db.clearLessonCheckoutSession).mockResolvedValue(undefined as any);
    vi.mocked(db.getUserById).mockResolvedValue({ id: 1, name: "Student", email: "s@t.com" } as any);

    const { req, res } = createWebhookReqRes();
    await handleStripeWebhook(req, res);

    expect(db.updateLessonPaymentCollected).toHaveBeenCalledWith(100, "pi_test_123");
    expect(res.json).toHaveBeenCalledWith({ received: true });
  });

  it("does NOT transition confirmed lesson (already past payment_collected)", async () => {
    vi.mocked(db.getLessonById).mockResolvedValue(makeLessonRow({ status: "confirmed" }));

    const { req, res } = createWebhookReqRes();
    await handleStripeWebhook(req, res);

    expect(db.updateLessonPaymentCollected).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ received: true });
  });

  it("does NOT transition already payment_collected lesson (idempotent no-op)", async () => {
    vi.mocked(db.getLessonById).mockResolvedValue(makeLessonRow({ status: "payment_collected" }));

    const { req, res } = createWebhookReqRes();
    await handleStripeWebhook(req, res);

    expect(db.updateLessonPaymentCollected).not.toHaveBeenCalled();
  });

  it("does NOT transition released/completed lesson", async () => {
    vi.mocked(db.getLessonById).mockResolvedValue(makeLessonRow({ status: "released" }));

    const { req, res } = createWebhookReqRes();
    await handleStripeWebhook(req, res);

    expect(db.updateLessonPaymentCollected).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// lesson.confirmCompletion
// ═══════════════════════════════════════════════════════════════════════════════

describe("lesson.confirmCompletion (payment-first model)", () => {
  it("rejects when lesson status is 'payment_collected' (not yet coach-confirmed)", async () => {
    vi.mocked(db.getLessonById).mockResolvedValue(makeLessonRow({ status: "payment_collected" }));
    const caller = appRouter.createCaller(createContext());

    await expect(caller.lesson.confirmCompletion({ lessonId: 100 }))
      .rejects.toThrow("Lesson must be confirmed before it can be completed");
  });

  it("rejects when lesson status is 'pending_payment'", async () => {
    vi.mocked(db.getLessonById).mockResolvedValue(makeLessonRow({ status: "pending_payment" }));
    const caller = appRouter.createCaller(createContext());

    await expect(caller.lesson.confirmCompletion({ lessonId: 100 }))
      .rejects.toThrow("Lesson must be confirmed before it can be completed");
  });

  it("rejects confirmed lesson without stripePaymentIntentId", async () => {
    vi.mocked(db.getLessonById).mockResolvedValue(
      makeLessonRow({ status: "confirmed", stripePaymentIntentId: null })
    );
    const caller = appRouter.createCaller(createContext());

    await expect(caller.lesson.confirmCompletion({ lessonId: 100 }))
      .rejects.toThrow("Payment not recorded for this lesson");
  });

  it("succeeds for confirmed lesson — starts 24h issue window, does NOT capture payment", async () => {
    // Sprint 28: scheduledAt must be in the past (lesson end time + 15min grace must have passed)
    const pastScheduledAt = new Date(Date.now() - 2 * 60 * 60 * 1000); // started 2h ago
    vi.mocked(db.getLessonById).mockResolvedValue(
      makeLessonRow({
        status: "confirmed",
        stripePaymentIntentId: "pi_valid_123",
        scheduledAt: pastScheduledAt,
        durationMinutes: 60, // ended 1h ago, well past 15min grace
      })
    );
    vi.mocked(db.updateLessonStatus).mockResolvedValue(undefined);
    vi.mocked(db.updateStudentXp).mockResolvedValue(undefined);

    const caller = appRouter.createCaller(createContext());
    const result = await caller.lesson.confirmCompletion({ lessonId: 100 });

    // Payment-first model: NO capturePaymentIntent call (already captured at checkout)
    expect(stripeService.capturePaymentIntent).not.toHaveBeenCalled();
    // Status should be set to 'completed' (not 'released')
    expect(db.updateLessonStatus).toHaveBeenCalledWith(
      100,
      "completed",
      expect.objectContaining({
        studentConfirmedAt: expect.any(Date),
        completedAt: expect.any(Date),
        issueWindowEndsAt: expect.any(Date),
      })
    );
    // Verify issueWindowEndsAt is ~24 hours from now (not 48h)
    const callArgs = vi.mocked(db.updateLessonStatus).mock.calls[0];
    const issueWindowEndsAt = (callArgs[2] as any).issueWindowEndsAt as Date;
    const hoursFromNow = (issueWindowEndsAt.getTime() - Date.now()) / (1000 * 60 * 60);
    expect(hoursFromNow).toBeGreaterThan(23);
    expect(hoursFromNow).toBeLessThan(25);
    expect(result).toBeDefined();
  });

  it("rejects when lesson status is 'released' (already paid out)", async () => {
    vi.mocked(db.getLessonById).mockResolvedValue(makeLessonRow({ status: "released" }));
    const caller = appRouter.createCaller(createContext());

    await expect(caller.lesson.confirmCompletion({ lessonId: 100 }))
      .rejects.toThrow("Lesson must be confirmed before it can be completed");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// lesson.confirmAsCoach (payment-first model)
// ═════════════════════════════════════════════════════════════════════════════

describe("lesson.confirmAsCoach (payment-first model)", () => {
  function coachContext() {
    return createContext({ id: 2, role: "user", userType: "coach" });
  }

  it("rejects when lesson status is 'pending_payment' (not yet paid)", async () => {
    vi.mocked(db.getLessonById).mockResolvedValue(makeLessonRow({ status: "pending_payment", coachId: 2 }));
    const caller = appRouter.createCaller(coachContext());

    await expect(caller.lesson.confirmAsCoach({ lessonId: 100 }))
      .rejects.toThrow("Lesson cannot be confirmed in its current state");
  });

  it("rejects when lesson status is 'confirmed' (already accepted)", async () => {
    vi.mocked(db.getLessonById).mockResolvedValue(makeLessonRow({ status: "confirmed", coachId: 2 }));
    const caller = appRouter.createCaller(coachContext());

    await expect(caller.lesson.confirmAsCoach({ lessonId: 100 }))
      .rejects.toThrow("Lesson cannot be confirmed in its current state");
  });

   it("succeeds when lesson status is 'payment_collected'", async () => {
    vi.mocked(db.getLessonById).mockResolvedValue(
      makeLessonRow({ status: "payment_collected", coachId: 2, stripePaymentIntentId: "pi_123" })
    );
    vi.mocked(db.claimLessonCoachDecision).mockResolvedValue(true);
    vi.mocked(db.updateLessonStatus).mockResolvedValue(undefined);
    vi.mocked(db.getUserById).mockResolvedValue({ id: 1, name: "Student", email: "s@t.com" } as any);
    const caller = appRouter.createCaller(coachContext());
    const result = await caller.lesson.confirmAsCoach({ lessonId: 100 });
    expect(db.claimLessonCoachDecision).toHaveBeenCalledWith(100, "confirmed");
    expect(result).toEqual({ success: true });
  });;

  it("rejects when coach is not the lesson's coach", async () => {
    vi.mocked(db.getLessonById).mockResolvedValue(makeLessonRow({ status: "payment_collected", coachId: 99 }));
    const caller = appRouter.createCaller(coachContext());

    await expect(caller.lesson.confirmAsCoach({ lessonId: 100 }))
      .rejects.toThrow("Not your lesson");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// lesson.declineAsCoach (payment-first model)
// ═════════════════════════════════════════════════════════════════════════════

describe("lesson.declineAsCoach (payment-first model)", () => {
  function coachContext() {
    return createContext({ id: 2, role: "user", userType: "coach" });
  }

  it("rejects when lesson status is 'pending_payment' (not yet paid)", async () => {
    vi.mocked(db.getLessonById).mockResolvedValue(makeLessonRow({ status: "pending_payment", coachId: 2 }));
    const caller = appRouter.createCaller(coachContext());

    await expect(caller.lesson.declineAsCoach({ lessonId: 100 }))
      .rejects.toThrow("Lesson cannot be declined in its current state");
  });

  it("rejects when lesson status is 'confirmed' (already accepted)", async () => {
    vi.mocked(db.getLessonById).mockResolvedValue(makeLessonRow({ status: "confirmed", coachId: 2 }));
    const caller = appRouter.createCaller(coachContext());

    await expect(caller.lesson.declineAsCoach({ lessonId: 100 }))
      .rejects.toThrow("Lesson cannot be declined in its current state");
  });

   it("succeeds when lesson status is 'payment_collected' — triggers full refund", async () => {
    vi.mocked(db.getLessonById).mockResolvedValue(
      makeLessonRow({ status: "payment_collected", coachId: 2, stripePaymentIntentId: "pi_decline_123", amountCents: 5000 })
    );
    vi.mocked(db.claimLessonCoachDecision).mockResolvedValue(true);
    vi.mocked(db.finalizeCoachDecline).mockResolvedValue(undefined as any);
    vi.mocked(stripeService.createRefund).mockResolvedValue({ id: "re_123" } as any);
    vi.mocked(db.getUserById).mockResolvedValue({ id: 1, name: "Student", email: "s@t.com" } as any);
    const caller = appRouter.createCaller(coachContext());
    const result = await caller.lesson.declineAsCoach({ lessonId: 100, reason: "Schedule conflict" });
    // Full refund (no amount specified = full)
    expect(stripeService.createRefund).toHaveBeenCalledWith("pi_decline_123", undefined, "requested_by_customer");
    // CAS claimed to decline_pending, then finalized
    expect(db.claimLessonCoachDecision).toHaveBeenCalledWith(100, "decline_pending");
    expect(db.finalizeCoachDecline).toHaveBeenCalled();
    expect(result).toEqual({ success: true, refundAmountCents: 5000 });
  });;

   it("throws INTERNAL_SERVER_ERROR when Stripe refund fails — does NOT silently succeed", async () => {
    vi.mocked(db.getLessonById).mockResolvedValue(
      makeLessonRow({ status: "payment_collected", coachId: 2, stripePaymentIntentId: "pi_fail_123", amountCents: 5000 })
    );
    vi.mocked(db.claimLessonCoachDecision).mockResolvedValue(true);
    vi.mocked(db.releaseCoachDeclineClaim).mockResolvedValue(undefined as any);
    vi.mocked(db.finalizeCoachDecline).mockResolvedValue(undefined as any);
    vi.mocked(stripeService.createRefund).mockRejectedValue(new Error("Stripe error"));
    vi.mocked(db.getUserById).mockResolvedValue({ id: 1, name: "Student", email: "s@t.com" } as any);
    const caller = appRouter.createCaller(coachContext());
    // Sprint 29: CAS claim wins, Stripe fails, claim is released
    await expect(caller.lesson.declineAsCoach({ lessonId: 100 }))
      .rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    // CAS claim must be released for admin retry
    expect(db.releaseCoachDeclineClaim).toHaveBeenCalledWith(100);
    // Lesson must NOT be finalized to declined
    expect(db.finalizeCoachDecline).not.toHaveBeenCalled();
  });;
});

// ═════════════════════════════════════════════════════════════════════════════
// lesson.raiseIssue (24-hour issue window)
// ═════════════════════════════════════════════════════════════════════════════

describe("lesson.raiseIssue (24-hour issue window)", () => {
  it("rejects when lesson status is not 'completed'", async () => {
    vi.mocked(db.getLessonById).mockResolvedValue(makeLessonRow({ status: "confirmed" }));
    const caller = appRouter.createCaller(createContext());

    await expect(caller.lesson.raiseIssue({ lessonId: 100, reason: "Coach was late" }))
      .rejects.toThrow("Issues can only be raised for completed lessons");
  });

  it("rejects when 24-hour issue window has expired", async () => {
    const expiredWindow = new Date();
    expiredWindow.setHours(expiredWindow.getHours() - 1); // 1 hour ago
    vi.mocked(db.getLessonById).mockResolvedValue(
      makeLessonRow({ status: "completed", issueWindowEndsAt: expiredWindow })
    );
    const caller = appRouter.createCaller(createContext());

    await expect(caller.lesson.raiseIssue({ lessonId: 100, reason: "Coach was late" }))
      .rejects.toThrow("The 24-hour issue window has expired");
  });

  it("succeeds within issue window — marks as disputed", async () => {
    const futureWindow = new Date();
    futureWindow.setHours(futureWindow.getHours() + 12); // 12 hours from now
    vi.mocked(db.getLessonById).mockResolvedValue(
      makeLessonRow({ status: "completed", issueWindowEndsAt: futureWindow })
    );
    vi.mocked(db.updateLessonStatus).mockResolvedValue(undefined);
    vi.mocked(db.getUserById).mockResolvedValue({ id: 1, name: "Student" } as any);
    const { notifyOwner } = await import("./_core/notification");
    vi.mocked(notifyOwner).mockResolvedValue(true);

    const caller = appRouter.createCaller(createContext());
    const result = await caller.lesson.raiseIssue({ lessonId: 100, reason: "Coach was late" });

    expect(db.updateLessonStatus).toHaveBeenCalledWith(100, "disputed", expect.objectContaining({
      cancellationReason: "Coach was late",
    }));
    expect(result).toEqual({ success: true });
  });

  it("rejects when student is not the lesson's student", async () => {
    const futureWindow = new Date();
    futureWindow.setHours(futureWindow.getHours() + 12);
    vi.mocked(db.getLessonById).mockResolvedValue(
      makeLessonRow({ status: "completed", studentId: 99, issueWindowEndsAt: futureWindow })
    );
    const caller = appRouter.createCaller(createContext());

    await expect(caller.lesson.raiseIssue({ lessonId: 100, reason: "Issue" }))
      .rejects.toThrow("Not your lesson");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// content.recordPurchase
// ═══════════════════════════════════════════════════════════════════════════════

describe("content.recordPurchase", () => {
  const validPaymentIntent = {
    id: "pi_content_123",
    status: "succeeded",
    amount: 1999,
    currency: "usd",
    metadata: {
      user_id: "1",
      content_item_id: "42",
      type: "content_purchase",
    },
  };

  function mockDbForRecordPurchase(contentItem = { priceCents: 1999, currency: "USD" }) {
    const mockDatabase = {
      execute: vi.fn()
        // First call: check existing purchase (none found)
        .mockResolvedValueOnce([[]])
        // Second call: content item lookup
        .mockResolvedValueOnce([[contentItem]])
        // Third call: insert
        .mockResolvedValueOnce([{ insertId: 1 }]),
    };
    vi.mocked(db.getDb).mockResolvedValue(mockDatabase as any);
    return mockDatabase;
  }

  beforeEach(() => {
    // Mock the dynamic import of stripe
    vi.doMock("./stripe", () => ({
      stripe: {
        paymentIntents: {
          retrieve: vi.fn().mockResolvedValue(validPaymentIntent),
        },
      },
      ...stripeService,
    }));
  });

  it("rejects when metadata.user_id is missing", async () => {
    mockDbForRecordPurchase();
    const { stripe } = await import("./stripe");
    vi.mocked((stripe as any).paymentIntents.retrieve).mockResolvedValue({
      ...validPaymentIntent,
      metadata: { content_item_id: "42", type: "content_purchase" },
    });

    const caller = appRouter.createCaller(createContext());
    await expect(caller.content.recordPurchase({
      contentItemId: 42,
      stripePaymentIntentId: "pi_content_123",
    })).rejects.toThrow("PaymentIntent missing required metadata: user_id");
  });

  it("rejects when metadata.user_id doesn't match current user", async () => {
    mockDbForRecordPurchase();
    const { stripe } = await import("./stripe");
    vi.mocked((stripe as any).paymentIntents.retrieve).mockResolvedValue({
      ...validPaymentIntent,
      metadata: { ...validPaymentIntent.metadata, user_id: "999" },
    });

    const caller = appRouter.createCaller(createContext());
    await expect(caller.content.recordPurchase({
      contentItemId: 42,
      stripePaymentIntentId: "pi_content_123",
    })).rejects.toThrow("Payment does not belong to this user");
  });

  it("rejects when metadata.content_item_id is missing", async () => {
    mockDbForRecordPurchase();
    const { stripe } = await import("./stripe");
    vi.mocked((stripe as any).paymentIntents.retrieve).mockResolvedValue({
      ...validPaymentIntent,
      metadata: { user_id: "1", type: "content_purchase" },
    });

    const caller = appRouter.createCaller(createContext());
    await expect(caller.content.recordPurchase({
      contentItemId: 42,
      stripePaymentIntentId: "pi_content_123",
    })).rejects.toThrow("PaymentIntent missing required metadata: content_item_id");
  });

  it("rejects when metadata.content_item_id doesn't match input", async () => {
    mockDbForRecordPurchase();
    const { stripe } = await import("./stripe");
    vi.mocked((stripe as any).paymentIntents.retrieve).mockResolvedValue({
      ...validPaymentIntent,
      metadata: { ...validPaymentIntent.metadata, content_item_id: "99" },
    });

    const caller = appRouter.createCaller(createContext());
    await expect(caller.content.recordPurchase({
      contentItemId: 42,
      stripePaymentIntentId: "pi_content_123",
    })).rejects.toThrow("Payment does not match this content item");
  });

  it("rejects when metadata.type is not 'content_purchase'", async () => {
    mockDbForRecordPurchase();
    const { stripe } = await import("./stripe");
    vi.mocked((stripe as any).paymentIntents.retrieve).mockResolvedValue({
      ...validPaymentIntent,
      metadata: { ...validPaymentIntent.metadata, type: "lesson_payment" },
    });

    const caller = appRouter.createCaller(createContext());
    await expect(caller.content.recordPurchase({
      contentItemId: 42,
      stripePaymentIntentId: "pi_content_123",
    })).rejects.toThrow("must be 'content_purchase'");
  });

  it("rejects when payment amount doesn't match content item price", async () => {
    mockDbForRecordPurchase({ priceCents: 2999, currency: "USD" });
    const { stripe } = await import("./stripe");
    vi.mocked((stripe as any).paymentIntents.retrieve).mockResolvedValue(validPaymentIntent);

    const caller = appRouter.createCaller(createContext());
    await expect(caller.content.recordPurchase({
      contentItemId: 42,
      stripePaymentIntentId: "pi_content_123",
    })).rejects.toThrow("Payment amount mismatch");
  });

  it("rejects when payment currency doesn't match content item currency", async () => {
    mockDbForRecordPurchase({ priceCents: 1999, currency: "EUR" });
    const { stripe } = await import("./stripe");
    vi.mocked((stripe as any).paymentIntents.retrieve).mockResolvedValue(validPaymentIntent);

    const caller = appRouter.createCaller(createContext());
    await expect(caller.content.recordPurchase({
      contentItemId: 42,
      stripePaymentIntentId: "pi_content_123",
    })).rejects.toThrow("Payment currency mismatch");
  });

  it("handles duplicate PaymentIntent gracefully (idempotent)", async () => {
    const mockDatabase = {
      execute: vi.fn()
        // First call: check existing purchase (none found)
        .mockResolvedValueOnce([[]])
        // Second call: content item lookup
        .mockResolvedValueOnce([[{ priceCents: 1999, currency: "USD" }]])
        // Third call: insert throws duplicate entry
        .mockRejectedValueOnce({ errno: 1062, code: "ER_DUP_ENTRY" }),
    };
    vi.mocked(db.getDb).mockResolvedValue(mockDatabase as any);
    const { stripe } = await import("./stripe");
    vi.mocked((stripe as any).paymentIntents.retrieve).mockResolvedValue(validPaymentIntent);

    const caller = appRouter.createCaller(createContext());
    const result = await caller.content.recordPurchase({
      contentItemId: 42,
      stripePaymentIntentId: "pi_content_123",
    });

    expect(result).toEqual({ success: true, alreadyOwned: true });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// referral.recordSignup
// ═══════════════════════════════════════════════════════════════════════════════

describe("referral.recordSignup", () => {
  it("uses ctx.user.id (not client-supplied userId)", async () => {
    vi.mocked(db.getReferralCodeByCode).mockResolvedValue({
      id: 10, coachId: 2, code: "ABC123", isActive: true, totalUses: 0,
      createdAt: new Date(), updatedAt: new Date(),
    } as any);
    vi.mocked(db.createReferral).mockResolvedValue(undefined);
    vi.mocked(db.incrementReferralCodeUses).mockResolvedValue(undefined);

    const caller = appRouter.createCaller(createContext({ id: 5 }));
    await caller.referral.recordSignup({ code: "ABC123" });

    // createReferral should be called with ctx.user.id (5), not any client-supplied value
    expect(db.createReferral).toHaveBeenCalledWith({
      referralCodeId: 10,
      referredUserId: 5,
    });
  });

  it("blocks self-referral (coach cannot refer themselves)", async () => {
    vi.mocked(db.getReferralCodeByCode).mockResolvedValue({
      id: 10, coachId: 1, code: "SELF123", isActive: true, totalUses: 0,
      createdAt: new Date(), updatedAt: new Date(),
    } as any);

    const caller = appRouter.createCaller(createContext({ id: 1 }));
    const result = await caller.referral.recordSignup({ code: "SELF123" });

    expect(result).toEqual({ success: false });
    expect(db.createReferral).not.toHaveBeenCalled();
  });

  it("handles duplicate referred user without incrementing usage twice", async () => {
    vi.mocked(db.getReferralCodeByCode).mockResolvedValue({
      id: 10, coachId: 2, code: "DUP123", isActive: true, totalUses: 3,
      createdAt: new Date(), updatedAt: new Date(),
    } as any);
    vi.mocked(db.createReferral).mockRejectedValue({ errno: 1062, code: "ER_DUP_ENTRY" });

    const caller = appRouter.createCaller(createContext({ id: 7 }));
    const result = await caller.referral.recordSignup({ code: "DUP123" });

    expect(result).toEqual({ success: true, alreadyReferred: true });
    // Should NOT increment usage on duplicate
    expect(db.incrementReferralCodeUses).not.toHaveBeenCalled();
  });

  it("increments usage on first successful referral", async () => {
    vi.mocked(db.getReferralCodeByCode).mockResolvedValue({
      id: 10, coachId: 2, code: "NEW123", isActive: true, totalUses: 0,
      createdAt: new Date(), updatedAt: new Date(),
    } as any);
    vi.mocked(db.createReferral).mockResolvedValue(undefined);
    vi.mocked(db.incrementReferralCodeUses).mockResolvedValue(undefined);

    const caller = appRouter.createCaller(createContext({ id: 8 }));
    const result = await caller.referral.recordSignup({ code: "NEW123" });

    expect(result).toEqual({ success: true, alreadyReferred: false });
    expect(db.incrementReferralCodeUses).toHaveBeenCalledWith(10);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// user.deleteAccount
// ═══════════════════════════════════════════════════════════════════════════════

describe("user.deleteAccount", () => {
  it("requires password for password-backed users", async () => {
    vi.mocked(db.getUserById).mockResolvedValue({
      id: 1, email: "test@example.com", password: "$2a$10$hashedpassword",
      loginMethod: "email",
    } as any);

    const caller = appRouter.createCaller(createContext());
    await expect(caller.user.deleteAccount({}))
      .rejects.toThrow("Password is required to delete your account");
  });

  it("rejects incorrect password", async () => {
    vi.mocked(db.getUserById).mockResolvedValue({
      id: 1, email: "test@example.com", password: "$2a$10$hashedpassword",
      loginMethod: "email",
    } as any);

    // Mock the dynamic import of auth module
    const auth = await import("./auth");
    vi.mocked(auth.comparePassword).mockResolvedValue(false);

    const caller = appRouter.createCaller(createContext());
    await expect(caller.user.deleteAccount({ password: "wrongpass" }))
      .rejects.toThrow("Incorrect password");
  });

  it("allows deletion with correct password", async () => {
    vi.mocked(db.getUserById).mockResolvedValue({
      id: 1, email: "test@example.com", password: "$2a$10$hashedpassword",
      loginMethod: "email",
    } as any);
    vi.mocked(db.softDeleteUser).mockResolvedValue(undefined);

    const auth = await import("./auth");
    vi.mocked(auth.comparePassword).mockResolvedValue(true);

    const caller = appRouter.createCaller(createContext());
    const result = await caller.user.deleteAccount({ password: "correctpass" });

    expect(result).toEqual({ success: true });
    expect(db.softDeleteUser).toHaveBeenCalledWith(1);
  });

  it("allows deletion without password for OAuth users", async () => {
    vi.mocked(db.getUserById).mockResolvedValue({
      id: 1, email: "test@example.com", password: null,
      loginMethod: "manus",
    } as any);
    vi.mocked(db.softDeleteUser).mockResolvedValue(undefined);

    const caller = appRouter.createCaller(createContext());
    const result = await caller.user.deleteAccount({});

    expect(result).toEqual({ success: true });
    expect(db.softDeleteUser).toHaveBeenCalledWith(1);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Sprint 28 — Hardened payment-first model behavioral tests
// ═════════════════════════════════════════════════════════════════════════════

// ─── S28-1: declineAsCoach — Stripe failure must NOT silently succeed ─────────
describe("S28-1: declineAsCoach — Stripe refund failure throws, does not silently succeed", () => {
  function coachCtx() { return createContext({ id: 2, role: "user", userType: "coach" }); }

  it("throws INTERNAL_SERVER_ERROR when Stripe refund fails — lesson stays in payment_collected", async () => {
    vi.mocked(db.getLessonById).mockResolvedValue(
      makeLessonRow({ status: "payment_collected", coachId: 2, stripePaymentIntentId: "pi_fail_s28", amountCents: 5000 })
    );
    vi.mocked(db.claimLessonCoachDecision).mockResolvedValue(true);
    vi.mocked(db.releaseCoachDeclineClaim).mockResolvedValue(undefined as any);
    vi.mocked(db.finalizeCoachDecline).mockResolvedValue(undefined as any);
    vi.mocked(stripeService.createRefund).mockRejectedValue(new Error("Stripe network error"));

    const caller = appRouter.createCaller(coachCtx());
    await expect(caller.lesson.declineAsCoach({ lessonId: 100 }))
      .rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });

    // CAS claim must be released for admin retry
    expect(db.releaseCoachDeclineClaim).toHaveBeenCalledWith(100);
    // Must NOT finalize to declined
    expect(db.finalizeCoachDecline).not.toHaveBeenCalled();
  });

  it("throws when no stripePaymentIntentId — CAS wins but no PI to refund", async () => {
    vi.mocked(db.getLessonById).mockResolvedValue(
      makeLessonRow({ status: "payment_collected", coachId: 2, stripePaymentIntentId: null, amountCents: 5000 })
    );
    vi.mocked(db.claimLessonCoachDecision).mockResolvedValue(true);
    vi.mocked(db.releaseCoachDeclineClaim).mockResolvedValue(undefined as any);
    vi.mocked(db.finalizeCoachDecline).mockResolvedValue(undefined as any);

    const caller = appRouter.createCaller(coachCtx());
    await expect(caller.lesson.declineAsCoach({ lessonId: 100 }))
      .rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });

    // Stripe refund must NOT be attempted
    expect(stripeService.createRefund).not.toHaveBeenCalled();
  });

  it("succeeds and finalizes ONLY after Stripe refund succeeds", async () => {
    vi.mocked(db.getLessonById).mockResolvedValue(
      makeLessonRow({ status: "payment_collected", coachId: 2, stripePaymentIntentId: "pi_ok_s28", amountCents: 5000 })
    );
    vi.mocked(db.claimLessonCoachDecision).mockResolvedValue(true);
    vi.mocked(db.finalizeCoachDecline).mockResolvedValue(undefined as any);
    vi.mocked(stripeService.createRefund).mockResolvedValue({ id: "re_ok_s28" } as any);
    vi.mocked(db.getUserById).mockResolvedValue({ id: 1, name: "Student", email: "s@t.com" } as any);

    const caller = appRouter.createCaller(coachCtx());
    const result = await caller.lesson.declineAsCoach({ lessonId: 100 });

    expect(result).toEqual({ success: true, refundAmountCents: 5000 });
    // CAS claimed to decline_pending, finalized after successful refund
    expect(db.claimLessonCoachDecision).toHaveBeenCalledWith(100, "decline_pending");
    expect(db.finalizeCoachDecline).toHaveBeenCalled();
  });
});

// ─── S28-2: confirmCompletion — lesson end time must have passed ──────────────
describe("S28-2: confirmCompletion — rejects if lesson has not ended yet", () => {
  it("rejects when scheduledAt + duration is in the future", async () => {
    const futureLesson = makeLessonRow({
      status: "confirmed",
      stripePaymentIntentId: "pi_future",
      scheduledAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2h from now
      durationMinutes: 60,
    });
    vi.mocked(db.getLessonById).mockResolvedValue(futureLesson);

    const caller = appRouter.createCaller(createContext());
    await expect(caller.lesson.confirmCompletion({ lessonId: 100 }))
      .rejects.toThrow("The lesson has not ended yet");
  });

  it("rejects when lesson just started (within duration + grace period)", async () => {
    const recentLesson = makeLessonRow({
      status: "confirmed",
      stripePaymentIntentId: "pi_recent",
      scheduledAt: new Date(Date.now() - 30 * 60 * 1000), // started 30 min ago
      durationMinutes: 60, // ends in 30 min + 15 min grace = still in future
    });
    vi.mocked(db.getLessonById).mockResolvedValue(recentLesson);

    const caller = appRouter.createCaller(createContext());
    await expect(caller.lesson.confirmCompletion({ lessonId: 100 }))
      .rejects.toThrow("The lesson has not ended yet");
  });

  it("succeeds when lesson ended more than 15 minutes ago", async () => {
    const pastLesson = makeLessonRow({
      status: "confirmed",
      stripePaymentIntentId: "pi_past",
      scheduledAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // started 2h ago
      durationMinutes: 60, // ended 1h ago, well past 15 min grace
    });
    vi.mocked(db.getLessonById).mockResolvedValue(pastLesson);
    vi.mocked(db.updateLessonStatus).mockResolvedValue(undefined);
    vi.mocked(db.updateStudentXp).mockResolvedValue(undefined);

    const caller = appRouter.createCaller(createContext());
    const result = await caller.lesson.confirmCompletion({ lessonId: 100 });

    expect(result).toEqual({ success: true });
    expect(db.updateLessonStatus).toHaveBeenCalledWith(100, "completed", expect.objectContaining({
      issueWindowEndsAt: expect.any(Date),
    }));
  });
});

// ─── S28-3: releasePayout — enforce issueWindowEndsAt ─────────────────────────
describe("S28-3: releasePayout — enforces issue window expiry and atomic CAS", () => {
  function adminCtx() { return createContext({ id: 99, role: "admin" }); }

  it("rejects when issueWindowEndsAt is null (no window set)", async () => {
    vi.mocked(db.getLessonById).mockResolvedValue(
      makeLessonRow({ status: "completed", stripePaymentIntentId: "pi_nowindow", issueWindowEndsAt: null })
    );

    const caller = appRouter.createCaller(adminCtx());
    await expect(caller.admin.disputes.releasePayout({ lessonId: 100 }))
      .rejects.toThrow("no issue window set");
  });

  it("rejects when issue window has not expired yet", async () => {
    const futureWindow = new Date(Date.now() + 12 * 60 * 60 * 1000); // 12h from now
    vi.mocked(db.getLessonById).mockResolvedValue(
      makeLessonRow({ status: "completed", stripePaymentIntentId: "pi_window_active", issueWindowEndsAt: futureWindow })
    );

    const caller = appRouter.createCaller(adminCtx());
    await expect(caller.admin.disputes.releasePayout({ lessonId: 100 }))
      .rejects.toThrow("Issue window has not expired yet");
  });

  it("rejects when lesson is disputed and no adminOverrideReason provided", async () => {
    vi.mocked(db.getLessonById).mockResolvedValue(
      makeLessonRow({ status: "disputed", stripePaymentIntentId: "pi_disputed" })
    );

    const caller = appRouter.createCaller(adminCtx());
    await expect(caller.admin.disputes.releasePayout({ lessonId: 100 }))
      .rejects.toThrow("Admin override reason is required for disputed lessons");
  });

  it("rejects when CAS fails (concurrent payout in progress)", async () => {
    const expiredWindow = new Date(Date.now() - 60 * 60 * 1000); // 1h ago
    vi.mocked(db.getLessonById).mockResolvedValue(
      makeLessonRow({
        status: "completed",
        stripePaymentIntentId: "pi_cas_test",
        issueWindowEndsAt: expiredWindow,
        stripeTransferId: null,
      })
    );
    vi.mocked(db.getUserById).mockResolvedValue({
      id: 2, stripeConnectAccountId: "acct_coach123"
    } as any);
    // CAS returns false = another request already claimed it
    vi.mocked(db.claimLessonPayoutSlot).mockResolvedValue(false);

    const caller = appRouter.createCaller(adminCtx());
    await expect(caller.admin.disputes.releasePayout({ lessonId: 100 }))
      .rejects.toThrow("Payout already claimed by a concurrent request");
  });

  it("releases payout slot on Stripe transfer failure", async () => {
    const expiredWindow = new Date(Date.now() - 60 * 60 * 1000);
    vi.mocked(db.getLessonById).mockResolvedValue(
      makeLessonRow({
        status: "completed",
        stripePaymentIntentId: "pi_transfer_fail",
        issueWindowEndsAt: expiredWindow,
        stripeTransferId: null,
      })
    );
    vi.mocked(db.getUserById).mockResolvedValue({
      id: 2, stripeConnectAccountId: "acct_coach123"
    } as any);
    vi.mocked(db.claimLessonPayoutSlot).mockResolvedValue(true);
    vi.mocked(stripeConnect.transferToCoach).mockResolvedValue({ success: false, error: "Network error" });
    vi.mocked(db.releaseLessonPayoutSlot).mockResolvedValue(undefined);

    const caller = appRouter.createCaller(adminCtx());
    await expect(caller.admin.disputes.releasePayout({ lessonId: 100 }))
      .rejects.toThrow("Transfer failed: Network error");

    // Slot must be released so admin can retry
    expect(db.releaseLessonPayoutSlot).toHaveBeenCalledWith(100);
    // finalizeLessonPayout must NOT be called
    expect(db.finalizeLessonPayout).not.toHaveBeenCalled();
  });

  it("succeeds with idempotency key when window expired and CAS wins", async () => {
    const expiredWindow = new Date(Date.now() - 60 * 60 * 1000);
    vi.mocked(db.getLessonById).mockResolvedValue(
      makeLessonRow({
        id: 100,
        status: "completed",
        stripePaymentIntentId: "pi_success_s28",
        issueWindowEndsAt: expiredWindow,
        stripeTransferId: null,
        coachPayoutCents: 4500,
        currency: "usd",
        coachId: 2,
        studentId: 1,
      })
    );
    vi.mocked(db.getUserById).mockResolvedValue({
      id: 2, stripeConnectAccountId: "acct_coach123"
    } as any);
    vi.mocked(db.claimLessonPayoutSlot).mockResolvedValue(true);
    vi.mocked(stripeConnect.transferToCoach).mockResolvedValue({ success: true, transferId: "tr_s28_ok" });
    vi.mocked(db.finalizeLessonPayout).mockResolvedValue(undefined);

    const caller = appRouter.createCaller(adminCtx());
    const result = await caller.admin.disputes.releasePayout({ lessonId: 100 });

    expect(result).toEqual({ success: true, transferId: "tr_s28_ok" });
    // Idempotency key must be deterministic
    expect(stripeConnect.transferToCoach).toHaveBeenCalledWith(expect.objectContaining({
      idempotencyKey: "lesson_payout_100",
    }));
    // Finalize must be called (not updateLessonTransfer)
    expect(db.finalizeLessonPayout).toHaveBeenCalledWith(100, "tr_s28_ok");
  });

  it("returns alreadyReleased=true when payout was already finalized (idempotent retry)", async () => {
    vi.mocked(db.getLessonById).mockResolvedValue(
      makeLessonRow({
        status: "completed",
        stripePaymentIntentId: "pi_already",
        stripeTransferId: "tr_already_done",
      })
    );

    const caller = appRouter.createCaller(adminCtx());
    const result = await caller.admin.disputes.releasePayout({ lessonId: 100 });

    expect(result).toEqual({ success: true, transferId: "tr_already_done", alreadyReleased: true });
    expect(stripeConnect.transferToCoach).not.toHaveBeenCalled();
  });
});

// ─── S28-4: autoDeclineStaleBookings — processes payment_collected ─────────────
describe("S28-4: autoDeclineStaleBookings — processes payment_collected with full refund", () => {
  it("processes payment_collected lessons past deadline with full Stripe refund", async () => {
    // This tests the scheduler function directly
    const { autoDeclineStaleBookings } = await import("./reminderScheduler");
    const executeMock = vi.fn();
    // SELECT: one stale payment_collected lesson
    executeMock.mockResolvedValueOnce([[
      {
        id: 200,
        studentId: 1,
        coachId: 2,
        status: "payment_collected",
        stripePaymentIntentId: "pi_stale_200",
        amountCents: 6000,
      }
    ]]);
    // CAS UPDATE: claim to decline_pending succeeds (affectedRows: 1)
    executeMock.mockResolvedValueOnce([{ affectedRows: 1 }]);
    // Finalize UPDATE to declined
    executeMock.mockResolvedValueOnce([{ affectedRows: 1 }]);
    vi.mocked(db.getDb).mockResolvedValue({ execute: executeMock } as any);
    vi.mocked(db.getLessonById).mockResolvedValue(
      makeLessonRow({ id: 200, status: "decline_pending", stripePaymentIntentId: "pi_stale_200" })
    );
    vi.mocked(stripeService.createRefund).mockResolvedValue({ id: "re_stale_200" } as any);
    vi.mocked(db.getUserById).mockResolvedValue({ id: 1, name: "Student", email: "s@t.com" } as any);
    await autoDeclineStaleBookings();
    // Must attempt Stripe refund for payment_collected lesson
    expect(stripeService.createRefund).toHaveBeenCalledWith("pi_stale_200", undefined, "requested_by_customer");
  });
});

// ─── S28-5: autoCompletePastLessons — sets issueWindowEndsAt ──────────────────
describe("S28-5: autoCompletePastLessons — always sets issueWindowEndsAt on completion", () => {
  it("sets issueWindowEndsAt in the UPDATE query when completing a confirmed lesson", async () => {
    const { autoCompletePastLessons } = await import("./reminderScheduler");

    // First call: SELECT returns a past lesson
    // Second call: UPDATE (affectedRows check)
    let callCount = 0;
    const executeMock = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // SELECT result
        return Promise.resolve([[
          { id: 300, status: "confirmed", durationMinutes: 60, scheduledAt: new Date(Date.now() - 3 * 60 * 60 * 1000) }
        ], []]);
      }
      // UPDATE result
      return Promise.resolve([{ affectedRows: 1 }, []]);
    });

    vi.mocked(db.getDb).mockResolvedValue({
      execute: executeMock,
    } as any);

    await autoCompletePastLessons();

    // Should have been called twice: once for SELECT, once for UPDATE
    expect(executeMock).toHaveBeenCalledTimes(2);

    // The UPDATE call (2nd call) must reference issueWindowEndsAt.
    // Drizzle sql`` template produces an object with queryChunks array.
    const updateCallArg = executeMock.mock.calls[1]?.[0];
    // The sql template tag serializes to an object with a queryChunks array.
    // We check the serialized string representation contains the column name.
    const sqlStr = JSON.stringify(updateCallArg);
    expect(sqlStr).toMatch(/issueWindowEndsAt|issue_window_ends_at/);
  });
});

// ============================================================
// Sprint 29: Atomic Settlement Hardening Tests
// ============================================================

describe("S29-1: Atomic coach accept/decline CAS", () => {
  function coachCtx() { return createContext({ id: 2, role: "user", userType: "coach" }); }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.getLessonById).mockResolvedValue(
      makeLessonRow({ status: "payment_collected", coachId: 2, stripePaymentIntentId: "pi_test_123" })
    );
    vi.mocked(db.getUserById).mockResolvedValue({
      id: 1, name: "Student", email: "student@test.com",
      stripeConnectAccountId: null,
    } as any);
  });

  it("confirmAsCoach wins the CAS and confirms the lesson", async () => {
    vi.mocked(db.claimLessonCoachDecision).mockResolvedValue(true);
    vi.mocked(db.updateLessonStatus).mockResolvedValue(undefined as any);

    const caller = appRouter.createCaller(coachCtx());
    const result = await caller.lesson.confirmAsCoach({ lessonId: 100 });

    expect(db.claimLessonCoachDecision).toHaveBeenCalledWith(100, "confirmed");
    expect(result.success).toBe(true);
  });

  it("confirmAsCoach throws CONFLICT when CAS is lost (concurrent decline won)", async () => {
    vi.mocked(db.claimLessonCoachDecision).mockResolvedValue(false);

    const caller = appRouter.createCaller(coachCtx());
    await expect(
      caller.lesson.confirmAsCoach({ lessonId: 100 })
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("declineAsCoach wins the CAS, refunds, and finalizes to declined", async () => {
    vi.mocked(db.claimLessonCoachDecision).mockResolvedValue(true);
    vi.mocked(stripeService.createRefund).mockResolvedValue({ id: "re_test" } as any);
    vi.mocked(db.finalizeCoachDecline).mockResolvedValue(undefined as any);

    const caller = appRouter.createCaller(coachCtx());
    const result = await caller.lesson.declineAsCoach({ lessonId: 100, reason: "Unavailable" });

    expect(db.claimLessonCoachDecision).toHaveBeenCalledWith(100, "decline_pending");
    expect(db.finalizeCoachDecline).toHaveBeenCalled();
    expect(result.success).toBe(true);
  });

  it("declineAsCoach throws CONFLICT when CAS is lost (concurrent accept won)", async () => {
    vi.mocked(db.claimLessonCoachDecision).mockResolvedValue(false);

    const caller = appRouter.createCaller(coachCtx());
    await expect(
      caller.lesson.declineAsCoach({ lessonId: 100 })
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("declineAsCoach releases CAS claim and throws when Stripe refund fails", async () => {
    vi.mocked(db.claimLessonCoachDecision).mockResolvedValue(true);
    vi.mocked(stripeService.createRefund).mockRejectedValue(new Error("Stripe error"));
    vi.mocked(db.releaseCoachDeclineClaim).mockResolvedValue(undefined as any);
    vi.mocked(db.finalizeCoachDecline).mockResolvedValue(undefined as any);

    const caller = appRouter.createCaller(coachCtx());
    await expect(
      caller.lesson.declineAsCoach({ lessonId: 100 })
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });

    // CAS must be released so admin can retry
    expect(db.releaseCoachDeclineClaim).toHaveBeenCalledWith(100);
    // Must NOT finalize to declined
    expect(db.finalizeCoachDecline).not.toHaveBeenCalled();
  });

  it("no confirmed lesson can be refunded via concurrent decline (status guard prevents it)", async () => {
    // Simulate: lesson was already confirmed — status guard rejects before CAS
    vi.mocked(db.getLessonById).mockResolvedValue(
      makeLessonRow({ status: "confirmed", coachId: 2, stripePaymentIntentId: "pi_test_123" })
    );

    const caller = appRouter.createCaller(coachCtx());
    await expect(
      caller.lesson.declineAsCoach({ lessonId: 100 })
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });

    // Stripe refund must never be called for a confirmed lesson
    expect(stripeService.createRefund).not.toHaveBeenCalled();
    expect(db.claimLessonCoachDecision).not.toHaveBeenCalled();
  });
});

describe("S29-2: Race-safe autoDeclineStaleBookings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.getLessonById).mockResolvedValue(
      makeLessonRow({ id: 42, status: "decline_pending", stripePaymentIntentId: "pi_test_race" })
    );
    vi.mocked(db.getUserById).mockResolvedValue({
      id: 1, name: "User", email: "user@test.com",
    } as any);
  });

  it("skips lesson when CAS claim returns 0 affectedRows (coach accepted first)", async () => {
    const executeMock = vi.fn();
    // SELECT returns one payment_collected lesson
    executeMock.mockResolvedValueOnce([[{
      id: 42,
      status: "payment_collected",
      stripePaymentIntentId: "pi_test_race",
      amountCents: 5000,
    }]]);
    // CAS UPDATE returns 0 affectedRows (coach accepted between scan and claim)
    executeMock.mockResolvedValueOnce([{ affectedRows: 0 }]);

    vi.mocked(db.getDb).mockResolvedValue({ execute: executeMock } as any);

    const { autoDeclineStaleBookings } = await import("./reminderScheduler");
    await autoDeclineStaleBookings();

    // Stripe must NOT be called — the row was already acted on
    expect(stripeService.createRefund).not.toHaveBeenCalled();
    // Only 2 execute calls: SELECT + failed CAS UPDATE
    expect(executeMock).toHaveBeenCalledTimes(2);
  });

  it("claims row atomically and refunds when CAS succeeds", async () => {
    const executeMock = vi.fn();
    executeMock.mockResolvedValueOnce([[{
      id: 43,
      status: "payment_collected",
      stripePaymentIntentId: "pi_test_stale",
      amountCents: 8000,
    }]]);
    // CAS claim succeeds
    executeMock.mockResolvedValueOnce([{ affectedRows: 1 }]);
    // Finalize to declined
    executeMock.mockResolvedValueOnce([{ affectedRows: 1 }]);

    vi.mocked(db.getLessonById).mockResolvedValue(
      makeLessonRow({ id: 43, status: "decline_pending", stripePaymentIntentId: "pi_test_stale" })
    );
    vi.mocked(db.getDb).mockResolvedValue({ execute: executeMock } as any);
    vi.mocked(stripeService.createRefund).mockResolvedValue({ id: "re_auto" } as any);

    const { autoDeclineStaleBookings } = await import("./reminderScheduler");
    await autoDeclineStaleBookings();

    expect(stripeService.createRefund).toHaveBeenCalledWith("pi_test_stale", undefined, "requested_by_customer");
  });
});

describe("S29-3: Shared settlement guard (refund vs payout)", () => {
  function adminCtx() { return createContext({ id: 1, role: "admin" }); }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.getUserById).mockResolvedValue({
      id: 1, name: "Admin", email: "admin@test.com", role: "admin",
    } as any);
  });

  it("refundStudent throws CONFLICT when __pending_payout__ is set", async () => {
    vi.mocked(db.getLessonById).mockResolvedValue(
      makeLessonRow({
        status: "disputed",
        stripePaymentIntentId: "pi_test_456",
        stripeTransferId: "__pending_payout__",
      })
    );

    const caller = appRouter.createCaller(adminCtx());
    await expect(
      caller.admin.disputes.refundStudent({ lessonId: 100 })
    ).rejects.toMatchObject({ code: "CONFLICT" });

    expect(stripeService.createRefund).not.toHaveBeenCalled();
  });

  it("refundStudent throws PRECONDITION_FAILED when real transfer ID is set", async () => {
    vi.mocked(db.getLessonById).mockResolvedValue(
      makeLessonRow({
        status: "disputed",
        stripePaymentIntentId: "pi_test_456",
        stripeTransferId: "tr_real_transfer_id",
      })
    );

    const caller = appRouter.createCaller(adminCtx());
    await expect(
      caller.admin.disputes.refundStudent({ lessonId: 100 })
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });

    expect(stripeService.createRefund).not.toHaveBeenCalled();
  });

  it("refundStudent succeeds when no transfer is set", async () => {
    vi.mocked(db.getLessonById).mockResolvedValue(
      makeLessonRow({
        status: "disputed",
        stripePaymentIntentId: "pi_test_456",
        stripeTransferId: null,
        amountCents: 5000,
      })
    );
    // S30-1: CAS claim must succeed for refund to proceed
    vi.mocked(db.claimLessonRefundSlot).mockResolvedValue(true);
    vi.mocked(stripeService.createRefund).mockResolvedValue({ id: "re_admin" } as any);
    vi.mocked(db.finalizeAdminRefund).mockResolvedValue(undefined as any);

    const caller = appRouter.createCaller(adminCtx());
    const result = await caller.admin.disputes.refundStudent({ lessonId: 100 });

    expect(result.success).toBe(true);
    expect(db.claimLessonRefundSlot).toHaveBeenCalledWith(100);
    expect(stripeService.createRefund).toHaveBeenCalled();
    expect(db.finalizeAdminRefund).toHaveBeenCalled();
  });
});

describe("S29-4: Hardened student cancellation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.getLessonById).mockResolvedValue(
      makeLessonRow({ status: "confirmed", stripePaymentIntentId: "pi_test_cancel" })
    );
    vi.mocked(db.getUserById).mockResolvedValue({
      id: 1, name: "Student", email: "student@test.com",
    } as any);
  });

  it("cancel succeeds and refunds when CAS claim succeeds and Stripe succeeds", async () => {
    vi.mocked(db.claimLessonCancellation).mockResolvedValue({
      refundAmountCents: 5000,
      refundPercentage: 100,
    } as any);
    vi.mocked(stripeService.createRefund).mockResolvedValue({ id: "re_cancel" } as any);
    vi.mocked(db.finalizeCancellation).mockResolvedValue(undefined as any);

    const caller = appRouter.createCaller(createContext());
    const result = await caller.lesson.cancel({ lessonId: 100 });

    expect(db.claimLessonCancellation).toHaveBeenCalledWith(100, "student", undefined);
    expect(db.finalizeCancellation).toHaveBeenCalledWith(100, true);
    expect(result.success).toBe(true);
    expect(result.refundAmountCents).toBe(5000);
  });

  it("cancel throws and flags refund_failed when Stripe fails (no false success)", async () => {
    vi.mocked(db.claimLessonCancellation).mockResolvedValue({
      refundAmountCents: 5000,
      refundPercentage: 100,
    } as any);
    vi.mocked(stripeService.createRefund).mockRejectedValue(new Error("Stripe down"));
    vi.mocked(db.releaseCancellationWithRefundFailed).mockResolvedValue(undefined as any);
    vi.mocked(db.finalizeCancellation).mockResolvedValue(undefined as any);

    const caller = appRouter.createCaller(createContext());
    await expect(
      caller.lesson.cancel({ lessonId: 100 })
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });

    expect(db.releaseCancellationWithRefundFailed).toHaveBeenCalledWith(100);
    // Must NOT finalize to cancelled with success
    expect(db.finalizeCancellation).not.toHaveBeenCalled();
  });

  it("cancel throws PRECONDITION_FAILED when CAS fails (already cancelled)", async () => {
    vi.mocked(db.claimLessonCancellation).mockResolvedValue(null);

    const caller = appRouter.createCaller(createContext());
    await expect(
      caller.lesson.cancel({ lessonId: 100 })
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });

    expect(stripeService.createRefund).not.toHaveBeenCalled();
  });

  it("cancel succeeds without Stripe call when no refund is due (no-refund policy)", async () => {
    vi.mocked(db.claimLessonCancellation).mockResolvedValue({
      refundAmountCents: 0,
      refundPercentage: 0,
    } as any);
    vi.mocked(db.finalizeCancellation).mockResolvedValue(undefined as any);

    const caller = appRouter.createCaller(createContext());
    const result = await caller.lesson.cancel({ lessonId: 100 });

    expect(stripeService.createRefund).not.toHaveBeenCalled();
    expect(db.finalizeCancellation).toHaveBeenCalledWith(100, true);
    expect(result.success).toBe(true);
    expect(result.refundAmountCents).toBe(0);
  });
});

describe("S29-5: Recovery scan for stuck pending states", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.getUserById).mockResolvedValue({
      id: 2, name: "Coach", email: "coach@test.com",
      stripeConnectAccountId: "acct_test",
    } as any);
  });

  it("recovers decline_pending lesson by re-attempting Stripe refund", async () => {
    const executeMock = vi.fn();
    // SELECT: one decline_pending lesson stuck > 10 min
    executeMock.mockResolvedValueOnce([[{
      id: 99,
      status: "decline_pending",
      stripePaymentIntentId: "pi_test_stuck",
      amountCents: 6000,
      stripeTransferId: null,
      coachId: 2,
    }]]);
    // UPDATE to finalize to declined
    executeMock.mockResolvedValueOnce([{ affectedRows: 1 }]);
    // SELECT: no stuck __pending_payout__ lessons
    executeMock.mockResolvedValueOnce([[]]);

    vi.mocked(db.getDb).mockResolvedValue({ execute: executeMock } as any);
    vi.mocked(stripeService.createRefund).mockResolvedValue({ id: "re_recovered" } as any);

    const { recoverStuckPendingStates } = await import("./reminderScheduler");
    await recoverStuckPendingStates();

    // S30-2: recovery now passes a deterministic idempotency key
    expect(stripeService.createRefund).toHaveBeenCalledWith("pi_test_stuck", undefined, "requested_by_customer", "lesson_decline_refund_99");
    // Should finalize to declined
    const updateCall = executeMock.mock.calls[1]?.[0];
    const sqlStr = JSON.stringify(updateCall);
    expect(sqlStr).toMatch(/declined/);
  });

  it("treats charge_already_refunded as success during recovery", async () => {
    const executeMock = vi.fn();
    executeMock.mockResolvedValueOnce([[{
      id: 100,
      status: "decline_pending",
      stripePaymentIntentId: "pi_test_already",
      amountCents: 4000,
      stripeTransferId: null,
      coachId: 2,
    }]]);
    executeMock.mockResolvedValueOnce([{ affectedRows: 1 }]);
    executeMock.mockResolvedValueOnce([[]]);

    vi.mocked(db.getDb).mockResolvedValue({ execute: executeMock } as any);
    const alreadyRefundedError = Object.assign(new Error("already refunded"), {
      raw: { code: "charge_already_refunded" },
    });
    vi.mocked(stripeService.createRefund).mockRejectedValue(alreadyRefundedError);

    const { recoverStuckPendingStates } = await import("./reminderScheduler");
    await recoverStuckPendingStates();

    // Should still finalize to declined (Stripe already processed it)
    const updateCall = executeMock.mock.calls[1]?.[0];
    const sqlStr = JSON.stringify(updateCall);
    expect(sqlStr).toMatch(/declined/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Sprint 30 — Final Payment Settlement Hardening
// ═══════════════════════════════════════════════════════════════════════════════

describe("S30-1: Atomic admin refund vs payout — shared settlement claim", () => {
  it("refundStudent wins the CAS claim and calls Stripe when no payout is in flight", async () => {
    const adminCtx = createContext({ role: "admin" as any });
    const caller = appRouter.createCaller(adminCtx);

    vi.mocked(db.getLessonById).mockResolvedValue(
      makeLessonRow({
        status: "disputed",
        stripePaymentIntentId: "pi_disputed_001",
        stripeTransferId: null,
        amountCents: 5000,
      })
    );
    vi.mocked(db.claimLessonRefundSlot).mockResolvedValue(true);
    vi.mocked(stripeService.createRefund).mockResolvedValue({ id: "re_001" } as any);
    vi.mocked(db.finalizeAdminRefund).mockResolvedValue();

    const result = await caller.admin.disputes.refundStudent({ lessonId: 100 });
    expect(result.success).toBe(true);
    expect(db.claimLessonRefundSlot).toHaveBeenCalledWith(100);
    expect(stripeService.createRefund).toHaveBeenCalledWith(
      "pi_disputed_001",
      undefined, // full refund (amountCents not passed, defaults to lesson.amountCents)
      "requested_by_customer",
      "lesson_admin_refund_100_5000"
    );
    expect(db.finalizeAdminRefund).toHaveBeenCalledWith(100, 5000, "Admin refund");
  });

  it("refundStudent loses the CAS claim when payout is in flight — throws CONFLICT", async () => {
    const adminCtx = createContext({ role: "admin" as any });
    const caller = appRouter.createCaller(adminCtx);

    vi.mocked(db.getLessonById)
      .mockResolvedValueOnce(
        makeLessonRow({
          status: "disputed",
          stripePaymentIntentId: "pi_disputed_002",
          stripeTransferId: null, // first read: no transfer yet
        })
      )
      .mockResolvedValueOnce(
        makeLessonRow({
          status: "disputed",
          stripePaymentIntentId: "pi_disputed_002",
          stripeTransferId: "__pending_payout__", // second read: payout claimed it first
        })
      );
    vi.mocked(db.claimLessonRefundSlot).mockResolvedValue(false); // lost the race

    await expect(
      caller.admin.disputes.refundStudent({ lessonId: 100 })
    ).rejects.toMatchObject({ code: "CONFLICT" });

    // Stripe must NOT have been called
    expect(stripeService.createRefund).not.toHaveBeenCalled();
    expect(db.finalizeAdminRefund).not.toHaveBeenCalled();
  });

  it("refundStudent releases the claim and throws when Stripe fails", async () => {
    const adminCtx = createContext({ role: "admin" as any });
    const caller = appRouter.createCaller(adminCtx);

    vi.mocked(db.getLessonById).mockResolvedValue(
      makeLessonRow({
        status: "disputed",
        stripePaymentIntentId: "pi_disputed_003",
        stripeTransferId: null,
        amountCents: 5000,
      })
    );
    vi.mocked(db.claimLessonRefundSlot).mockResolvedValue(true);
    vi.mocked(stripeService.createRefund).mockRejectedValue(new Error("card_declined"));
    vi.mocked(db.releaseAdminRefundClaim).mockResolvedValue();

    await expect(
      caller.admin.disputes.refundStudent({ lessonId: 100 })
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });

    expect(db.releaseAdminRefundClaim).toHaveBeenCalledWith(100);
    expect(db.finalizeAdminRefund).not.toHaveBeenCalled();
  });

  it("refundStudent rejects when payout already completed (real transfer ID)", async () => {
    const adminCtx = createContext({ role: "admin" as any });
    const caller = appRouter.createCaller(adminCtx);

    vi.mocked(db.getLessonById).mockResolvedValue(
      makeLessonRow({
        status: "disputed",
        stripePaymentIntentId: "pi_disputed_004",
        stripeTransferId: null, // first read: stale
      })
    );
    // CAS fails — someone else set a real transfer ID
    vi.mocked(db.claimLessonRefundSlot).mockResolvedValue(false);
    vi.mocked(db.getLessonById).mockResolvedValueOnce(
      makeLessonRow({
        status: "released",
        stripeTransferId: "tr_completed_001",
      })
    );

    await expect(
      caller.admin.disputes.refundStudent({ lessonId: 100 })
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });

    expect(stripeService.createRefund).not.toHaveBeenCalled();
  });
});

describe("S30-2: Recovery uses correct refund amounts and idempotency keys", () => {
  it("cancel_pending recovery uses stored refundAmountCents (50% partial), not full amountCents", async () => {
    vi.resetModules();
    vi.mock("./db");
    vi.mock("./stripe");

    const executeMock = vi.fn();
    // First call: return the stuck cancel_pending row with refundAmountCents = 2500 (50% of 5000)
    executeMock.mockResolvedValueOnce([[{
      id: 200,
      status: "cancel_pending",
      stripePaymentIntentId: "pi_cancel_001",
      amountCents: 5000,
      refundAmountCents: 2500, // 50% refund stored at claim time
      stripeTransferId: null,
      coachId: 2,
      cancelledAt: new Date(Date.now() - 20 * 60 * 1000),
      coachDeclinedAt: null,
    }]]);
    // Second call: stuck payouts (empty)
    executeMock.mockResolvedValueOnce([[]]);
    // Third call: UPDATE to cancelled
    executeMock.mockResolvedValueOnce([{ affectedRows: 1 }]);

    const { getDb } = await import("./db");
    const { createRefund } = await import("./stripe");
    vi.mocked(getDb).mockResolvedValue({ execute: executeMock } as any);
    vi.mocked(createRefund).mockResolvedValue({ id: "re_cancel_001" } as any);

    const { recoverStuckPendingStates } = await import("./reminderScheduler");
    await recoverStuckPendingStates();

    // createRefund must be called with 2500 (partial), not 5000 (full)
    expect(createRefund).toHaveBeenCalledWith(
      "pi_cancel_001",
      2500, // stored partial amount
      "requested_by_customer",
      "lesson_cancel_refund_200" // deterministic idempotency key
    );
  });

  it("decline_pending recovery uses full refund (undefined amount) with correct idempotency key", async () => {
    vi.resetModules();
    vi.mock("./db");
    vi.mock("./stripe");

    const executeMock = vi.fn();
    executeMock.mockResolvedValueOnce([[{
      id: 201,
      status: "decline_pending",
      stripePaymentIntentId: "pi_decline_001",
      amountCents: 5000,
      refundAmountCents: 0,
      stripeTransferId: null,
      coachId: 2,
      cancelledAt: null,
      coachDeclinedAt: new Date(Date.now() - 20 * 60 * 1000),
    }]]);
    executeMock.mockResolvedValueOnce([[]]); // stuck payouts
    executeMock.mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE

    const { getDb } = await import("./db");
    const { createRefund } = await import("./stripe");
    vi.mocked(getDb).mockResolvedValue({ execute: executeMock } as any);
    vi.mocked(createRefund).mockResolvedValue({ id: "re_decline_001" } as any);

    const { recoverStuckPendingStates } = await import("./reminderScheduler");
    await recoverStuckPendingStates();

    expect(createRefund).toHaveBeenCalledWith(
      "pi_decline_001",
      undefined, // full refund
      "requested_by_customer",
      "lesson_decline_refund_201"
    );
  });
});

describe("S30-3: Legacy lesson.requestRefund is disabled for released lessons", () => {
  it("throws METHOD_NOT_SUPPORTED for released lessons (payout already transferred)", async () => {
    const studentCtx = createContext({ id: 1, role: "user" as any });
    const caller = appRouter.createCaller(studentCtx);

    vi.mocked(db.getLessonById).mockResolvedValue(
      makeLessonRow({
        status: "released",
        studentId: 1,
        stripePaymentIntentId: "pi_released_001",
        stripeTransferId: "tr_completed_001",
      })
    );

    await expect(
      caller.lesson.requestRefund({ lessonId: 100 })
    ).rejects.toMatchObject({ code: "METHOD_NOT_SUPPORTED" });

    // Stripe must NOT have been called
    expect(stripeService.createRefund).not.toHaveBeenCalled();
  });

  it("throws METHOD_NOT_SUPPORTED even for lessons within the refund window", async () => {
    const studentCtx = createContext({ id: 1, role: "user" as any });
    const caller = appRouter.createCaller(studentCtx);

    const futureWindow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    vi.mocked(db.getLessonById).mockResolvedValue(
      makeLessonRow({
        status: "released",
        studentId: 1,
        stripePaymentIntentId: "pi_released_002",
        stripeTransferId: "tr_completed_002",
        refundWindowEndsAt: futureWindow,
      })
    );

    await expect(
      caller.lesson.requestRefund({ lessonId: 100 })
    ).rejects.toMatchObject({ code: "METHOD_NOT_SUPPORTED" });

    expect(stripeService.createRefund).not.toHaveBeenCalled();
  });
});

describe("S30-4: claimLessonCancellation allowlist — blocks non-pre-completion statuses", () => {
  const BLOCKED_STATUSES = [
    "disputed",
    "completed",
    "released",
    "refunded",
    "declined",
    "decline_pending",
    "cancel_pending",
    "cancelled",
    "no_show",
  ];

  for (const status of BLOCKED_STATUSES) {
    it(`cancel procedure rejects a lesson in '${status}' status`, async () => {
      const studentCtx = createContext({ id: 1 });
      const caller = appRouter.createCaller(studentCtx);

      vi.mocked(db.getLessonById).mockResolvedValue(
        makeLessonRow({ status, studentId: 1 })
      );
      // CAS returns null because status is not in the allowlist
      vi.mocked(db.claimLessonCancellation).mockResolvedValue(null);

      await expect(
        caller.lesson.cancel({ lessonId: 100, reason: "test" })
      ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });

      expect(stripeService.createRefund).not.toHaveBeenCalled();
    });
  }

  it("cancel succeeds for confirmed status (in allowlist)", async () => {
    const studentCtx = createContext({ id: 1 });
    const caller = appRouter.createCaller(studentCtx);

    vi.mocked(db.getLessonById).mockResolvedValue(
      makeLessonRow({ status: "confirmed", studentId: 1, stripePaymentIntentId: "pi_conf_001", amountCents: 5000 })
    );
    vi.mocked(db.claimLessonCancellation).mockResolvedValue({ refundAmountCents: 5000, refundPercentage: 100 });
    vi.mocked(stripeService.createRefund).mockResolvedValue({ id: "re_conf_001" } as any);
    vi.mocked(db.finalizeCancellation).mockResolvedValue();

    const result = await caller.lesson.cancel({ lessonId: 100, reason: "test" });
    expect(result.success).toBe(true);
    expect(stripeService.createRefund).toHaveBeenCalled();
  });

  it("cancel succeeds for payment_collected status (in allowlist)", async () => {
    const studentCtx = createContext({ id: 1 });
    const caller = appRouter.createCaller(studentCtx);

    vi.mocked(db.getLessonById).mockResolvedValue(
      makeLessonRow({ status: "payment_collected", studentId: 1, stripePaymentIntentId: "pi_pc_001", amountCents: 5000 })
    );
    vi.mocked(db.claimLessonCancellation).mockResolvedValue({ refundAmountCents: 5000, refundPercentage: 100 });
    vi.mocked(stripeService.createRefund).mockResolvedValue({ id: "re_pc_001" } as any);
    vi.mocked(db.finalizeCancellation).mockResolvedValue();

    const result = await caller.lesson.cancel({ lessonId: 100, reason: "test" });
    expect(result.success).toBe(true);
  });
});
