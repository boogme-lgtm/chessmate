/**
 * Sprint S-REF-2 — admin lesson dispute panel (procedures)
 *
 * Tests admin.disputes.listLessonDisputes and resolveLessonDispute.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

vi.mock("./db");
vi.mock("./stripe");
vi.mock("./payoutService");
vi.mock("./emailService");
vi.mock("./nurtureEmailScheduler");
vi.mock("./resendWelcomeEmails");
vi.mock("./_core/notification");

import * as db from "./db";
import * as stripeService from "./stripe";
import * as payoutService from "./payoutService";
import { notifyOwner } from "./_core/notification";

const admin = { id: 9, role: "admin", userType: "student", openId: "a", name: "Admin", email: "a@e.com" };
const student = { id: 1, role: "user", userType: "student", openId: "s", name: "Stu", email: "s@e.com" };

const disputedLesson = {
  id: 7, studentId: 1, coachId: 42, status: "disputed",
  amountCents: 5000, coachPayoutCents: 4250, currency: "usd",
  stripePaymentIntentId: "pi_abc",
};

function ctx(user: any): TrpcContext {
  return { user, req: { protocol: "https", headers: {} } as any, res: { setHeader: vi.fn() } as any };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.getAllLessonDisputes).mockResolvedValue([] as any);
  vi.mocked(db.getDisputeById).mockResolvedValue({ id: 3, lessonId: 7, status: "open" } as any);
  vi.mocked(db.getLessonById).mockResolvedValue(disputedLesson as any);
  vi.mocked(db.claimLessonRefundSlot).mockResolvedValue(true as any);
  vi.mocked(db.releaseAdminRefundClaim).mockResolvedValue(undefined as any);
  vi.mocked(db.finalizeAdminRefund).mockResolvedValue(undefined as any);
  vi.mocked(db.updateLessonDispute).mockResolvedValue(undefined as any);
  vi.mocked(stripeService.createRefund).mockResolvedValue({ id: "re_1" } as any);
  vi.mocked(payoutService.releaseLessonPayoutToCoach).mockResolvedValue({ success: true, transferId: "tr_1" } as any);
  vi.mocked(notifyOwner).mockResolvedValue(true);
});

describe("S-REF-2 — listLessonDisputes", () => {
  it("1: non-admin → FORBIDDEN", async () => {
    const caller = appRouter.createCaller(ctx(student));
    await expect(caller.admin.disputes.listLessonDisputes()).rejects.toThrow(/Admin access required/);
  });

  it("2: admin → returns array", async () => {
    const caller = appRouter.createCaller(ctx(admin));
    const res = await caller.admin.disputes.listLessonDisputes();
    expect(Array.isArray(res)).toBe(true);
    expect(db.getAllLessonDisputes).toHaveBeenCalled();
  });
});

describe("S-REF-2 — resolveLessonDispute", () => {
  it("3: non-admin → FORBIDDEN", async () => {
    const caller = appRouter.createCaller(ctx(student));
    await expect(
      caller.admin.disputes.resolveLessonDispute({ disputeId: 3, resolution: "refund_full" })
    ).rejects.toThrow(/Admin access required/);
  });

  it("4: non-existent disputeId → NOT_FOUND", async () => {
    vi.mocked(db.getDisputeById).mockResolvedValue(null);
    const caller = appRouter.createCaller(ctx(admin));
    await expect(
      caller.admin.disputes.resolveLessonDispute({ disputeId: 999, resolution: "refund_full" })
    ).rejects.toThrow(/Dispute not found/);
  });

  it("5: already-resolved dispute → CONFLICT", async () => {
    vi.mocked(db.getDisputeById).mockResolvedValue({ id: 3, lessonId: 7, status: "resolved" } as any);
    const caller = appRouter.createCaller(ctx(admin));
    await expect(
      caller.admin.disputes.resolveLessonDispute({ disputeId: 3, resolution: "refund_full" })
    ).rejects.toThrow(/already resolved/);
  });

  it("6: refund_partial with no refundAmountCents → BAD_REQUEST", async () => {
    const caller = appRouter.createCaller(ctx(admin));
    await expect(
      caller.admin.disputes.resolveLessonDispute({ disputeId: 3, resolution: "refund_partial" })
    ).rejects.toThrow(/refundAmountCents is required/);
  });

  it("refund_full: refunds full amount, marks dispute resolved", async () => {
    const caller = appRouter.createCaller(ctx(admin));
    const res = await caller.admin.disputes.resolveLessonDispute({ disputeId: 3, resolution: "refund_full" });
    expect(res.success).toBe(true);
    expect(stripeService.createRefund).toHaveBeenCalledWith("pi_abc", undefined, "requested_by_customer", expect.any(String));
    expect(db.finalizeAdminRefund).toHaveBeenCalledWith(7, 5000, expect.any(String));
    expect(db.updateLessonDispute).toHaveBeenCalledWith(3, expect.objectContaining({
      status: "resolved",
      resolution: "refund_full",
      resolvedBy: "admin",
    }));
  });

  it("refund_partial: refunds the partial amount", async () => {
    const caller = appRouter.createCaller(ctx(admin));
    const res = await caller.admin.disputes.resolveLessonDispute({
      disputeId: 3, resolution: "refund_partial", refundAmountCents: 2000,
    });
    expect(res.success).toBe(true);
    expect(db.claimLessonRefundSlot).toHaveBeenCalledWith(7, 2000);
    expect(stripeService.createRefund).toHaveBeenCalledWith("pi_abc", 2000, "requested_by_customer", expect.any(String));
    expect(db.updateLessonDispute).toHaveBeenCalledWith(3, expect.objectContaining({
      resolution: "refund_partial",
      refundAmountCents: 2000,
    }));
  });

  it("denied: releases payout to coach with admin override", async () => {
    const caller = appRouter.createCaller(ctx(admin));
    const res = await caller.admin.disputes.resolveLessonDispute({
      disputeId: 3, resolution: "denied", adminNote: "No fault found",
    });
    expect(res.success).toBe(true);
    expect(payoutService.releaseLessonPayoutToCoach).toHaveBeenCalledWith(expect.objectContaining({
      lessonId: 7,
      adminOverrideReason: "No fault found",
    }));
    expect(stripeService.createRefund).not.toHaveBeenCalled();
    expect(db.updateLessonDispute).toHaveBeenCalledWith(3, expect.objectContaining({ resolution: "denied" }));
  });

  it("denied: payout release failure → PRECONDITION_FAILED, dispute not marked resolved", async () => {
    vi.mocked(payoutService.releaseLessonPayoutToCoach).mockResolvedValue({
      success: false, precondition: true, reason: "Coach has no Stripe account",
    } as any);
    const caller = appRouter.createCaller(ctx(admin));
    await expect(
      caller.admin.disputes.resolveLessonDispute({ disputeId: 3, resolution: "denied" })
    ).rejects.toThrow(/Coach has no Stripe account/);
    expect(db.updateLessonDispute).not.toHaveBeenCalled();
  });
});
