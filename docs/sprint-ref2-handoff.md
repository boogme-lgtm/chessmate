# Sprint S-REF-2 Handoff — Admin Dispute Panel (Lesson Disputes)

**Branch:** create `claude/sprint-ref2` from `main`
**Baseline:** checkpoint `1c955fe1` — 428 tests passing, tsc clean
**Primary files to touch:**
- `server/routers.ts` — add `admin.disputes.listLessonDisputes` and `admin.disputes.resolveLessonDispute` procedures
- `server/db.ts` — add `getAllLessonDisputes` and `updateLessonDispute` helpers
- `client/src/pages/AdminDisputesPanel.tsx` — add a new "Lesson Disputes" tab backed by the new procedures
- `server/sprint-ref2.test.ts` — new test file

---

## Context

S-REF-1 shipped a structured dispute intake system. Students can now raise issues on completed
lessons via 5 categories. Disputes land in the `lesson_disputes` table (18 columns) and flip
the lesson to `status = 'disputed'`, pausing the coach payout.

The existing `AdminDisputesPanel.tsx` (Sprint 37) already has a "Disputed Lessons" tab that
lists lessons by `status = 'disputed'` and lets admin release the payout or issue a refund.
**However, it has no visibility into the `lesson_disputes` table** — it cannot see the dispute
category, the student's description, the coach's response (Phase 3 will add that), or the
resolution. It also cannot mark a dispute as resolved or write an admin note.

This sprint upgrades the admin panel to close that gap.

---

## What to Build

### Part 1 — DB Helpers (`server/db.ts`)

Add two helpers at the end of the file, after `countNonNoShowDisputesByStudent`:

```ts
/**
 * Return all lesson_disputes rows joined with basic lesson + user info,
 * ordered by createdAt DESC.
 */
export async function getAllLessonDisputes() {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select({
      // dispute fields
      id: lessonDisputes.id,
      lessonId: lessonDisputes.lessonId,
      raisedBy: lessonDisputes.raisedBy,
      category: lessonDisputes.category,
      description: lessonDisputes.description,
      evidenceUrls: lessonDisputes.evidenceUrls,
      status: lessonDisputes.status,
      coachResponse: lessonDisputes.coachResponse,
      coachRespondedAt: lessonDisputes.coachRespondedAt,
      coachAction: lessonDisputes.coachAction,
      resolution: lessonDisputes.resolution,
      refundAmountCents: lessonDisputes.refundAmountCents,
      resolvedBy: lessonDisputes.resolvedBy,
      resolvedAt: lessonDisputes.resolvedAt,
      adminNote: lessonDisputes.adminNote,
      abuseFlag: lessonDisputes.abuseFlag,
      createdAt: lessonDisputes.createdAt,
      updatedAt: lessonDisputes.updatedAt,
      // lesson fields
      lessonAmountCents: lessons.amountCents,
      lessonStatus: lessons.status,
      lessonScheduledAt: lessons.scheduledAt,
      lessonStripePaymentIntentId: lessons.stripePaymentIntentId,
      // student name (raisedBy → users)
      studentName: users.name,
      studentEmail: users.email,
    })
    .from(lessonDisputes)
    .leftJoin(lessons, eq(lessonDisputes.lessonId, lessons.id))
    .leftJoin(users, eq(lessonDisputes.raisedBy, users.id))
    .orderBy(desc(lessonDisputes.createdAt));
}

/**
 * Update a lesson_dispute row (admin resolution).
 */
export async function updateLessonDispute(
  id: number,
  data: {
    status?: string;
    resolution?: string;
    refundAmountCents?: number | null;
    resolvedBy?: "coach" | "admin" | "system";
    resolvedAt?: Date;
    adminNote?: string;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(lessonDisputes)
    .set({
      ...(data.status ? { status: data.status as any } : {}),
      ...(data.resolution ? { resolution: data.resolution as any } : {}),
      ...(data.refundAmountCents !== undefined ? { refundAmountCents: data.refundAmountCents } : {}),
      ...(data.resolvedBy ? { resolvedBy: data.resolvedBy } : {}),
      ...(data.resolvedAt ? { resolvedAt: data.resolvedAt } : {}),
      ...(data.adminNote !== undefined ? { adminNote: data.adminNote } : {}),
    })
    .where(eq(lessonDisputes.id, id));
}
```

You will also need to import `desc` from `drizzle-orm` if it is not already imported, and ensure
`lessons` and `users` are imported from the schema.

---

### Part 2 — Server Procedures (`server/routers.ts`)

Inside the existing `admin: router({ ... disputes: router({ ... }) })` block, add two new
procedures **after** the existing `refundStudent` mutation:

#### 2a. `admin.disputes.listLessonDisputes`

