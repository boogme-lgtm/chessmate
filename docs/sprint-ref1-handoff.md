# S-REF-1 Handoff — Refund & Dispute System Phase 1

**Sprint:** S-REF-1  
**Date:** 2026-06-15  
**Author:** Manus (for Claude Code)  
**Design source:** `docs/refund-policy-design.md` (commit `575d003`)  
**Owner decisions locked:**
- Abuse threshold: **>3 non-no-show disputes** triggers manual-review-only (no-show disputes are excluded from this count because they are objective)
- Late/short partial refund: **admin discretion** (not a flat percentage)
- Quality complaints: **non-refundable by policy**, recorded as feedback only

---

## What you are building in Phase 1

Phase 1 is the **categorized intake + policy gate**. It replaces the current
free-text `raiseIssue(reason)` with a structured `raiseIssue({category, description, evidenceUrls?})`
that enforces the policy at the server level. The tiered coach-response flow
(Phase 2) and no-show fast-track (Phase 3) build on top of this schema — do
not implement them yet.

**Deliverables:**
1. `lesson_disputes` table in `drizzle/schema.ts` + migration
2. Updated `lesson.raiseIssue` tRPC procedure (new input shape, policy gate, dispute row creation)
3. New `db.ts` helpers for dispute CRUD
4. Updated `StudentDashboard.tsx` raise-issue dialog (category picker + guidance copy)
5. Tests covering every category route, the quality non-refund gate, and the window guard
6. `pnpm test` must pass (currently 419)

---

## 1. Schema — `lesson_disputes` table

Add to `drizzle/schema.ts`. The table name in the DB will be `lesson_disputes` (snake_case).

```ts
export const disputeCategories = [
  "coach_no_show",
  "coach_late_or_short",
  "technical_failure",
  "not_as_described",
  "quality",
] as const;
export type DisputeCategory = (typeof disputeCategories)[number];

export const disputeStatuses = [
  "open",
  "coach_responded",
  "escalated",
  "resolved",
] as const;

export const disputeResolutions = [
  "refund_full",
  "refund_partial",
  "denied",
  "feedback_only", // for quality category
] as const;

export const lessonDisputes = mysqlTable("lesson_disputes", {
  id: int("id").primaryKey().autoincrement(),
  lessonId: int("lessonId").notNull().unique(), // one dispute per lesson
  raisedBy: int("raisedBy").notNull(),          // studentId
  category: mysqlEnum("category", disputeCategories).notNull(),
  description: text("description"),             // required for non-no-show categories
  evidenceUrls: text("evidenceUrls"),           // JSON array of URLs, optional
  status: mysqlEnum("status", disputeStatuses).notNull().default("open"),
  // Coach response fields (Phase 2 will populate these; schema needed now)
  coachResponse: text("coachResponse"),
  coachRespondedAt: timestamp("coachRespondedAt"),
  coachAction: mysqlEnum("coachAction", ["accept", "contest"]),
  // Resolution fields
  resolution: mysqlEnum("resolution", disputeResolutions),
  refundAmountCents: int("refundAmountCents"),
  resolvedBy: mysqlEnum("resolvedBy", ["coach", "admin", "system"]),
  resolvedAt: timestamp("resolvedAt"),
  adminNote: text("adminNote"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow().onUpdateNow(),
});
```

Run `pnpm db:push` after adding this.

---

## 2. DB helpers — `server/db.ts`

Add these helpers (do not modify any existing helpers):

```ts
// Create a new dispute row
export async function createLessonDispute(data: {
  lessonId: number;
  raisedBy: number;
  category: DisputeCategory;
  description: string | null;
  evidenceUrls?: string[] | null;
}): Promise<number> { /* insert + return id */ }

// Get dispute by lessonId
export async function getDisputeByLessonId(lessonId: number) { /* ... */ }

// Get dispute by id
export async function getDisputeById(id: number) { /* ... */ }

// Count non-no-show disputes raised by a student (for abuse check)
// Only counts disputes with category != 'coach_no_show'
export async function countNonNoShowDisputesByStudent(studentId: number): Promise<number> { /* ... */ }
```

---

## 3. tRPC procedure — `lesson.raiseIssue`

Replace the existing `raiseIssue` procedure in `server/routers.ts`. The procedure
is at approximately line 1495. **Keep the same procedure name** (`raiseIssue`) so
the frontend mutation hook does not need to change.

### New input schema

```ts
raiseIssue: protectedProcedure
  .input(z.object({
    lessonId: z.number(),
    category: z.enum(["coach_no_show", "coach_late_or_short", "technical_failure", "not_as_described", "quality"]),
    description: z.string().optional(),
    evidenceUrls: z.array(z.string().url()).max(5).optional(),
  }))
```

### Server logic (in order)

1. **Fetch lesson** — throw `NOT_FOUND` if missing.
2. **Ownership check** — `lesson.studentId !== ctx.user.id` → `FORBIDDEN`.
3. **Status check** — only `completed` lessons → `PRECONDITION_FAILED`.
4. **Window check** — `lesson.issueWindowEndsAt && now > issueWindowEndsAt` → `PRECONDITION_FAILED("The 24-hour issue window has expired")`.
5. **One dispute per lesson** — if `getDisputeByLessonId(lessonId)` already exists → `PRECONDITION_FAILED("An issue has already been raised for this lesson")`.
6. **Description required** — for categories `coach_late_or_short`, `technical_failure`, `not_as_described`: if `!description || description.trim().length < 20` → `BAD_REQUEST("Please provide at least 20 characters describing the issue")`. For `coach_no_show` and `quality`, description is optional.
7. **Quality policy gate** — if `category === "quality"`:
   - Create dispute row with `status: "resolved"`, `resolution: "feedback_only"`.
   - Do **NOT** call `updateLessonStatus(lessonId, "disputed")` — lesson stays `completed`, payout is NOT paused.
   - Notify owner with title `"Lesson Feedback (Non-Refundable): #${lessonId}"`.
   - Return `{ success: true, policyGated: true, message: "Quality feedback recorded. Per our policy, subjective dissatisfaction is not eligible for a refund. Your feedback has been shared with the coach." }`.
