# Sprint S-UI-1 Handoff — Lesson UX Improvements

## Context

BooGMe is a chess coaching marketplace. Students book lessons with coaches, pay via Stripe Checkout, and both parties review each other after completion (Airbnb-style: reviews are hidden until both sides submit). The platform uses React + tRPC + Drizzle + MySQL.

---

## Three Features Requested

### 1. Completed Lesson Detail View + Counterpart Review Display

**Problem:** There is no dedicated lesson detail page. Completed lessons are listed in the "Past" tab of the student dashboard and the "All Lessons" section of the coach dashboard, but clicking on them does nothing — there's no way to see the full lesson details or the counterpart's review.

**What we want:**
- A clickable lesson card (or "View Details" button) on completed/released lessons that opens a lesson detail view (can be a modal or a `/lesson/:id` page — Claude's call on which is cleaner).
- The detail view shows: lesson date, duration, coach/student name, amount paid, status.
- If the lesson has `isVisible = true` reviews (both sides submitted), show the **counterpart's review** — i.e., the student sees the coach's review of them, and the coach sees the student's review of them.
- If only one side has reviewed (reviews not yet visible), show a "Waiting for the other party to submit their review" message.
- If neither has reviewed, show nothing (or a prompt to review if pending).

**Backend needed:**
- New tRPC procedure: `review.getForLesson` — protected, takes `{ lessonId: number }`, returns `{ myReview: Review | null, counterpartReview: Review | null }`. Both are only returned if `isVisible = true`. Uses existing `getReviewByLessonAndReviewer` and `getCounterpartReview` helpers in `server/db.ts`.
- Existing `booking.getBookingById` procedure already fetches a lesson by ID with auth check — can be reused for the detail view.

**Existing helpers (do NOT recreate):**
- `db.getReviewByLessonAndReviewer(lessonId, userId)` — returns the current user's review for a lesson
- `db.getCounterpartReview(lessonId, reviewerType)` — returns the other side's review
- `db.getLessonById(id)` — returns the full lesson row
- `booking.getBookingById` tRPC procedure — already auth-gated, returns lesson + coachName

**Files to touch:**
- `server/routers.ts` — add `review.getForLesson` procedure (inside the existing `review: router({...})` block, after `getForCoach`)
- `server/db.ts` — no changes needed (helpers already exist)
- `client/src/pages/StudentDashboard.tsx` — add "View Details" button/click handler on completed lesson cards
- `client/src/pages/CoachDashboard.tsx` — same for `CoachLessonRow`
- New component or page for the detail view

---

### 2. Student Tipping for Completed Lessons

**Problem:** There is no way for a student to tip a coach after a lesson. This is a net-new feature — no tips table, no tip procedures, no tip UI exists anywhere.

**What we want:**
- On a completed/released lesson (student view only), show a "Leave a Tip" button.
- Student picks a tip amount (e.g. $5, $10, $20, custom) and pays via Stripe Checkout.
- The tip goes directly to the coach (via Stripe Connect transfer, same model as lesson payouts).
- After a successful tip, show a confirmation and disable the tip button (one tip per lesson).

**Architecture decision — use Stripe Checkout (same as lessons):**
The platform uses `stripe.checkout.sessions.create` for lesson payments (see `server/stripe.ts → createLessonCheckoutSession`). Tips should follow the same pattern:
1. Student clicks "Tip" → calls `tip.createCheckout` tRPC mutation with `{ lessonId, amountCents }`.
2. Server creates a Stripe Checkout session with `metadata: { type: 'tip', lessonId, studentId, coachId }`.
3. Student is redirected to Stripe Checkout, pays, returns to `/dashboard`.
4. Webhook `checkout.session.completed` fires → server sees `metadata.type === 'tip'` → calls `transferToCoach` to send the tip to the coach's Stripe Connect account, records the tip in the DB.

**Schema changes needed:**
Add a `tips` table to `drizzle/schema.ts`:
```ts
export const tips = mysqlTable("tips", {
  id: int("id").autoincrement().primaryKey(),
  lessonId: int("lessonId").notNull(),
  studentId: int("studentId").notNull(),
  coachId: int("coachId").notNull(),
  amountCents: int("amountCents").notNull(),
  currency: varchar("currency", { length: 3 }).default("USD"),
  stripeCheckoutSessionId: varchar("stripeCheckoutSessionId", { length: 128 }),
  stripeTransferId: varchar("stripeTransferId", { length: 64 }),
  status: mysqlEnum("status", ["pending", "paid", "transferred", "failed"]).default("pending"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  paidAt: timestamp("paidAt"),
  transferredAt: timestamp("transferredAt"),
});
export type Tip = typeof tips.$inferSelect;
export type InsertTip = typeof tips.$inferInsert;
```

**Backend needed:**
- `server/db.ts`: add `createTip`, `getTipByCheckoutSession`, `getTipsByLesson`, `updateTipStatus` helpers.
- `server/routers.ts`: add `tip: router({...})` with:
  - `tip.createCheckout` — protected, `{ lessonId: number, amountCents: number }`. Validates: lesson exists, student owns it, lesson is `completed` or `released`, no existing paid tip for this lesson. Creates Stripe Checkout session (no platform fee on tips — 100% goes to coach minus Stripe's own fee), saves tip row with `status: 'pending'`, returns `{ url }`.
  - `tip.getForLesson` — protected, `{ lessonId: number }`. Returns any existing tip for this lesson by this student.
- `server/webhooks.ts`: in `handleCheckoutCompleted`, add routing: if `session.metadata?.type === 'tip'`, call a new `handleTipCheckoutCompleted` function that: finds the tip by `stripeCheckoutSessionId`, calls `transferToCoach` (from `server/stripeConnect.ts`), updates tip status to `transferred`.
- `server/stripe.ts`: add `createTipCheckoutSession` function (similar to `createLessonCheckoutSession` but simpler — no platform fee, just the tip amount + Stripe fee line item).

**Stripe architecture note:**
The platform uses "Separate Charges and Transfers" (not destination charges). For tips, the checkout session should NOT have `transfer_data` or `application_fee_amount` — the charge lands on the platform, then a separate `stripe.transfers.create` sends the tip to the coach. Use `transferToCoach` from `server/stripeConnect.ts` in the webhook handler.

**Files to touch:**
- `drizzle/schema.ts` — add tips table
- `server/db.ts` — add tip helpers
- `server/stripe.ts` — add `createTipCheckoutSession`
- `server/routers.ts` — add `tip` router
- `server/webhooks.ts` — add tip routing in `handleCheckoutCompleted`
- `client/src/pages/StudentDashboard.tsx` — add "Leave a Tip" button on completed/released lessons
- Run `pnpm db:push` after schema changes

**Constraints:**
- One tip per lesson per student (enforce in `tip.createCheckout` and in DB with a unique index on `(lessonId, studentId)`).
- Only available on `completed` or `released` lessons.
- Coach must have `stripeConnectOnboarded = true` (check before creating checkout).
- Tip amounts: suggest preset amounts ($5, $10, $20) + custom input (min $1, max $500).
- No platform fee on tips — coaches keep 100% minus Stripe's processing fee.

---

### 3. Lesson List Clutter — Cancelled Lessons Sorting

**Problem:** Both dashboards show cancelled lessons mixed in with active/completed lessons. The coach dashboard has a `STATUS_PRIORITY` map that puts `cancelled: 3` and `declined: 4` — but `completed: 2` is still above them, so completed lessons should already sort above cancelled. However, the student dashboard has **no sorting at all** — lessons come back from the server `ORDER BY scheduledAt DESC`, so cancelled lessons from the same date appear mixed with completed ones.

**What we want:**
1. **Student dashboard "Past" tab**: Sort lessons so `completed`/`released` appear before `cancelled`/`declined`/`refunded`. Within each group, keep `scheduledAt DESC` order. Add a "Show cancelled" toggle (collapsed by default) so cancelled lessons don't clutter the view.
2. **Coach dashboard "All Lessons"**: The `STATUS_PRIORITY` map already sorts completed above cancelled. But add the same "Show cancelled" toggle to collapse them by default.

**Files to touch:**
- `client/src/pages/StudentDashboard.tsx` — add status-based sort to `pastLessons`, add "Show cancelled" toggle
- `client/src/pages/CoachDashboard.tsx` — add "Show cancelled" toggle (sort is already correct)

**No backend changes needed** — this is purely frontend sorting/filtering.

---

## What NOT to Change

- `server/webhooks.ts` existing lesson payment flow (only add the tip routing branch)
- `server/payoutService.ts` — tips use `transferToCoach` directly, not the payout service
- Any Sprint 49/50 analysis/PGN code
- `drizzle/schema.ts` reviews table (just fixed in S-REV-1)
- The `STATUS_PRIORITY` map values in `CoachDashboard.tsx` — only add the toggle

---

## Current State

- 400 tests pass, tsc clean, build clean
- Checkpoint: `f4fb21dc`
- Live DB: `reviews` table has `studentId`, `coachId`, `reviewerType` (S-REV-1 complete)
- No `tips` table exists in DB or schema

---

## Tests Expected

- `tip.createCheckout`: rejects non-student, rejects non-completed lesson, rejects duplicate tip, happy path returns URL
- `review.getForLesson`: returns null for both when no reviews, returns only visible reviews, correct counterpart matching
- Webhook tip handler: marks tip as transferred, calls transferToCoach with correct amount
