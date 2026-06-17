# Handoff: Content Request Escrow Workflow — S-CONTENT-2

## Goal

Introduce a Fiverr-style escrow gate into the content request lifecycle. The coach sets a price and delivery date; the student must **accept and pay** before the coach can start work. Funds are held on the platform until the coach marks the request as delivered, at which point the coach's payout is released after a 48-hour dispute window.

---

## Current State (what S-CONTENT-1 shipped)

| Status | Meaning |
|---|---|
| `queued` | Student submitted the request; coach has not responded yet |
| `in_progress` | Coach clicked START (no payment required) |
| `delivered` | Coach clicked MARK DELIVERED |
| `cancelled` | Coach declined |

`amountCents` is stored but **never charged**. The quote is purely informational.

---

## Target Lifecycle (after this sprint)

```
queued
  │
  ├─ coach.quote ──────────────────────────────► quoted          (coach sets price + due date + note)
  │                                                │
  │                                                ├─ student.acceptQuote ──► pending_payment   (student clicks Accept)
  │                                                │                              │
  │                                                │                              └─ student.createCheckout ──► [Stripe Checkout]
  │                                                │                                                                │
  │                                                │                              ◄── webhook: checkout.session.completed ──┘
  │                                                │                              │
  │                                                │                              └─ payment_collected              (funds in escrow on platform)
  │                                                │                                     │
  │                                                │                                     └─ coach.startWork ──────► in_progress
  │                                                │                                                                    │
  │                                                │                                                                    └─ coach.markDelivered ──► delivered
  │                                                │                                                                                                   │
  │                                                │                                                                    ◄── 48-hour dispute window ───┘
  │                                                │                                                                    │
  │                                                │                                                                    └─ payout released to coach (via heartbeat)
  │                                                │
  │                                                ├─ student.rejectQuote ──────────────────────────────────────────────────────────────► queued     (student rejects, coach can re-quote)
  │                                                │
  │                                                └─ coach.decline ────────────────────────────────────────────────────────────────────► cancelled
  │
  └─ coach.decline ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────► cancelled
```

**Key rules:**
- Coach can only call `startWork` when status is `payment_collected`.
- Student can only call `createCheckout` when status is `pending_payment`.
- Student can reject a quote (returns to `queued` so the coach can re-quote).
- If the student rejects, `amountCents` is reset to 0 and `dueDate` is cleared.
- No refund logic is needed for `rejectQuote` — no money has been collected yet.
- After delivery, the 48-hour dispute window mirrors the lesson payout pattern. No dispute UI is required in this sprint — just the window and the heartbeat release.

---

## Schema Changes

File: `drizzle/schema.ts`

### 1 — Expand `content_requests.status` enum

```ts
// Replace the current enum:
status: mysqlEnum("status", [
  "queued",
  "quoted",           // NEW — coach has set a price, awaiting student acceptance
  "pending_payment",  // NEW — student accepted, awaiting Stripe checkout
  "payment_collected",// NEW — funds in escrow, coach can start work
  "in_progress",
  "delivered",
  "cancelled",
]).default("queued").notNull(),
```

### 2 — Add Stripe tracking columns to `content_requests`

```ts
// After coachNote, add:
stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 64 }),
stripeChargeId: varchar("stripeChargeId", { length: 64 }),
stripeCheckoutSessionId: varchar("stripeCheckoutSessionId", { length: 128 }),
payoutReleasedAt: timestamp("payoutReleasedAt"),   // set when payout transfer fires
payoutAt: timestamp("payoutAt"),                   // 48h after deliveredAt — the release window
```

### 3 — Add `content_request_accepted` and `content_request_payment_collected` to notifications enum

```ts
// In the notifications table type enum, add after "content_request_declined":
"content_request_accepted",
"content_request_payment_collected",
```

Run `pnpm db:push` after all schema changes. **Manus will run this — do not skip.**

---

## Backend Changes

### 4 — New db helpers (`server/db.ts`)

Add these helpers near the existing `updateContentRequestQuote` and `updateContentRequestStatus`:

