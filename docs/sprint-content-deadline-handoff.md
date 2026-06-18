# S-CONTENT-3 — Content Request Deadline Reminders & Overdue Flow

**Sprint goal:** Coaches receive email reminders before a content request due date, and students get actionable options when a deadline passes without delivery.

---

## Context

The `content_requests` table already has a `dueDate timestamp` column set by the coach during quoting. There is currently no logic that watches this date. The `reminderScheduler.ts` runs every hour via `setInterval` and is the correct place to add this. The `emailService.ts` uses a shared `disputeEmailShell(title, body, ctaUrl, ctaLabel)` wrapper for all transactional emails.

---

## New Schema Columns (one `pnpm db:push` required)

Add to `content_requests` in `drizzle/schema.ts`:

```ts
deadline24hReminderSentAt: timestamp("deadline24hReminderSentAt"),
deadline1hReminderSentAt:  timestamp("deadline1hReminderSentAt"),
overdueNotifiedAt:         timestamp("overdueNotifiedAt"),
```

These are idempotency guards — the scheduler checks `IS NULL` before sending, then stamps the column after a successful send. Same pattern as `lessons.reminderSentAt`.

---

## New Notification Types

Add to the `notifications.type` enum in `drizzle/schema.ts`:

```
"content_request_deadline_24h"
"content_request_deadline_1h"
"content_request_overdue"
"content_request_deadline_extended"
"content_request_cancelled_overdue"
```

---

## New Status Value

Add `"overdue"` to the `content_requests.status` enum. This is set by the scheduler when `dueDate` passes and the request is still `in_progress` or `payment_collected`. It is a soft flag — the escrow is NOT released; the student chooses what to do next.

Full updated enum:
```
"queued" | "quoted" | "pending_payment" | "payment_collected" | "in_progress" | "delivered" | "cancelled" | "overdue"
```

---

## Scheduler Logic (add to `reminderScheduler.ts`)

Add a new exported function `sendContentRequestDeadlineReminders()` and wire it into `runAll()` inside `startReminderScheduler`.

### 24h reminder
- Query: `status IN ('payment_collected', 'in_progress') AND dueDate IS NOT NULL AND dueDate BETWEEN now+20h AND now+28h AND deadline24hReminderSentAt IS NULL`
- Send email to **coach only** (see email template below)
- Stamp `deadline24hReminderSentAt = NOW()`
- Create in-app notification: `type: "content_request_deadline_24h"`, `recipientRole: "coach"`

### 1h reminder
- Query: `status IN ('payment_collected', 'in_progress') AND dueDate IS NOT NULL AND dueDate BETWEEN now+45min AND now+75min AND deadline1hReminderSentAt IS NULL`
- Send email to **coach only**
- Stamp `deadline1hReminderSentAt = NOW()`
- Create in-app notification: `type: "content_request_deadline_1h"`, `recipientRole: "coach"`

### Overdue scan
- Query: `status IN ('payment_collected', 'in_progress') AND dueDate IS NOT NULL AND dueDate < NOW() AND overdueNotifiedAt IS NULL`
- Set `status = "overdue"` via `db.updateContentRequestStatus`
- Send email to **student** (see template below)
- Stamp `overdueNotifiedAt = NOW()`
- Create in-app notification: `type: "content_request_overdue"`, `recipientRole: "student"`

---

## New tRPC Procedures

### `contentRequest.proposeDeadlineExtension` (student)
- Guard: `status = "overdue"` and `studentId = ctx.user.id`
- Input: `{ requestId: number, newDueDate: string (ISO datetime) }`
- Updates `dueDate`, resets `status = "in_progress"`, clears `deadline24hReminderSentAt`, `deadline1hReminderSentAt`, `overdueNotifiedAt` (so reminders re-fire for the new date)
- Notifies coach: `type: "content_request_deadline_extended"`, `recipientRole: "coach"`

### `contentRequest.cancelOverdue` (student)
- Guard: `status = "overdue"` and `studentId = ctx.user.id`
- Sets `status = "cancelled"`
- Issues a **full Stripe refund** via `stripe.refunds.create({ payment_intent: request.stripePaymentIntentId })` — same pattern as lesson cancellation refunds
- Notifies coach: `type: "content_request_cancelled_overdue"`, `recipientRole: "coach"`
- Idempotency: check `stripePaymentIntentId IS NOT NULL` before attempting refund; if null (no payment collected), just cancel

### `contentRequest.acceptDeadlineExtension` (coach)
- Guard: `status = "overdue"` and `coachId = ctx.user.id`
- This is the coach's confirmation of the student's proposed new date
- Sets `status = "in_progress"`, clears reminder stamps
- Notifies student: `type: "content_request_deadline_extended"`, `recipientRole: "student"`

> **Simplification note:** The propose/accept two-step is the cleanest UX. However, if you prefer a simpler flow, the student can just extend unilaterally (no coach accept required) — this is acceptable since the student is the paying party and the coach agreed to deliver. Make this call based on UX preference; the handoff supports both.

---

## Email Templates (add to `emailService.ts`)

