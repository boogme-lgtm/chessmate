# S-DASH-4 Handoff — Notification Routing Fix + Remaining Dashboard Polish

**Branch:** `main` (pull latest before starting)
**Test target:** 490 → 495+ (5 new tests)
**Files to touch:** `NotificationBell.tsx` (already fixed — verify only), `CoachDashboard.tsx`, `StudentDashboard.tsx`, `DashShell.tsx`

---

## Context: What's Already Fixed (Do Not Re-Do)

Manus has already committed two fixes to `main`:

1. **Notification click routing** (`cf87c686`) — `NotificationBell.tsx` now uses `getNotificationUrl(type, userType)` with type-based routing. `new_content_request` and `new_subscriber` always go to `/coach/dashboard#<section>`. `content_delivered` always goes to `/dashboard#content-library`. Ambiguous types (messages, lessons) use `userType` as tiebreaker, defaulting to coach for "both" accounts.

2. **Content request empty-state** (`cf87c686`) — When `coaches.length === 0`, `+ New Request` redirects to `/coaches` instead of showing a blocking toast.

**Do not revert or re-implement these.** Pull main, verify they're present, then continue.

---

## Issue 1: `new_message` Notification Routes to Wrong Dashboard for "Both" Accounts

### Root Cause
`new_message` notifications are sent to the **recipient** — which could be either the coach or the student depending on who sent the message. The current routing defaults to `/coach/dashboard#inbox` for "both" accounts, but if the student sent a message to their coach, the coach receives the notification and that's correct. However, if the coach sent a message to the student, the student receives the notification and should be routed to `/dashboard#messages`.

The fix is already architecturally correct — `recipientId` is computed as the other party in `routers.ts:1875`. The problem is the frontend has no way to know which role the recipient was playing when they received the notification.

### Fix
Add a `recipientRole` column to the `notifications` table and populate it when creating notifications.

**Schema change** (`drizzle/schema.ts`):
```ts
// Add to notifications table
recipientRole: mysqlEnum("recipientRole", ["coach", "student"]).default("student"),
```

**Migration** — Manus will run this SQL manually (do NOT use `pnpm db:push`):
```sql
ALTER TABLE notifications ADD COLUMN recipientRole ENUM('coach','student') NOT NULL DEFAULT 'student';
```

**Server change** (`server/routers.ts` — `messages.send` procedure, around line 1880):
```ts
// Determine recipient's role in this lesson
const recipientRole = recipientId === lesson.coachId ? "coach" : "student";
await db.createNotification({
  userId: recipientId,
  type: "new_message",
  title: "New message",
  body: `${sender?.name || "Someone"} sent you a message`,
  relatedUserId: ctx.user.id,
  relatedLessonId: input.lessonId,
  recipientRole,  // ← add this
});
```

**`db.createNotification` helper** (`server/db.ts`) — add `recipientRole` to the insert.

**Frontend** (`NotificationBell.tsx`) — update `getNotificationUrl` to use `n.recipientRole` when available:
```ts
case "new_message":
  // Use stored recipientRole if available, fall back to userType
  const role = n.recipientRole || (userType === "coach" || userType === "both" ? "coach" : "student");
  return role === "coach" ? "/coach/dashboard#inbox" : "/dashboard#messages";
```

---

## Issue 2: "Full Inbox" and "View All Students" Toast Stubs Should Navigate

Several buttons currently show `toast.info("X coming soon")` but the destination already exists in the dashboard.

### Fixes

**`CoachDashboard.tsx` line ~838** — "View All" button in Inbox module:
```tsx
// Change from:
onClick={() => toast.info("Full inbox coming soon")}
// To:
onClick={() => {
  document.getElementById("inbox")?.scrollIntoView({ behavior: "smooth" });
}}
```

**`CoachDashboard.tsx` line ~1120** — "View all students" button:
```tsx
// Change from:
onClick={() => toast.info("View all students: coming soon")}
// To:
onClick={() => {
  document.getElementById("students")?.scrollIntoView({ behavior: "smooth" });
}}
```

**`StudentDashboard.tsx` line ~1694** — "View All" in Messages module:
```tsx
// Change from:
onClick={() => toast.info("Full inbox coming soon")}
// To:
onClick={() => {
  document.getElementById("messages")?.scrollIntoView({ behavior: "smooth" });
}}
```

---

## Issue 3: DashShell "Upload Content" Button Should Navigate to Storefront Section

**`DashShell.tsx` line ~255** — The header "+ Upload Content" button currently shows a toast. It should scroll to the storefront section in the coach dashboard.

```tsx
// Change from:
toast.info("Content upload is coming soon — manage your storefront below.");
// To:
document.getElementById("storefront")?.scrollIntoView({ behavior: "smooth" });
```

---

## Issue 4: Student Roster "Student Detail" Toast Should Navigate to Lesson History

**`CoachDashboard.tsx` line ~1150** — Clicking a student row shows `toast.info("Student detail: coming soon")`. For now, route to the lessons section filtered by that student (the `All Lessons` section already exists at `id="schedule"`).

```tsx
// Change from:
toast.info("Student detail: coming soon")
// To:
document.getElementById("schedule")?.scrollIntoView({ behavior: "smooth" });
```

---

## Issue 5: Notification Bell in DashShell Header Missing

The `NotificationBell` component was added to `Home.tsx` nav but the screenshots show it also appears in the DashShell header (the bell icon at top-right of the dashboard). Verify it's actually imported and rendered in `DashShell.tsx` header. If missing, add it next to the role-specific action buttons.

Check `DashShell.tsx` around the header section:
```tsx
import NotificationBell from "@/components/NotificationBell";
// In the header right section:
<NotificationBell />
```

---

## Tests to Write (`server/dash4.test.ts`)

1. `createNotification` helper accepts and stores `recipientRole`
2. `messages.send` creates notification with `recipientRole: "coach"` when student sends
3. `messages.send` creates notification with `recipientRole: "student"` when coach sends
4. `notifications.list` returns `recipientRole` field
5. `getNotificationUrl("new_message", "both")` with `recipientRole: "student"` returns `/dashboard#messages`

---

## Do Not Touch

- `content_requests` table or router (working correctly)
- `coach_subscriptions` or `coach_subscription_settings` tables
- `NotificationBell.tsx` routing logic (already fixed — only add `recipientRole` support)
- Any Stripe-related code
- `pnpm db:push` — Manus will run the ALTER TABLE manually

---

## Delivery Checklist

- [ ] `recipientRole` column added to schema + `createNotification` helper
- [ ] `messages.send` populates `recipientRole` correctly
- [ ] `NotificationBell` uses `recipientRole` for `new_message` routing
- [ ] 4 toast stubs replaced with scroll-to-section navigation
- [ ] `NotificationBell` confirmed in DashShell header
- [ ] 5 new tests in `server/dash4.test.ts`
- [ ] `pnpm test` passes (495+), `tsc --noEmit` clean
- [ ] **Do NOT run `pnpm db:push`** — Manus handles the migration
