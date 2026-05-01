import Stripe from "stripe";
import { ENV } from "./_core/env";
import { DEFAULT_PRICING_TIER, getTierFeePercent, calculateStripeFeeCents } from "@shared/pricing";

// Initialize Stripe with the secret key
const stripe = new Stripe(ENV.stripeSecretKey || "", {
  apiVersion: "2026-01-28.clover",
});

// ============ CUSTOMER OPERATIONS ============

export async function createStripeCustomer(email: string, name?: string, userId?: number) {
  const customer = await stripe.customers.create({
    email,
    name: name || undefined,
    metadata: {
      userId: userId?.toString() || "",
      platform: "boogme",
    },
  });
  return customer;
}

export async function getStripeCustomer(customerId: string) {
  return await stripe.customers.retrieve(customerId);
}

// ============ STRIPE CONNECT (COACH ONBOARDING) ============

/**
 * Create a Stripe Connect Express account for a coach
 * This allows coaches to receive payouts through BooGMe
 */
export async function createConnectAccount(
  email: string,
  coachUserId: number,
  country: string = "US"
) {
  const account = await stripe.accounts.create({
    type: "express",
    country,
    email,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    business_type: "individual",
    metadata: {
      userId: coachUserId.toString(),
      platform: "boogme",
      role: "coach",
    },
  });
  return account;
}

/**
 * Generate an onboarding link for a coach to complete Stripe verification
 * This opens an embedded form within BooGMe
 */
export async function createConnectOnboardingLink(
  accountId: string,
  refreshUrl: string,
  returnUrl: string
) {
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: "account_onboarding",
  });
  return accountLink;
}

/**
 * Create a login link for coaches to access their Stripe Express dashboard
 */
export async function createConnectLoginLink(accountId: string) {
  const loginLink = await stripe.accounts.createLoginLink(accountId);
  return loginLink;
}

/**
 * Check if a Connect account has completed onboarding
 */
export async function getConnectAccountStatus(accountId: string) {
  const account = await stripe.accounts.retrieve(accountId);
  return {
    id: account.id,
    chargesEnabled: account.charges_enabled,
    payoutsEnabled: account.payouts_enabled,
    detailsSubmitted: account.details_submitted,
    requirements: account.requirements,
  };
}

// ============ ESCROW PAYMENT FLOW ============

/**
 * Create a PaymentIntent for a lesson booking
 * Funds are captured but held until lesson completion.
 *
 * Pricing: the student is charged `lessonPriceCents + stripeFee`. The coach
 * receives `lessonPriceCents - tierPlatformFee`. The platform's
 * application_fee covers the platform's tier % plus the Stripe processing
 * fee (so the coach takes home exactly their tier's share of the lesson).
 */
export async function createLessonPaymentIntent(params: {
  lessonPriceCents: number;
  currency: string;
  studentCustomerId: string;
  coachConnectAccountId: string;
  coachPricingTier: string | null | undefined;
  lessonId: number;
  studentId: number;
  coachId: number;
}) {
  const {
    lessonPriceCents,
    currency,
    studentCustomerId,
    coachConnectAccountId,
    coachPricingTier,
    lessonId,
    studentId,
    coachId,
  } = params;

  const feePercent = getTierFeePercent(coachPricingTier ?? DEFAULT_PRICING_TIER);
  const platformFeeCents = Math.round((lessonPriceCents * feePercent) / 100);
  const stripeFeeCents = calculateStripeFeeCents(lessonPriceCents);
  const studentTotalCents = lessonPriceCents + stripeFeeCents;
  const applicationFeeCents = platformFeeCents + stripeFeeCents;

  const paymentIntent = await stripe.paymentIntents.create({
    amount: studentTotalCents,
    currency: currency.toLowerCase(),
    customer: studentCustomerId,
    // Capture manually to implement escrow
    capture_method: "manual",
    // Transfer to coach's Connect account after capture
    transfer_data: {
      destination: coachConnectAccountId,
    },
    // Platform takes tier-based commission + recovers Stripe processing fee
    application_fee_amount: applicationFeeCents,
    metadata: {
      lessonId: lessonId.toString(),
      studentId: studentId.toString(),
      coachId: coachId.toString(),
      platform: "boogme",
      type: "lesson_payment",
      tier: coachPricingTier ?? DEFAULT_PRICING_TIER,
      feePercent: feePercent.toString(),
    },
  });

  return paymentIntent;
}

/**
 * Capture a PaymentIntent after lesson completion
 * This releases funds from escrow
 */
export async function capturePaymentIntent(paymentIntentId: string) {
  const paymentIntent = await stripe.paymentIntents.capture(paymentIntentId);
  return paymentIntent;
}

/**
 * Cancel/refund a PaymentIntent (before capture)
 */
export async function cancelPaymentIntent(paymentIntentId: string) {
  const paymentIntent = await stripe.paymentIntents.cancel(paymentIntentId);
  return paymentIntent;
}

/**
 * Create a refund for a captured payment
 * Supports partial refunds based on cancellation policy
 * @param paymentIntentId - Stripe PaymentIntent ID
 * @param amountCents - Amount to refund in cents (optional, defaults to full refund)
 * @param reason - Reason for refund
 */
