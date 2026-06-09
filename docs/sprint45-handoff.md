# Sprint 45 — Handoff to Claude Code

## Context

Live E2E testing on boogme.com (2026-06-09) revealed 6 bugs. The Stripe webhook endpoint is now correctly registered at `https://boogme.com/api/webhooks/stripe` and the signing secret matches. However the webhook handler is still not processing events — lesson 300001 has `status = pending_payment` even though Stripe confirms the checkout session `cs_test_b1rBZI88...` is `paid`. This is the critical blocker.

---

## Bug Summary

| ID | Severity | Description |
|----|----------|-------------|
| S45-2 | **Critical** | Webhook fires but lesson status not updated — root cause unknown |
| S45-1 | High | Cancellation refund window wrong — should be 1h cutoff, not 48h/24h |
| S45-6 | High | Unpaid lessons (pending_payment) charged 50% cancellation fee — should be free |
| S45-5 | Medium | "Pay Later" button shown in booking modal — must be removed |
| S45-3 | Medium | "Pay Now" shows "already processing" toast after payment (symptom of S45-2) |
| S45-4 | Medium | No payment-confirmed or coach-notification emails (symptom of S45-2) |

---

## S45-2 (CRITICAL): Webhook not processing — investigate and fix

**Evidence:**
- Stripe event `evt_1TgH9cDWCgTDQAOtzOSKV0uV` fired at `2026-06-09T04:20:44Z` for session `cs_test_b1rBZI88...`
- Stripe confirms: `payment_status: paid`, `payment_intent: pi_3TgH9bDWCgTDQAOt2DJyZ52L`
- DB: lesson 300001 still has `status = pending_payment`, `stripePaymentIntentId = null`
- This means either: (a) the webhook request was rejected before reaching `handleCheckoutCompleted`, or (b) the DB update inside `handleCheckoutCompleted` failed silently

**Investigation steps for Claude:**

1. **Check the webhook signature verification** in `server/webhooks.ts`. The handler calls `stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)`. If the raw body is not preserved correctly (e.g., body-parser JSON middleware runs before the webhook route), the signature will always fail with a 400. Verify that the webhook route uses `express.raw({ type: 'application/json' })` middleware, NOT `express.json()`.

2. **Check `server/_core/index.ts`** (or wherever Express middleware is registered) to confirm that `express.json()` is NOT applied globally before the Stripe webhook route. The Stripe route MUST receive the raw body buffer for signature verification to work.

3. **Check the Stripe Workbench → Event deliveries tab** for `evt_1TgH9cDWCgTDQAOtzOSKV0uV` — it will show the HTTP response code. If it's 400, the signature failed. If it's 200, the handler ran but the DB update failed.

4. **Add detailed error logging** to `handleCheckoutCompleted` so any failure is visible in server logs.

**Most likely fix:** The webhook route is receiving a parsed JSON body instead of the raw buffer, causing `stripe.webhooks.constructEvent` to throw a signature mismatch. Fix: ensure the Stripe webhook route is registered BEFORE `express.json()` middleware, with its own `express.raw()` middleware.

**File to check:** `server/_core/index.ts` or `server/index.ts` — look for where `app.use(express.json())` is registered relative to the Stripe webhook route.

---

## S45-1: Fix cancellation refund window

**File:** `server/db.ts`, function `claimCancellationSlot` (around line 1662)

**Current logic:**
```ts
if (hoursUntilLesson > 48) {
  refundPercentage = 100;
} else if (hoursUntilLesson >= 24) {
  refundPercentage = 50;
}
// else 0%
```

**New logic (per user requirement):**
```ts
if (hoursUntilLesson > 1) {
  refundPercentage = 100;  // Full refund if more than 1 hour away
} else {
  refundPercentage = 0;    // No refund within 1 hour of lesson
}
```

The user wants: full refund if cancelled more than 1 hour before the lesson, no refund within 1 hour. The 50% tier is removed entirely.

**Also update the UI copy** in `client/src/pages/StudentDashboard.tsx` (and anywhere else that shows cancellation policy text) to reflect the new "1 hour" policy instead of "24 hours" or "48 hours".

---

## S45-6: Free cancellation for unpaid lessons

**File:** `server/db.ts`, function `claimCancellationSlot`

**Problem:** When a lesson has `status = pending_payment` and `stripePaymentIntentId = null`, there is no charge to refund. The current code still calculates a `refundAmountCents` based on `lesson.amountCents`, which is wrong — it leads to a 50% refund being "issued" on a lesson that was never paid for.

**Fix:** Before calculating the refund percentage, check if the lesson was actually paid:
```ts
// If lesson was never paid, cancellation is always free
const wasPaid = !!lesson.stripePaymentIntentId;
if (!wasPaid) {
  refundPercentage = 0;
  // No Stripe refund needed — just cancel the lesson
}
```

The cancellation should still proceed (transition to `cancel_pending` → `cancelled`), but `refundAmountCents` should be 0 and no Stripe refund call should be made.

**Also update** `server/routers.ts` in the `lesson.cancel` procedure — after `claimCancellationSlot` returns, the code calls Stripe to issue a refund. Add a guard: if `refundAmountCents === 0`, skip the Stripe refund call entirely.

---

## S45-5: Remove "Pay Later" button from booking modal

**File:** `client/src/components/BookingModal.tsx`, around line 274

**Current code:**
```tsx
<Button
  variant="outline"
  onClick={handleClose}
  className="flex-1"
  disabled={createCheckout.isPending}
>
  Pay Later
</Button>
```

**Fix:** Remove this button entirely. The booking modal should only show "Pay Now". The platform is payment-first — there is no pay-later path. Replace the two-button row with a single full-width "Pay Now" button and a smaller "Cancel" text link below it (or just keep the X close button in the dialog header).

---

## Tests to write

Add `server/sprint45.test.ts` with:

1. **S45-1-1**: `claimCancellationSlot` with lesson 2 hours away → `refundPercentage = 100`
2. **S45-1-2**: `claimCancellationSlot` with lesson 30 minutes away → `refundPercentage = 0`
3. **S45-6-1**: `claimCancellationSlot` with `stripePaymentIntentId = null` → `refundAmountCents = 0` regardless of timing
4. **S45-2-1**: Webhook route uses `express.raw()` not `express.json()` — verify by checking the middleware stack

---

## Acceptance criteria

- [ ] Stripe webhook `checkout.session.completed` updates lesson status to `payment_collected` in DB
- [ ] After webhook processes, student dashboard shows correct status (not "Awaiting Payment")
- [ ] Payment-confirmed email sent to student after successful payment
- [ ] Coach-notification email sent to coach after student pays
- [ ] Cancellation of unpaid lesson (pending_payment) costs $0 and issues no refund
- [ ] Cancellation of paid lesson more than 1 hour before → 100% refund
- [ ] Cancellation of paid lesson within 1 hour → 0% refund
- [ ] "Pay Later" button removed from booking modal
- [ ] All existing tests still pass (currently 356)
- [ ] `tsc --noEmit` exits 0

---

## Current state

- Checkpoint: v-a3b1aa86 (Sprint 44 Patch 2 handoff)
- Branch: `claude/code-audit-review-icD40`
- 356 tests passing, tsc exits 0
- Live lesson in DB: lesson 300001, student 990004, status `pending_payment`, Stripe session `cs_test_b1rBZI88...` (paid but not processed by server)

## After Claude is done

Manus will cherry-pick the commits onto `main`, run `pnpm test`, verify `tsc --noEmit`, and save a checkpoint.
