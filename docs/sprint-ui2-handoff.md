# Sprint S-UI-2 Handoff — Tip UX Fixes + Coach Stats Bug

## Context

BooGMe is a chess coaching marketplace (React + tRPC + Drizzle + MySQL). The S-UI-1 sprint
added a lesson detail modal with student tipping via Stripe Checkout. Three bugs were found
immediately after shipping. Fix all three.

---

## Bug 1 — Tip Stripe Checkout must open in a new tab (not redirect current page)

### What's broken
`client/src/pages/StudentDashboard.tsx` ~line 908–912:
```ts
const tipMutation = trpc.tip.createCheckout.useMutation({
  onSuccess: (data) => {
    if (data.url) window.location.href = data.url;  // ← redirects away
  },
```
This replaces the current page with Stripe Checkout. When the user presses browser Back,
they land back on the dashboard with a stale `pending` tip record (see Bug 2).

### Fix
Change `window.location.href = data.url` → `window.open(data.url, '_blank')`.

This is consistent with how `CoachDashboard.tsx` handles Stripe Connect onboarding
(line ~190: `window.open(data.url, '_blank')`).

### Success/cancel URL issue
The current success/cancel URLs in `server/routers.ts` ~line 2343–2344 point to
`/lessons/${lesson.id}?tip=success` and `/lessons/${lesson.id}?tip=cancelled`. These are
fine for a new-tab flow — the new tab lands on that page after payment. However,
`LessonPaymentSuccess.tsx` (the `/lessons/:id` page) does NOT handle the `tip` query
param at all — it only handles `payment=cancelled`. The tip success/cancel URLs should
instead point back to `/dashboard` (or just close the tab). Simplest fix: change success
and cancel URLs to `${baseUrl}/dashboard?tip=success` and `${baseUrl}/dashboard?tip=cancelled`.

---

## Bug 2 — Stale "pending" tip record shown after user presses Back without paying

### What's broken
The `tip.createCheckout` procedure in `server/routers.ts` ~line 2330 calls `db.createTip()`
**before** the Stripe Checkout session is created. If the user abandons the checkout
(presses Back, closes tab, etc.), the tip row stays in the DB with `status = 'pending'`
and `stripeCheckoutSessionId` set. The next time `tip.getForLesson` is queried, it returns
this stale record and the UI shows:

```
✅ Tip of $5.00 pending
```

The green `CheckCircle2` icon makes it look like the tip succeeded.

### Two-part fix

**Part A — Backend: create the tip row only after Stripe session is confirmed**

Reorder the operations in `tip.createCheckout` mutation (~line 2307–2355):
1. Create the Stripe Checkout session first (no DB write yet).
2. Only after `session` is returned successfully, call `db.createTip(...)` and
   `db.setTipCheckoutSession(tip.id, session.id)` in one go (or pass the session ID
   directly to `createTip`).

This way, if Stripe fails or the user never starts checkout, no DB row is created.

**Part B — UI: don't show pending tip as "done"**

In `StudentDashboard.tsx` ~line 985–992, the `hasTipped` check is:
```ts
const hasTipped = !!tipData?.tip;
```
This is true even for `status = 'pending'` (i.e., checkout started but not completed).
The UI then renders a green `CheckCircle2` icon with "pending" text — misleading.

Fix the display logic:
- `status = 'pending'` → show "Tip checkout in progress — complete payment in the other tab"
  (no green checkmark, no "done" aesthetic)
- `status = 'paid'` → show "Tip processing…"
- `status = 'transferred'` → show green checkmark "Tip of $X.XX sent ✓"
- `status = 'failed'` → show error + allow retry (delete the failed tip row or add a
  `canRetry` flag)

Also update the "already tipped" guard in `tip.createCheckout` to only block on
`status IN ('paid', 'transferred')`, not `pending`/`failed`:
```ts
const existing = await db.getTipByLessonAndStudent(input.lessonId, ctx.user.id);
if (existing && ['paid', 'transferred'].includes(existing.status)) {
  throw new TRPCError({ code: "CONFLICT", message: "You have already tipped for this lesson" });
}
// If existing is pending/failed, delete it and create a fresh one
if (existing) {
  await db.deleteTip(existing.id);  // add this helper to db.ts
}
```

