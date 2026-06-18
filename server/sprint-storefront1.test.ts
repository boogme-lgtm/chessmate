/**
 * S-STOREFRONT-1 — coach content upload + access control + student library.
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
import * as storage from "./storage";
import * as stripeConnect from "./stripeConnect";

const coach = { id: 42, role: "user", userType: "coach", openId: "c", name: "Coach", email: "c@e.com" };
const student = { id: 1, role: "user", userType: "student", openId: "s", name: "Student", email: "s@e.com" };

function ctx(user: any): TrpcContext {
  return { user, req: { protocol: "https", headers: {} } as any, res: { setHeader: vi.fn() } as any };
}

// base64 for a tiny payload (well under the 50MB limit)
const SMALL_BASE64 = Buffer.from("hello world").toString("base64");

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(storage.storagePut).mockResolvedValue({ key: "k", url: "https://cdn/k" } as any);
  vi.mocked(storage.storageGet).mockResolvedValue({ key: "k", url: "https://cdn/signed" } as any);
  vi.mocked(db.createContentItem).mockResolvedValue(100);
  vi.mocked(db.updateContentRequestStatus).mockResolvedValue(undefined as any);
  vi.mocked(db.createNotification).mockResolvedValue(1);
});

describe("content.create", () => {
  it("coach can upload a public item", async () => {
    const caller = appRouter.createCaller(ctx(coach));
    const res = await caller.content.create({
      title: "Caro-Kann Masterclass",
      kind: "video",
      accessType: "public",
      priceCents: 2900,
      fileBase64: SMALL_BASE64,
      fileName: "video.mp4",
    });
    expect(res.id).toBe(100);
    expect(storage.storagePut).toHaveBeenCalled();
    const insertArg = vi.mocked(db.createContentItem).mock.calls[0][0] as any;
    expect(insertArg.published).toBe(false);
    expect(insertArg.priceCents).toBe(2900);
    expect(insertArg.accessType).toBe("public");
  });

  it("coach can upload a student_only item for a valid student", async () => {
    vi.mocked(db.getStudentRoster).mockResolvedValue([{ id: 1, name: "Student" }] as any);
    const caller = appRouter.createCaller(ctx(coach));
    const res = await caller.content.create({
      title: "Private Plan for Student",
      kind: "pgn",
      accessType: "student_only",
      targetStudentId: 1,
      fileBase64: SMALL_BASE64,
      fileName: "pack.pgn",
    });
    expect(res.id).toBe(100);
    const insertArg = vi.mocked(db.createContentItem).mock.calls[0][0] as any;
    expect(insertArg.targetStudentId).toBe(1);
    expect(insertArg.priceCents).toBe(0); // forced free
  });

  it("coach cannot upload student_only item for a non-student", async () => {
    vi.mocked(db.getStudentRoster).mockResolvedValue([{ id: 7, name: "Someone Else" }] as any);
    const caller = appRouter.createCaller(ctx(coach));
    await expect(
      caller.content.create({
        title: "Private Plan",
        kind: "pgn",
        accessType: "student_only",
        targetStudentId: 1,
        fileBase64: SMALL_BASE64,
        fileName: "pack.pgn",
      }),
    ).rejects.toThrow(/not one of your active students/i);
    expect(db.createContentItem).not.toHaveBeenCalled();
  });

  it("coach can upload a request_fulfillment item for a valid in_progress request", async () => {
    vi.mocked(db.getContentRequestById).mockResolvedValue({
      id: 5,
      coachId: 42,
      studentId: 1,
      title: "Custom PGN pack",
      status: "in_progress",
    } as any);
    const caller = appRouter.createCaller(ctx(coach));
    const res = await caller.content.create({
      title: "Custom PGN pack",
      kind: "pgn",
      accessType: "request_fulfillment",
      contentRequestId: 5,
      fileBase64: SMALL_BASE64,
      fileName: "pack.pgn",
    });
    expect(res.id).toBe(100);
    // Links the request to the new content item.
    expect(db.updateContentRequestStatus).toHaveBeenCalledWith(5, "in_progress", { contentItemId: 100 });
  });
});

describe("content.publish", () => {
  it("coach can publish a public item", async () => {
    vi.mocked(db.getContentItemsByCoach).mockResolvedValue([
      { id: 100, coachId: 42, accessType: "public", published: false },
    ] as any);
    vi.mocked(db.setContentItemPublished).mockResolvedValue(undefined as any);
    const caller = appRouter.createCaller(ctx(coach));
    const res = await caller.content.publish({ id: 100, published: true });
    expect(res.published).toBe(true);
    expect(db.setContentItemPublished).toHaveBeenCalledWith(100, 42, true);
  });

  it("coach cannot publish a student_only item", async () => {
    vi.mocked(db.getContentItemsByCoach).mockResolvedValue([
      { id: 101, coachId: 42, accessType: "student_only", published: false },
    ] as any);
    const caller = appRouter.createCaller(ctx(coach));
    await expect(caller.content.publish({ id: 101, published: true })).rejects.toThrow(
      /only public content/i,
    );
    expect(db.setContentItemPublished).not.toHaveBeenCalled();
  });
});

describe("content.listMine", () => {
  it("returns all items for the coach", async () => {
    vi.mocked(db.getContentItemsByCoach).mockResolvedValue([
      { id: 100, coachId: 42, accessType: "public" },
      { id: 101, coachId: 42, accessType: "student_only" },
    ] as any);
    const caller = appRouter.createCaller(ctx(coach));
    const res = await caller.content.listMine();
    expect(res).toHaveLength(2);
    expect(db.getContentItemsByCoach).toHaveBeenCalledWith(42);
  });
});

describe("content.listOwned", () => {
  it("student sees purchased items", async () => {
    vi.mocked(db.getOwnedContentItems).mockResolvedValue([
      { id: 100, title: "Bought", kind: "video", coachName: "Coach", unlockedAt: new Date() },
    ] as any);
    const caller = appRouter.createCaller(ctx(student));
    const res = await caller.content.listOwned();
    expect(res).toHaveLength(1);
    expect(db.getOwnedContentItems).toHaveBeenCalledWith(1);
  });

  it("student sees student_only items without a purchase record", async () => {
    vi.mocked(db.getOwnedContentItems).mockResolvedValue([
      { id: 101, title: "Gifted", kind: "pgn", accessType: "student_only", coachName: "Coach", unlockedAt: new Date() },
    ] as any);
    const caller = appRouter.createCaller(ctx(student));
    const res = await caller.content.listOwned();
    expect(res[0].id).toBe(101);
  });

  it("student sees request_fulfillment items after the request is delivered", async () => {
    vi.mocked(db.getOwnedContentItems).mockResolvedValue([
      { id: 102, title: "Delivered work", kind: "pgn", accessType: "request_fulfillment", coachName: "Coach", unlockedAt: new Date() },
    ] as any);
    const caller = appRouter.createCaller(ctx(student));
    const res = await caller.content.listOwned();
    expect(res[0].id).toBe(102);
  });
});

describe("content.delete", () => {
  it("hard deletes when there are no purchases and no request references", async () => {
    vi.mocked(db.getContentItemsByCoach).mockResolvedValue([{ id: 100, coachId: 42 }] as any);
    vi.mocked(db.getContentPurchaseCount).mockResolvedValue(0);
    vi.mocked(db.getContentRequestRefCount).mockResolvedValue(0);
    vi.mocked(db.deleteContentItem).mockResolvedValue(undefined as any);
    const caller = appRouter.createCaller(ctx(coach));
    const res = await caller.content.delete({ id: 100 });
    expect(res).toEqual({ deleted: true });
    expect(db.deleteContentItem).toHaveBeenCalledWith(100, 42);
  });

  it("soft deletes (unpublish only) when purchases exist", async () => {
    vi.mocked(db.getContentItemsByCoach).mockResolvedValue([{ id: 100, coachId: 42 }] as any);
    vi.mocked(db.getContentPurchaseCount).mockResolvedValue(3);
    vi.mocked(db.getContentRequestRefCount).mockResolvedValue(0);
    vi.mocked(db.setContentItemPublished).mockResolvedValue(undefined as any);
    const caller = appRouter.createCaller(ctx(coach));
    const res = await caller.content.delete({ id: 100 });
    expect(res).toEqual({ deleted: false, unpublished: true });
    expect(db.setContentItemPublished).toHaveBeenCalledWith(100, 42, false);
    expect(db.deleteContentItem).not.toHaveBeenCalled();
  });

  it("I2: soft deletes (never orphans) when a content_request references the item", async () => {
    vi.mocked(db.getContentItemsByCoach).mockResolvedValue([{ id: 102, coachId: 42 }] as any);
    vi.mocked(db.getContentPurchaseCount).mockResolvedValue(0);
    vi.mocked(db.getContentRequestRefCount).mockResolvedValue(1); // delivered request_fulfillment item
    vi.mocked(db.setContentItemPublished).mockResolvedValue(undefined as any);
    const caller = appRouter.createCaller(ctx(coach));
    const res = await caller.content.delete({ id: 102 });
    expect(res).toEqual({ deleted: false, unpublished: true });
    expect(db.deleteContentItem).not.toHaveBeenCalled();
  });
});

describe("content.update (price invariant)", () => {
  it("I1: ignores priceCents on a student_only item (always free)", async () => {
    vi.mocked(db.getContentItemsByCoach).mockResolvedValue([
      { id: 101, coachId: 42, accessType: "student_only" },
    ] as any);
    vi.mocked(db.updateContentItem).mockResolvedValue(undefined as any);
    const caller = appRouter.createCaller(ctx(coach));
    await caller.content.update({ id: 101, title: "Updated Plan", priceCents: 4900 });
    const dataArg = vi.mocked(db.updateContentItem).mock.calls[0][2] as any;
    expect(dataArg.title).toBe("Updated Plan");
    expect(dataArg.priceCents).toBeUndefined(); // price never applied to non-public
  });

  it("applies priceCents on a public item", async () => {
    vi.mocked(db.getContentItemsByCoach).mockResolvedValue([
      { id: 100, coachId: 42, accessType: "public" },
    ] as any);
    vi.mocked(db.updateContentItem).mockResolvedValue(undefined as any);
    const caller = appRouter.createCaller(ctx(coach));
    await caller.content.update({ id: 100, priceCents: 4900 });
    const dataArg = vi.mocked(db.updateContentItem).mock.calls[0][2] as any;
    expect(dataArg.priceCents).toBe(4900);
  });
});

describe("content.getDownloadUrl (access control)", () => {
  it("returns a signed url when the user has access", async () => {
    vi.mocked(db.userHasContentAccess).mockResolvedValue(true);
    vi.mocked(db.getContentItemById).mockResolvedValue({ id: 100, storageKey: "coach-content/42/x.pdf" } as any);
    const caller = appRouter.createCaller(ctx(student));
    const res = await caller.content.getDownloadUrl({ id: 100 });
    expect(res.url).toBe("https://cdn/signed");
    expect(db.userHasContentAccess).toHaveBeenCalledWith(1, 100);
    expect(storage.storageGet).toHaveBeenCalledWith("coach-content/42/x.pdf");
  });

  it("rejects with FORBIDDEN when the user lacks access", async () => {
    vi.mocked(db.userHasContentAccess).mockResolvedValue(false);
    const caller = appRouter.createCaller(ctx(student));
    await expect(caller.content.getDownloadUrl({ id: 100 })).rejects.toThrow(/do not have access/i);
    // Never hand out a URL when access is denied.
    expect(storage.storageGet).not.toHaveBeenCalled();
  });
});

describe("content.createStorefrontCheckout (purchase guards)", () => {
  const publicItem = {
    id: 100, coachId: 42, title: "Caro-Kann Masterclass",
    accessType: "public", published: true, priceCents: 2900, currency: "USD",
  };

  it("starts checkout for an available public item", async () => {
    vi.mocked(db.getContentItemById).mockResolvedValue(publicItem as any);
    vi.mocked(db.userHasContentAccess).mockResolvedValue(false);
    vi.mocked(db.getUserById).mockResolvedValue({ id: 42, stripeConnectAccountId: "acct_42" } as any);
    vi.mocked(stripe.createContentItemCheckoutSession).mockResolvedValue({ url: "https://stripe/checkout" } as any);
    const caller = appRouter.createCaller(ctx(student));
    const res = await caller.content.createStorefrontCheckout({ contentItemId: 100 });
    expect(res.url).toBe("https://stripe/checkout");
  });

  it("blocks re-purchase of already-owned content (CONFLICT) — protects payout idempotency key", async () => {
    vi.mocked(db.getContentItemById).mockResolvedValue(publicItem as any);
    vi.mocked(db.userHasContentAccess).mockResolvedValue(true);
    const caller = appRouter.createCaller(ctx(student));
    await expect(caller.content.createStorefrontCheckout({ contentItemId: 100 })).rejects.toThrow(/already own/i);
    expect(stripe.createContentItemCheckoutSession).not.toHaveBeenCalled();
  });

  it("rejects an unpublished / non-public item", async () => {
    vi.mocked(db.getContentItemById).mockResolvedValue({ ...publicItem, published: false } as any);
    const caller = appRouter.createCaller(ctx(student));
    await expect(caller.content.createStorefrontCheckout({ contentItemId: 100 })).rejects.toThrow(/not available/i);
  });
});

describe("webhook: content_item checkout (money path)", () => {
  function mockEvent() {
    vi.mocked(stripe.constructWebhookEvent).mockReturnValue({
      id: "evt_storefront_001", // must NOT start with evt_test_
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_storefront_123",
          metadata: { type: "content_item", contentItemId: "100", buyerId: "1" },
          payment_status: "paid",
          payment_intent: "pi_store_456",
          amount_total: 2900,
        },
      },
    } as any);
  }
  function makeReqRes() {
    const req = { body: "raw", headers: { "stripe-signature": "sig" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as any;
    return { req, res };
  }

  beforeEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    vi.mocked(db.getContentItemById).mockResolvedValue({ id: 100, coachId: 42, title: "Caro-Kann Masterclass" } as any);
    vi.mocked(db.getUserById).mockResolvedValue({ id: 42, stripeConnectAccountId: "acct_42" } as any);
    vi.mocked(db.getCoachProfileByUserId).mockResolvedValue({ pricingTier: "free" } as any);
    vi.mocked(stripeConnect.getChargeIdForPaymentIntent).mockResolvedValue("ch_store_789");
    vi.mocked(stripeConnect.transferToCoach).mockResolvedValue({ success: true, transferId: "tr_1" } as any);
  });

  it("records the purchase and transfers the coach's charge-sourced share", async () => {
    mockEvent();
    vi.mocked(db.recordContentPurchase).mockResolvedValue("inserted"); // new insert
    const { req, res } = makeReqRes();
    const { handleStripeWebhook } = await import("./webhooks");
    await handleStripeWebhook(req, res);

    expect(db.recordContentPurchase).toHaveBeenCalledWith(expect.objectContaining({
      contentItemId: 100, userId: 1, amountPaidCents: 2900, stripePaymentIntentId: "pi_store_456",
    }));
    // free tier = 12% platform fee → coach payout = 2900 - round(2900*12/100) = 2552, charge-sourced.
    // Payout idempotency key is per-PaymentIntent (C1 fix).
    expect(stripeConnect.transferToCoach).toHaveBeenCalledWith(expect.objectContaining({
      accountId: "acct_42",
      amountCents: 2552,
      idempotencyKey: "content_item_payout_pi_store_456",
      sourceTransaction: "ch_store_789",
    }));
    expect(db.createNotification).toHaveBeenCalledWith(expect.objectContaining({
      userId: 1, type: "content_delivered", recipientRole: "student",
    }));
    expect(res.json).toHaveBeenCalledWith({ received: true });
  });

  it("is idempotent: a webhook retry (same PI) never re-pays the coach and never refunds", async () => {
    mockEvent();
    vi.mocked(db.recordContentPurchase).mockResolvedValue("duplicate_same_pi");
    const { req, res } = makeReqRes();
    const { handleStripeWebhook } = await import("./webhooks");
    await handleStripeWebhook(req, res);

    expect(db.recordContentPurchase).toHaveBeenCalled();
    expect(stripeConnect.transferToCoach).not.toHaveBeenCalled();
    expect(stripe.createRefund).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ received: true });
  });

  it("C1: a concurrent double-purchase (different PI, already owned) refunds the buyer and never re-pays the coach", async () => {
    mockEvent();
    vi.mocked(db.recordContentPurchase).mockResolvedValue("duplicate_other_pi");
    vi.mocked(stripe.createRefund).mockResolvedValue({ id: "re_1" } as any);
    const { req, res } = makeReqRes();
    const { handleStripeWebhook } = await import("./webhooks");
    await handleStripeWebhook(req, res);

    // Redundant charge is refunded as a duplicate; coach is NOT paid again.
    expect(stripe.createRefund).toHaveBeenCalledWith(
      "pi_store_456", undefined, "duplicate", "content_item_dup_refund_pi_store_456",
    );
    expect(stripeConnect.transferToCoach).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ received: true });
  });
});
