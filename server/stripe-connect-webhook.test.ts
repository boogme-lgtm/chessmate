import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import Stripe from "stripe";
import type { Request, Response } from "express";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { ENV } from "./_core/env";
import { handleStripeWebhook } from "./webhooks";
import * as db from "./db";
import { transferToCoach } from "./stripeConnect";
import { sendEmail } from "./emailService";

vi.mock("./db");
vi.mock("./stripeConnect");
vi.mock("./emailService");
vi.mock("./_core/notification");

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

beforeEach(() => {
  vi.resetAllMocks();
  ENV.stripeWebhookSecret = platformSecret;
  ENV.stripeConnectWebhookSecret = connectSecret;
  execute.mockResolvedValue([[{ id: 42, stripeConnectOnboarded: false }]]);
  vi.mocked(db.getDb).mockResolvedValue({ execute } as any);
  vi.mocked(db.updateUserStripeConnectAccount).mockResolvedValue(undefined);
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
  it("does not route Connect-signed checkout events into platform payments", async () => {
    const res = await dispatch({ ...paymentEvent, account: "acct_coach_unit" });
    expect(res.json).toHaveBeenCalledWith({ received: true });
    expect(db.getLessonById).not.toHaveBeenCalled();
    expect(transferToCoach).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("does not accept the platform signature for a connected-account event", async () => {
    const res = await dispatch(connectEvent, platformSecret);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(db.getDb).not.toHaveBeenCalled();
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
  });

  it("leaves already-onboarded accounts unchanged on repeat delivery", async () => {
    execute.mockResolvedValue([[{ id: 42, stripeConnectOnboarded: true }]]);
    const res = await dispatch(connectEvent);
    expect(res.json).toHaveBeenCalledWith({ received: true });
    expect(db.updateUserStripeConnectAccount).not.toHaveBeenCalled();
  });

  it("retains the current behavior for incomplete onboarding", async () => {
    const res = await dispatch({ ...connectEvent, data: { object: { ...connectEvent.data.object, payouts_enabled: false } } });
    expect(res.json).toHaveBeenCalledWith({ received: true });
    expect(db.getDb).not.toHaveBeenCalled();
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
