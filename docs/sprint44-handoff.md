# Sprint 44 Handoff — E2E Booking Test Fixes

**To Claude — Sprint 44**

## Branch / sync state

Same discipline as before: merge `origin/main` into your branch before starting. Current baseline on `main` is commit `5306f12d` (Sprint 41 patch 3). Sprint 42 (admin name resolution) and Sprint 43 (bulk payout release) have been merged. Verified baseline: **348 tests, `tsc` exit 0, audit 26/2h/22m/2l**.

---

## Context

A live end-to-end booking test was performed today using real Stripe test cards. The payment succeeded ($149.87 captured, payout expected Jun 15 in Stripe dashboard). Several UX and notification issues were discovered. None touch the money path — all fixes are in the UI layer and the email/notification service.

---

## Issues to fix (S44-1 through S44-8)

### S44-1 — Post-booking: replace disappearing toast with persistent payment modal

**Problem:** After a student books a lesson, a toast notification appears briefly at the bottom-right saying something like "complete payment to confirm." It disappears in a few seconds. If the student misses it, they have no idea they need to pay.

**Fix:** Replace the toast with a persistent modal/dialog that appears immediately after booking is confirmed. The modal should:
- Explain that the lesson is reserved but payment is required to confirm it.
- Show the lesson details (coach name, date/time, price).
- Have a prominent "Pay Now" CTA button that takes the student directly to the Stripe checkout URL.
- Have a secondary "Pay Later" option that dismisses the modal and leaves the lesson in "Awaiting Payment" state on the dashboard.

No new server procedures needed — the checkout URL is already returned by the booking mutation response.

---

### S44-2 — Lesson card shows "Coach #1" instead of coach's real name

**Problem:** On the student dashboard (`/dashboard`), lesson cards display "Lesson with Coach #1" (a raw numeric ID fallback) instead of the coach's actual name.

**Fix:** The student dashboard lesson query should JOIN or resolve the coach's display name. The `getUsersByIds` helper added in Sprint 42 (`db.getUsersByIds`) can be reused here. Render the coach's name on the card title, e.g. "Lesson with Coach Cristian." The "View Coach" link on the card should navigate to `/coach/[coachId]`.

---

### S44-3 — Dashboard shows stale "Awaiting Payment" status after payment completes

**Problem:** After completing Stripe checkout, the student is redirected back to the dashboard, but the lesson card still shows "Awaiting Payment" and the "Pay Now" button is still visible. The status does not update until a manual page refresh.

**Fix:** On the Stripe success redirect URL (e.g. `/dashboard?payment_success=1` or `/payment-success`), invalidate the lesson list query so the dashboard re-fetches and shows the updated status. A `useEffect` that watches for the `payment_success` query param and calls `trpc.useUtils().lessons.invalidate()` (or equivalent) is sufficient.

---

### S44-4 — PGN message tab: add file upload button

**Problem:** The messaging modal's PGN tab only supports copy-paste. Students want to upload `.pgn` files directly from their computer.

**Fix:** Add a "Browse file" button (a standard `<input type="file" accept=".pgn">`) next to or below the PGN textarea. When a file is selected, read its contents with `FileReader` and populate the textarea. No server-side upload needed — the PGN text is sent as a message string, same as the paste flow.

---

### S44-5 — Messaging modal PGN tab: cannot scroll to Send button

**Problem:** When a long PGN is pasted into the PGN tab textarea, the textarea expands and pushes the Send button below the visible area of the modal. The modal does not scroll, so the Send button is unreachable.

**Fix:** The messaging modal should have a fixed max-height with `overflow-y: auto` on the scrollable content area, or the textarea should have a fixed `max-height` with `overflow-y: auto` so it does not expand beyond the modal bounds. The Send button should always be visible at the bottom of the modal, outside the scrollable area (sticky footer pattern).

---

### S44-6 — Booking confirmation email not sent to student

**Problem:** When a student books a lesson, they receive no email confirmation. The `emailService.ts` has email templates but the booking confirmation email is either not wired up or the send call is missing.

**Fix:** After a lesson is successfully created (in the `lessons.book` or equivalent tRPC procedure in `server/routers.ts`), send a booking confirmation email to the student containing:
- Coach name, date/time, duration, price.
- A reminder that payment is required to confirm the lesson (with a Pay Now link if status is `awaiting_payment`).
- A link to their dashboard.

Use the existing `emailService.ts` pattern (Resend API via `sendEmail`).

---

### S44-7 — Coach notification email not sent when a new lesson is booked

**Problem:** When a student books a lesson with a coach, the coach receives no email notification.

**Fix:** After a lesson is successfully created, send a notification email to the coach containing:
- Student name, requested date/time, duration, lesson notes/goals if provided.
- A link to their coach dashboard to accept/confirm the lesson.

---

### S44-8 — Payment confirmation email not sent to student after Stripe checkout

**Problem:** After the student completes Stripe checkout, they receive no payment confirmation email.

**Fix:** In the Stripe webhook handler (`server/webhooks.ts`), in the `checkout.session.completed` handler (after `handleCheckoutCompleted` succeeds), send a payment confirmation email to the student containing:
- Lesson details (coach name, date/time, duration).
- Confirmation that payment is secured in escrow.
- Reminder of the cancellation/refund policy.
- Link to their dashboard.

---

## Files likely to change

| File | Reason |
|------|--------|
| `client/src/pages/StudentDashboard.tsx` (or equivalent) | S44-1 modal, S44-2 coach name, S44-3 status refresh |
| `client/src/components/LessonMessagingModal.tsx` (or equivalent) | S44-4 file upload, S44-5 scroll fix |
| `server/routers.ts` | S44-6, S44-7 — send emails after lesson creation |
| `server/webhooks.ts` | S44-8 — send email after checkout.session.completed |
| `server/emailService.ts` | New email templates for booking confirmation, coach notification, payment confirmation |

---

## Not in scope for this sprint

- S44-9: Personalized landing page for logged-in users (future sprint).
- S44-10: Replace Manus OAuth with native auth (future sprint).
- Any changes to the money path (payout, escrow, refund logic).

---

## Deliverables

- All 8 fixes implemented.
- New email templates added to `emailService.ts`.
- `server/sprint44.test.ts` with behavioral tests covering at minimum: email send calls triggered on booking creation (S44-6, S44-7) and on webhook checkout completion (S44-8).
- `pnpm test` passing (target: 348+ tests).
- `tsc --noEmit` exits 0.
- `pnpm audit --prod` unchanged (26/2h/22m/2l).
- Commit SHA(s) to merge into `main`.

---

## Review asks

1. For S44-3 (stale dashboard status): if the Stripe redirect already hits a `/payment-success` route that calls a `lessons.confirmPayment` procedure, the invalidation should happen there. If there is no such route and status is updated purely via webhook, note that webhook delivery can be delayed — consider polling or a short `refetchInterval` on the lesson query as a fallback.
2. For S44-6/S44-7/S44-8: if `emailService.ts` does not already have a `sendBookingConfirmation`, `sendCoachNewBookingNotification`, and `sendPaymentConfirmation` function, add them following the existing pattern. Keep HTML templates consistent with the existing BooGMe email style (dark background, BooGMe logo, Coach Cristian sign-off).
