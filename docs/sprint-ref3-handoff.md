# S-REF-3 Handoff — Dispute Transactional Emails

**Branch:** `claude/code-audit-review-icD40`  
**Prereqs:** S-REF-1 (categorized intake) and S-REF-2 (admin resolve panel) are live on `main`.

---

## Problem

When a dispute is raised or resolved, only the platform owner receives a notification (`notifyOwner`). The student and coach receive **no email** about:
- Dispute raised (student confirmation + coach alert)
- Dispute resolved: denied (student told "no refund"; coach told "payout released")
- Dispute resolved: refund (student told "refund issued"; coach told "dispute found against you")

This is a gap in the communication loop.

---

## Scope

**No schema changes.** Email-only additions to two existing procedures in `server/routers.ts` + new template functions in `server/emailService.ts`.

---

## Email Matrix

| Trigger | Recipient | Subject | Key content |
|---|---|---|---|
| `raiseIssue` (non-quality) | Student | "Your dispute has been received — Lesson #X" | Category, description, "we'll review within 24–48 hours" |
| `raiseIssue` (non-quality) | Coach | "A dispute has been filed on Lesson #X" | Category, student description, "you have 24h to respond via your dashboard" |
| `resolveLessonDispute` → denied | Student | "Dispute #X resolved — no refund issued" | Admin note (if any), "the coach has been paid" |
| `resolveLessonDispute` → denied | Coach | "Dispute #X resolved in your favor — Lesson #X" | "Your payout has been released", amount |
| `resolveLessonDispute` → refund_full | Student | "Dispute #X resolved — full refund issued" | Refund amount, "allow 5–10 business days" |
| `resolveLessonDispute` → refund_full | Coach | "Dispute #X resolved — refund issued to student" | Amount refunded, admin note (if any) |
| `resolveLessonDispute` → refund_partial | Student | "Dispute #X resolved — partial refund issued" | Partial amount, admin note |
| `resolveLessonDispute` → refund_partial | Coach | "Dispute #X resolved — partial refund issued to student" | Amount refunded, admin note |

---

## Implementation Plan

### Step 1 — Add 4 email template functions to `server/emailService.ts`

Append after the last existing export (`getStudentCoachConfirmedEmail`).

#### `getStudentDisputeReceivedEmail(params)`
```ts
params: {
  studentName: string;
  coachName: string;
  lessonId: number;
  category: string;       // human-readable label, e.g. "Coach No-Show"
  description: string | null;
  frontendUrl: string;
}
```
Subject: `Your dispute has been received — Lesson #${lessonId}`  
Body: Confirm receipt, category, description (if any), "We'll review within 24–48 hours. You can track the status in your dashboard."

#### `getCoachDisputeFiledEmail(params)`
```ts
params: {
  coachName: string;
  studentName: string;
  lessonId: number;
  category: string;       // human-readable label
  description: string | null;
  frontendUrl: string;
}
```
Subject: `A dispute has been filed on Lesson #${lessonId}`  
Body: Category, student description (if any), "You have 24 hours to respond via your Coach Dashboard. If no response is received, the dispute will be reviewed by admin."

#### `getStudentDisputeResolvedEmail(params)`
```ts
params: {
  studentName: string;
  coachName: string;
  lessonId: number;
  disputeId: number;
  resolution: "refund_full" | "refund_partial" | "denied";
  refundAmountCents: number | null;   // null for denied
  adminNote: string | null;
  frontendUrl: string;
}
```
Subject (varies):
- denied → `"Dispute #${disputeId} reviewed — no refund issued"`
- refund_full → `"Dispute #${disputeId} resolved — full refund issued"`
- refund_partial → `"Dispute #${disputeId} resolved — partial refund issued"`

Body: Resolution outcome, refund amount (if applicable), admin note (if any), "allow 5–10 business days for refunds to appear."

#### `getCoachDisputeResolvedEmail(params)`
```ts
params: {
  coachName: string;
  studentName: string;
  lessonId: number;
  disputeId: number;
  resolution: "refund_full" | "refund_partial" | "denied";
  refundAmountCents: number | null;
  lessonAmountCents: number;
  adminNote: string | null;
  frontendUrl: string;
}
```
Subject (varies):
- denied → `"Dispute #${disputeId} resolved in your favor — Lesson #${lessonId}"`
- refund_full / refund_partial → `"Dispute #${disputeId} — refund issued to student"`

Body: Resolution outcome, payout status (released or refunded), admin note (if any).

**Style note:** Match the existing dark-background HTML email style used throughout `emailService.ts` (dark `#0a0a0a` body, `#1a1a1a` card, `#8b4513` accent, BooGMe logo at top). Use the same table-based layout.

---

### Step 2 — Wire emails into `raiseIssue` (non-quality path only)

In `server/routers.ts`, in the `raiseIssue` mutation, **after** the `notifyOwner` call (around line 1570–1585), add:

