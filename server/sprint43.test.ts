/**
 * Sprint 43 — Bulk payout release
 *
 * Tests releaseAllEligiblePayouts() (server/payoutService.ts) and the
 * admin.disputes.releaseAllEligible procedure.
 *
 * The bulk helper is a thin orchestration over releaseLessonPayoutToCoach — it
 * introduces NO new money path. These tests exercise the real per-lesson service
 * with db + stripeConnect mocked, so the aggregation, partial-failure isolation,
 * and idempotent-success behavior are all verified against the production path.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./db");
vi.mock("./stripeConnect");
vi.mock("./emailService");
vi.mock("./nurtureEmailScheduler");
vi.mock("./resendWelcomeEmails");

import * as db from "./db";
import * as stripeConnect from "./stripeConnect";
import { releaseAllEligiblePayouts } from "./payoutService";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const past = new Date(Date.now() - 60_000); // issue window expired

function eligibleLesson(id: number, overrides: Record<string, any> = {}) {
  return {
    id,
    status: "completed",
    issueWindowEndsAt: past,
    stripePaymentIntentId: `pi_${id}`,
    stripeTransferId: null,
    coachId: 100 + id,
    studentId: 200 + id,
    coachPayoutCents: 5000,
    currency: "usd",
    ...overrides,
  };
}

const coach = (id: number) => ({ id, stripeConnectAccountId: `acct_${id}` });

beforeEach(() => {
  vi.clearAllMocks();
  // Default coach lookup: every coach has a connected account.
  vi.mocked(db.getUserById).mockImplementation(async (id: number) => coach(id) as any);
  vi.mocked(db.finalizeLessonPayout).mockResolvedValue(undefined as any);
  vi.mocked(db.releaseLessonPayoutSlot).mockResolvedValue(undefined as any);
});

describe("Sprint 43 — releaseAllEligiblePayouts", () => {
  it("S43-1: releases every eligible lesson and aggregates successes", async () => {
    const lessons = [eligibleLesson(1), eligibleLesson(2)];
    vi.mocked(db.getCompletedLessonsReadyForPayout).mockResolvedValue(lessons as any);
    vi.mocked(db.getLessonById).mockImplementation(
      async (id: number) => lessons.find((l) => l.id === id) as any
    );
    vi.mocked(db.claimLessonPayoutSlot).mockResolvedValue(true);
    vi.mocked(stripeConnect.transferToCoach).mockImplementation(
      async ({ idempotencyKey }: any) => ({ success: true, transferId: `tr_${idempotencyKey}` })
    );

    const res = await releaseAllEligiblePayouts();

    expect(res.total).toBe(2);
    expect(res.releasedCount).toBe(2);
    expect(res.failedCount).toBe(0);
    expect(db.claimLessonPayoutSlot).toHaveBeenCalledTimes(2);
    expect(stripeConnect.transferToCoach).toHaveBeenCalledTimes(2);
    expect(db.finalizeLessonPayout).toHaveBeenCalledTimes(2);
  });

  it("S43-2: a single failed lesson does not abort the rest", async () => {
    const lessons = [eligibleLesson(1), eligibleLesson(2)];
    vi.mocked(db.getCompletedLessonsReadyForPayout).mockResolvedValue(lessons as any);
    vi.mocked(db.getLessonById).mockImplementation(
      async (id: number) => lessons.find((l) => l.id === id) as any
    );
    // Lesson 1 wins its claim; lesson 2 loses (concurrent claim) → conflict.
    vi.mocked(db.claimLessonPayoutSlot).mockImplementation(async (id: number) => id === 1);
    vi.mocked(stripeConnect.transferToCoach).mockResolvedValue({
      success: true,
      transferId: "tr_1",
    } as any);

    const res = await releaseAllEligiblePayouts();

    expect(res.total).toBe(2);
    expect(res.releasedCount).toBe(1);
    expect(res.failedCount).toBe(1);
    expect(res.released[0].lessonId).toBe(1);
    expect(res.failed[0].lessonId).toBe(2);
    expect(res.failed[0].reason).toMatch(/claimed by a concurrent request/i);
    // Stripe only called for the lesson that won its claim.
    expect(stripeConnect.transferToCoach).toHaveBeenCalledTimes(1);
  });

  it("S43-3: an already-released lesson counts as success, not re-transferred", async () => {
    // List saw it as eligible (transfer null at query time), but the fresh
    // per-lesson read shows a real transfer id (a concurrent release finalized).
    const lessons = [eligibleLesson(1)];
    vi.mocked(db.getCompletedLessonsReadyForPayout).mockResolvedValue(lessons as any);
    // status stays 'completed' (payable) but a real transfer id is already set —
    // this is the idempotent-success branch in releaseLessonPayoutToCoach.
    vi.mocked(db.getLessonById).mockResolvedValue(
      eligibleLesson(1, { stripeTransferId: "tr_existing" }) as any
    );

    const res = await releaseAllEligiblePayouts();

    expect(res.total).toBe(1);
    expect(res.releasedCount).toBe(1);
    expect(res.released[0].alreadyReleased).toBe(true);
    expect(db.claimLessonPayoutSlot).not.toHaveBeenCalled();
    expect(stripeConnect.transferToCoach).not.toHaveBeenCalled();
  });

  it("S43-4: empty eligible set returns a zero summary", async () => {
    vi.mocked(db.getCompletedLessonsReadyForPayout).mockResolvedValue([] as any);
    const res = await releaseAllEligiblePayouts();
    expect(res).toEqual({ total: 0, releasedCount: 0, failedCount: 0, released: [], failed: [] });
    expect(stripeConnect.transferToCoach).not.toHaveBeenCalled();
  });

  it("S43-5: a Stripe failure releases the slot and is recorded, not thrown", async () => {
    const lessons = [eligibleLesson(1)];
    vi.mocked(db.getCompletedLessonsReadyForPayout).mockResolvedValue(lessons as any);
    vi.mocked(db.getLessonById).mockResolvedValue(eligibleLesson(1) as any);
    vi.mocked(db.claimLessonPayoutSlot).mockResolvedValue(true);
    vi.mocked(stripeConnect.transferToCoach).mockResolvedValue({
      success: false,
      error: "Stripe transfer failed",
    } as any);

    const res = await releaseAllEligiblePayouts();

    expect(res.failedCount).toBe(1);
    expect(res.failed[0].reason).toMatch(/transfer failed/i);
    // Slot released so a later retry can re-claim.
    expect(db.releaseLessonPayoutSlot).toHaveBeenCalledWith(1);
    expect(db.finalizeLessonPayout).not.toHaveBeenCalled();
  });
});

describe("Sprint 43 — admin.disputes.releaseAllEligible procedure", () => {
  function ctx(user: any): TrpcContext {
    return {
      user,
      req: { protocol: "https", headers: {} } as any,
      res: { setHeader: vi.fn() } as any,
    };
  }

  it("S43-6: non-admin caller is rejected with FORBIDDEN before any db call", async () => {
    const caller = appRouter.createCaller(
      ctx({ id: 2, role: "user", openId: "u", name: "U", email: "u@example.com" })
    );
    await expect(caller.admin.disputes.releaseAllEligible()).rejects.toThrow(
      /Admin access required/
    );
    expect(db.getCompletedLessonsReadyForPayout).not.toHaveBeenCalled();
  });

  it("S43-7: admin caller returns the bulk summary", async () => {
    vi.mocked(db.getCompletedLessonsReadyForPayout).mockResolvedValue([] as any);
    const caller = appRouter.createCaller(
      ctx({ id: 1, role: "admin", openId: "a", name: "A", email: "a@example.com" })
    );
    const res = await caller.admin.disputes.releaseAllEligible();
    expect(res.total).toBe(0);
  });
});
