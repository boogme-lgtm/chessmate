/**
 * Stripe Webhook Handlers
 * 
 * Handles Stripe webhook events for payment processing and booking status updates.
 * This file contains handlers for checkout completion, payment success/failure, and escrow management.
 */

import { Request, Response } from 'express';
import Stripe from 'stripe';
import { constructWebhookEvent } from './stripe';
import * as db from './db';
import { sendEmail, getStudentBookingConfirmationEmail, getCoachBookingNotificationEmail } from './emailService';
import { ENV } from './_core/env';

// Use the shared Stripe instance from stripe.ts — do not create a duplicate

/**
 * Main webhook handler that routes events to specific handlers
 */
export async function handleStripeWebhook(req: Request, res: Response) {
  const signature = req.headers['stripe-signature'];
  
  if (!signature || Array.isArray(signature)) {
    console.error('[Webhook] No signature provided or invalid signature format');
    return res.status(400).json({ error: 'No signature' });
  }

  try {
    // Validate webhook secret is configured
    if (!ENV.stripeWebhookSecret) {
      console.error('[Webhook] STRIPE_WEBHOOK_SECRET not configured');
      return res.status(500).json({ error: 'Webhook secret not configured' });
    }

    // Construct and verify the webhook event
    const event = constructWebhookEvent(
      req.body,
      signature,
      ENV.stripeWebhookSecret
    );

    console.log(`[Webhook] Received event: ${event.type} (${event.id})`);

    // Handle test events from Stripe Dashboard
    if (event.id.startsWith('evt_test_')) {
      console.log('[Webhook] Test event detected, returning verification response');
      return res.json({ verified: true });
    }

    // Route to specific handlers based on event type
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event);
        break;
      
      case 'payment_intent.succeeded':
        await handlePaymentSucceeded(event);
        break;
      
      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event);
        break;

      case 'account.updated':
        await handleAccountUpdated(event);
        break;

      default:
        console.log(`[Webhook] Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('[Webhook] Error processing webhook:', error);
    res.status(400).json({ error: 'Webhook processing failed' });
  }
}

/**
 * Handle checkout.session.completed event
 * This fires when a student completes the Stripe checkout
 */
async function handleCheckoutCompleted(event: Stripe.Event) {
  const session = event.data.object as Stripe.Checkout.Session;
  
  console.log(`[Webhook] Checkout completed for session: ${session.id}`);
  console.log(`[Webhook] Payment status: ${session.payment_status}`);
  console.log(`[Webhook] Metadata:`, session.metadata);

  // Extract and validate lesson ID from metadata
  const rawLessonId = session.metadata?.lessonId;

  if (!rawLessonId) {
    console.error('[Webhook] No lessonId in checkout session metadata');
    return;
  }

  const lessonId = parseInt(rawLessonId, 10);
  if (isNaN(lessonId) || lessonId <= 0) {
    console.error(`[Webhook] Invalid lessonId in metadata: ${rawLessonId}`);
    return;
  }

  // Update lesson status based on payment status
  if (session.payment_status === 'paid') {
    // Idempotency: skip if lesson has already been processed past the payment stage.
    // "paid" must be in this list because handlePaymentSucceeded or a retried
    // checkout.session.completed event would otherwise reprocess and re-send emails.
    const currentLesson = await db.getLessonById(lessonId);
    if (!currentLesson) {
      console.error(`[Webhook] Lesson ${lessonId} not found in DB (metadata points to missing record)`);
      return;
    }
    // R2-2: Strict state transition — only allow confirmed → paid.
    // Any other status (pending_confirmation, declined, no_show, disputed, etc.)
    // must NOT be promoted to paid. Already-paid/terminal states are idempotent no-ops.
    if (currentLesson.status !== 'confirmed') {
      console.log(`[Webhook] Lesson ${lessonId} is in state '${currentLesson.status}', not 'confirmed'. Refusing to mark paid (no-op).`);
      return;
    }

    // Extract the payment intent ID from the session payload
    const paymentIntentId = session.payment_intent
      ? (typeof session.payment_intent === 'string'
          ? session.payment_intent
          : session.payment_intent.id)
      : null;

    if (!paymentIntentId) {
      console.error(`[Webhook] checkout.session.completed for lesson ${lessonId} had no payment_intent — cannot record payment`);
      return;
    }

    // Atomic update: set status = 'paid' AND store payment intent in a single DB call.
    // Previously this was two sequential updates which left a brief window where the
    // lesson was `confirmed` without a payment intent, causing "Lesson not found" race
    // on the success page.
    await db.updateLessonPaymentIntent(lessonId, paymentIntentId);
    console.log(`[Webhook] Lesson ${lessonId} marked 'paid' with payment intent ${paymentIntentId}`);

    // Send confirmation emails to student and coach
    try {
      const lesson = await db.getLessonById(lessonId);
      if (lesson) {
        const student = await db.getUserById(lesson.studentId);
        const coach = await db.getUserById(lesson.coachId);
        
        if (student && coach) {
          // Format lesson date and time
          const lessonDate = new Date(lesson.scheduledAt).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });
          const lessonTime = new Date(lesson.scheduledAt).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          });
          const amount = `$${(lesson.amountCents / 100).toFixed(2)}`;
          const coachPayout = `$${(lesson.coachPayoutCents / 100).toFixed(2)}`;
          
          // Send student confirmation
          await sendEmail({
            to: student.email,
            subject: `Lesson Confirmed with ${coach.name || 'Your Coach'}`,
            html: getStudentBookingConfirmationEmail(
              student.name || 'Student',
              coach.name || 'Your Coach',
              lessonDate,
              lessonTime,
              lesson.durationMinutes,
              amount,
              lesson.id
            )
          });
          console.log(`[Webhook] ✉️ Sent confirmation email to student: ${student.email}`);
          
          // Send coach notification
          await sendEmail({
            to: coach.email,
            subject: `New Lesson Booking from ${student.name || 'a Student'}`,
            html: getCoachBookingNotificationEmail(
              coach.name || 'Coach',
              student.name || 'Student',
              lessonDate,
              lessonTime,
              lesson.durationMinutes,
              coachPayout,
              lesson.id
            )
          });
          console.log(`[Webhook] ✉️ Sent booking notification to coach: ${coach.email}`);
        }
      }
    } catch (emailError) {
      console.error('[Webhook] Failed to send confirmation emails:', emailError);
      // Don't fail the webhook if email sending fails
    }
  } else {
    console.log(`[Webhook] Payment not completed yet for lesson ${lessonId}`);
  }
}

/**
 * Handle payment_intent.succeeded event
 * This confirms the payment was successfully processed
 */
async function handlePaymentSucceeded(event: Stripe.Event) {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;

  console.log(`[Webhook] payment_intent.succeeded: ${paymentIntent.id}`);

  // Find lesson by payment intent ID (raw SQL read for transaction-isolation consistency)
  const lesson = await db.getLessonByPaymentIntent(paymentIntent.id);

  if (!lesson) {
    console.log(`[Webhook] No lesson found for payment intent ${paymentIntent.id}. This is expected if checkout.session.completed hasn't fired yet.`);
    return;
  }

  console.log(`[Webhook] Found lesson ${lesson.id} for payment ${paymentIntent.id} (current status: ${lesson.status})`);

  // R2-2: Strict state transition — only allow confirmed → paid.
  if (lesson.status !== 'confirmed') {
    console.log(`[Webhook] Lesson ${lesson.id} is in state '${lesson.status}', not 'confirmed'. Refusing to mark paid via payment_intent.succeeded (no-op).`);
    return;
  }

  await db.updateLessonStatus(lesson.id, 'paid');
  console.log(`[Webhook] Lesson ${lesson.id} marked 'paid' via payment_intent.succeeded`);
}