```ts
// Set status to "quoted" and store price/date/note
export async function quoteContentRequest(
  requestId: number,
  data: { amountCents: number; dueDate?: Date; coachNote?: string }
) {
  await db.update(contentRequests)
    .set({ status: "quoted", amountCents: data.amountCents, dueDate: data.dueDate, coachNote: data.coachNote, updatedAt: new Date() })
    .where(eq(contentRequests.id, requestId));
}

// Student accepts quote → pending_payment
export async function acceptContentRequestQuote(requestId: number) {
  await db.update(contentRequests)
    .set({ status: "pending_payment", updatedAt: new Date() })
    .where(eq(contentRequests.id, requestId));
}

// Student rejects quote → back to queued, clear price/date
export async function rejectContentRequestQuote(requestId: number) {
  await db.update(contentRequests)
    .set({ status: "queued", amountCents: 0, dueDate: null, coachNote: null, updatedAt: new Date() })
    .where(eq(contentRequests.id, requestId));
}

// Atomic CAS: set stripeCheckoutSessionId to "__pending__" only if currently NULL
// Returns true if claimed, false if another request won the race
export async function claimContentRequestCheckoutSlot(requestId: number): Promise<boolean> {
  const result = await db.update(contentRequests)
    .set({ stripeCheckoutSessionId: "__pending__", updatedAt: new Date() })
    .where(and(eq(contentRequests.id, requestId), isNull(contentRequests.stripeCheckoutSessionId)));
  return (result[0] as any).affectedRows > 0;
}

// Set the real session ID (overwrite __pending__)
export async function setContentRequestCheckoutSession(requestId: number, sessionId: string) {
  await db.update(contentRequests)
    .set({ stripeCheckoutSessionId: sessionId, updatedAt: new Date() })
    .where(eq(contentRequests.id, requestId));
}

// Clear the checkout session slot (on failure or expiry)
export async function clearContentRequestCheckoutSession(requestId: number) {
  await db.update(contentRequests)
    .set({ stripeCheckoutSessionId: null, updatedAt: new Date() })
    .where(eq(contentRequests.id, requestId));
}

// Mark payment collected — store payment intent + charge, set status
export async function markContentRequestPaymentCollected(
  requestId: number,
  paymentIntentId: string,
  chargeId: string | null
) {
  await db.update(contentRequests)
    .set({
      status: "payment_collected",
      stripePaymentIntentId: paymentIntentId,
      stripeChargeId: chargeId ?? undefined,
      stripeCheckoutSessionId: null,
      updatedAt: new Date(),
    })
    .where(eq(contentRequests.id, requestId));
}

// Coach starts work (payment_collected → in_progress)
export async function startContentRequestWork(requestId: number) {
  await db.update(contentRequests)
    .set({ status: "in_progress", updatedAt: new Date() })
    .where(eq(contentRequests.id, requestId));
}

// Coach marks delivered — set deliveredAt and payoutAt (48h window)
export async function deliverContentRequest(requestId: number) {
  const now = new Date();
  const payoutAt = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  await db.update(contentRequests)
    .set({ status: "delivered", deliveredAt: now, payoutAt, updatedAt: now })
    .where(eq(contentRequests.id, requestId));
}

// Fetch all delivered content requests whose payout window has expired and payout not yet released
export async function getContentRequestsReadyForPayout(): Promise<ContentRequest[]> {
  const now = new Date();
  return db.select().from(contentRequests)
    .where(and(
      eq(contentRequests.status, "delivered"),
      isNotNull(contentRequests.payoutAt),
      lte(contentRequests.payoutAt, now),
      isNull(contentRequests.payoutReleasedAt),
      isNotNull(contentRequests.stripeChargeId),
    ));
}

// Mark payout released
export async function markContentRequestPayoutReleased(requestId: number, transferId: string) {
  await db.update(contentRequests)
    .set({ payoutReleasedAt: new Date(), updatedAt: new Date() })
    .where(eq(contentRequests.id, requestId));
}
```

---

### 5 — New Stripe helper (`server/stripe.ts`)

Add `createContentRequestCheckoutSession` near `createLessonCheckoutSession`. It follows the **identical Separate Charges and Transfers pattern** — student is charged immediately, funds stay on the platform, coach payout is a separate Transfer after the dispute window.

