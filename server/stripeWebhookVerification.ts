import type Stripe from "stripe";
import { ENV } from "./_core/env";
import { constructWebhookEvent } from "./stripe";

/** Trust the matching destination signature, never an unverified payload field. */
export function verifyStripeWebhook(
  payload: string | Buffer,
  signature: string,
): { event: Stripe.Event; source: "platform" | "connect" } {
  const destinations = [
    { source: "platform" as const, secret: ENV.stripeWebhookSecret },
    { source: "connect" as const, secret: ENV.stripeConnectWebhookSecret },
  ];

  for (const destination of destinations) {
    if (!destination.secret) continue;
    try {
      const event = constructWebhookEvent(payload, signature, destination.secret);
      return { event, source: destination.source };
    } catch {
      // A signature from the other destination can still be valid.
    }
  }

  // Keep signed payloads and headers out of application error logs.
  throw new Error("Stripe webhook signature verification failed");
}