All use the existing `disputeEmailShell` wrapper. CTA always links to `${frontendUrl}/dashboard`.

### `getCoachDeadlineReminderEmail(params: { coachName, studentName, requestTitle, dueDate: Date, hoursRemaining: 24 | 1 })`

Subject: `Content Request Due in ${hoursRemaining}h — "${requestTitle}"`

Body: Warn the coach that `studentName`'s request `"${requestTitle}"` is due in `${hoursRemaining} hour(s)` (`${formatDate(dueDate)}`). CTA: "Go to Dashboard".

### `getStudentContentOverdueEmail(params: { studentName, coachName, requestTitle, dueDate: Date })`

Subject: `Your Content Request is Overdue — "${requestTitle}"`

Body: Inform the student that `"${requestTitle}"` was due on `${formatDate(dueDate)}` and has not been delivered. Offer two options:
- **Extend the deadline** — propose a new due date from the dashboard
- **Cancel and get a full refund** — cancel the request and receive a full refund

CTA: "View Request".

---

## Student Dashboard UI Changes (`StudentDashboard.tsx`)

When a content request has `status = "overdue"`:
1. Show a red **Overdue** badge (alongside the existing badge set)
2. Show two action buttons in the row: **Propose New Deadline** (opens a date picker dialog) and **Cancel & Refund**
3. **Cancel & Refund** should show a confirmation dialog before firing `contentRequest.cancelOverdue`
4. After `proposeDeadlineExtension` succeeds, show a toast: "New deadline proposed — waiting for coach to confirm"

---

## Coach Dashboard UI Changes (`CoachDashboard.tsx`)

When a content request has `status = "overdue"`:
1. Show a red **Overdue** badge
2. If the student has proposed a new deadline (you can detect this by `status = "overdue"` + `dueDate > NOW()` after the student's `proposeDeadlineExtension` call), show an **Accept New Deadline** button
3. The coach can also still click **Mark Delivered** from the overdue state — this should be allowed (status guard: `["in_progress", "overdue"]`)

---

## DB Helpers needed (add to `server/db.ts`)

- `getContentRequestsDueForReminder24h()` — returns rows matching the 24h query above
- `getContentRequestsDueForReminder1h()` — returns rows matching the 1h query above
- `getOverdueContentRequests()` — returns rows matching the overdue scan query
- `stampContentRequestDeadlineReminder(id, field: "deadline24hReminderSentAt" | "deadline1hReminderSentAt" | "overdueNotifiedAt")` — sets the given timestamp column to NOW()
- `proposeContentRequestDeadlineExtension(id, newDueDate: Date)` — updates dueDate, status → in_progress, clears reminder stamps
- `cancelOverdueContentRequest(id)` — sets status → cancelled

---

## Test File: `server/sprint-content3.test.ts`

Write tests for:
1. `sendContentRequestDeadlineReminders` — 24h reminder sends email + stamps column + creates notification
2. `sendContentRequestDeadlineReminders` — 1h reminder sends email + stamps column + creates notification
3. `sendContentRequestDeadlineReminders` — 24h reminder is NOT re-sent if `deadline24hReminderSentAt` is already set (idempotency)
4. `sendContentRequestDeadlineReminders` — overdue scan sets status to "overdue", sends student email, stamps overdueNotifiedAt
5. `contentRequest.proposeDeadlineExtension` — resets status to in_progress, clears reminder stamps, notifies coach
6. `contentRequest.cancelOverdue` — issues Stripe refund, sets status to cancelled, notifies coach
7. `contentRequest.cancelOverdue` — no refund attempt if `stripePaymentIntentId` is null
8. `contentRequest.acceptDeadlineExtension` — sets status to in_progress, notifies student

---

## Files Changed

| File | Change |
|---|---|
| `drizzle/schema.ts` | 3 new columns on `content_requests`, 5 new notification types, `"overdue"` status value |
| `server/db.ts` | 6 new helpers |
| `server/emailService.ts` | 2 new email templates |
| `server/reminderScheduler.ts` | New `sendContentRequestDeadlineReminders()` function, wired into `runAll()` |
| `server/routers.ts` | 3 new procedures: `proposeDeadlineExtension`, `cancelOverdue`, `acceptDeadlineExtension` |
| `client/src/pages/StudentDashboard.tsx` | Overdue badge + Propose New Deadline + Cancel & Refund UI |
| `client/src/pages/CoachDashboard.tsx` | Overdue badge + Accept New Deadline button + allow Mark Delivered from overdue |
| `server/sprint-content3.test.ts` | New test file (8 tests) |

**`pnpm db:push` required** for the 3 new columns, 5 new notification enum values, and `"overdue"` status value.

---

## Money-Path Note

`cancelOverdue` touches Stripe. Apply the same review discipline as S-CONTENT-2:
- Idempotency key on the refund: `content_request_cancel_overdue_${requestId}`
- Check `stripePaymentIntentId IS NOT NULL` before calling Stripe
- CAS guard: check `status = "overdue"` atomically before issuing refund (prevent double-refund if two concurrent requests fire)