```ts
export async function createContentRequestCheckoutSession(params: {
  amountCents: number;
  currency: string;
  requestId: number;
  studentId: number;
  studentEmail: string;
  coachName: string;
  coachConnectAccountId: string;
  coachPricingTier: string | null | undefined;
  requestTitle: string;
  successUrl: string;
  cancelUrl: string;
  idempotencyKey?: string;
}) {
  const {
    amountCents, currency, requestId, studentId, studentEmail,
    coachName, coachConnectAccountId, coachPricingTier, requestTitle,
    successUrl, cancelUrl, idempotencyKey,
  } = params;

  const feePercent = getTierFeePercent(coachPricingTier ?? DEFAULT_PRICING_TIER);
  const platformFeeCents = Math.round((amountCents * feePercent) / 100);
  const stripeFeeCents = calculateStripeFeeCents(amountCents);

  const isTestAccount = coachConnectAccountId.startsWith("acct_test_coach_");

  const paymentIntentData: any = {
    metadata: {
      type: "content_request",          // ← webhook discriminator
      requestId: requestId.toString(),
      studentId: studentId.toString(),
      platform: "boogme",
      tier: coachPricingTier ?? DEFAULT_PRICING_TIER,
      feePercent: feePercent.toString(),
      coachConnectAccountId: isTestAccount ? "" : coachConnectAccountId,
    },
  };

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    customer_email: studentEmail,
    line_items: [
      {
        price_data: {
          currency: currency.toLowerCase(),
          product_data: {
            name: `Content: ${requestTitle}`,
            description: `Custom content request from ${coachName}`,
          },
          unit_amount: amountCents,
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
      type: "content_request",
      requestId: requestId.toString(),
      studentId: studentId.toString(),
    },
  }, idempotencyKey ? { idempotencyKey } : undefined);

  return session;
}
```

---

### 6 — New tRPC procedures (`server/routers.ts`)

**Replace** the existing `contentRequest.quote` procedure (which currently moves `queued → queued`) with a version that moves `queued → quoted`. Then add the following new procedures to the `contentRequest` router:

