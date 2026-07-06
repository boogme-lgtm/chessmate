/**
 * Stripe Webhook Handlers
 * 
 * Handles Stripe webhook events for payment processing and booking status updates.
 * This file contains handlers for checkout completion, payment success/failure, and escrow management.
 */

import { Request, Response } from 'express';
import Stripe from 'stripe';
import { constructWebhookEvent, createRefund } from './stripe';
import * as db from './db';
import { transferToCoach, getChargeIdForPaymentIntent } from './stripeConnect';
import { sendEmail, getStudentBookingConfirmationEmail, getCoachBookingNotificationEmail, getStudentContentPurchaseReceiptEmail } from './emailService';
import { ENV } from './_core/env';
import { getTierFeePercent, DEFAULT_PRICING_TIER } from '@shared/pricing';

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

  if (session.metadata?.type === 'tip') {
    await handleTipCheckoutCompleted(session);
    return;
  }

  // S-CONTENT-2: content request checkout
  if (session.metadata?.type === 'content_request') {
    await handleContentRequestCheckoutCompleted(session);
    return;
  }

  // S-STOREFRONT-1: storefront content purchase
  if (session.metadata?.type === 'content_item') {
    await handleContentItemCheckoutCompleted(session);
    return;
  }

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
    // Payment-first model: checkout.session.completed transitions pending_payment → payment_collected.
    // The student has paid upfront; now the coach is notified about the booking request.
    // Idempotent: if already past pending_payment, this is a no-op (webhook retry safe).
    if (currentLesson.status !== 'pending_payment') {
      // Orphaned-payment guard. If the lesson was cancelled/declined while the
      // student's Stripe checkout was still open, the payment lands here for a
      // lesson that no longer exists. When we never recorded a payment intent
      // for it (so no refund was ever issued), the money is orphaned — refund
      // it immediately. A lesson that already has a payment intent was handled
      // normally, so this is just a webhook retry → no-op.
      const isOrphanedPayment =
        (currentLesson.status === 'cancelled' || currentLesson.status === 'declined') &&
        !currentLesson.stripePaymentIntentId;

      if (isOrphanedPayment) {
        const orphanPI = session.payment_intent
          ? (typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent.id)
          : null;
        if (orphanPI) {
          try {
            // The idempotency key makes a webhook retry return the same refund —
            // this can never double-refund.
            await createRefund(orphanPI, undefined, "requested_by_customer", `orphan_refund_lesson_${lessonId}_${orphanPI}`);
            console.error(`[Webhook] Auto-refunded ORPHANED payment ${orphanPI} for '${currentLesson.status}' lesson ${lessonId} (student paid after the lesson was cancelled)`);
          } catch (e) {
            console.error(`[Webhook] CRITICAL: failed to auto-refund orphaned payment ${orphanPI} for lesson ${lessonId} — needs manual refund:`, e);
          }
        } else {
          console.error(`[Webhook] Orphaned paid '${currentLesson.status}' lesson ${lessonId} had no payment_intent on the session — needs manual refund`);
        }
      } else {
        console.log(`[Webhook] Lesson ${lessonId} is in state '${currentLesson.status}', not 'pending_payment'. No-op.`);
      }
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

    // Resolve the charge backing this payment intent so the eventual coach
    // payout can be a charge-sourced transfer (works in test mode, no
    // available-balance requirement). Best-effort — never blocks payment.
    const chargeId = await getChargeIdForPaymentIntent(paymentIntentId);
    if (!chargeId) {
      console.warn(`[Webhook] Could not resolve charge for payment intent ${paymentIntentId} on lesson ${lessonId} — payout will fall back to balance-based transfer`);
    }

    // Atomic update: set status = 'payment_collected' AND store payment intent + charge.
    // Also reset the confirmation deadline to 24h from now (coach has 24h to accept/decline).
    await db.updateLessonPaymentCollected(lessonId, paymentIntentId, chargeId);
    // Clear the checkout session reference now that payment is complete
    await db.clearLessonCheckoutSession(lessonId);
    console.log(`[Webhook] Lesson ${lessonId} marked 'payment_collected' with payment intent ${paymentIntentId}${chargeId ? ` (charge ${chargeId})` : ''}`);

    // Send confirmation emails to student and coach
    try {
      const lesson = await db.getLessonById(lessonId);
      if (lesson) {
        const student = await db.getUserById(lesson.studentId);
        const coach = await db.getUserById(lesson.coachId);
        
        if (!student) {
          console.warn(`[Webhook] Cannot send emails for lesson ${lessonId}: student ${lesson.studentId} not found`);
        }
        if (!coach) {
          console.warn(`[Webhook] Cannot send emails for lesson ${lessonId}: coach ${lesson.coachId} not found`);
        }
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
          
          // Send student payment receipt
          await sendEmail({
            to: student.email,
            subject: `Payment received — awaiting coach confirmation`,
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
          console.log(`[Webhook] ✉️ Sent payment receipt to student: ${student.email}`);
          
          // NOW notify coach about the paid booking request.
          // Coach was NOT notified at booking time — only after student pays.
          const deadline = new Date(Date.now() + 24 * 60 * 60 * 1000);
          const confirmByDate = deadline.toLocaleDateString('en-US', {
            weekday: 'long', month: 'long', day: 'numeric',
          });
          const confirmByTime = deadline.toLocaleTimeString('en-US', {
            hour: 'numeric', minute: '2-digit', hour12: true,
          });
          await sendEmail({
            to: coach.email,
            subject: `New paid lesson request from ${student.name || 'a Student'}`,
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
          console.log(`[Webhook] ✉️ Sent paid booking request to coach: ${coach.email}`);
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

async function handleTipCheckoutCompleted(session: Stripe.Checkout.Session) {
  const tipRecord = await db.getTipByCheckoutSession(session.id);
  if (!tipRecord) {
    console.error(`[Webhook] No tip found for checkout session ${session.id}`);
    return;
  }
  if (tipRecord.status !== 'pending') {
    console.log(`[Webhook] Tip ${tipRecord.id} already processed (status: ${tipRecord.status})`);
    return;
  }
  if (session.payment_status !== 'paid') {
    console.log(`[Webhook] Tip payment not completed for session ${session.id}`);
    return;
  }

  await db.updateTipStatus(tipRecord.id, 'paid', { paidAt: new Date() });
  console.log(`[Webhook] Tip ${tipRecord.id} marked paid`);

  const coach = await db.getUserById(tipRecord.coachId);
  if (!coach?.stripeConnectAccountId) {
    console.error(`[Webhook] Coach ${tipRecord.coachId} has no Connect account — tip ${tipRecord.id} cannot be transferred`);
    await db.updateTipStatus(tipRecord.id, 'failed');
    return;
  }

  const result = await transferToCoach({
    accountId: coach.stripeConnectAccountId,
    amountCents: tipRecord.amountCents,
    description: `Tip for lesson #${tipRecord.lessonId}`,
    metadata: {
      tipId: tipRecord.id.toString(),
      lessonId: tipRecord.lessonId.toString(),
    },
    idempotencyKey: `tip_transfer_${tipRecord.id}`,
  });

  if (result.success) {
    await db.updateTipStatus(tipRecord.id, 'transferred', {
      transferredAt: new Date(),
      stripeTransferId: result.transferId,
    });
    console.log(`[Webhook] Tip ${tipRecord.id} transferred to coach ${tipRecord.coachId}`);
  } else {
    await db.updateTipStatus(tipRecord.id, 'failed');
    console.error(`[Webhook] Tip ${tipRecord.id} transfer failed: ${result.error}`);
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

  // Payment-first model: payment_intent.succeeded also transitions pending_payment → payment_collected.
  // This is a backup path — checkout.session.completed usually fires first.
  if (lesson.status !== 'pending_payment') {
    console.log(`[Webhook] Lesson ${lesson.id} is in state '${lesson.status}', not 'pending_payment'. No-op via payment_intent.succeeded.`);
    return;
  }

  // The PaymentIntent on this event carries latest_charge directly (a charge
  // id string), so no extra API round-trip is needed on this backup path.
  const latest = (paymentIntent as any).latest_charge;
  const chargeId = latest ? (typeof latest === 'string' ? latest : latest.id) : null;

  await db.updateLessonPaymentCollected(lesson.id, paymentIntent.id, chargeId);
  console.log(`[Webhook] Lesson ${lesson.id} marked 'payment_collected' via payment_intent.succeeded${chargeId ? ` (charge ${chargeId})` : ''}`);
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
    if (lesson.status && ['pending_payment', 'pending_confirmation', 'confirmed'].includes(lesson.status)) {
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

/**
 * S-CONTENT-2: Handle checkout.session.completed for content requests.
 * Transitions pending_payment -> payment_collected, stores payment info, notifies coach.
 */
async function handleContentRequestCheckoutCompleted(session: Stripe.Checkout.Session) {
  const rawRequestId = session.metadata?.requestId;
  if (!rawRequestId) {
    console.error('[Webhook] content_request checkout: no requestId in metadata');
    return;
  }
  const requestId = parseInt(rawRequestId, 10);
  if (isNaN(requestId) || requestId <= 0) return;

  if (session.payment_status !== 'paid') return;

  const request = await db.getContentRequestById(requestId);
  if (!request) {
    console.error(`[Webhook] content_request ${requestId} not found`);
    return;
  }
  // Idempotency: only transition from pending_payment
  if (request.status !== 'pending_payment') {
    console.log(`[Webhook] content_request ${requestId} already in state '${request.status}' -- no-op`);
    return;
  }

  const paymentIntentId = session.payment_intent
    ? (typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent.id)
    : null;
  if (!paymentIntentId) {
    console.error(`[Webhook] content_request ${requestId}: no payment_intent in session`);
    return;
  }

  const chargeId = await getChargeIdForPaymentIntent(paymentIntentId);
  await db.markContentRequestPaymentCollected(requestId, paymentIntentId, chargeId);

  console.log(`[Webhook] content_request ${requestId} -> payment_collected (PI: ${paymentIntentId})`);

  // Notify coach
  try {
    const student = await db.getUserById(request.studentId);
    await db.createNotification({
      userId: request.coachId,
      type: "content_request_payment_collected",
      title: "Payment received -- ready to start",
      body: `${student?.name || "Your student"} paid for "${request.title}". You can now begin work.`,
      relatedUserId: request.studentId,
      relatedContentRequestId: requestId,
      recipientRole: "coach",
    });
  } catch (err) {
    console.error(`[Webhook] content_request ${requestId}: notify coach failed`, err);
  }
}

/**
 * S-STOREFRONT-1: Handle checkout.session.completed for a storefront content
 * purchase. Records the purchase (idempotent on the UNIQUE PaymentIntent),
 * then transfers the coach's share via a charge-sourced transfer (Separate
 * Charges and Transfers — mirrors the tip flow). Notifies the student.
 */
async function handleContentItemCheckoutCompleted(session: Stripe.Checkout.Session) {
  const rawContentItemId = session.metadata?.contentItemId;
  const rawBuyerId = session.metadata?.buyerId;
  if (!rawContentItemId || !rawBuyerId) {
    console.error('[Webhook] content_item checkout: missing contentItemId/buyerId in metadata');
    return;
  }
  const contentItemId = parseInt(rawContentItemId, 10);
  const buyerId = parseInt(rawBuyerId, 10);
  if (isNaN(contentItemId) || contentItemId <= 0 || isNaN(buyerId) || buyerId <= 0) {
    console.error('[Webhook] content_item checkout: invalid metadata ids');
    return;
  }

  if (session.payment_status !== 'paid') {
    console.log(`[Webhook] content_item ${contentItemId}: payment not completed (${session.payment_status})`);
    return;
  }

  const paymentIntentId = session.payment_intent
    ? (typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent.id)
    : null;
  if (!paymentIntentId) {
    console.error(`[Webhook] content_item ${contentItemId}: no payment_intent in session`);
    return;
  }

  const amountPaidCents = session.amount_total ?? 0;

  // Record the purchase. Race-safe & idempotent:
  //  - "duplicate_same_pi": a webhook retry — no-op, no payout, no refund.
  //  - "duplicate_other_pi": the buyer already owns this item via a different
  //    PaymentIntent (concurrent double-checkout) — refund THIS charge, no payout.
  //  - "inserted": a genuine new purchase — proceed to pay the coach.
  let result: db.RecordContentPurchaseResult;
  try {
    result = await db.recordContentPurchase({
      contentItemId,
      userId: buyerId,
      amountPaidCents,
      stripePaymentIntentId: paymentIntentId,
    });
  } catch (err) {
    console.error(`[Webhook] content_item ${contentItemId}: failed to record purchase`, err);
    return;
  }

  if (result === "duplicate_same_pi") {
    console.log(`[Webhook] content_item ${contentItemId}: purchase already recorded for PI ${paymentIntentId} — no-op`);
    return;
  }

  if (result === "duplicate_other_pi") {
    // Buyer was charged a second time for content they already own. Do NOT pay
    // the coach again; refund the redundant charge to the buyer.
    console.warn(`[Webhook] content_item ${contentItemId}: buyer ${buyerId} double-purchased (PI ${paymentIntentId}) — refunding redundant charge`);
    try {
      await createRefund(paymentIntentId, undefined, "duplicate", `content_item_dup_refund_${paymentIntentId}`);
      console.log(`[Webhook] content_item ${contentItemId}: refunded duplicate charge ${paymentIntentId}`);
    } catch (refundErr) {
      console.error(`[Webhook] content_item ${contentItemId}: failed to refund duplicate charge ${paymentIntentId}`, refundErr);
    }
    return;
  }
  console.log(`[Webhook] content_item ${contentItemId} purchased by buyer ${buyerId} (PI: ${paymentIntentId})`);

  const item = await db.getContentItemById(contentItemId);
  if (!item) {
    console.error(`[Webhook] content_item ${contentItemId}: item not found after purchase`);
    return;
  }

  // Transfer the coach's share (price minus platform fee) via a charge-sourced transfer.
  const coach = await db.getUserById(item.coachId);
  if (!coach?.stripeConnectAccountId) {
    console.error(`[Webhook] content_item ${contentItemId}: coach ${item.coachId} has no Connect account — payout skipped`);
  } else {
    const coachProfile = await db.getCoachProfileByUserId(item.coachId);
    const feePercent = getTierFeePercent(coachProfile?.pricingTier ?? DEFAULT_PRICING_TIER);
    const platformFeeCents = Math.round((amountPaidCents * feePercent) / 100);
    const coachPayoutCents = amountPaidCents - platformFeeCents;

    if (coachPayoutCents > 0) {
      const chargeId = await getChargeIdForPaymentIntent(paymentIntentId);
      const result = await transferToCoach({
        accountId: coach.stripeConnectAccountId,
        amountCents: coachPayoutCents,
        description: `Content sale: ${item.title}`,
        metadata: {
          contentItemId: contentItemId.toString(),
          buyerId: buyerId.toString(),
        },
        idempotencyKey: `content_item_payout_${paymentIntentId}`,
        sourceTransaction: chargeId,
      });
      if (result.success) {
        console.log(`[Webhook] content_item ${contentItemId}: transferred ${coachPayoutCents} to coach ${item.coachId}`);
      } else {
        console.error(`[Webhook] content_item ${contentItemId}: transfer failed: ${result.error}`);
      }
    }
  }

  // Fetch buyer details once for both notification and email.
  const buyer = await db.getUserById(buyerId);

  // Notify the student (in-app).
  try {
    await db.createNotification({
      userId: buyerId,
      type: "content_delivered",
      title: "Your content is ready to download",
      body: `"${item.title}" is now in your library.`,
      relatedUserId: item.coachId,
      recipientRole: "student",
    });
  } catch (err) {
    console.error(`[Webhook] content_item ${contentItemId}: notify student failed`, err);
  }

  // Notify the coach (in-app).
  try {
    await db.createNotification({
      userId: item.coachId,
      type: "new_content_sale",
      title: "New content sale",
      body: `${buyer?.name || "A student"} purchased "${item.title}" for $${(amountPaidCents / 100).toFixed(2)}`,
      relatedUserId: buyerId,
      recipientRole: "coach",
    });
  } catch (err) {
    console.error(`[Webhook] content_item ${contentItemId}: notify coach failed`, err);
  }

  // Send receipt email to the student.
  try {
    if (buyer?.email) {
      await sendEmail({
        to: buyer.email,
        subject: `Receipt: "${item.title}" — BooGMe`,
        html: getStudentContentPurchaseReceiptEmail({
          studentName: buyer.name || "Student",
          itemTitle: item.title,
          itemKind: item.kind || "content",
          coachName: coach?.name || "Your coach",
          amountPaidCents,
          purchaseDate: new Date().toLocaleDateString("en-US", {
            year: "numeric", month: "long", day: "numeric",
          }),
        }),
      });
      console.log(`[Webhook] content_item ${contentItemId}: receipt email sent to ${buyer.email}`);
    }
  } catch (emailErr) {
    console.error(`[Webhook] content_item ${contentItemId}: receipt email failed`, emailErr);
  }
}
