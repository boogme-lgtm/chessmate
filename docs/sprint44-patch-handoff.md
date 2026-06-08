# Sprint 44 Patch — Email Diagnostics & Delivery Verification

**To Claude — Sprint 44 Patch**

## Branch / sync state

Merge `origin/main` before starting. Current baseline on `main` is commit `f45f1de` (Sprint 44 merge). Verified baseline: **353 tests, `tsc` exit 0, audit 26/2h/22m/2l**.

---

## Context

During the live E2E booking test, no booking or payment emails were received despite the Stripe payment succeeding ($149.87 captured). The waitlist confirmation email fired correctly, which proves Resend is configured and the sending domain is verified. The problem is therefore in the server-side email code paths, not the infrastructure.

After reading the source, the most likely root cause is:

**`RESEND_API_KEY` resolves to an empty string via `optionalEnv`.** `new Resend("")` creates a client that silently returns a `401` error on every send. `sendEmail` catches this and logs `[Email Service] Failed to send email: ...` — but this only appears in server logs, not visible to the user. There is currently no startup warning if the key is missing, and no easy way to test email delivery without triggering a full booking flow.

---

## What to build

### P1 — Startup warning for missing `RESEND_API_KEY`

In `server/emailService.ts`, immediately after `const resend = new Resend(ENV.resendApiKey);`, add:

```ts
if (!ENV.resendApiKey) {
  console.warn('[Email Service] WARNING: RESEND_API_KEY is not set. All email sends will fail silently.');
}
```

This makes the misconfiguration immediately visible in the server startup log.

---

### P2 — Pre-send log line in `sendEmail`

In `server/emailService.ts`, inside `sendEmail`, add a log line **before** the `resend.emails.send` call:

```ts
console.log(`[Email Service] Sending to: ${options.to} | subject: "${options.subject}"`);
```

This confirms whether the send is being attempted at all, independent of whether it succeeds. Currently you can only see success or failure, not whether the function was even called with the right address.

---

### P3 — `admin.system.testEmail` diagnostic procedure

Add a new admin-gated tRPC procedure to `server/routers.ts` (in the `system` router or a new `admin.system` sub-router):

```ts
testEmail: adminProcedure
  .input(z.object({ to: z.string().email() }))
  .mutation(async ({ input }) => {
    const result = await sendEmail({
      to: input.to,
      subject: 'BooGMe — Email delivery test',
      html: '<p>This is a test email from BooGMe. If you received this, email delivery is working correctly.</p>',
    });
    return result; // { success: boolean, id?: string, error?: unknown }
  }),
```

Add a simple UI trigger in the Admin panel (e.g. a "Send Test Email" button in the existing admin settings or a new "System" tab) that calls this mutation with the admin's own email address and shows the raw result in a toast. This lets you verify email delivery from the browser without needing a full booking flow.

---

### P4 — Check `lesson.book` email recipient resolution

In `server/routers.ts` around line 1125–1135, the booking-reserved email send block does:

```ts
const [student, coach] = await Promise.all([
  db.getUserById(ctx.user.id),
  db.getUserById(input.coachId),
]);
if (!student?.email) return;
```

The `return` inside the IIFE silently skips the email if `student.email` is falsy. Add a log line before the return:

```ts
if (!student?.email) {
  console.warn(`[lesson.book] Student ${ctx.user.id} has no email address — skipping booking-reserved email`);
  return;
}
```

Also log the resolved email address before the send:

```ts
console.log(`[lesson.book] Sending booking-reserved email to student: ${student.email}`);
```

---

### P5 — Webhook email recipient guard

In `server/webhooks.ts` around line 146–150, the webhook email block does:

```ts
if (student && coach) {
  // ... send emails
}
```

If either `student` or `coach` is null (e.g. user deleted between booking and payment), the emails are silently skipped. Add a log:

```ts
if (!student) {
  console.warn(`[Webhook] Cannot send emails for lesson ${lessonId}: student ${lesson.studentId} not found`);
}
if (!coach) {
  console.warn(`[Webhook] Cannot send emails for lesson ${lessonId}: coach ${lesson.coachId} not found`);
}
if (student && coach) {
  // ... existing send logic
}
```

---

## Files to change

| File | Change |
|------|--------|
| `server/emailService.ts` | P1 startup warning, P2 pre-send log |
| `server/routers.ts` | P3 `admin.system.testEmail` procedure, P4 booking email guard logs |
| `server/webhooks.ts` | P5 webhook email recipient guard logs |
| Admin panel UI (existing admin page) | P3 "Send Test Email" button |

---

## Not in scope

- Changes to the money path.
- Changes to email templates.
- Any new email templates.

---

## Deliverables

- All 5 changes implemented.
- `server/sprint44patch.test.ts` with at minimum:
  - A test that `sendEmail` logs a warning when called with an empty `RESEND_API_KEY`.
  - A test that `admin.system.testEmail` returns `{ success: false }` (not throws) when Resend returns an error.
- `pnpm test` passing (target: 353+ tests).
- `tsc --noEmit` exits 0.
- `pnpm audit --prod` unchanged (26/2h/22m/2l).
- Commit SHA to merge into `main`.

---

## Review asks

1. After implementing P3, test it live: go to the admin panel, enter your email, click "Send Test Email", and report what the toast shows. If it shows `{ success: false, error: { statusCode: 401 } }`, the `RESEND_API_KEY` secret is missing or wrong in the deployed environment. If it shows `{ success: true, id: "..." }`, email delivery is working and the issue was elsewhere.

2. If the test email succeeds but booking emails still don't arrive, the next step is to check whether `student.email` is populated for Manus OAuth users — Manus OAuth may not populate the `email` field on the `users` table if the user hasn't explicitly granted email access.
