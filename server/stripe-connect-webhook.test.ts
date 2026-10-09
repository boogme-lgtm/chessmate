import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import Stripe from "stripe";
import type { Request, Response } from "express";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { ENV } from "./_core/env";
import { handleStripeWebhook } from "./webhooks";
import * as db from "./db";
import { expireCheckoutSession, getConnectAccountStatus } from "./stripe";
import { transferToCoach } from "./stripeConnect";
import { sendEmail } from "./emailService";
import { notifyOwner } from "./_core/notification";
import { SAFE_EVENT_TYPES } from "../scripts/stripe-webhook-ops.mjs";

vi.mock("./db");
vi.mock("./stripeConnect");
vi.mock("./emailService");
vi.mock("./_core/notification");
// Signature verification stays real; only the live account read is stubbed.
vi.mock("./stripe", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./stripe")>()),
  getConnectAccountStatus: vi.fn(),
  createRefund: vi.fn(),
  expireCheckoutSession: vi.fn(),
}));

// Use Stripe's real signing and verification code with synthetic local secrets.
const stripe = new Stripe("sk_test_dummy");
const platformSecret = "whsec_unit_platform";
const connectSecret = "whsec_unit_connect";
const originalSecrets = {
  stripeWebhookSecret: ENV.stripeWebhookSecret,
  stripeConnectWebhookSecret: ENV.stripeConnectWebhookSecret,
};
const execute = vi.fn();
const connectEvent = {
  id: "evt_connect_unit", object: "event", type: "account.updated",
  account: "acct_coach_unit", livemode: false,
  data: { object: { id: "acct_coach_unit", object: "account", charges_enabled: true, payouts_enabled: true } },
};
const paymentEvent = {
  id: "evt_payment_unit", object: "event", type: "checkout.session.completed", livemode: false,
  data: { object: { id: "cs_unit", payment_status: "paid", payment_intent: "pi_unit", metadata: { lessonId: "10" } } },
};

function signedRequest(event: unknown, secret: string, timestamp?: number) {
  const payload = JSON.stringify(event);
  return {
    body: Buffer.from(payload),
    headers: { "stripe-signature": stripe.webhooks.generateTestHeaderString({ payload, secret, timestamp }) },
  } as unknown as Request;
}