```ts
// Fire-and-forget: email student + coach
try {
  const student = await db.getUserById(ctx.user.id);
  const coach = await db.getUserById(lesson.coachId);
  const categoryLabel = {
    coach_no_show: "Coach No-Show",
    coach_late_or_short: "Late / Short",
    technical_failure: "Technical Failure",
    not_as_described: "Not As Described",
  }[input.category] ?? input.category;
  const baseUrl = process.env.VITE_FRONTEND_URL || "http://localhost:3000";

  if (student?.email) {
    await sendEmail({
      to: student.email,
      subject: `Your dispute has been received — Lesson #${input.lessonId}`,
      html: getStudentDisputeReceivedEmail({
        studentName: student.name || "Student",
        coachName: coach?.name || "your coach",
        lessonId: input.lessonId,
        category: categoryLabel,
        description: input.description?.trim() || null,
        frontendUrl: baseUrl,
      }),
    });
  }
  if (coach?.email) {
    await sendEmail({
      to: coach.email,
      subject: `A dispute has been filed on Lesson #${input.lessonId}`,
      html: getCoachDisputeFiledEmail({
        coachName: coach.name || "Coach",
        studentName: student?.name || "a student",
        lessonId: input.lessonId,
        category: categoryLabel,
        description: input.description?.trim() || null,
        frontendUrl: baseUrl,
      }),
    });
  }
} catch (emailErr) {
  console.error(`[raiseIssue] Email send failed for lesson ${input.lessonId}:`, emailErr);
}
```

**Important:** `lesson.coachId` is the coach's `userId` (same as `users.id`), so `db.getUserById(lesson.coachId)` returns the coach's user record directly.

---

### Step 3 — Wire emails into `resolveLessonDispute`

In `server/routers.ts`, in the `resolveLessonDispute` mutation, **after** the `notifyOwner` call (around line 3249), add:

```ts
// Fire-and-forget: email student + coach
try {
  const student = await db.getUserById(dispute.studentId);
  const coach = await db.getUserById(dispute.coachId);
  const baseUrl = process.env.VITE_FRONTEND_URL || "http://localhost:3000";

  if (student?.email) {
    await sendEmail({
      to: student.email,
      subject: /* see matrix above */,
      html: getStudentDisputeResolvedEmail({
        studentName: student.name || "Student",
        coachName: coach?.name || "your coach",
        lessonId: dispute.lessonId,
        disputeId: input.disputeId,
        resolution: input.resolution,
        refundAmountCents: resolvedRefundCents,
        adminNote: input.adminNote || null,
        frontendUrl: baseUrl,
      }),
    });
  }
  if (coach?.email) {
    await sendEmail({
      to: coach.email,
      subject: /* see matrix above */,
      html: getCoachDisputeResolvedEmail({
        coachName: coach.name || "Coach",
        studentName: student?.name || "the student",
        lessonId: dispute.lessonId,
        disputeId: input.disputeId,
        resolution: input.resolution,
        refundAmountCents: resolvedRefundCents,
        lessonAmountCents: lesson.amountCents,
        adminNote: input.adminNote || null,
        frontendUrl: baseUrl,
      }),
    });
  }
} catch (emailErr) {
  console.error(`[resolveLessonDispute] Email send failed for dispute ${input.disputeId}:`, emailErr);
}
```

**Note on `dispute.studentId` / `dispute.coachId`:** The `getAllLessonDisputes` join already returns these. For `resolveLessonDispute`, the `dispute` object is fetched via `db.getLessonDisputeById(input.disputeId)` — check if that helper returns `studentId` and `coachId`. If not, fetch `lesson` (already fetched) and use `lesson.studentId` / `lesson.coachId`.

---

## Tests

Add to a new file `server/sprint-ref3.test.ts`. Target: **8 tests**.

1. `raiseIssue` (coach_no_show) → `sendEmail` called twice (student + coach)
2. `raiseIssue` (quality) → `sendEmail` NOT called (quality is policy-gated, no emails)
3. `raiseIssue` with missing student email → only coach email sent (no throw)
4. `raiseIssue` with missing coach email → only student email sent (no throw)
5. `resolveLessonDispute` (denied) → student gets "no refund" email, coach gets "payout released" email
6. `resolveLessonDispute` (refund_full) → student gets "full refund" email, coach gets "refund issued" email
7. `resolveLessonDispute` (refund_partial) → student gets "partial refund" email with correct amount
8. Email send failure → procedure still returns `success: true` (fire-and-forget, no throw)

Mock `sendEmail` from `./emailService` and assert it was called with the correct `to` and `subject` strings.

---

## Acceptance Criteria

- [ ] 4 new email template functions exported from `emailService.ts`
- [ ] `raiseIssue` sends 2 emails (student + coach) for non-quality disputes
- [ ] `raiseIssue` sends 0 emails for quality disputes
- [ ] `resolveLessonDispute` sends 2 emails (student + coach) for all 3 resolution paths
- [ ] Email failures are caught and logged, never thrown (fire-and-forget)
- [ ] 8 new tests, all passing
- [ ] `pnpm test` passes (438 + 8 = 446 total)
- [ ] `tsc --noEmit` clean
- [ ] Build clean

---

## What NOT to change

- No schema changes
- No new DB helpers needed
- Do not change the `notifyOwner` calls — they stay as-is
- Do not change the quality gate logic in `raiseIssue`
- Do not add email sends for the `quality` category
