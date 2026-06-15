# Sprint S-PAY-1 Handoff — Payout Architecture Verification + Fix

## Context

BooGMe is a chess coaching marketplace (React + tRPC + Drizzle + MySQL + Stripe). This sprint is a **verification and fix** task — not a feature build. We need you to confirm whether the payout architecture is correct, identify any bugs, and fix them.

---

## The Question

When a student pays for a lesson, funds land on the **BooGMe platform Stripe account**. After the lesson completes and the 24-hour dispute window closes, the platform is supposed to transfer the coach's share to their **Stripe Connect account** via `stripe.transfers.create()`.

We manually triggered `releaseAllEligiblePayouts()` and got:

```
{
  "total": 1,
  "releasedCount": 0,
  "failedCount": 1,
  "failed": [{ "lessonId": 330001, "reason": "You have insufficient available funds in your Stripe account." }]
}
```

Stripe returned `balance_insufficient`. **Is this a real bug or expected test mode behavior?**

---

## Current Payment Architecture (read this carefully)

### How lesson payments work

`server/stripe.ts` → `createLessonCheckoutSession()` (line ~273):
- Creates a Stripe **Checkout Session** in `payment` mode
- `capture_method` defaults to **automatic** (student charged immediately)
- **No `transfer_data` or `application_fee_amount`** — funds land entirely on the platform account
- Comment in code: *"Funds stay on the platform. Coach payout is handled later via stripe.transfers.create()"*

This is the **"Separate Charges and Transfers"** model. The platform collects 100% of the student payment, then later creates a separate `stripe.transfers.create()` to send the coach's share.

### How payout release works

`server/payoutService.ts` → `releaseLessonPayoutToCoach()`:
1. Validates lesson is `completed` or `disputed`
2. Checks issue window has expired
3. Calls `transferToCoach()` from `server/stripeConnect.ts` (line ~141)
4. `transferToCoach()` calls `stripe.transfers.create({ amount, destination: coachConnectAccountId })`
5. On success, calls `db.finalizeLessonPayout()` → sets status to `released`

### The problem

`stripe.transfers.create()` **without a `source_transaction`** requires the platform account to have **available balance** (settled funds). In test mode, Stripe test payments don't automatically settle to available balance — they stay in **pending balance**. This is why we get `balance_insufficient` in test mode.

In **production**, card payments settle to available balance within 2 business days, so the transfer would succeed once the scheduler runs after settlement.

---

## What we need you to verify and fix

### Task 1 — Confirm the architecture is correct for production

Read the Stripe docs on [Separate Charges and Transfers](https://stripe.com/docs/connect/separate-charges-and-transfers). Confirm:
- Is `stripe.transfers.create()` without `source_transaction` the right approach for this model?
- Does this work correctly in production (real card payments settle to available balance)?
- Is there a better approach (e.g., using `source_transaction` to link the transfer to the original charge)?

**If the architecture is wrong**, fix it. The correct approach for Separate Charges and Transfers is to pass `source_transaction: chargeId` to `stripe.transfers.create()`. This requires:
1. Storing the Stripe **charge ID** (not just payment intent ID) on the lesson when the webhook fires
2. Passing `source_transaction: lesson.stripeChargeId` in `transferToCoach()`

The charge ID is available in the `checkout.session.completed` webhook via `session.payment_intent` → then retrieve the payment intent to get `latest_charge`.

### Task 2 — Fix test mode so we can verify end-to-end

In test mode, to make a transfer work without `balance_insufficient`, Stripe requires using the test card `4000000000000077` which immediately makes funds available. But we can't control which card users use in testing.

Alternative: add a `source_transaction` to the transfer. In test mode, a transfer with `source_transaction` doesn't require available balance — it pulls directly from the specific charge. This would also fix the production architecture.

**Concrete fix:**

In `server/webhooks.ts` → `handleCheckoutCompleted()` (line ~130), after extracting `paymentIntentId`, also retrieve the charge ID:
```ts
// After getting paymentIntentId, retrieve the charge
const pi = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ['latest_charge'] });
const chargeId = typeof pi.latest_charge === 'string' ? pi.latest_charge : pi.latest_charge?.id;
```

Store `chargeId` on the lesson (add `stripeChargeId TEXT` column to `lessons` table in schema).

In `server/stripeConnect.ts` → `transferToCoach()`, add optional `sourceTransaction` param:
```ts
const transfer = await stripe.transfers.create({
  amount: amountCents,
  currency,
  destination: accountId,
  ...(sourceTransaction ? { source_transaction: sourceTransaction } : {}),
  description,
  metadata,
});
```

In `server/payoutService.ts` → `releaseLessonPayoutToCoach()`, pass `sourceTransaction: lesson.stripeChargeId` to `transferToCoach()`.

### Task 3 — Verify the test flow end-to-end

After implementing the fix, write a test that:
1. Simulates a `checkout.session.completed` webhook with a mock payment intent that has a `latest_charge`
2. Verifies `stripeChargeId` is stored on the lesson
3. Verifies `releaseLessonPayoutToCoach()` calls `transferToCoach()` with `source_transaction: chargeId`
4. Verifies the lesson transitions to `released` status

---

## Files to touch

| File | Change |
|------|--------|
| `drizzle/schema.ts` | Add `stripeChargeId: text('stripe_charge_id')` to lessons table |
| `server/webhooks.ts` | Retrieve charge ID from payment intent, store on lesson |
| `server/db.ts` | Update `updateLessonPaymentCollected()` to accept and store `chargeId` |
| `server/stripeConnect.ts` | Add `sourceTransaction?` param to `transferToCoach()` |
| `server/payoutService.ts` | Pass `sourceTransaction: lesson.stripeChargeId` to `transferToCoach()` |
| `server/payoutService.test.ts` (new or existing) | Tests for the above |

## Do NOT change
- `server/stripe.ts` (Checkout session creation is fine as-is)
- `server/reminderScheduler.ts`
- Any Sprint 49/50 PGN/analysis code
- `reviews` table or procedures
- Tip checkout flow

## Current state
- 414 tests pass, tsc clean — checkpoint `949000bf`
- Lesson 330001 is in `completed` status with `stripePaymentIntentId` set, `stripeChargeId` does not exist yet
- The `balance_insufficient` error is the only thing blocking the payout release