```ts
// UPDATED: coach.quote now sets status to "quoted"
quote: coachProcedure
  .input(z.object({
    requestId: z.number(),
    amountCents: z.number().int().min(100).max(500000), // min $1
    dueDate: z.string().datetime().optional(),
    coachNote: z.string().max(2000).optional(),
  }))
  .mutation(async ({ ctx, input }) => {
    const request = await db.getContentRequestById(input.requestId);
    if (!request) throw new TRPCError({ code: "NOT_FOUND", message: "Content request not found" });
    if (request.coachId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Not your content request" });
    // Allow re-quoting from queued OR quoted (student rejected, coach revises)
    if (!["queued", "quoted"].includes(request.status)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Can only quote a queued or quoted request" });
    }
    await db.quoteContentRequest(input.requestId, {
      amountCents: input.amountCents,
      dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
      coachNote: input.coachNote,
    });
    try {
      const coach = await db.getUserById(ctx.user.id);
      await db.createNotification({
        userId: request.studentId,
        type: "content_request_quoted",
        title: "Your content request has been priced",
        body: `${coach?.name || "Your coach"} set a price of $${(input.amountCents / 100).toFixed(2)} for "${request.title}"`,
        relatedUserId: ctx.user.id,
        relatedContentRequestId: input.requestId,
        recipientRole: "student",
      });
    } catch (err) {
      console.error(`[contentRequest.quote] notify failed for request ${input.requestId}:`, err);
    }
    return { success: true };
  }),

// Student accepts the coach's quote → pending_payment
acceptQuote: protectedProcedure
  .input(z.object({ requestId: z.number() }))
  .mutation(async ({ ctx, input }) => {
    const request = await db.getContentRequestById(input.requestId);
    if (!request) throw new TRPCError({ code: "NOT_FOUND", message: "Content request not found" });
    if (request.studentId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Not your content request" });
    if (request.status !== "quoted") throw new TRPCError({ code: "BAD_REQUEST", message: "No active quote to accept" });
    await db.acceptContentRequestQuote(input.requestId);
    try {
      const student = await db.getUserById(ctx.user.id);
      await db.createNotification({
        userId: request.coachId,
        type: "content_request_accepted",
        title: "Quote accepted",
        body: `${student?.name || "Your student"} accepted your quote for "${request.title}" — they will now complete payment.`,
        relatedUserId: ctx.user.id,
        relatedContentRequestId: input.requestId,
        recipientRole: "coach",
      });
    } catch (err) {
      console.error(`[contentRequest.acceptQuote] notify failed for request ${input.requestId}:`, err);
    }
    return { success: true };
  }),

// Student rejects the coach's quote → back to queued
rejectQuote: protectedProcedure
  .input(z.object({
    requestId: z.number(),
  }))
  .mutation(async ({ ctx, input }) => {
    const request = await db.getContentRequestById(input.requestId);
    if (!request) throw new TRPCError({ code: "NOT_FOUND", message: "Content request not found" });
    if (request.studentId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Not your content request" });
    if (request.status !== "quoted") throw new TRPCError({ code: "BAD_REQUEST", message: "No active quote to reject" });
    await db.rejectContentRequestQuote(input.requestId);
    try {
      const student = await db.getUserById(ctx.user.id);
      await db.createNotification({
        userId: request.coachId,
        type: "new_content_request",   // reuse — coach sees it as a re-open
        title: "Quote rejected",
        body: `${student?.name || "Your student"} rejected your quote for "${request.title}" — you may revise and re-quote.`,
        relatedUserId: ctx.user.id,
        relatedContentRequestId: input.requestId,
        recipientRole: "coach",
      });
    } catch (err) {
      console.error(`[contentRequest.rejectQuote] notify failed for request ${input.requestId}:`, err);
    }
    return { success: true };
  }),

// Student creates Stripe Checkout for an accepted (pending_payment) content request
createCheckout: protectedProcedure
  .input(z.object({ requestId: z.number() }))
  .mutation(async ({ ctx, input }) => {
    const request = await db.getContentRequestById(input.requestId);
    if (!request) throw new TRPCError({ code: "NOT_FOUND", message: "Content request not found" });
    if (request.studentId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Not your content request" });
    if (request.status !== "pending_payment") {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: `Cannot checkout: request is in '${request.status}' state (must be 'pending_payment')` });
    }
    // Idempotency: return existing open session if present
    if (request.stripeCheckoutSessionId && request.stripeCheckoutSessionId !== "__pending__") {
      try {
        const existing = await retrieveCheckoutSession(request.stripeCheckoutSessionId);
        if (existing.status === "open") return { url: existing.url };
      } catch { /* fall through */ }
    }
    // Atomic CAS to prevent concurrent session creation
    const claimed = await db.claimContentRequestCheckoutSlot(request.id);
    if (!claimed) {
      throw new TRPCError({ code: "CONFLICT", message: "Checkout is already being created. Please try again shortly." });
    }
    try {
      const coach = await db.getUserById(request.coachId);
      if (!coach?.stripeConnectAccountId) {
        await db.clearContentRequestCheckoutSession(request.id);
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Coach has not completed payment setup" });
      }
      const student = await db.getUserById(ctx.user.id);
      const coachProfile = await db.getCoachProfileByUserId(request.coachId);
      const baseUrl = process.env.VITE_FRONTEND_URL || "http://localhost:3000";
      const session = await createContentRequestCheckoutSession({
        amountCents: request.amountCents,
        currency: "USD",
        requestId: request.id,
        studentId: ctx.user.id,
        studentEmail: student?.email || "",
        coachName: coach.name || "Coach",
        coachConnectAccountId: coach.stripeConnectAccountId,
        coachPricingTier: coachProfile?.pricingTier,
        requestTitle: request.title,
        successUrl: `${baseUrl}/dashboard?section=content-requests&payment=success`,
        cancelUrl: `${baseUrl}/dashboard?section=content-requests&payment=cancelled`,
        idempotencyKey: `content_request_checkout_${request.id}`,
      });
      await db.setContentRequestCheckoutSession(request.id, session.id);
      return { url: session.url };
    } catch (err) {
      if (!(err instanceof TRPCError)) {
        await db.clearContentRequestCheckoutSession(request.id);
      }
      throw err;
    }
  }),

// UPDATED: coach.startWork — only allowed from payment_collected
startWork: coachProcedure
  .input(z.object({ requestId: z.number() }))
  .mutation(async ({ ctx, input }) => {
    const request = await db.getContentRequestById(input.requestId);
    if (!request) throw new TRPCError({ code: "NOT_FOUND", message: "Content request not found" });
    if (request.coachId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Not your content request" });
    if (request.status !== "payment_collected") {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Cannot start work until the student has paid" });
    }
    await db.startContentRequestWork(input.requestId);
    return { success: true };
  }),

// UPDATED: coach.markDelivered — sets deliveredAt + payoutAt (48h window)
markDelivered: coachProcedure
  .input(z.object({ requestId: z.number() }))
  .mutation(async ({ ctx, input }) => {
    const request = await db.getContentRequestById(input.requestId);
    if (!request) throw new TRPCError({ code: "NOT_FOUND", message: "Content request not found" });
    if (request.coachId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Not your content request" });
    if (request.status !== "in_progress") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Can only mark in-progress requests as delivered" });
    }
    await db.deliverContentRequest(input.requestId);
    try {
      const coach = await db.getUserById(ctx.user.id);
      await db.createNotification({
        userId: request.studentId,
        type: "content_delivered",
        title: "Your content is ready",
        body: `${coach?.name || "Your coach"} delivered "${request.title}"`,
        relatedUserId: ctx.user.id,
        relatedContentRequestId: input.requestId,
        recipientRole: "student",
      });
    } catch (err) {
      console.error(`[contentRequest.markDelivered] notify failed for request ${input.requestId}:`, err);
    }
    return { success: true };
  }),
```