/**
 * Handle payment_intent.payment_failed event
 * This handles failed payments
 */
async function handlePaymentFailed(event: Stripe.Event) {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  
  console.error(`[Webhook] Payment failed: ${paymentIntent.id}`);
  console.error(`[Webhook] Failure reason:`, paymentIntent.last_payment_error);
  
  // Find lesson by payment intent ID
  const lesson = await db.getLessonByPaymentIntent(paymentIntent.id);
  
  if (lesson) {
    // Only cancel if lesson hasn't already progressed past payment
    if (lesson.status && ['pending_confirmation', 'confirmed'].includes(lesson.status)) {
      console.log(`[Webhook] Marking lesson ${lesson.id} as payment failed`);
      await db.updateLessonStatus(lesson.id, 'cancelled');
      console.log(`[Webhook] Lesson ${lesson.id} cancelled due to payment failure`);
    } else {
      console.log(`[Webhook] Lesson ${lesson.id} already in state '${lesson.status}', ignoring payment failure`);
    }
  }
}

/**
 * Handle account.updated event (Stripe Connect)
 *
 * Fired when a Connect account's verification status changes. This catches
 * the case where Stripe finishes verifying a coach *after* they returned to
 * the wizard (e.g. KYC documents processed hours later).
 *
 * To receive this event, add "account.updated" to the webhook's event list
 * in the Stripe Dashboard → Developers → Webhooks.
 */
async function handleAccountUpdated(event: Stripe.Event) {
  const account = event.data.object as Stripe.Account;

  console.log(`[Webhook] account.updated: ${account.id} (charges=${account.charges_enabled}, payouts=${account.payouts_enabled})`);

  if (!account.charges_enabled || !account.payouts_enabled) {
    // Not fully onboarded yet — nothing to do
    return;
  }

  // Find the user with this Connect account ID and flip the flag
  try {
    // Look up user by stripeConnectAccountId via raw SQL
    const database = (await import("./db")).getDb;
    const dbInstance = await database();
    if (!dbInstance) return;

    const { sql } = await import("drizzle-orm");
    const result: any = await dbInstance.execute(sql`
      SELECT id, stripeConnectOnboarded FROM users
      WHERE stripeConnectAccountId = ${account.id}
      LIMIT 1
    `);
    const user = result[0]?.[0];
    if (!user) {
      console.log(`[Webhook] No user found for Connect account ${account.id}`);
      return;
    }

    if (user.stripeConnectOnboarded) {
      console.log(`[Webhook] User ${user.id} already marked onboarded, skipping`);
      return;
    }

    await db.updateUserStripeConnectAccount(user.id, account.id, true);
    console.log(`[Webhook] User ${user.id} stripeConnectOnboarded set to true via account.updated`);
  } catch (err) {
    console.error(`[Webhook] Failed to process account.updated for ${account.id}:`, err);
  }
}
