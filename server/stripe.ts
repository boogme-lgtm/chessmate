import Stripe from "stripe";
import { ENV } from "./_core/env";

// Initialize Stripe with the secret key
const stripe = new Stripe(ENV.stripeSecretKey || "", {
  apiVersion: "2026-01-28.clover",
});

// Platform commission rate (15%)
const PLATFORM_COMMISSION_RATE = 0.15;

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
 * Funds are captured but held until lesson completion
 */
export async function createLessonPaymentIntent(params: {
  amountCents: number;
  currency: string;
  studentCustomerId: string;
  coachConnectAccountId: string;
  lessonId: number;
  studentId: number;
  coachId: number;
}) {
  const {
    amountCents,
    currency,
    studentCustomerId,
    coachConnectAccountId,
    lessonId,
    studentId,
    coachId,
  } = params;

  // Calculate platform fee (commission)
  const platformFeeCents = Math.round(amountCents * PLATFORM_COMMISSION_RATE);

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountCents,
    currency: currency.toLowerCase(),
    customer: studentCustomerId,
    // Capture manually to implement escrow
    capture_method: "manual",
    // Transfer to coach's Connect account after capture
    transfer_data: {
      destination: coachConnectAccountId,
    },
    // Platform takes commission
    application_fee_amount: platformFeeCents,
    metadata: {
      lessonId: lessonId.toString(),
      studentId: studentId.toString(),
      coachId: coachId.toString(),
      platform: "boogme",
      type: "lesson_payment",
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
 * Alternative to PaymentIntent for simpler integration
 */
export async function createLessonCheckoutSession(params: {
  amountCents: number;
  currency: string;
  lessonId: number;
  studentId: number;
  studentEmail: string;
  coachName: string;
  coachConnectAccountId: string;
  successUrl: string;
  cancelUrl: string;
}) {
  const {
    amountCents,
    currency,
    lessonId,
    studentId,
    studentEmail,
    coachName,
    coachConnectAccountId,
    successUrl,
    cancelUrl,
  } = params;

  const platformFeeCents = Math.round(amountCents * PLATFORM_COMMISSION_RATE);

  // Check if this is a test/mock coach account (starts with "acct_test_coach_")
  const isTestAccount = coachConnectAccountId.startsWith("acct_test_coach_");

  // Build payment intent data conditionally
  const paymentIntentData: any = {
    capture_method: "manual", // Escrow
    metadata: {
      lessonId: lessonId.toString(),
      studentId: studentId.toString(),
      platform: "boogme",
    },
  };

  // Only add transfer_data and application_fee for real Stripe Connect accounts
  if (!isTestAccount) {
    paymentIntentData.transfer_data = {
      destination: coachConnectAccountId,
    };
    paymentIntentData.application_fee_amount = platformFeeCents;
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
          unit_amount: amountCents,
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

export { stripe };