**Note:** The existing `updateStatus` procedure that currently handles `in_progress` and `delivered` transitions should be **removed** — it is replaced by `startWork` and `markDelivered` above.

---

### 7 — Webhook handler (`server/webhooks.ts`)

In `handleCheckoutCompleted`, add a branch for `type === "content_request"` **before** the existing `lessonId` extraction:

```ts
// At the top of handleCheckoutCompleted, after the 'tip' branch:
if (session.metadata?.type === 'content_request') {
  await handleContentRequestCheckoutCompleted(session);
  return;
}
```

Add the new handler function:

```ts
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
    console.log(`[Webhook] content_request ${requestId} already in state '${request.status}' — no-op`);
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

  console.log(`[Webhook] content_request ${requestId} → payment_collected (PI: ${paymentIntentId})`);

  // Notify coach
  try {
    const student = await db.getUserById(request.studentId);
    await db.createNotification({
      userId: request.coachId,
      type: "content_request_payment_collected",
      title: "Payment received — ready to start",
      body: `${student?.name || "Your student"} paid for "${request.title}". You can now begin work.`,
      relatedUserId: request.studentId,
      relatedContentRequestId: requestId,
      recipientRole: "coach",
    });
  } catch (err) {
    console.error(`[Webhook] content_request ${requestId}: notify coach failed`, err);
  }
}
```

---

### 8 — Payout release heartbeat (`server/contentRequestPayoutService.ts` — new file)

Create this file. It mirrors `payoutService.ts` but for content requests.

```ts
import Stripe from "stripe";
import { stripe } from "./stripe";
import * as db from "./db";
import { getTierFeePercent, DEFAULT_PRICING_TIER } from "../shared/pricing";

/**
 * Release coach payout for a single delivered content request
 * whose 48-hour dispute window has expired.
 *
 * Money path: platform Stripe balance → coach Connect account (Transfer).
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
    if (request.stripeChargeId) {
      transferParams.source_transaction = request.stripeChargeId;
    }
    const transfer = await stripe.transfers.create(transferParams);
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
```

Wire this into the existing heartbeat/periodic-updates scheduler alongside `releaseAllEligiblePayouts`. Read `/home/ubuntu/chessmate/references/periodic-updates.md` before touching the scheduler.

---

### 9 — Update existing `contentRequest.updateStatus` procedure

The old `updateStatus` procedure that sets `in_progress` and `delivered` directly must be **removed or restricted** to admin-only use. The new `startWork` and `markDelivered` procedures replace it for all normal flows.

---

## Frontend Changes

### 10 — Coach Dashboard: Content Requests module (`client/src/pages/CoachDashboard.tsx`)

**Status badge mapping** (add `quoted`, `pending_payment`, `payment_collected` to the existing badge renderer):

| Status | Badge color | Label |
|---|---|---|
| `queued` | gray | Pending |
| `quoted` | yellow/amber | Quote Sent |
| `pending_payment` | blue | Awaiting Payment |
| `payment_collected` | green | Paid — Ready |
| `in_progress` | orange | In Progress |
| `delivered` | green | Delivered |
| `cancelled` | red | Declined |

**Action buttons per status:**

| Status | Coach sees |
|---|---|
| `queued` | [SET PRICE & DATE] [DECLINE] |
| `quoted` | "Quote sent — awaiting student acceptance" (read-only) + [REVISE QUOTE] [DECLINE] |
| `pending_payment` | "Awaiting student payment" (read-only) |
| `payment_collected` | [START WORK] |
| `in_progress` | [MARK DELIVERED] |
| `delivered` | "Delivered ✓" + payout countdown (time until `payoutAt`) |
| `cancelled` | "Declined" |