function response() {
  return { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as unknown as Response;
}

async function dispatch(event: unknown, secret = connectSecret) {
  const res = response();
  await handleStripeWebhook(signedRequest(event, secret), res);
  return res;
}

/** An account.updated event whose snapshot carries these flags. */
function accountEvent(flags: { charges_enabled?: boolean; payouts_enabled?: boolean }) {
  return { ...connectEvent, data: { object: { ...connectEvent.data.object, ...flags } } };
}

/** What Stripe reports for the account right now (the handler's source of truth). */
function liveAccount(chargesEnabled: boolean, payoutsEnabled: boolean) {
  vi.mocked(getConnectAccountStatus).mockResolvedValue({
    id: "acct_coach_unit", chargesEnabled, payoutsEnabled, detailsSubmitted: true, requirements: null,
  } as any);
}

beforeEach(() => {
  vi.resetAllMocks();
  ENV.stripeWebhookSecret = platformSecret;
  ENV.stripeConnectWebhookSecret = connectSecret;
  execute.mockResolvedValue([[{ id: 42, stripeConnectOnboarded: false }]]);
  vi.mocked(db.getDb).mockResolvedValue({ execute } as any);
  vi.mocked(db.updateUserStripeConnectAccount).mockResolvedValue(undefined);
  liveAccount(true, true);
});

afterAll(() => Object.assign(ENV, originalSecrets));

describe("destination signing secrets", () => {
  it("keeps platform checkout processing when Connect is not configured", async () => {
    ENV.stripeConnectWebhookSecret = "";
    vi.mocked(db.getLessonById).mockResolvedValue({ id: 10, status: "payment_collected" } as any);
    const res = await dispatch(paymentEvent, platformSecret);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ received: true });
    expect(db.getLessonById).toHaveBeenCalledWith(10);
  });

  it("still processes platform checkout after configuring a distinct Connect secret", async () => {
    vi.mocked(db.getLessonById).mockResolvedValue({ id: 10, status: "payment_collected" } as any);
    const res = await dispatch(paymentEvent, platformSecret);
    expect(res.status).not.toHaveBeenCalled();
    expect(db.getLessonById).toHaveBeenCalledWith(10);
    expect(db.updateUserStripeConnectAccount).not.toHaveBeenCalled();
  });

  it("accepts the Connect signature and updates the matching coach", async () => {
    const res = await dispatch(connectEvent);
    expect(res.status).not.toHaveBeenCalled();
    expect(db.updateUserStripeConnectAccount).toHaveBeenCalledWith(42, "acct_coach_unit", true);
    const query = new MySqlDialect().sqlToQuery(execute.mock.calls[0][0]);
    expect(query.params).toEqual(["acct_coach_unit"]);
    // The live state is read for the event's own (verified) account.
    expect(getConnectAccountStatus).toHaveBeenCalledWith("acct_coach_unit", expect.anything());
    expect(db.getLessonById).not.toHaveBeenCalled();
  });

  it("rejects an unknown signing secret", async () => {
    const res = await dispatch(connectEvent, "whsec_unit_unknown");
    expect(res.status).toHaveBeenCalledWith(400);
    expect(db.getDb).not.toHaveBeenCalled();
  });

  it("rejects a Connect event when its secret is not configured", async () => {
    ENV.stripeConnectWebhookSecret = "";
    const res = await dispatch(connectEvent);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(db.updateUserStripeConnectAccount).not.toHaveBeenCalled();
  });

  it("rejects a modified raw payload", async () => {
    const req = signedRequest(connectEvent, connectSecret);
    req.body = Buffer.concat([req.body, Buffer.from(" ")]);
    const res = response();
    await handleStripeWebhook(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(db.getDb).not.toHaveBeenCalled();
  });

  it("rejects a stale signed payload", async () => {
    const req = signedRequest(connectEvent, connectSecret, Math.floor(Date.now() / 1000) - 600);
    const res = response();
    await handleStripeWebhook(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(db.getDb).not.toHaveBeenCalled();
  });

  it("rejects requests without a signature", async () => {
    const req = { body: Buffer.from(JSON.stringify(connectEvent)), headers: {} } as Request;
    const res = response();
    await handleStripeWebhook(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(db.getDb).not.toHaveBeenCalled();
  });

  it("reports missing configuration without processing an event", async () => {
    ENV.stripeWebhookSecret = "";
    ENV.stripeConnectWebhookSecret = "";
    const res = await dispatch(connectEvent);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(db.getDb).not.toHaveBeenCalled();
  });

  it("rejects identical destination secrets instead of misclassifying events", async () => {
    ENV.stripeConnectWebhookSecret = platformSecret;
    const res = await dispatch(connectEvent, platformSecret);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(db.getDb).not.toHaveBeenCalled();
  });

  it("verifies a signed diagnostic event without changing data", async () => {
    const res = await dispatch({ ...connectEvent, id: "evt_test_connect_unit" });
    expect(res.json).toHaveBeenCalledWith({ verified: true });
    expect(db.getDb).not.toHaveBeenCalled();
    expect(transferToCoach).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

describe("event scope and Connect account identity", () => {
  it.each(SAFE_EVENT_TYPES)("keeps operational replay of %s free of business processing", async type => {
    const res = await dispatch({ id: "evt_existing_subscription", object: "event", type,
      livemode: false, data: { object: { id: "sub_existing" } } }, platformSecret);
    expect(res.json).toHaveBeenCalledWith({ received: true });
    for (const method of Object.values(db)) {
      if (vi.isMockFunction(method)) expect(method).not.toHaveBeenCalled();
    }
    expect(transferToCoach).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("does not route Connect-signed checkout events into platform payments", async () => {
    const res = await dispatch({ ...paymentEvent, account: "acct_coach_unit" });
    expect(res.json).toHaveBeenCalledWith({ received: true });
    expect(db.getLessonById).not.toHaveBeenCalled();
    expect(transferToCoach).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  // Sprint 3 (intended change): this used to return 400, which makes Stripe
  // retry and eventually DISABLE the platform endpoint — stopping every payment
  // webhook. It is now acknowledged with 200, logged loudly, alerted to the
  // owner (throttled) and still never processed.
  it("acknowledges but never processes a connected-account event on the platform destination", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      // Far enough ahead that no alert from an earlier test is inside the window.
      const start = Date.now() + 365 * 24 * 60 * 60 * 1000;
      vi.setSystemTime(start);
      for (const event of [connectEvent, { ...paymentEvent, account: "acct_coach_unit" }]) {
        const res = await dispatch(event, platformSecret);
        expect(res.status).not.toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith({ received: true, ignored: "connected_account_event_on_platform_destination" });
      }
      expect(db.getDb).not.toHaveBeenCalled();
      expect(db.getLessonById).not.toHaveBeenCalled();
      expect(db.updateUserStripeConnectAccount).not.toHaveBeenCalled();
      expect(transferToCoach).not.toHaveBeenCalled();
      expect(sendEmail).not.toHaveBeenCalled();
      expect(error.mock.calls.filter(([message]) => String(message).includes("MISCONFIGURED DESTINATION"))).toHaveLength(2);
      // One owner alert per hour, however many events arrive.
      await vi.waitFor(() => expect(notifyOwner).toHaveBeenCalledTimes(1));
      expect(vi.mocked(notifyOwner).mock.calls[0][0].title).toBe("Stripe webhook destination misconfigured");

      vi.setSystemTime(start + 60 * 60 * 1000 + 1);
      await dispatch(connectEvent, platformSecret);
      await vi.waitFor(() => expect(notifyOwner).toHaveBeenCalledTimes(2));
    } finally {
      vi.useRealTimers();
      error.mockRestore();
    }
  });

  it("still acknowledges the event when the owner alert fails", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      vi.setSystemTime(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000);
      vi.mocked(notifyOwner).mockRejectedValue(new Error("Notification service URL is not configured."));
      const res = await dispatch(connectEvent, platformSecret);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ received: true, ignored: "connected_account_event_on_platform_destination" });
      await vi.waitFor(() => expect(error.mock.calls.some(([message]) =>
        String(message).includes("Could not alert the owner"))).toBe(true));
    } finally {
      vi.useRealTimers();
      error.mockRestore();
    }
  });

  it("ignores platform account updates instead of treating them as coach updates", async () => {
    const { account, ...platformAccountEvent } = connectEvent;
    const res = await dispatch(platformAccountEvent, platformSecret);
    expect(res.json).toHaveBeenCalledWith({ received: true });
    expect(db.getDb).not.toHaveBeenCalled();
  });

  it.each([undefined, "acct_another_coach"])("rejects missing or mismatched event.account (%s)", async (account) => {
    const res = await dispatch({ ...connectEvent, account });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(db.getDb).not.toHaveBeenCalled();
    expect(db.updateUserStripeConnectAccount).not.toHaveBeenCalled();
  });

  it("acknowledges an unknown Connect account without creating or updating a user", async () => {
    execute.mockResolvedValue([[]]);
    const res = await dispatch(connectEvent);
    expect(res.json).toHaveBeenCalledWith({ received: true });
    expect(db.updateUserStripeConnectAccount).not.toHaveBeenCalled();
    expect(getConnectAccountStatus).not.toHaveBeenCalled();
  });

  it("leaves already-onboarded accounts unchanged on repeat delivery", async () => {
    execute.mockResolvedValue([[{ id: 42, stripeConnectOnboarded: true }]]);
    const res = await dispatch(connectEvent);
    expect(res.json).toHaveBeenCalledWith({ received: true });
    expect(db.updateUserStripeConnectAccount).not.toHaveBeenCalled();
  });

  // The not-enabled path reads the coach row (to decide whether a verified
  // coach must be flipped back to not-onboarded), but a coach who never
  // finished onboarding is still left untouched.
  it("leaves a coach who never finished onboarding unchanged", async () => {
    liveAccount(true, false);
    const res = await dispatch(accountEvent({ payouts_enabled: false }));
    expect(res.json).toHaveBeenCalledWith({ received: true });
    expect(db.updateUserStripeConnectAccount).not.toHaveBeenCalled();
  });

  it.each([
    ["charges", { charges_enabled: false }],
    ["payouts", { payouts_enabled: false }],
  ])("fails closed when Stripe disables %s on an onboarded coach", async (_label, disabled) => {
    execute.mockResolvedValue([[{ id: 42, stripeConnectOnboarded: 1 }]]);
    liveAccount(disabled.charges_enabled ?? true, disabled.payouts_enabled ?? true);
    const res = await dispatch(accountEvent(disabled));
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ received: true });
    expect(db.updateUserStripeConnectAccount).toHaveBeenCalledWith(42, "acct_coach_unit", false);
    // Still matched on the event's own account id.
    const query = new MySqlDialect().sqlToQuery(execute.mock.calls[0][0]);
    expect(query.params).toEqual(["acct_coach_unit"]);
  });

  describe("closing payment links when a coach becomes unpayable", () => {
    it("expires every stored open checkout once Stripe disables the account", async () => {
      execute.mockResolvedValue([[{ id: 42, stripeConnectOnboarded: 1 }]]);
      liveAccount(true, false);
      vi.mocked(db.getOpenCheckoutSessionIdsForCoach).mockResolvedValue(["cs_lesson", "cs_request", "cs_tip"]);
      const res = await dispatch(accountEvent({ payouts_enabled: false }));
      expect(res.json).toHaveBeenCalledWith({ received: true });
      expect(db.getOpenCheckoutSessionIdsForCoach).toHaveBeenCalledWith(42);
      expect(vi.mocked(expireCheckoutSession).mock.calls.map(c => c[0])).toEqual(["cs_lesson", "cs_request", "cs_tip"]);
    });

    it("retries expiry on a redelivery even though the flag is already off", async () => {
      execute.mockResolvedValue([[{ id: 42, stripeConnectOnboarded: 0 }]]);
      liveAccount(false, true);
      vi.mocked(db.getOpenCheckoutSessionIdsForCoach).mockResolvedValue(["cs_left_open"]);
      await dispatch(accountEvent({ charges_enabled: false }));
      expect(db.updateUserStripeConnectAccount).not.toHaveBeenCalled();
      expect(expireCheckoutSession).toHaveBeenCalledWith("cs_left_open");
    });

    it("never expires checkouts for a fully enabled account", async () => {
      execute.mockResolvedValue([[{ id: 42, stripeConnectOnboarded: 0 }]]);
      liveAccount(true, true);
      await dispatch(accountEvent({}));
      expect(db.updateUserStripeConnectAccount).toHaveBeenCalledWith(42, "acct_coach_unit", true);
      expect(db.getOpenCheckoutSessionIdsForCoach).not.toHaveBeenCalled();
      expect(expireCheckoutSession).not.toHaveBeenCalled();
    });

    it("acknowledges the event and keeps going when a session can't be expired", async () => {
      execute.mockResolvedValue([[{ id: 42, stripeConnectOnboarded: 1 }]]);
      liveAccount(false, false);
      vi.mocked(db.getOpenCheckoutSessionIdsForCoach).mockResolvedValue(["cs_already_complete", "cs_open"]);
      vi.mocked(expireCheckoutSession).mockRejectedValueOnce(new Error("Only open sessions can be expired"));
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const res = await dispatch(accountEvent({ charges_enabled: false, payouts_enabled: false }));
      warn.mockRestore();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ received: true });
      expect(db.updateUserStripeConnectAccount).toHaveBeenCalledWith(42, "acct_coach_unit", false);
      expect(expireCheckoutSession).toHaveBeenCalledWith("cs_open");
    });
  });

  it("is idempotent when a disabled account is delivered again", async () => {
    execute.mockResolvedValue([[{ id: 42, stripeConnectOnboarded: 0 }]]);
    liveAccount(false, true);
    const res = await dispatch(accountEvent({ charges_enabled: false }));
    expect(res.json).toHaveBeenCalledWith({ received: true });
    expect(db.updateUserStripeConnectAccount).not.toHaveBeenCalled();
  });

  it.each(["unavailable", "write failure"])("does not acknowledge a lost disable on database %s", async (failure) => {
    execute.mockResolvedValue([[{ id: 42, stripeConnectOnboarded: true }]]);
    liveAccount(true, false);
    if (failure === "unavailable") vi.mocked(db.getDb).mockResolvedValue(null);
    if (failure === "write failure") vi.mocked(db.updateUserStripeConnectAccount).mockRejectedValue(new Error("Simulated database write failure"));
    const res = await dispatch(accountEvent({ payouts_enabled: false }));
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).not.toHaveBeenCalledWith({ received: true });
  });

  it.each(["unavailable", "read failure", "write failure"])("does not acknowledge a lost account update on database %s", async (failure) => {
    if (failure === "unavailable") vi.mocked(db.getDb).mockResolvedValue(null);
    if (failure === "read failure") execute.mockRejectedValue(new Error("Simulated database read failure"));
    if (failure === "write failure") vi.mocked(db.updateUserStripeConnectAccount).mockRejectedValue(new Error("Simulated database write failure"));
    const res = await dispatch(connectEvent);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).not.toHaveBeenCalledWith({ received: true });
  });
});

