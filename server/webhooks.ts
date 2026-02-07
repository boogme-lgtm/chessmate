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

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-01-28.clover',
});

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
    // Construct and verify the webhook event
    const event = constructWebhookEvent(
      req.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
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

  // Extract lesson ID from metadata
  const lessonId = session.metadata?.lessonId;
  
  if (!lessonId) {
    console.error('[Webhook] No lessonId in checkout session metadata');
    return;
  }

  // Update lesson status based on payment status
  if (session.payment_status === 'paid') {
    console.log(`[Webhook] Updating lesson ${lessonId} to confirmed status`);
    
    await db.updateLessonStatus(parseInt(lessonId), 'confirmed');
    
    // Store the Stripe payment intent ID
    if (session.payment_intent) {
      const paymentIntentId = typeof session.payment_intent === 'string' 
        ? session.payment_intent 
        : session.payment_intent.id;
      
      await db.updateLessonPaymentIntent(parseInt(lessonId), paymentIntentId);
      console.log(`[Webhook] Stored payment intent ${paymentIntentId} for lesson ${lessonId}`);
    }
    
    console.log(`[Webhook] ✅ Lesson ${lessonId} confirmed and payment recorded`);
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
    console.log(`[Webhook] Marking lesson ${lesson.id} as payment failed`);
    await db.updateLessonStatus(lesson.id, 'cancelled');
    console.log(`[Webhook] ❌ Lesson ${lesson.id} cancelled due to payment failure`);
  }
}