8. **Abuse check** — call `countNonNoShowDisputesByStudent(ctx.user.id)`. If count **> 3** (strictly greater than 3):
   - Still create the dispute row normally (do not block the student from raising the issue).
   - Set a flag `abuseFlag: true` in the dispute row (add `abuseFlag: boolean` column to the schema).
   - Notify owner with title `"⚠️ Abuse Flag: High-dispute student #${ctx.user.id} raised issue on lesson #${lessonId}"`.
9. **Create dispute row** — `createLessonDispute({ lessonId, raisedBy: ctx.user.id, category, description: description?.trim() || null, evidenceUrls })`.
10. **Mark lesson disputed** — `updateLessonStatus(lessonId, "disputed", { cancellationReason: \`[${category}] ${description || ""}\` })`.
11. **Notify owner** — title: `"Lesson Dispute [${category}]: #${lessonId}"`, content includes student name, category, description snippet.
12. Return `{ success: true, policyGated: false }`.

---

## 4. Frontend — `StudentDashboard.tsx`

The existing `raiseIssueMutation` hook at line ~482 calls `trpc.lesson.raiseIssue.useMutation`.
The hook itself does not need to change (same procedure name). Update only:

### State additions
```tsx
const [issueCategory, setIssueCategory] = useState<string>("");
const [issueDescription, setIssueDescription] = useState(""); // rename from issueReason
```

### Dialog content — replace the current `<textarea>` block with:

1. **Category picker** (radio group or select) with these options and guidance copy:

   | Value | Label | Guidance |
   |---|---|---|
   | `coach_no_show` | Coach didn't show up | The lesson never started because your coach didn't join. |
   | `coach_late_or_short` | Coach was late or cut lesson short | Coach joined >15 min late, or the lesson ended materially early. |
   | `technical_failure` | Technical failure | A platform or connection issue prevented the lesson from happening. |
   | `not_as_described` | Not as described | The lesson was materially different from what the coach's profile stated. |
   | `quality` | Quality / didn't find it useful | ⚠️ **Note:** Subjective dissatisfaction is not eligible for a refund per our policy. You may still submit this as feedback for the coach. |

2. **Description textarea** — shown for all categories. For `quality`, label it "Feedback for the coach (optional)". For all others, label it "Describe what happened (required, min 20 characters)".

3. **Submit button** — disabled unless:
   - `issueCategory` is selected
   - For non-`quality` categories: `issueDescription.trim().length >= 20`
   - `raiseIssueMutation.isPending` is false

4. **Mutation call** — update to pass new shape:
   ```tsx
   raiseIssueMutation.mutate({
     lessonId: lesson.id,
     category: issueCategory as any,
     description: issueDescription.trim() || undefined,
   });
   ```

5. **On success** — if `data.policyGated === true`, show a different toast: `"Feedback submitted. Quality alone is not eligible for a refund per our policy."` Otherwise keep the existing success toast.

6. **Reset state** — on dialog close/success, reset both `issueCategory` and `issueDescription`.

---

## 5. Tests — `server/sprint-ref1.test.ts`

Create a new test file. Required test cases (minimum):

| # | Test | Expected |
|---|---|---|
| 1 | `quality` category → `policyGated: true`, lesson stays `completed`, dispute row has `resolution: feedback_only` | pass |
| 2 | `coach_no_show` with no description → succeeds | pass |
| 3 | `coach_late_or_short` with description < 20 chars → `BAD_REQUEST` | pass |
| 4 | `technical_failure` with description ≥ 20 chars → `success: true`, lesson → `disputed` | pass |
| 5 | Raise issue after window expired → `PRECONDITION_FAILED` | pass |
| 6 | Raise issue on non-completed lesson → `PRECONDITION_FAILED` | pass |
| 7 | Raise issue twice on same lesson → `PRECONDITION_FAILED` | pass |
| 8 | Student with 4 prior non-no-show disputes → dispute created but `abuseFlag: true` | pass |
| 9 | Student with 3 prior non-no-show disputes → dispute created, `abuseFlag: false` (threshold is >3, not ≥3) | pass |

---

## 6. What NOT to do in Phase 1

- Do **not** implement the coach-response flow (Phase 2) — schema columns are there but no procedures yet.
- Do **not** implement the no-show fast-track (Phase 3).
- Do **not** modify `admin.disputes.*` procedures — admin panel upgrades are Phase 4.
- Do **not** modify `server/stripe.ts`, `server/reminderScheduler.ts`, or any Sprint 49/50 PGN/analysis code.
- Do **not** add `abuseFlag` to the `users` table — track it only on the dispute row for now.

---

## 6. Commit convention

Single commit, message:
```
feat: S-REF-1 — categorized dispute intake, quality gate, abuse flag
```

Push to your branch. Manus will cherry-pick onto `main`.

---

## Current test count: 419