// Stripe doesn't guarantee event order and retries failed deliveries for days,
// so the flag must follow the account's live state, never the event snapshot.
describe("account.updated follows Stripe's live account state, not the event snapshot", () => {
  it("a stale 'disabled' snapshot never flips a payable coach to not-onboarded", async () => {
    execute.mockResolvedValue([[{ id: 42, stripeConnectOnboarded: 1 }]]);
    liveAccount(true, true);
    const res = await dispatch(accountEvent({ payouts_enabled: false }));
    expect(res.json).toHaveBeenCalledWith({ received: true });
    expect(db.updateUserStripeConnectAccount).not.toHaveBeenCalled();
  });

  it("a stale 'enabled' snapshot never re-opens payments Stripe has disabled", async () => {
    execute.mockResolvedValue([[{ id: 42, stripeConnectOnboarded: 0 }]]);
    liveAccount(true, false);
    const res = await dispatch(connectEvent);
    expect(res.json).toHaveBeenCalledWith({ received: true });
    expect(db.updateUserStripeConnectAccount).not.toHaveBeenCalled();
  });

  it("closes payments when Stripe has disabled the account, whatever the snapshot says", async () => {
    execute.mockResolvedValue([[{ id: 42, stripeConnectOnboarded: true }]]);
    liveAccount(false, true);
    await dispatch(connectEvent);
    expect(db.updateUserStripeConnectAccount).toHaveBeenCalledWith(42, "acct_coach_unit", false);
  });

  it("opens payments when Stripe has enabled the account, whatever the snapshot says", async () => {
    liveAccount(true, true);
    await dispatch(accountEvent({ charges_enabled: false, payouts_enabled: false }));
    expect(db.updateUserStripeConnectAccount).toHaveBeenCalledWith(42, "acct_coach_unit", true);
  });

  it("does not acknowledge the event when Stripe can't be asked, so it is retried", async () => {
    execute.mockResolvedValue([[{ id: 42, stripeConnectOnboarded: true }]]);
    vi.mocked(getConnectAccountStatus).mockRejectedValue(new Error("Stripe API unavailable"));
    const res = await dispatch(accountEvent({ payouts_enabled: false }));
    expect(res.status).toHaveBeenCalledWith(400);
    expect(db.updateUserStripeConnectAccount).not.toHaveBeenCalled();
  });

  it("a retried intermediate onboarding event can't undo a completed onboarding", async () => {
    // In-memory users row behind the handler's read and write.
    let onboarded = false;
    execute.mockImplementation(async () => [[{ id: 42, stripeConnectOnboarded: onboarded }]]);
    vi.mocked(db.updateUserStripeConnectAccount).mockImplementation(async (_id, _acct, value) => { onboarded = !!value; });
    const e1 = { ...accountEvent({ payouts_enabled: false }), id: "evt_e1" };
    const e2 = { ...connectEvent, id: "evt_e2" };

    // E1 (charges only) hits a database blip and is left for Stripe to retry.
    vi.mocked(db.getDb).mockResolvedValueOnce(null);
    expect((await dispatch(e1)).status).toHaveBeenCalledWith(400);
    // E2 (fully enabled) completes onboarding.
    liveAccount(true, true);
    await dispatch(e2);
    expect(onboarded).toBe(true);
    // Stripe retries E1 hours later; the account is still fully enabled.
    const res = await dispatch(e1);
    expect(res.json).toHaveBeenCalledWith({ received: true });
    expect(onboarded).toBe(true);
  });
});
