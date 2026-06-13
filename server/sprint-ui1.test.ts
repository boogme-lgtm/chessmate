/**
 * Sprint S-UI-1 — lesson detail view + tipping + cancelled filtering
 *
 * Tests:
 *   - review.getForLesson: returns null when no reviews, returns only visible counterpart
 *   - tip.createCheckout: rejects non-student, rejects non-completed lesson, rejects duplicate
 *   - tip.createCheckout: happy path returns URL
 *   - webhook tip handler: marks tip as transferred
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

vi.mock("./db");
vi.mock("./emailService");
vi.mock("./nurtureEmailScheduler");
vi.mock("./resendWelcomeEmails");
vi.mock("./stripe");
vi.mock("./stripeConnect");

import * as db from "./db";
import * as stripeService from "./stripe";
import * as stripeConnect from "./stripeConnect";

const student = { id: 1, role: "user", userType: "student", openId: "s", name: "Stu", email: "s@e.com" };
const coach = { id: 42, role: "user", userType: "coach", openId: "c", name: "Coach", email: "c@e.com", stripeConnectAccountId: "acct_coach_42" };
const outsider = { id: 99, role: "user", userType: "student", openId: "x", name: "X", email: "x@e.com" };
const completedLesson = { id: 7, studentId: 1, coachId: 42, status: "completed", amountCents: 5000, coachPayoutCents: 4250, currency: "USD" };
const pendingLesson = { id: 8, studentId: 1, coachId: 42, status: "pending_payment", amountCents: 5000 };

function ctx(user: any): TrpcContext {
  return { user, req: { protocol: "https", headers: {} } as any, res: { setHeader: vi.fn() } as any };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.getLessonById).mockResolvedValue(completedLesson as any);
  vi.mocked(db.getReviewByLessonAndReviewer).mockResolvedValue(null);
  vi.mocked(db.getCounterpartReview).mockResolvedValue(null);
  vi.mocked(db.getTipByLessonAndStudent).mockResolvedValue(null);
  vi.mocked(db.getTipByCheckoutSession).mockResolvedValue(null);
  vi.mocked(db.createTip).mockResolvedValue({} as any);
  vi.mocked(db.setTipCheckoutSession).mockResolvedValue(undefined);
  vi.mocked(db.getUserById).mockImplementation(async (id) => {
    if (id === 1) return student as any;
    if (id === 42) return coach as any;
    return null;
  });
  vi.mocked(stripeService.createTipCheckoutSession).mockResolvedValue({
    id: "cs_test_tip_123",
    url: "https://checkout.stripe.com/tip",
  } as any);
});

describe("S-UI-1-A — review.getForLesson", () => {
  it("returns null when no reviews exist", async () => {
    const caller = appRouter.createCaller(ctx(student));
    const result = await caller.review.getForLesson({ lessonId: 7 });
    expect(result.myReview).toBeNull();
    expect(result.counterpartReview).toBeNull();
  });

  it("returns myReview but hides non-visible counterpart", async () => {
    vi.mocked(db.getReviewByLessonAndReviewer).mockResolvedValue({
      id: 1, rating: 5, comment: "great", isVisible: false,
    } as any);
    vi.mocked(db.getCounterpartReview).mockResolvedValue({
      id: 2, rating: 4, comment: "good", isVisible: false,
    } as any);
    const caller = appRouter.createCaller(ctx(student));
    const result = await caller.review.getForLesson({ lessonId: 7 });
    expect(result.myReview).toBeTruthy();
    expect(result.counterpartReview).toBeNull();
  });

  it("returns visible counterpart review", async () => {
    vi.mocked(db.getReviewByLessonAndReviewer).mockResolvedValue({
      id: 1, rating: 5, isVisible: true,
    } as any);
    vi.mocked(db.getCounterpartReview).mockResolvedValue({
      id: 2, rating: 4, comment: "good job", isVisible: true,
    } as any);
    const caller = appRouter.createCaller(ctx(student));
    const result = await caller.review.getForLesson({ lessonId: 7 });
    expect(result.myReview).toBeTruthy();
    expect(result.counterpartReview).toBeTruthy();
    expect(result.counterpartReview!.rating).toBe(4);
  });

  it("rejects third party", async () => {
    const caller = appRouter.createCaller(ctx(outsider));
    await expect(caller.review.getForLesson({ lessonId: 7 })).rejects.toThrow(/Not your lesson/);
  });
});

describe("S-UI-1-B — tip.createCheckout", () => {
  it("rejects non-student", async () => {
    const caller = appRouter.createCaller(ctx(coach));
    await expect(caller.tip.createCheckout({ lessonId: 7, tipAmountCents: 500 }))
      .rejects.toThrow(/Only the student can tip/);
  });

  it("rejects non-completed lesson", async () => {
    vi.mocked(db.getLessonById).mockResolvedValue(pendingLesson as any);
    const caller = appRouter.createCaller(ctx(student));
    await expect(caller.tip.createCheckout({ lessonId: 8, tipAmountCents: 500 }))
      .rejects.toThrow(/not completed/);
  });

  it("rejects duplicate tip", async () => {
    vi.mocked(db.getTipByLessonAndStudent).mockResolvedValue({ id: 1 } as any);
    const caller = appRouter.createCaller(ctx(student));
    await expect(caller.tip.createCheckout({ lessonId: 7, tipAmountCents: 500 }))
      .rejects.toThrow(/already tipped/);
  });

  it("happy path creates checkout and returns URL", async () => {
    const caller = appRouter.createCaller(ctx(student));
    const result = await caller.tip.createCheckout({ lessonId: 7, tipAmountCents: 1000 });
    expect(result.url).toBe("https://checkout.stripe.com/tip");
    expect(db.createTip).toHaveBeenCalledWith(expect.objectContaining({
      lessonId: 7,
      studentId: 1,
      coachId: 42,
      amountCents: 1000,
    }));
    expect(stripeService.createTipCheckoutSession).toHaveBeenCalledWith(expect.objectContaining({
      tipAmountCents: 1000,
      coachName: "Coach",
    }));
  });
});

describe("S-UI-1-C — tip.getForLesson", () => {
  it("returns null when no tip exists", async () => {
    const caller = appRouter.createCaller(ctx(student));
    const result = await caller.tip.getForLesson({ lessonId: 7 });
    expect(result.tip).toBeNull();
  });

  it("returns tip when present", async () => {
    vi.mocked(db.getTipByLessonAndStudent).mockResolvedValue({
      id: 1, amountCents: 500, status: "transferred",
    } as any);
    const caller = appRouter.createCaller(ctx(student));
    const result = await caller.tip.getForLesson({ lessonId: 7 });
    expect(result.tip).toBeTruthy();
    expect(result.tip!.amountCents).toBe(500);
  });
});

describe("S-UI-1-D — webhook tip handler", () => {
  it("handleTipCheckoutCompleted marks tip transferred", async () => {
    const { handleStripeWebhook } = await import("./webhooks");

    vi.mocked(db.getTipByCheckoutSession).mockResolvedValue({
      id: 10, lessonId: 7, studentId: 1, coachId: 42, amountCents: 1000, status: "pending",
    } as any);
    vi.mocked(stripeConnect.transferToCoach).mockResolvedValue({
      success: true, transferId: "tr_test_123",
    } as any);

    const mockSession = {
      id: "cs_tip_session",
      metadata: { type: "tip", lessonId: "7", studentId: "1", coachId: "42" },
      payment_status: "paid",
    };

    const mockReq = {
      body: Buffer.from("test"),
      headers: { "stripe-signature": "sig_test" },
    };
    const mockRes = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    const { constructWebhookEvent } = await import("./stripe");
    vi.mocked(constructWebhookEvent).mockReturnValue({
      type: "checkout.session.completed",
      id: "evt_123",
      data: { object: mockSession },
    } as any);

    await handleStripeWebhook(mockReq as any, mockRes as any);

    expect(db.updateTipStatus).toHaveBeenCalledWith(10, "paid", expect.objectContaining({ paidAt: expect.any(Date) }));
    expect(stripeConnect.transferToCoach).toHaveBeenCalledWith(expect.objectContaining({
      accountId: "acct_coach_42",
      amountCents: 1000,
    }));
    expect(db.updateTipStatus).toHaveBeenCalledWith(10, "transferred", expect.objectContaining({
      transferredAt: expect.any(Date),
      stripeTransferId: "tr_test_123",
    }));
  });
});
