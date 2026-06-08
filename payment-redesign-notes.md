# Payment Model Redesign — Working Notes

## Current State Machine
```
pending_confirmation → confirmed → paid → in_progress → completed/cancelled/disputed
                    → declined
```
- `pending_confirmation`: student books, coach must confirm first
- `confirmed`: coach accepted, student must pay
- `paid`: student paid, lesson can proceed
- `released`: payment released to coach after student confirms completion
- Current flow: book → coach confirms → student pays → lesson → student confirms → released

## Target State Machine
```
pending_payment → payment_collected → confirmed → completed → released
              ↘ cancelled           → declined    → disputed → released/refunded
                                    → cancelled
```
- `pending_payment`: student books (draft), needs to pay
- `payment_collected`: student paid, coach notified, awaiting coach acceptance
- `confirmed`: coach accepted, lesson scheduled
- `declined`: coach declined, refund initiated
- `cancelled`: cancelled before completion, refund per policy
- `completed`: lesson done, 24h issue window active
- `disputed`: student raised issue, payout paused
- `released`: payout released to coach
- `refunded`: student refunded

## Schema Changes Needed
1. Add `pending_payment` and `payment_collected` to lessons.status enum
2. Remove `pending_confirmation` (or keep for backwards compat)
3. Add `issueWindowEndsAt` timestamp column for the 24h window
4. Keep existing: `payoutAt`, `refundWindowEndsAt`, `completedAt`

## Key Code Changes
1. **lesson.book**: create with `pending_payment` instead of `pending_confirmation`
   - Do NOT email coach yet (coach only notified after payment)
2. **payment.createCheckout**: allow from `pending_payment` (not `confirmed`)
   - Keep ALL idempotency guards from R3-R8
3. **webhook checkout.session.completed**: transition `pending_payment → payment_collected`
   - NOW email coach about the paid booking request
4. **lesson.confirmAsCoach**: accept `payment_collected` → `confirmed`
   - Email student that coach accepted
5. **lesson.declineAsCoach**: accept `payment_collected` → declined + refund
6. **lesson.confirmCompletion**: transition to `completed` (not `released`)
   - Set `issueWindowEndsAt = now + 24h`
   - Do NOT capture/transfer payment yet
7. **New: payout release logic**: after 24h window, release payout
   - Could be a scheduled job or on-demand check
8. **lesson.requestRefund**: works during 24h issue window on `completed` lessons

## Stripe Architecture Decision
**Separate charges and transfers** (option 1):
- Charge student on platform account (standard PaymentIntent)
- Funds sit in platform Stripe balance
- Transfer to coach's Connect account only after completion + 24h window
- Platform owns refunds/chargebacks
- This is the Airbnb model
- No manual capture needed — standard charge, delayed transfer

This means:
- Remove `capture_method: "manual"` if present
- Remove `capturePaymentIntent` calls
- Add `stripe.transfers.create()` for coach payout after 24h window
- Refunds are simple: `stripe.refunds.create()` on the platform charge

## Migration Mapping (existing lessons)
- `pending_confirmation` → keep as-is (legacy, no payment yet)
- `confirmed` → keep as-is (legacy, coach confirmed but unpaid)
- `paid` → map to `confirmed` (in new model, paid+confirmed = confirmed)
- `in_progress` → keep or map to `confirmed`
- `completed` → keep as `completed`
- `released` → keep as `released`
- `cancelled` → keep as `cancelled`
- `disputed` → keep as `disputed`
- `refunded` → keep as `refunded`
- `no_show` → keep as `cancelled`