export async function createRefund(
  paymentIntentId: string,
  amountCents?: number,
  reason?: "requested_by_customer" | "duplicate" | "fraudulent"
) {
  const refundParams: any = {
    payment_intent: paymentIntentId,
    reason: reason || "requested_by_customer",
    // Reverse the transfer to the coach as well
    reverse_transfer: true,
    // Refund the application fee (platform commission)
    refund_application_fee: true,
  };
  
  // Add amount if partial refund
  if (amountCents !== undefined) {
    refundParams.amount = amountCents;
  }
  
  const refund = await stripe.refunds.create(refundParams);
  return refund;
}

// ============ CHECKOUT SESSION (ALTERNATIVE FLOW) ============

/**
 * Create a Checkout Session for lesson payment
 *
 * The student is charged the lesson price plus a separate Stripe processing
 * fee line item, so the coach takes home exactly their tier's share of the
 * lesson price.
 */
export async function createLessonCheckoutSession(params: {
  lessonPriceCents: number;
  currency: string;
  lessonId: number;
  studentId: number;
  studentEmail: string;
  coachName: string;
  coachConnectAccountId: string;
  coachPricingTier: string | null | undefined;
  successUrl: string;
  cancelUrl: string;
}) {
  const {
    lessonPriceCents,
    currency,
    lessonId,
    studentId,
    studentEmail,
    coachName,
    coachConnectAccountId,
    coachPricingTier,
    successUrl,
    cancelUrl,
  } = params;

  const feePercent = getTierFeePercent(coachPricingTier ?? DEFAULT_PRICING_TIER);
  const platformFeeCents = Math.round((lessonPriceCents * feePercent) / 100);
  const stripeFeeCents = calculateStripeFeeCents(lessonPriceCents);
  const applicationFeeCents = platformFeeCents + stripeFeeCents;

  // Check if this is a test/mock coach account (starts with "acct_test_coach_")
  const isTestAccount = coachConnectAccountId.startsWith("acct_test_coach_");

  // Build payment intent data conditionally
  const paymentIntentData: any = {
    capture_method: "manual", // Escrow
    metadata: {
      lessonId: lessonId.toString(),
      studentId: studentId.toString(),
      platform: "boogme",
      tier: coachPricingTier ?? DEFAULT_PRICING_TIER,
      feePercent: feePercent.toString(),
    },
  };

  // Only add transfer_data and application_fee for real Stripe Connect accounts
  if (!isTestAccount) {
    paymentIntentData.transfer_data = {
      destination: coachConnectAccountId,
    };
    paymentIntentData.application_fee_amount = applicationFeeCents;
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    customer_email: studentEmail,
    line_items: [
      {
        price_data: {
          currency: currency.toLowerCase(),
          product_data: {
            name: `Chess Lesson with ${coachName}`,
            description: "60-minute private chess coaching session",
          },
          unit_amount: lessonPriceCents,
        },
        quantity: 1,
      },
      {
        price_data: {
          currency: currency.toLowerCase(),
          product_data: {
            name: "Payment processing fee",
            description: "Covers Stripe's 2.9% + $0.30 processing charge",
          },
          unit_amount: stripeFeeCents,
        },
        quantity: 1,
      },
    ],
    payment_intent_data: paymentIntentData,
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      lessonId: lessonId.toString(),
      studentId: studentId.toString(),
    },
  });

  return session;
}

// ============ SUBSCRIPTION (PREMIUM PLANS) ============

/**
 * Create a subscription for premium student plans
 */
export async function createSubscription(
  customerId: string,
  priceId: string,
  trialDays?: number
) {
  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    trial_period_days: trialDays,
    payment_behavior: "default_incomplete",
    expand: ["latest_invoice.payment_intent"],
  });
  return subscription;
}

/**
 * Cancel a subscription
 */
export async function cancelSubscription(subscriptionId: string, immediately: boolean = false) {
  if (immediately) {
    return await stripe.subscriptions.cancel(subscriptionId);
  }
  return await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  });
}

// ============ WEBHOOK VERIFICATION ============

/**
 * Verify and construct a Stripe webhook event
 */
export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string,
  webhookSecret: string
) {
  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}

// ============ BALANCE & PAYOUTS ============

/**
 * Get the balance for a Connect account
 */
export async function getConnectBalance(accountId: string) {
  const balance = await stripe.balance.retrieve({
    stripeAccount: accountId,
  });
  return balance;
}

/**
 * Create an instant payout for a coach (if eligible)
 */
export async function createInstantPayout(
  accountId: string,
  amountCents: number,
  currency: string = "usd"
) {
  const payout = await stripe.payouts.create(
    {
      amount: amountCents,
      currency,
      method: "instant",
    },
    {
      stripeAccount: accountId,
    }
  );
  return payout;
}

// R3-2: Retrieve a checkout session to check its status
export async function retrieveCheckoutSession(sessionId: string) {
  return stripe.checkout.sessions.retrieve(sessionId);
}

export { stripe };
