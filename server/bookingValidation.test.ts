/**
 * Server-side booking validation for lesson.book (audit CRITICAL routers.ts:1260
 * — the live booking path performed zero slot/availability validation).
 * Verifies the double-booking guard and the advance-window enforcement.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./db");
vi.mock("./emailService");
vi.mock("./nurtureEmailScheduler");
vi.mock("./resendWelcomeEmails");
vi.mock("./bookingService");

import * as db from "./db";
import * as bookingService from "./bookingService";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function studentCtx(): TrpcContext {
  return {
    user: { id: 1, role: "user", userType: "student", email: "s@e.com", name: "Stu" } as any,
    req: { protocol: "https", headers: {} } as any,
    res: { setHeader: vi.fn() } as any,
  };
}

const inDays = (d: number) => new Date(Date.now() + d * 24 * 60 * 60 * 1000);
const inHours = (h: number) => new Date(Date.now() + h * 60 * 60 * 1000);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.getUserById).mockImplementation(async (id: number) =>
    (id === 1 ? { id: 1, email: "s@e.com" } : { id: 2, email: "c@e.com" }) as any
  );
  vi.mocked(db.getCoachProfileByUserId).mockResolvedValue({
    userId: 2, hourlyRateCents: 6000, pricingTier: "free",
    minAdvanceHours: 24, maxAdvanceDays: 30,
  } as any);
  vi.mocked(db.createLesson).mockResolvedValue({ id: 99, status: "pending_payment" } as any);
  vi.mocked(db.updateUserType).mockResolvedValue(undefined as any);
  vi.mocked(bookingService.isTimeSlotAvailable).mockResolvedValue(true);
});

describe("lesson.book — server-side validation", () => {
  it("books a valid future slot on a free coach", async () => {
    const caller = appRouter.createCaller(studentCtx());
    const res = await caller.lesson.book({ coachId: 2, scheduledAt: inDays(7), durationMinutes: 60 });
    expect(res.success).toBe(true);
    expect(db.createLesson).toHaveBeenCalled();
  });

  it("rejects a double-booking when the slot overlaps an existing lesson", async () => {
    vi.mocked(bookingService.isTimeSlotAvailable).mockResolvedValue(false);
    const caller = appRouter.createCaller(studentCtx());
    await expect(
      caller.lesson.book({ coachId: 2, scheduledAt: inDays(7), durationMinutes: 60 })
    ).rejects.toThrow(/no longer available/i);
    expect(db.createLesson).not.toHaveBeenCalled();
  });

  it("rejects a booking sooner than the coach's minimum advance window", async () => {
    const caller = appRouter.createCaller(studentCtx());
    await expect(
      caller.lesson.book({ coachId: 2, scheduledAt: inHours(1), durationMinutes: 60 })
    ).rejects.toThrow(/at least 24 hours in advance/i);
    expect(db.createLesson).not.toHaveBeenCalled();
  });

  it("rejects a booking further out than the coach's maximum advance window", async () => {
    const caller = appRouter.createCaller(studentCtx());
    await expect(
      caller.lesson.book({ coachId: 2, scheduledAt: inDays(60), durationMinutes: 60 })
    ).rejects.toThrow(/up to 30 days ahead/i);
    expect(db.createLesson).not.toHaveBeenCalled();
  });

  it("does not reserve a slot when validation rejects (no createLesson side effect)", async () => {
    vi.mocked(bookingService.isTimeSlotAvailable).mockResolvedValue(false);
    const caller = appRouter.createCaller(studentCtx());
    await caller.lesson.book({ coachId: 2, scheduledAt: inDays(7), durationMinutes: 60 }).catch(() => {});
    expect(db.createLesson).not.toHaveBeenCalled();
  });
});
