import Stripe from "stripe";
import { ENV } from "./env";

export function createAppStripeClient(): Stripe {
  if (ENV.preview) {
    // Keep SDK parsing/types usable, but reject API work before any network I/O.
    // No real API key is loaded in this first isolation phase.
    return new Stripe("sk_test_preview_disabled", {
      apiVersion: "2026-01-28.clover",
      maxNetworkRetries: 0,
      httpClient: Stripe.createFetchHttpClient(async () => {
        throw new Error("Payments are disabled in this isolated preview");
      }),
    });
  }
  return new Stripe(ENV.stripeSecretKey || "", { apiVersion: "2026-01-28.clover" });
}
