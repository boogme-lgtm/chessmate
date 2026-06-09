# Sprint 44 Patch 2 — Handoff to Claude Code

## Context

This patch resolves the root cause of booking/payment emails not being received during live E2E testing on boogme.com.

### What was confirmed during investigation

**The test booking (lesson 270001):**
- Student: user ID 990004, name `cchirila`, email `cchirila@saintlouischessclub.org`
- Coach: user ID 1 (Cristian Chirila, `chessaesthetics@gmail.com`)
- Status: `pending_payment` — Stripe checkout session was created but the webhook may not have fired in test mode, OR the email was skipped for a different reason

**The student's email IS populated** (`cchirila@saintlouischessclub.org`) — so the null guard at `lesson.book` (`if (!student?.email)`) did NOT skip the booking-reserved email. The email should have been attempted.

**However**, the webhook email path (`webhooks.ts → handleCheckoutCompleted`) checks `if (student && coach)` but does NOT check `if (student.email && coach.email)` before calling `sendEmail()`. If either email is an empty string `""`, Resend will reject the send silently or with an error caught by the outer try/catch.

**The real issue identified in `upsertUser` (server/db.ts line 53–55):**
```ts
if (!user.email) {
  throw new Error("User email is required for upsert");
}
```
The OAuth callback passes `email: userInfo.email ?? ""` — so if Manus OAuth returns `null` or `undefined` for email, the fallback is an **empty string `""`**, which is falsy in JS but passes as a valid string to the DB. The DB stores `""` (empty string), not `NULL`. The null guard `if (!student?.email)` catches this correctly (empty string is falsy), so the booking-reserved email IS skipped — but the log line says "skipping" and the user never sees it.

**Separate issue: the Stripe webhook may not have fired** — in Stripe test mode, `checkout.session.completed` only fires if the Stripe CLI is forwarding webhooks locally, or if the webhook endpoint is registered in the Stripe dashboard for the live URL. During the E2E test, the lesson status stayed `pending_payment` (not `payment_collected`), which confirms the webhook did NOT fire — so the payment-confirmed and coach-notification emails never had a chance to run.

---

## Root Causes (in priority order)

### RC-1: OAuth creates users with empty-string email
When a user logs in via Manus OAuth and the OAuth provider does not return an email address, `oauth.ts` passes `email: userInfo.email ?? ""` to `upsertUser`. The DB stores `""`. All email sends are then silently skipped by the null guard.

### RC-2: Stripe webhook not firing in test mode
The lesson stayed `pending_payment` after the $149.87 charge was confirmed in the Stripe dashboard. This means `checkout.session.completed` was never received by the server. The webhook endpoint must be registered in the Stripe dashboard for `https://boogme.com/api/webhooks/stripe`.

### RC-3: Webhook email path has no email-present guard
In `webhooks.ts`, the code does `if (student && coach)` but then calls `sendEmail({ to: student.email })` without checking `if (student.email && coach.email)`. If either is `""`, Resend will error.

---

## Tasks for Claude

### P1 — Fix OAuth to handle missing email gracefully

**File:** `server/_core/oauth.ts`

**Problem:** `email: userInfo.email ?? ""` stores empty string when OAuth returns no email.

**Fix:** Change the upsert call to pass `email: userInfo.email || null` (or omit email entirely if null), and update `upsertUser` in `server/db.ts` to allow null/undefined email on upsert (treating it as "don't update the email field if we don't have one").

Specifically:
1. In `oauth.ts`, change:
   ```ts
   email: userInfo.email ?? "",
   ```
   to:
   ```ts
   email: userInfo.email || null,
   ```
2. In `server/db.ts`, update `upsertUser` to NOT throw if email is null/empty — instead, only set/update the email field when a non-empty value is provided. The insert should still require email (use `""` as a safe default for new users if truly no email), but the ON DUPLICATE KEY UPDATE should skip the email field if the new value is null/empty (to avoid overwriting a good email with blank).

   The safest approach: if `user.email` is null/empty/undefined, skip the email field in both the insert values and the update set. This way, an existing user who already has a good email won't have it overwritten by a blank OAuth re-login.

   For brand-new users with no email: store `""` as the initial value (the DB column should allow it), and surface a "complete your profile" prompt in the UI.

