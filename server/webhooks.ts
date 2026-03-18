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
    // Idempotency: skip if lesson is already confirmed or further along
    const currentLesson = await db.getLessonById(lessonId);
    if (currentLesson?.status && ['confirmed', 'completed', 'released', 'cancelled', 'refunded'].includes(currentLesson.status)) {
      console.log(`[Webhook] Lesson ${lessonId} already in state '${currentLesson.status}', skipping duplicate event`);
      return;
    }

    console.log(`[Webhook] Updating lesson ${lessonId} to confirmed status`);

    await db.updateLessonStatus(lessonId, 'confirmed');

    // Store the Stripe payment intent ID
    if (session.payment_intent) {
      const paymentIntentId = typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent.id;

      await db.updateLessonPaymentIntent(lessonId, paymentIntentId);
      console.log(`[Webhook] Stored payment intent ${paymentIntentId} for lesson ${lessonId}`);
    }

    console.log(`[Webhook] Lesson ${lessonId} confirmed and payment recorded`);

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
  
  console.log(`[Webhook] Payment succeeded: ${paymentIntent.id}`);
  console.log(`[Webhook] Amount: $${paymentIntent.amount / 100}`);
  
  // Find lesson by payment intent ID
  const lesson = await db.getLessonByPaymentIntent(paymentIntent.id);
  
  if (lesson) {
    console.log(`[Webhook] Found lesson ${lesson.id} for payment ${paymentIntent.id}`);
    
    // Ensure lesson is marked as confirmed
    if (lesson.status !== 'confirmed') {
      await db.updateLessonStatus(lesson.id, 'confirmed');
      console.log(`[Webhook] ✅ Lesson ${lesson.id} confirmed via payment_intent.succeeded`);
    }
  } else {
    console.log(`[Webhook] No lesson found for payment intent ${paymentIntent.id}`);
  }
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
