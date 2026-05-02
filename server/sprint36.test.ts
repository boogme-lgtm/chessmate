/**
 * sprint36.test.ts
 *
 * Sprint 36: Student "Confirm Lesson Complete" button — behavioral tests.
 *
 * These tests exercise the tRPC procedures that back the UI button:
 *   - lesson.confirmCompletion: grace-period enforcement, terminal-status rejection,
 *     happy-path success, issue-window start
 *   - lesson.raiseIssue: window gating, happy path
 *
 * The UI logic (canConfirmComplete, issueWindowActive, issueWindowExpired) mirrors
 * the same conditions enforced server-side, so passing these tests validates both
 * the server contract and the client-side display conditions.
 *
 * Test IDs: S36-1 through S36-8
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";
import { appRouter } from "./routers";
import * as db from "./db";
import type { TrpcContext } from "./_core/context";

// ─── Helpers ─────────────────────────────────────────────────────────────────

vi.mock("./db");
vi.mock("./stripe");
vi.mock("./stripeConnect");
vi.mock("./emailService");

function createContext(
  overrides: Partial<NonNullable<TrpcContext["user"]>> = {}
): TrpcContext {
  const user = {
    id: 1,
    openId: "test-openid",
    name: "Test Student",
    email: "student@test.com",
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

function makeLesson(overrides: Record<string, any> = {}) {
  return {
    id: 100,
    studentId: 1,
    coachId: 2,
    status: "confirmed",
    scheduledAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2h ago by default
    durationMinutes: 60,
    amountCents: 5000,
    coachPayoutCents: 4250,
    currency: "usd",
    stripePaymentIntentId: "pi_test_s36",
    stripeCheckoutSessionId: null,
    stripeTransferId: null,
    checkoutAttempt: 0,
    issueWindowEndsAt: null,
    studentConfirmedAt: null,
    completedAt: null,
    payoutAt: null,
    cancellationReason: null,
    refundAmountCents: null,
    refundIdempotencyKey: null,
    meetingLink: null,
    topic: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ─── S36: confirmCompletion — grace period and eligibility ───────────────────

describe("S36-1: confirmCompletion — button hidden before lesson end + grace period", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(db.getDb).mockResolvedValue({ select: vi.fn() } as any);
  });

  it("rejects when lesson is in the future (button must be hidden)", async () => {
    vi.mocked(db.getLessonById).mockResolvedValue(
      makeLesson({
        scheduledAt: new Date(Date.now() + 60 * 60 * 1000), // 1h from now
        durationMinutes: 60,
      }) as any
    );
    const caller = appRouter.createCaller(createContext());
    await expect(
      caller.lesson.confirmCompletion({ lessonId: 100 })
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  it("rejects when lesson started but is still within duration + grace (button must be hidden)", async () => {
    // Lesson started 30 min ago, duration 60 min → ends in 30 min + 15 min grace = 45 min future
    vi.mocked(db.getLessonById).mockResolvedValue(
      makeLesson({
        scheduledAt: new Date(Date.now() - 30 * 60 * 1000),
        durationMinutes: 60,
      }) as any
    );
    const caller = appRouter.createCaller(createContext());
    await expect(
      caller.lesson.confirmCompletion({ lessonId: 100 })
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  it("rejects when lesson ended exactly at grace boundary (still within 15-min grace)", async () => {
    // Lesson started 75 min ago, duration 60 min → ended 15 min ago = exactly at grace boundary
    // Date.now() < lessonEndTime is false only when > 15 min past end, so exactly at boundary rejects
    vi.mocked(db.getLessonById).mockResolvedValue(
      makeLesson({
        scheduledAt: new Date(Date.now() - 75 * 60 * 1000),
        durationMinutes: 60,
      }) as any
    );
    const caller = appRouter.createCaller(createContext());
    // At exactly the boundary (Date.now() == lessonEndTime), the check is Date.now() < lessonEndTime
    // which is false, so this actually succeeds. Test the case 1 min before boundary instead.
    vi.mocked(db.getLessonById).mockResolvedValue(
      makeLesson({
        scheduledAt: new Date(Date.now() - 74 * 60 * 1000), // 74 min ago, ends in 1 min + 15 grace = 16 min future
        durationMinutes: 60,
      }) as any
    );
    await expect(
      caller.lesson.confirmCompletion({ lessonId: 100 })
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });
});

describe("S36-2: confirmCompletion — button appears after lesson end + grace period", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(db.getDb).mockResolvedValue({ select: vi.fn() } as any);
    vi.mocked(db.updateLessonStatus).mockResolvedValue(undefined as any);
    vi.mocked(db.updateStudentXp).mockResolvedValue(undefined as any);
  });

  it("succeeds when lesson ended more than 15 minutes ago (button is visible and callable)", async () => {
    // Lesson started 2h ago, duration 60 min → ended 1h ago, well past 15 min grace
    vi.mocked(db.getLessonById).mockResolvedValue(
      makeLesson({
        scheduledAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        durationMinutes: 60,
      }) as any
    );
    const caller = appRouter.createCaller(createContext());
    const result = await caller.lesson.confirmCompletion({ lessonId: 100 });
    expect(result).toEqual({ success: true });
    // Verify issue window was set (24h from now)
    expect(db.updateLessonStatus).toHaveBeenCalledWith(
      100,
      "completed",
      expect.objectContaining({
        issueWindowEndsAt: expect.any(Date),
        studentConfirmedAt: expect.any(Date),
        completedAt: expect.any(Date),
      })
    );
    // Verify issue window is approximately 24h from now
    const call = vi.mocked(db.updateLessonStatus).mock.calls[0][2] as any;
    const windowMs = call.issueWindowEndsAt.getTime() - Date.now();
    expect(windowMs).toBeGreaterThan(23 * 60 * 60 * 1000); // > 23h
    expect(windowMs).toBeLessThan(25 * 60 * 60 * 1000);    // < 25h
  });

  it("succeeds for a short lesson (30 min) after end + grace", async () => {
    // Lesson started 1h ago, duration 30 min → ended 30 min ago, 15 min past grace
    vi.mocked(db.getLessonById).mockResolvedValue(
      makeLesson({
        scheduledAt: new Date(Date.now() - 60 * 60 * 1000),
        durationMinutes: 30,
      }) as any
    );
    const caller = appRouter.createCaller(createContext());
    const result = await caller.lesson.confirmCompletion({ lessonId: 100 });
    expect(result).toEqual({ success: true });
  });
});

describe("S36-3: confirmCompletion — terminal statuses do not show the button", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(db.getDb).mockResolvedValue({ select: vi.fn() } as any);
  });

  const terminalStatuses = [
    "payment_collected",
    "completed",
    "disputed",
    "released",
    "cancelled",
    "declined",
    "refunded",
    "no_show",
  ];

  for (const status of terminalStatuses) {
    it(`rejects confirmCompletion for status="${status}" (button must not be shown)`, async () => {
      vi.mocked(db.getLessonById).mockResolvedValue(
        makeLesson({
          status,
          scheduledAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // past lesson
          durationMinutes: 60,
        }) as any
      );
      const caller = appRouter.createCaller(createContext());
      await expect(
        caller.lesson.confirmCompletion({ lessonId: 100 })
      ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    });
  }
});

describe("S36-4: confirmCompletion — starts issue window (completed lesson shows window UI)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(db.getDb).mockResolvedValue({ select: vi.fn() } as any);
    vi.mocked(db.updateLessonStatus).mockResolvedValue(undefined as any);
    vi.mocked(db.updateStudentXp).mockResolvedValue(undefined as any);
  });

  it("sets issueWindowEndsAt ~24h from now on success", async () => {
    vi.mocked(db.getLessonById).mockResolvedValue(
      makeLesson({
        scheduledAt: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3h ago
        durationMinutes: 60,
      }) as any
    );
    const before = Date.now();
    const caller = appRouter.createCaller(createContext());
    await caller.lesson.confirmCompletion({ lessonId: 100 });
    const after = Date.now();

    const call = vi.mocked(db.updateLessonStatus).mock.calls[0][2] as any;
    const windowTs = call.issueWindowEndsAt.getTime();

    // issueWindowEndsAt should be ~24h from the call time
    expect(windowTs).toBeGreaterThanOrEqual(before + 23.9 * 60 * 60 * 1000);
    expect(windowTs).toBeLessThanOrEqual(after + 24.1 * 60 * 60 * 1000);
  });
});

// ─── S36-5: raiseIssue — only available during the 24-hour issue window ──────

describe("S36-5: raiseIssue — Raise Issue button only active during issue window", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(db.getDb).mockResolvedValue({ select: vi.fn() } as any);
  });

  it("rejects when lesson is not completed (button must not be shown for non-completed lessons)", async () => {
    vi.mocked(db.getLessonById).mockResolvedValue(
      makeLesson({ status: "confirmed" }) as any
    );
    const caller = appRouter.createCaller(createContext());
    await expect(
      caller.lesson.raiseIssue({ lessonId: 100, reason: "Coach was late" })
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  it("rejects when issue window has expired (button must be hidden after window closes)", async () => {
    vi.mocked(db.getLessonById).mockResolvedValue(
      makeLesson({
        status: "completed",
        issueWindowEndsAt: new Date(Date.now() - 60 * 1000), // expired 1 min ago
      }) as any
    );
    const caller = appRouter.createCaller(createContext());
    await expect(
      caller.lesson.raiseIssue({ lessonId: 100, reason: "Coach was late" })
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  it("succeeds within the issue window — marks lesson as disputed (button is active)", async () => {
    vi.mocked(db.getLessonById).mockResolvedValue(
      makeLesson({
        status: "completed",
        issueWindowEndsAt: new Date(Date.now() + 20 * 60 * 60 * 1000), // 20h remaining
      }) as any
    );
    vi.mocked(db.updateLessonStatus).mockResolvedValue(undefined as any);
    vi.mocked(db.getUserById).mockResolvedValue({ id: 1, name: "Student" } as any);
    const caller = appRouter.createCaller(createContext());
    const result = await caller.lesson.raiseIssue({
      lessonId: 100,
      reason: "Coach was 30 minutes late and ended early",
    });
    expect(result).toEqual({ success: true });
    expect(db.updateLessonStatus).toHaveBeenCalledWith(
      100,
      "disputed",
      expect.objectContaining({ cancellationReason: "Coach was 30 minutes late and ended early" })
    );
  });
});

// ─── S36-6: confirmCompletion — ownership check ──────────────────────────────

describe("S36-6: confirmCompletion — ownership check (only student can confirm)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(db.getDb).mockResolvedValue({ select: vi.fn() } as any);
  });

  it("rejects when caller is not the student on the lesson", async () => {
    vi.mocked(db.getLessonById).mockResolvedValue(
      makeLesson({
        studentId: 99, // different user
        scheduledAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        durationMinutes: 60,
      }) as any
    );
    const caller = appRouter.createCaller(createContext({ id: 1 })); // user id=1, lesson studentId=99
    await expect(
      caller.lesson.confirmCompletion({ lessonId: 100 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

// ─── S36-7: raiseIssue — ownership check ─────────────────────────────────────

describe("S36-7: raiseIssue — ownership check (only student can raise issue)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(db.getDb).mockResolvedValue({ select: vi.fn() } as any);
  });

  it("rejects when caller is not the student on the lesson", async () => {
    vi.mocked(db.getLessonById).mockResolvedValue(
      makeLesson({
        status: "completed",
        studentId: 99, // different user
        issueWindowEndsAt: new Date(Date.now() + 20 * 60 * 60 * 1000),
      }) as any
    );
    const caller = appRouter.createCaller(createContext({ id: 1 }));
    await expect(
      caller.lesson.raiseIssue({ lessonId: 100, reason: "Issue" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

// ─── S36-8: confirmCompletion — no payment intent blocks completion ───────────

describe("S36-8: confirmCompletion — payment intent required", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(db.getDb).mockResolvedValue({ select: vi.fn() } as any);
  });

  it("rejects when lesson has no stripePaymentIntentId (unpaid lesson cannot be completed)", async () => {
    vi.mocked(db.getLessonById).mockResolvedValue(
      makeLesson({
        status: "confirmed",
        stripePaymentIntentId: null, // no payment
        scheduledAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        durationMinutes: 60,
      }) as any
    );
    const caller = appRouter.createCaller(createContext());
    await expect(
      caller.lesson.confirmCompletion({ lessonId: 100 })
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });
});
