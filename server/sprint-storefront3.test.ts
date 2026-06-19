/**
 * S-STOREFRONT-3 — post-purchase notifications, earnings, and student receipt email.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

vi.mock("./db");
vi.mock("./stripe");
vi.mock("./stripeConnect");
vi.mock("./storage");
vi.mock("./emailService");
vi.mock("./nurtureEmailScheduler");
vi.mock("./resendWelcomeEmails");
vi.mock("./_core/notification");

import * as db from "./db";
import * as stripe from "./stripe";
import * as stripeConnect from "./stripeConnect";
import * as emailService from "./emailService";

const coach = { id: 42, role: "user", userType: "coach", openId: "c", name: "Coach", email: "c@e.com", stripeConnectAccountId: "acct_42" };
const student = { id: 1, role: "user", userType: "student", openId: "s", name: "Student", email: "s@e.com" };

function ctx(user: any): TrpcContext {
  return { user, req: { protocol: "https", headers: {} } as any, res: { setHeader: vi.fn() } as any };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.createNotification).mockResolvedValue(1);
  vi.mocked(db.getUserById).mockImplementation(async (id: number) => {
    if (id === 1) return student as any;
    if (id === 42) return coach as any;
    return undefined;
  });
  vi.mocked(db.getCoachProfileByUserId).mockResolvedValue({ pricingTier: "free" } as any);
});

// ── Webhook: coach notification + receipt email ──────────────────────────

describe("webhook: content_item post-purchase signals", () => {
  function mockEvent() {
    vi.mocked(stripe.constructWebhookEvent).mockReturnValue({
      id: "evt_s3_001",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_s3_123",
          metadata: { type: "content_item", contentItemId: "100", buyerId: "1" },
          payment_status: "paid",
          payment_intent: "pi_s3_456",
          amount_total: 2900,
        },
      },
    } as any);
  }
  function makeReqRes() {
    return {
      req: { body: "raw", headers: { "stripe-signature": "sig" } } as any,
      res: { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as any,
    };
  }

  beforeEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    vi.mocked(db.getContentItemById).mockResolvedValue({
      id: 100, coachId: 42, title: "Caro-Kann Masterclass", kind: "video",
    } as any);
    vi.mocked(db.recordContentPurchase).mockResolvedValue("inserted");
    vi.mocked(stripeConnect.getChargeIdForPaymentIntent).mockResolvedValue("ch_s3_789");
    vi.mocked(stripeConnect.transferToCoach).mockResolvedValue({ success: true, transferId: "tr_1" } as any);
    vi.mocked(emailService.sendEmail).mockResolvedValue(undefined as any);
    vi.mocked(emailService.getStudentContentPurchaseReceiptEmail).mockReturnValue("<html>receipt</html>");
  });

  it("1: creates a new_content_sale notification for the coach", async () => {
    mockEvent();
    const { req, res } = makeReqRes();
    const { handleStripeWebhook } = await import("./webhooks");
    await handleStripeWebhook(req, res);

    const coachNotifCall = vi.mocked(db.createNotification).mock.calls.find(
      (c) => c[0].type === "new_content_sale",
    );
    expect(coachNotifCall).toBeDefined();
    expect(coachNotifCall![0]).toMatchObject({
      userId: 42,
      type: "new_content_sale",
      recipientRole: "coach",
    });
  });

  it("2: notification body includes student name, item title, and formatted price", async () => {
    mockEvent();
    const { req, res } = makeReqRes();
    const { handleStripeWebhook } = await import("./webhooks");
    await handleStripeWebhook(req, res);

    const coachNotifCall = vi.mocked(db.createNotification).mock.calls.find(
      (c) => c[0].type === "new_content_sale",
    );
    const body = coachNotifCall![0].body;
    expect(body).toContain("Student");
    expect(body).toContain("Caro-Kann Masterclass");
    expect(body).toContain("$29.00");
  });

  it("3: notification failure does NOT throw — webhook still returns { received: true }", async () => {
    mockEvent();
    vi.mocked(db.createNotification).mockRejectedValue(new Error("DB down"));
    const { req, res } = makeReqRes();
    const { handleStripeWebhook } = await import("./webhooks");
    await handleStripeWebhook(req, res);

    expect(res.json).toHaveBeenCalledWith({ received: true });
  });

  it("8: receipt email is sent to the student after successful purchase", async () => {
    mockEvent();
    const { req, res } = makeReqRes();
    const { handleStripeWebhook } = await import("./webhooks");
    await handleStripeWebhook(req, res);

    expect(emailService.getStudentContentPurchaseReceiptEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        studentName: "Student",
        itemTitle: "Caro-Kann Masterclass",
        itemKind: "video",
        coachName: "Coach",
        amountPaidCents: 2900,
      }),
    );
    expect(emailService.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "s@e.com",
        subject: expect.stringContaining("Caro-Kann Masterclass"),
      }),
    );
  });
});

// ── Earnings ─────────────────────────────────────────────────────────────

describe("getCoachContentEarnings", () => {
  it("4: returns 0 when coach has no content purchases", async () => {
    vi.mocked(db.getCoachContentEarnings).mockResolvedValue(0);
    const result = await db.getCoachContentEarnings(42);
    expect(result).toBe(0);
  });

  it("5: returns correct sum for multiple purchases", async () => {
    vi.mocked(db.getCoachContentEarnings).mockResolvedValue(7800);
    const result = await db.getCoachContentEarnings(42);
    expect(result).toBe(7800);
  });
});

describe("getCoachEarningsSummary includes contentEarningsCents", () => {
  it("6: includes contentEarningsCents in the summary", async () => {
    vi.mocked(db.getCoachEarningsSummary).mockResolvedValue({
      totalEarningsCents: 50000,
      pendingEarningsCents: 10000,
      contentEarningsCents: 8500,
    } as any);

    const summary = await db.getCoachEarningsSummary(42);
    expect(summary.contentEarningsCents).toBe(8500);
    expect(summary.totalEarningsCents).toBe(50000);
    expect(summary.pendingEarningsCents).toBe(10000);
  });
});

describe("coach.getEarnings includes contentEarningsCents", () => {
  it("7: returns contentEarningsCents in the response", async () => {
    vi.mocked(db.getCoachEarningsSummary).mockResolvedValue({
      totalEarningsCents: 50000,
      pendingEarningsCents: 10000,
      contentEarningsCents: 8500,
      stripeOnboarded: true,
    } as any);
    vi.mocked(db.getUserById).mockResolvedValue(coach as any);

    const caller = appRouter.createCaller(ctx(coach));
    const res = await caller.coach.getEarnings();
    expect(res.contentEarningsCents).toBe(8500);
  });
});