Add `deleteTip(tipId: number)` to `server/db.ts`.

---

## Bug 3 — Coach stats (Lessons count, Rating) not updating after completed lessons

### What's broken
The coach listing page shows Cristian Chirila with `0.0` rating, `0` lessons, `0` students
despite having a completed lesson with reviews submitted.

### Root cause analysis

`updateCoachStats(coachId)` in `server/db.ts` ~line 295 is the function that writes
`averageRating`, `totalLessons`, `totalStudents` to `coachProfiles`. It is only called
from one place:

```ts
// server/db.ts line 644–648
export async function createReview(review: InsertReview) {
  ...
  if (review.reviewerType === 'student') {
    await updateCoachStats(review.coachId);
  }
}
```

**Two problems:**

**Problem A — `totalLessons` counts only `released` lessons, not `completed`**

In `updateCoachStats` ~line 319:
```ts
.where(and(
  eq(lessons.coachId, coachId),
  eq(lessons.status, "released")   // ← only released
))
```
Lessons become `released` only after the coach payout is processed (Stripe transfer).
Most completed lessons are still in `completed` status. Fix: count both:
```ts
inArray(lessons.status, ["completed", "released"])
```

**Problem B — `updateCoachStats` is never called when a lesson completes**

When a lesson is marked `completed` (via `lesson.markComplete` procedure in
`server/routers.ts` ~line 1460), `updateCoachStats` is not called. It is also not called
in `finalizeLessonPayout` (`server/db.ts` ~line 1546) when status becomes `released`.

Fix: call `updateCoachStats(lesson.coachId)` in both places:

1. In `server/routers.ts` in the `lesson.markComplete` procedure, after
   `db.updateLessonStatus(input.lessonId, "completed", ...)` (~line 1460):
   ```ts
   await db.updateCoachStats(lesson.coachId);
   ```

2. In `server/db.ts` in `finalizeLessonPayout` (~line 1546), after the UPDATE:
   ```ts
   // After the UPDATE sql
   const lesson = await getLessonById(lessonId);
   if (lesson) await updateCoachStats(lesson.coachId);
   ```

**Problem C — `averageRating` only counts `isVisible = true` reviews**

In `updateCoachStats` ~line 307:
```ts
eq(reviews.isVisible, true)
```
Reviews become visible only after both parties submit. If only the student has reviewed,
the coach's rating stays at 0.0. This is intentional per the Airbnb-style model — but
confirm with Coach Cristian whether he wants ratings to show only after mutual review, or
immediately after any student review. **For now, leave this as-is** (both-sides-required
is the intended design per S-REV-1).

---

## Files to touch

| File | Change |
|------|--------|
| `client/src/pages/StudentDashboard.tsx` | Bug 1: `window.open` instead of `window.location.href`; Bug 2: tip status display logic |
| `server/routers.ts` | Bug 1: success/cancel URLs → `/dashboard?tip=...`; Bug 2: reorder createTip after Stripe session; Bug 3: call `updateCoachStats` in `lesson.markComplete` |
| `server/db.ts` | Bug 2: add `deleteTip(tipId)`; Bug 3: fix `released` → `completed|released` in `updateCoachStats`; call `updateCoachStats` in `finalizeLessonPayout` |

---

## What NOT to change
- `server/webhooks.ts` tip handler (already correct — marks paid/transferred)
- `server/stripe.ts` `createTipCheckoutSession` (correct)
- `server/payoutService.ts`
- Any Sprint 49/50 PGN/analysis code
- `reviews` table or review procedures

---

## Tests expected
- `tip.createCheckout` with abandoned checkout: no tip row created (or stale row cleaned up)
- `tip.createCheckout` duplicate: only blocked if status is `paid` or `transferred`
- `updateCoachStats` called after `lesson.markComplete`: `totalLessons` increments
- `updateCoachStats` counts `completed` lessons (not just `released`)
- `finalizeLessonPayout` triggers `updateCoachStats`

## Current state
- 411 tests pass, tsc clean — checkpoint `f85da3d6`