```ts
listLessonDisputes: protectedProcedure
  .use(({ ctx, next }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
    }
    return next({ ctx });
  })
  .query(async () => {
    return await db.getAllLessonDisputes();
  }),
```

#### 2b. `admin.disputes.resolveLessonDispute`

This is the core action procedure. It handles three resolution paths:

| Resolution | What happens |
|---|---|
| `refund_full` | Call `admin.disputes.refundStudent` logic (full refund), then mark dispute resolved |
| `refund_partial` | Call `admin.disputes.refundStudent` logic with `amountCents`, then mark dispute resolved |
| `denied` | Release payout to coach (call `releaseLessonPayoutToCoach` with `adminOverrideReason`), mark dispute resolved |

```ts
resolveLessonDispute: protectedProcedure
  .input(z.object({
    disputeId: z.number(),
    resolution: z.enum(["refund_full", "refund_partial", "denied"]),
    refundAmountCents: z.number().int().positive().optional(), // required for refund_partial
    adminNote: z.string().optional(),
  }))
  .use(({ ctx, next }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
    }
    return next({ ctx });
  })
  .mutation(async ({ input }) => {
    const dispute = await db.getDisputeById(input.disputeId);
    if (!dispute) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Dispute not found" });
    }
    if (dispute.status === "resolved") {
      throw new TRPCError({ code: "CONFLICT", message: "Dispute is already resolved" });
    }
    if (input.resolution === "refund_partial" && !input.refundAmountCents) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "refundAmountCents is required for partial refund" });
    }

    const lesson = await db.getLessonById(dispute.lessonId);
    if (!lesson) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Lesson not found" });
    }

    if (input.resolution === "refund_full" || input.resolution === "refund_partial") {
      // Reuse the existing refund path — call the same Stripe logic used by refundStudent.
      // Import and call refundLessonToStudent (or inline the same logic from refundStudent).
      // The lesson status will be set to 'refunded' by that path.
      const amountCents = input.resolution === "refund_partial"
        ? input.refundAmountCents
        : undefined; // undefined = full refund
      // Call the existing refund service directly (same as admin.disputes.refundStudent).
      // You can extract the refund logic into a shared helper in server/payoutService.ts,
      // or simply duplicate the call here — whichever is cleaner.
      // After the refund succeeds, fall through to mark the dispute resolved.
    } else if (input.resolution === "denied") {
      // Release payout to coach.
      const result = await releaseLessonPayoutToCoach({
        lessonId: dispute.lessonId,
        adminOverrideReason: input.adminNote || "Admin denied dispute — payout released",
      });
      if (!result.success) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "reason" in result ? result.reason : "Payout release failed",
        });
      }
    }

    // Mark dispute resolved.
    await db.updateLessonDispute(input.disputeId, {
      status: "resolved",
      resolution: input.resolution,
      refundAmountCents: input.resolution === "refund_partial" ? input.refundAmountCents : null,
      resolvedBy: "admin",
      resolvedAt: new Date(),
      adminNote: input.adminNote,
    });

    // Notify owner.
    await notifyOwner({
      title: `Dispute #${input.disputeId} resolved: ${input.resolution}`,
      content: `Admin resolved dispute on lesson #${dispute.lessonId} with resolution: ${input.resolution}. ${input.adminNote ? `Note: ${input.adminNote}` : ""}`,
    });

    return { success: true };
  }),
```

**Implementation note on the refund path:** The existing `refundStudent` mutation in
`admin.disputes` already contains the full Stripe refund + DB update logic. Rather than
duplicating it, extract the core refund logic into a helper function
`refundLessonPaymentToStudent(lessonId, amountCents?)` in `server/payoutService.ts` (or
`server/stripe.ts`), then call it from both `refundStudent` and `resolveLessonDispute`.
This is the cleanest approach. If time is short, inlining is acceptable for this sprint.

---

### Part 3 — Frontend (`client/src/pages/AdminDisputesPanel.tsx`)

The existing file has two tabs: "Disputed Lessons" and "Payout-Ready". Add a **third tab**
called "Lesson Disputes" that is driven by the new `admin.disputes.listLessonDisputes` query.

#### Tab layout

The new tab should render a table with the following columns:

| Column | Source |
|---|---|
| Dispute # | `dispute.id` |
| Lesson # | `dispute.lessonId` |
| Student | `dispute.studentName` + `dispute.studentEmail` |
| Category | `dispute.category` (display as human-readable label, see mapping below) |
| Description | `dispute.description` (truncated to 80 chars with tooltip for full text) |
| Amount | `dispute.lessonAmountCents / 100` formatted as `$X.XX` |
| Status | `dispute.status` as a colored badge |
| Abuse Flag | red ⚠️ icon if `dispute.abuseFlag === true` |
| Raised | `format(dispute.createdAt, "MMM d, yyyy")` |
| Actions | "Review" button → opens detail dialog |

**Category label mapping:**
```ts
const CATEGORY_LABELS: Record<string, string> = {
  coach_no_show: "Coach No-Show",
  coach_late_or_short: "Late / Short",
  technical_failure: "Technical Failure",
  not_as_described: "Not As Described",
  quality: "Quality Feedback",
};
```

**Status badge colors:**
- `open` → amber/yellow
- `coach_responded` → blue
- `escalated` → orange
- `resolved` → green

#### Dispute detail dialog

When admin clicks "Review" on a row, open a dialog showing:

1. **Dispute summary** — category, description (full), evidence URLs (if any), raised date, abuse flag warning if set
2. **Lesson info** — lesson ID, scheduled date, amount, current lesson status
3. **Student info** — name, email
4. **Coach response section** — if `dispute.coachResponse` exists, show it with the responded date and action (`accept`/`contest`). If not, show "No coach response yet."
5. **Resolution section** — if `dispute.status === "resolved"`, show the resolution, refund amount (if partial), resolved date, and admin note. If not resolved, show the resolution form:

**Resolution form:**
```
Resolution: [radio: Full Refund | Partial Refund | Deny (Release to Coach)]
  ↳ if Partial Refund: input for amount in dollars (max = lesson amount)
