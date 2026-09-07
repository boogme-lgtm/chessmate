import { describe, expect, it, vi } from "vitest";
import Stripe from "stripe";
import type { Request, Response } from "express";
import { ENV } from "./_core/env";
import { handleStripeWebhook } from "./webhooks";

const validateConfiguredSecret = process.env.VALIDATE_STRIPE_CONNECT_SECRET === "true";

describe("configured Connect webhook signing secret", () => {
  it.runIf(validateConfiguredSecret)("verifies a harmless Stripe test event without database access", async () => {
    expect(ENV.stripeConnectWebhookSecret).toBeTruthy();

    const payload = JSON.stringify({
      id: "evt_test_connect_secret_validation",
      object: "event",
      type: "account.updated",
      account: "acct_test_connect_secret_validation",
      data: { object: { id: "acct_test_connect_secret_validation" } },
    });
    const signature = Stripe.webhooks.generateTestHeaderString({
      payload,
      secret: ENV.stripeConnectWebhookSecret!,
      timestamp: Math.floor(Date.now() / 1000),
    });
    const response = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    await handleStripeWebhook(
      { headers: { "stripe-signature": signature }, body: payload } as unknown as Request,
      response as unknown as Response,
    );

    expect(response.status).not.toHaveBeenCalled();
    expect(response.json).toHaveBeenCalledWith({ verified: true });
  });
});