### P2 — Add email guard in webhook email path

**File:** `server/webhooks.ts`, function `handleCheckoutCompleted`

**Problem:** The code checks `if (student && coach)` but not whether their emails are non-empty before calling `sendEmail()`.

**Fix:** Change the guard from:
```ts
if (student && coach) {
```
to:
```ts
if (student?.email && coach?.email) {
  // emails are present, proceed
} else {
  if (!student?.email) console.warn(`[Webhook] Cannot send emails for lesson ${lessonId}: student ${lesson.studentId} has no email`);
  if (!coach?.email) console.warn(`[Webhook] Cannot send emails for lesson ${lessonId}: coach ${lesson.coachId} has no email`);
}
```

### P3 — Add "complete your profile" prompt for users with missing email

**Files:** `client/src/components/DashboardLayout.tsx` (or a new `ProfileCompletionBanner.tsx`)

**Problem:** Users who logged in via OAuth without an email have no way to add their email, and all booking emails silently fail.

**Fix:** After login, if `ctx.user.email` is empty/null, show a dismissible yellow banner at the top of the dashboard:
> "Add your email address to receive booking confirmations and lesson reminders. [Update Profile →]"

This banner should link to a profile settings page (or open a modal) where the user can enter their email. The profile update should call a new tRPC procedure `user.updateEmail` that:
1. Validates the email format
2. Updates the `users` table `email` field for `ctx.user.id`
3. Returns success

**New tRPC procedure** (`server/routers.ts`):
```ts
user.updateEmail: protectedProcedure
  .input(z.object({ email: z.string().email() }))
  .mutation(async ({ ctx, input }) => {
    await db.updateUserEmail(ctx.user.id, input.email);
    return { success: true };
  })
```

**New DB helper** (`server/db.ts`):
```ts
export async function updateUserEmail(userId: number, email: string): Promise<void>
```

### P4 — Verify Stripe webhook endpoint registration (documentation only)

**This is NOT a code change** — it's an operational step that Cristian needs to do in the Stripe dashboard.

Add a comment in `server/webhooks.ts` at the top of the file:
```ts
// IMPORTANT: For production, ensure the webhook endpoint is registered in the Stripe Dashboard:
// Endpoint URL: https://boogme.com/api/webhooks/stripe
// Events to listen for: checkout.session.completed, payment_intent.succeeded
// The STRIPE_WEBHOOK_SECRET env var must match the signing secret from the Stripe Dashboard.
```

Also add a note in `docs/stripe-webhook-setup.md` (create this file) with step-by-step instructions for registering the webhook in the Stripe dashboard.

---

## Tests to write

Add `server/sprint44patch2.test.ts` with:

1. **P1-1**: `upsertUser` with `email: null` does not throw and does not overwrite an existing non-empty email
2. **P1-2**: `upsertUser` with `email: ""` does not overwrite an existing non-empty email
3. **P1-3**: `upsertUser` with a valid email updates the email field
4. **P2-1**: `handleCheckoutCompleted` with a student who has no email logs a warning and does not call `sendEmail`
5. **P3-1**: `user.updateEmail` procedure updates the email and returns `{ success: true }`
6. **P3-2**: `user.updateEmail` rejects an invalid email format

---

## Acceptance criteria

- [ ] A user who logs in via Manus OAuth without an email does NOT cause `upsertUser` to throw
- [ ] A user who logs in via Manus OAuth without an email sees a "complete your profile" banner on the dashboard
- [ ] After entering their email via the profile banner, the user's email is stored and subsequent booking emails fire correctly
- [ ] The webhook email path logs a clear warning (not a silent skip) when student or coach email is missing
- [ ] All existing 356 tests still pass
- [ ] `tsc --noEmit` exits 0
- [ ] `pnpm audit --prod` remains at 26/2h/22m/2l

---

## Current state

- Checkpoint: v93beb79c (Sprint 44 patch merged)
- Branch: `claude/code-audit-review-icD40`
- 356 tests passing, tsc exits 0

## After Claude is done

Manus will cherry-pick the commits onto `main`, run `pnpm test`, verify `tsc --noEmit`, and save a checkpoint.