Admin Note: [textarea, optional]
[Resolve Dispute] button
```

- "Full Refund" → calls `resolveLessonDispute({ disputeId, resolution: "refund_full", adminNote })`
- "Partial Refund" → calls `resolveLessonDispute({ disputeId, resolution: "refund_partial", refundAmountCents, adminNote })`
- "Deny" → calls `resolveLessonDispute({ disputeId, resolution: "denied", adminNote })`

Show a confirmation step before submitting (e.g. "Are you sure? This will [refund $X to the student / release $X to the coach].").

After success: close dialog, show toast, invalidate `admin.disputes.listLessonDisputes`.

#### Tab ordering

Place the new "Lesson Disputes" tab **first** (leftmost), before "Disputed Lessons" and "Payout-Ready", since it is the primary workflow going forward.

---

### Part 4 — Tests (`server/sprint-ref2.test.ts`)

Create a new test file with the following test cases:

| # | Test | Expected |
|---|---|---|
| 1 | `listLessonDisputes` as non-admin → `FORBIDDEN` | pass |
| 2 | `listLessonDisputes` as admin → returns array (may be empty) | pass |
| 3 | `resolveLessonDispute` as non-admin → `FORBIDDEN` | pass |
| 4 | `resolveLessonDispute` with non-existent disputeId → `NOT_FOUND` | pass |
| 5 | `resolveLessonDispute` on already-resolved dispute → `CONFLICT` | pass |
| 6 | `resolveLessonDispute` with `refund_partial` and no `refundAmountCents` → `BAD_REQUEST` | pass |
| 7 | `updateLessonDispute` DB helper sets `status`, `resolution`, `resolvedBy`, `resolvedAt`, `adminNote` correctly | pass |
| 8 | `getAllLessonDisputes` DB helper returns joined rows with `studentName` and `lessonAmountCents` | pass |

Use the same test DB setup pattern as `server/sprint-ref1.test.ts`.

---

## What NOT to Do in This Sprint

- Do **not** build the coach-response UI (Phase 3 — coach sees the dispute and can accept/contest).
- Do **not** add a no-show auto-refund timer (Phase 3).
- Do **not** modify `server/stripe.ts` beyond extracting the refund helper if needed.
- Do **not** modify any Sprint 49/50 PGN/analysis code.
- Do **not** change the `lesson_disputes` schema — no new columns needed.
- Do **not** touch the existing "Disputed Lessons" or "Payout-Ready" tabs — leave them as-is.

---

## Existing Assets to Reuse

| Asset | Location | Notes |
|---|---|---|
| `getDisputeById` | `server/db.ts` | Already exists — use in `resolveLessonDispute` |
| `getLessonById` | `server/db.ts` | Already exists |
| `releaseLessonPayoutToCoach` | `server/payoutService.ts` | Already exists — use for `denied` path |
| `notifyOwner` | `server/_core/notification.ts` | Already exists |
| `adminProcedure` | `server/_core/trpc.ts` | Already exists — use instead of manual role check if preferred |
| `AdminNav` component | `AdminDisputesPanel.tsx` (top of file) | Already exists — do not duplicate |
| `formatAdminActionError` | `shared/adminActionErrors.ts` | Already exists — use for error toasts |

---

## Commit Convention

Single commit, message:
```
feat: S-REF-2 — admin lesson dispute panel with resolve/refund/deny
```

Push to your branch. Manus will cherry-pick onto `main` and run `pnpm test`.

---

## Current test count: 428
