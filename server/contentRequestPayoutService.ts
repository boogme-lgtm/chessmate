import Stripe from "stripe";
import { stripe } from "./stripe";
import * as db from "./db";
import { getChargeIdForPaymentIntent } from "./stripeConnect";
import { getTierFeePercent, DEFAULT_PRICING_TIER } from "../shared/pricing";

/**
 * Release coach payout for a single delivered content request
 * whose 48-hour dispute window has expired.
 *
 * Money path: platform Stripe balance -> coach Connect account (Transfer).
 * Uses charge-sourced transfer when stripeChargeId is available (test-mode safe).
 */
export async function releaseContentRequestPayoutToCoach(requestId: number): Promise<{
  success: boolean;
  reason?: string;
}> {
  const request = await db.getContentRequestById(requestId);
  if (!request) return { success: false, reason: "Request not found" };
  if (request.status !== "delivered") return { success: false, reason: `Status is '${request.status}', not 'delivered'` };
  if (!request.payoutAt || request.payoutAt > new Date()) return { success: false, reason: "Payout window has not expired yet" };
  if (request.payoutReleasedAt) return { success: false, reason: "Payout already released" };
  if (!request.stripeChargeId && !request.stripePaymentIntentId) return { success: false, reason: "No Stripe charge on record" };

  const coach = await db.getUserById(request.coachId);
  if (!coach?.stripeConnectAccountId) return { success: false, reason: "Coach has no Stripe Connect account" };

  const coachProfile = await db.getCoachProfileByUserId(request.coachId);
  const feePercent = getTierFeePercent(coachProfile?.pricingTier ?? DEFAULT_PRICING_TIER);
  const platformFeeCents = Math.round((request.amountCents * feePercent) / 100);
  const coachPayoutCents = request.amountCents - platformFeeCents;

  if (coachPayoutCents <= 0) return { success: false, reason: "Coach payout amount is zero or negative" };

  // Charge may be null if getChargeIdForPaymentIntent failed at webhook time —
  // resolve it lazily here so the transfer can be charge-sourced (test-mode safe)
  // and the payout is never permanently stranded. Best-effort; falls back to a
  // balance-based transfer if it still can't be resolved.
  let chargeId = request.stripeChargeId;
  if (!chargeId && request.stripePaymentIntentId) {
    chargeId = await getChargeIdForPaymentIntent(request.stripePaymentIntentId);
    if (chargeId) await db.setContentRequestChargeId(requestId, chargeId);
  }

  try {
    const transferParams: Stripe.TransferCreateParams = {
      amount: coachPayoutCents,
      currency: "usd",
      destination: coach.stripeConnectAccountId,
      metadata: {
        type: "content_request_payout",
        requestId: requestId.toString(),
        coachId: request.coachId.toString(),
      },
    };
    if (chargeId) {
      transferParams.source_transaction = chargeId;
    }
    // Deterministic idempotency key so a retried or concurrent heartbeat run
    // can never create a second transfer (double-pay protection), mirroring
    // the lesson payout path.
    const transfer = await stripe.transfers.create(transferParams, {
      idempotencyKey: `content_request_payout_${requestId}`,
    });
    await db.markContentRequestPayoutReleased(requestId, transfer.id);
    console.log(`[ContentRequestPayout] Released $${(coachPayoutCents / 100).toFixed(2)} to coach ${request.coachId} for request ${requestId} (transfer ${transfer.id})`);
    return { success: true };
  } catch (err: any) {
    console.error(`[ContentRequestPayout] Transfer failed for request ${requestId}:`, err.message);
    return { success: false, reason: err.message };
  }
}

/**
 * Release payouts for ALL eligible delivered content requests.
 * Called by the heartbeat scheduler.
 */
export async function releaseAllEligibleContentRequestPayouts(): Promise<void> {
  const eligible = await db.getContentRequestsReadyForPayout();
  console.log(`[ContentRequestPayout] ${eligible.length} request(s) eligible for payout`);
  for (const req of eligible) {
    const result = await releaseContentRequestPayoutToCoach(req.id);
    if (!result.success) {
      console.warn(`[ContentRequestPayout] Skipped request ${req.id}: ${result.reason}`);
    }
  }
}
