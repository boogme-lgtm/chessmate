import Stripe from 'stripe';
import { ENV } from './_core/env';

const stripe = new Stripe(ENV.stripeSecretKey, {
  apiVersion: '2026-01-28.clover',
});

export interface CreateConnectAccountParams {
  email: string;
  firstName: string;
  lastName: string;
  country?: string;
}

export interface CreateAccountLinkParams {
  accountId: string;
  refreshUrl: string;
  returnUrl: string;
}

/**
 * Create a Stripe Connect Express account for a coach
 */
export async function createConnectAccount(params: CreateConnectAccountParams) {
  const { email, firstName, lastName, country = 'US' } = params;

  try {
    const account = await stripe.accounts.create({
      type: 'express',
      country,
      email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_type: 'individual',
      individual: {
        email,
        first_name: firstName,
        last_name: lastName,
      },
      settings: {
        payouts: {
          schedule: {
            interval: 'daily', // Coaches get paid daily (subject to Stripe's processing time)
          },
        },
      },
    });

    return {
      success: true,
      accountId: account.id,
    };
  } catch (error) {
    console.error('[Stripe Connect] Failed to create account:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create Stripe account',
    };
  }
}

/**
 * Create an account link for Stripe Connect onboarding
 */
export async function createAccountLink(params: CreateAccountLinkParams) {
  const { accountId, refreshUrl, returnUrl } = params;

  try {
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    });

    return {
      success: true,
      url: accountLink.url,
    };
  } catch (error) {
    console.error('[Stripe Connect] Failed to create account link:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create onboarding link',
    };
  }
}

/**
 * Get Stripe Connect account status
 */
export async function getAccountStatus(accountId: string) {
  try {
    const account = await stripe.accounts.retrieve(accountId);

    return {
      success: true,
      account: {
        id: account.id,
        detailsSubmitted: account.details_submitted,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        requirements: account.requirements,
      },
    };
  } catch (error) {
    console.error('[Stripe Connect] Failed to get account status:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get account status',
    };
  }
}

/**
 * Create a login link for coaches to access their Stripe Express dashboard
 */
export async function createLoginLink(accountId: string) {
  try {
    const loginLink = await stripe.accounts.createLoginLink(accountId);

    return {
      success: true,
      url: loginLink.url,
    };
  } catch (error) {
    console.error('[Stripe Connect] Failed to create login link:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create login link',
    };
  }
}

/**
 * Transfer funds to a coach's Stripe Connect account
 * (Used after lesson completion and payment hold period)
 */
export async function transferToCoach(params: {
  accountId: string;
  amountCents: number;
  currency?: string;
  description: string;
  metadata?: Record<string, string>;
}) {
  const { accountId, amountCents, currency = 'usd', description, metadata } = params;

  try {
    const transfer = await stripe.transfers.create({
      amount: amountCents,
      currency,
      destination: accountId,
      description,
      metadata,
    });

    return {
      success: true,
      transferId: transfer.id,
    };
  } catch (error) {
    console.error('[Stripe Connect] Failed to transfer funds:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to transfer funds',
    };
  }
}

/**
 * Create a payment intent with application fee and manual capture (escrow)
 * Money is held until lesson is confirmed by both parties
 */
export async function createEscrowPaymentIntent(params: {
  amountCents: number;
  currency?: string;
  applicationFeeCents: number;
  connectedAccountId: string;
  description: string;
  metadata?: Record<string, string>;
}) {
  const { amountCents, currency = 'usd', applicationFeeCents, connectedAccountId, description, metadata } = params;

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency,
      application_fee_amount: applicationFeeCents,
      transfer_data: {
        destination: connectedAccountId,
      },
      description,
      metadata,
      // Manual capture = escrow (hold funds until lesson confirmed)
      capture_method: 'manual',
    });

    console.log('[Stripe Escrow] Payment intent created:', paymentIntent.id);
    return {
      success: true,
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret!,
    };
  } catch (error) {
    console.error('[Stripe Escrow] Payment intent creation failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create payment intent',
    };
  }
}

/**
 * Capture a payment intent (release escrow after lesson confirmation)
 */
export async function captureEscrowPayment(paymentIntentId: string) {
  try {
    const paymentIntent = await stripe.paymentIntents.capture(paymentIntentId);
    console.log('[Stripe Escrow] Payment captured:', paymentIntentId);
    return {
      success: true,
      paymentIntent,
    };
  } catch (error) {
    console.error('[Stripe Escrow] Payment capture failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to capture payment',
    };
  }
}

/**
 * Cancel a payment intent (lesson cancelled before happening)
 */
export async function cancelEscrowPayment(paymentIntentId: string) {
  try {
    const paymentIntent = await stripe.paymentIntents.cancel(paymentIntentId);
    console.log('[Stripe Escrow] Payment cancelled:', paymentIntentId);
    return {
      success: true,
      paymentIntent,
    };
  } catch (error) {
    console.error('[Stripe Escrow] Payment cancellation failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cancel payment',
    };
  }
}

/**
 * Create a refund for a payment intent (full or partial)
 */
export async function createRefund(params: {
  paymentIntentId: string;
  amountCents?: number; // Undefined = full refund
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer';
  metadata?: Record<string, string>;
}) {
  const { paymentIntentId, amountCents, reason, metadata } = params;

  try {
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: amountCents,
      reason,
      metadata,
    });

    console.log('[Stripe Refund] Refund created:', refund.id);
    return {
      success: true,
      refundId: refund.id,
      refund,
    };
  } catch (error) {
    console.error('[Stripe Refund] Refund failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create refund',
    };
  }
}

/**
 * Calculate platform fee based on coach subscription tier
 * Free: 15%, Growth: 10%, Business: 5%
 */
export function calculatePlatformFee(params: {
  amountCents: number;
  tier: 'free' | 'growth' | 'business';
}): {
  platformFeeCents: number;
  coachPayoutCents: number;
  feePercent: number;
} {
  const feePercent = params.tier === 'free' ? 15 : params.tier === 'growth' ? 10 : 5;
  const platformFeeCents = Math.round((params.amountCents * feePercent) / 100);
  const coachPayoutCents = params.amountCents - platformFeeCents;

  return {
    platformFeeCents,
    coachPayoutCents,
    feePercent,
  };
}

/**
 * Calculate Stripe processing fee (2.9% + $0.30)
 * Only charged to Business tier coaches (5% platform fee)
 */
export function calculateProcessingFee(amountCents: number): number {
  return Math.round(amountCents * 0.029 + 30);
}

/**
 * Calculate refund amount based on cancellation timing
 * >24hrs: 100% refund
 * <24hrs: 50% refund
 * No-show: 0% refund
 */
export function calculateCancellationRefund(params: {
  amountCents: number;
  hoursBeforeLesson: number;
  isNoShow?: boolean;
}): {
  refundPercent: number;
  refundAmountCents: number;
  coachCompensationCents: number;
} {
  if (params.isNoShow) {
    return {
      refundPercent: 0,
      refundAmountCents: 0,
      coachCompensationCents: params.amountCents,
    };
  }

  if (params.hoursBeforeLesson >= 24) {
    return {
      refundPercent: 100,
      refundAmountCents: params.amountCents,
      coachCompensationCents: 0,
    };
  }

  // Less than 24 hours
  const refundAmountCents = Math.round(params.amountCents * 0.5);
  return {
    refundPercent: 50,
    refundAmountCents,
    coachCompensationCents: params.amountCents - refundAmountCents,
  };
}
