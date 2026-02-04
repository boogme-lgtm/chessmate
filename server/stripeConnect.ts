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
