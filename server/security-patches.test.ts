/**
 * Security Patch Tests — Behavioral Tests (Round 3)
 *
 * These tests call actual tRPC procedures and webhook handlers with mocked
 * DB and Stripe responses. They verify security invariants end-to-end rather
 * than checking source strings.
 *
 * Coverage:
 *  - payment.createCheckout: rejects non-confirmed, idempotent (no duplicate sessions)
 *  - checkout.session.completed webhook: only transitions confirmed → paid
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

import { appRouter } from "./routers";
import * as db from "./db";
import * as stripeService from "./stripe";
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
    status: "confirmed",
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
  it("rejects when lesson status is not 'confirmed'", async () => {
    vi.mocked(db.getLessonById).mockResolvedValue(makeLessonRow({ status: "pending_confirmation" }));
    const caller = appRouter.createCaller(createContext());

    await expect(caller.payment.createCheckout({ lessonId: 100 }))
      .rejects.toThrow("Cannot create checkout");
  });

  it("rejects when lesson status is 'paid' (already paid)", async () => {
    vi.mocked(db.getLessonById).mockResolvedValue(makeLessonRow({ status: "paid" }));
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

  it("creates new session and persists session ID for confirmed lesson without existing session", async () => {
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

  it("transitions confirmed lesson to paid", async () => {
    vi.mocked(db.getLessonById).mockResolvedValue(makeLessonRow({ status: "confirmed" }));
    vi.mocked(db.updateLessonPaymentIntent).mockResolvedValue(undefined);
    vi.mocked(db.clearLessonCheckoutSession).mockResolvedValue(undefined);
    vi.mocked(db.getUserById).mockResolvedValue({ id: 1, name: "Student", email: "s@t.com" } as any);

    const { req, res } = createWebhookReqRes();
    await handleStripeWebhook(req, res);

    expect(db.updateLessonPaymentIntent).toHaveBeenCalledWith(100, "pi_test_123");
    expect(res.json).toHaveBeenCalledWith({ received: true });
  });

  it("does NOT transition pending_confirmation lesson to paid (no-op)", async () => {
    vi.mocked(db.getLessonById).mockResolvedValue(makeLessonRow({ status: "pending_confirmation" }));

    const { req, res } = createWebhookReqRes();
    await handleStripeWebhook(req, res);

    expect(db.updateLessonPaymentIntent).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ received: true });
  });

  it("does NOT transition already-paid lesson (idempotent no-op)", async () => {
    vi.mocked(db.getLessonById).mockResolvedValue(makeLessonRow({ status: "paid" }));

    const { req, res } = createWebhookReqRes();
    await handleStripeWebhook(req, res);

    expect(db.updateLessonPaymentIntent).not.toHaveBeenCalled();
  });

  it("does NOT transition released/completed lesson", async () => {
    vi.mocked(db.getLessonById).mockResolvedValue(makeLessonRow({ status: "released" }));

    const { req, res } = createWebhookReqRes();
    await handleStripeWebhook(req, res);

    expect(db.updateLessonPaymentIntent).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// lesson.confirmCompletion
// ═══════════════════════════════════════════════════════════════════════════════

describe("lesson.confirmCompletion", () => {
  it("rejects when lesson status is 'confirmed' (not yet paid)", async () => {
    vi.mocked(db.getLessonById).mockResolvedValue(makeLessonRow({ status: "confirmed" }));
    const caller = appRouter.createCaller(createContext());

    await expect(caller.lesson.confirmCompletion({ lessonId: 100 }))
      .rejects.toThrow("Lesson must be paid before it can be completed");
  });

  it("rejects when lesson status is 'pending_confirmation'", async () => {
    vi.mocked(db.getLessonById).mockResolvedValue(makeLessonRow({ status: "pending_confirmation" }));
    const caller = appRouter.createCaller(createContext());

    await expect(caller.lesson.confirmCompletion({ lessonId: 100 }))
      .rejects.toThrow("Lesson must be paid before it can be completed");
  });

  it("rejects paid lesson without stripePaymentIntentId", async () => {
    vi.mocked(db.getLessonById).mockResolvedValue(
      makeLessonRow({ status: "paid", stripePaymentIntentId: null })
    );
    const caller = appRouter.createCaller(createContext());

    await expect(caller.lesson.confirmCompletion({ lessonId: 100 }))
      .rejects.toThrow("Payment not recorded for this lesson");
  });

  it("succeeds for paid lesson with stripePaymentIntentId", async () => {
    vi.mocked(db.getLessonById).mockResolvedValue(
      makeLessonRow({ status: "paid", stripePaymentIntentId: "pi_valid_123" })
    );
    vi.mocked(stripeService.capturePaymentIntent).mockResolvedValue(undefined as any);
    vi.mocked(db.updateLessonStatus).mockResolvedValue(undefined);

    const caller = appRouter.createCaller(createContext());
    const result = await caller.lesson.confirmCompletion({ lessonId: 100 });

    expect(stripeService.capturePaymentIntent).toHaveBeenCalledWith("pi_valid_123");
    expect(result).toBeDefined();
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