The existing quote form (price input, date picker, note textarea) is reused for both initial quote and revise-quote flows.

---

### 11 — Student Dashboard: Content Requests module (`client/src/pages/StudentDashboard.tsx`)

**Status badge mapping** (same colors as coach side for consistency).

**Action buttons per status:**

| Status | Student sees |
|---|---|
| `queued` | "Waiting for coach to quote" (read-only) |
| `quoted` | Quote card showing: price, due date, coach note + [ACCEPT & PAY] [REJECT] |
| `pending_payment` | [COMPLETE PAYMENT] button → calls `contentRequest.createCheckout`, redirects to Stripe URL |
| `payment_collected` | "Payment received — coach will begin work soon" |
| `in_progress` | "In progress" |
| `delivered` | "Delivered ✓" — 48-hour dispute note ("If you have an issue, contact support within 48 hours") |
| `cancelled` | "Declined" + coach note if present |

The `ACCEPT & PAY` button calls `contentRequest.acceptQuote` first (moves to `pending_payment`), then immediately calls `contentRequest.createCheckout` and redirects to the returned Stripe URL. This is a two-step mutation in sequence — handle loading state across both calls.

---

## Test File

Create `server/sprint-content2.test.ts`. Cover:

1. `contentRequest.quote` — sets status to `quoted`, stores price/date/note, notifies student
2. `contentRequest.acceptQuote` — moves `quoted → pending_payment`, notifies coach
3. `contentRequest.rejectQuote` — moves `quoted → queued`, clears price/date/note, notifies coach
4. `contentRequest.createCheckout` — requires `pending_payment` status, returns Stripe URL
5. `contentRequest.startWork` — requires `payment_collected`, moves to `in_progress`; rejects `queued` status
6. `contentRequest.markDelivered` — requires `in_progress`, sets `deliveredAt` + `payoutAt` (48h), notifies student
7. `releaseContentRequestPayoutToCoach` — skips if window not expired; releases and marks `payoutReleasedAt` when eligible
8. Webhook `handleContentRequestCheckoutCompleted` — idempotent, transitions `pending_payment → payment_collected`, notifies coach

Follow the mock pattern from `server/sprint-content1.test.ts`.

---

## Files Changed

| File | Change |
|---|---|
| `drizzle/schema.ts` | Expand status enum (7 values), add 5 Stripe columns, add 2 notification types |
| `server/db.ts` | 9 new helpers |
| `server/stripe.ts` | `createContentRequestCheckoutSession` function |
| `server/routers.ts` | Replace `quote`, add `acceptQuote`, `rejectQuote`, `createCheckout`, `startWork`, `markDelivered`; remove/restrict `updateStatus` |
| `server/webhooks.ts` | `handleContentRequestCheckoutCompleted` branch + function |
| `server/contentRequestPayoutService.ts` | New file — payout release logic |
| `client/src/pages/CoachDashboard.tsx` | Status badges + action buttons for all 7 states |
| `client/src/pages/StudentDashboard.tsx` | Quote card, Accept/Reject, Pay button, status badges |
| `server/sprint-content2.test.ts` | New test file — 8 test cases |

**Manus will run `pnpm db:push` after schema changes — do not skip this step in the handoff.**

---

## Important Notes for Claude

1. **`retrieveCheckoutSession` import** — import it from `./stripe` alongside `createContentRequestCheckoutSession`. The function already exists in `stripe.ts` (used by the lesson checkout flow).
2. **`getChargeIdForPaymentIntent` import** — already defined in `webhooks.ts`; use it directly inside `handleContentRequestCheckoutCompleted` (same file).
3. **Heartbeat wiring** — read `references/periodic-updates.md` before touching the scheduler. Add `releaseAllEligibleContentRequestPayouts` to the same job that calls `releaseAllEligiblePayouts`.
4. **Do not remove the `decline` procedure** — it still works from `queued` and `quoted` states.
5. **`amountCents` min is 100** (one dollar) when quoting — the coach cannot set a $0 price in the new flow (that would make the Stripe checkout fail).
6. **The `updateStatus` procedure** currently used by the coach's START and MARK DELIVERED buttons must be replaced by `startWork` and `markDelivered` in the UI as well as the backend.
