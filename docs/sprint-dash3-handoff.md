# S-DASH-3 — Coach Subscriptions, Notification Panel, DM Access Rules, Email Alerts

**Branch:** `claude/s-dash-3-subscriptions-notifications`  
**Priority:** High — new revenue pillar + broken notification flow confirmed in production  
**Scope:** Schema (2 new tables), server (routers + db helpers + email templates), CoachDetail.tsx, StudentDashboard.tsx, CoachDashboard.tsx, Home.tsx, UserMenu.tsx  
**Tests target:** 471 → 490+ (new subscription + notification procedures)

---

## Background & What Was Observed

Three things were confirmed broken or missing in production testing:

1. **Content requests are limited to coaches you've had lessons with.** The student's coach picker in `NewContentRequestDialog` is populated from `studentCoaches` — a derived list of coaches from past lessons. The user wants content requests to be available to any coach the student is **subscribed to** (free or paid), not just lesson coaches.

2. **The coach received zero notifications when a content request was submitted.** `contentRequest.create` in `routers.ts` inserts the row and returns — no email, no in-app notification. The coach has no way to know a request exists unless they manually check their dashboard.

3. **There is no notification panel on the landing page.** Authenticated users see only a `UserMenu` dropdown (Dashboard / Settings / Sign Out). There is no bell icon, no notification count badge, and no panel showing recent activity.

Additionally, the user wants to add a new feature: a **coach subscription model** (OnlyFans-style) where coaches can offer a subscription tier (free or paid) that grants subscribers the ability to send content requests and DMs to that coach, even without a prior lesson.

---

## Feature 1: Coach Subscription Model

### 1a. Two new DB tables

**Table: `coach_subscription_settings`** — one row per coach, controls whether subscriptions are enabled and at what price.

```sql
CREATE TABLE IF NOT EXISTS coach_subscription_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  coachId INT NOT NULL UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  monthlyPriceCents INT NOT NULL DEFAULT 0,
  description VARCHAR(500),
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL
);
```

**Table: `coach_subscriptions`** — one row per subscriber per coach.

```sql
CREATE TABLE IF NOT EXISTS coach_subscriptions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  subscriberId INT NOT NULL,
  coachId INT NOT NULL,
  status ENUM('active', 'cancelled', 'expired') NOT NULL DEFAULT 'active',
  monthlyPriceCents INT NOT NULL DEFAULT 0,
  stripeSubscriptionId VARCHAR(255),
  currentPeriodEnd TIMESTAMP,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
  UNIQUE KEY uq_subscriber_coach (subscriberId, coachId)
);
```

**Add to `drizzle/schema.ts`** (use Drizzle ORM syntax, not raw SQL — the SQL above is for reference only):

```ts
export const coachSubscriptionSettings = mysqlTable("coach_subscription_settings", {
  id: int("id").autoincrement().primaryKey(),
  coachId: int("coachId").notNull().unique(),
  enabled: boolean("enabled").notNull().default(false),
  monthlyPriceCents: int("monthlyPriceCents").notNull().default(0),
  description: varchar("description", { length: 500 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const coachSubscriptions = mysqlTable("coach_subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  subscriberId: int("subscriberId").notNull(),
  coachId: int("coachId").notNull(),
  status: mysqlEnum("status", ["active", "cancelled", "expired"]).notNull().default("active"),
  monthlyPriceCents: int("monthlyPriceCents").notNull().default(0),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 255 }),
  currentPeriodEnd: timestamp("currentPeriodEnd"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  uqSubscriberCoach: unique().on(t.subscriberId, t.coachId),
}));
```

**Run `pnpm db:push` after adding these to schema.ts.**

### 1b. DB helpers (`server/db.ts`)

Add these helpers:

```ts
// Get subscription settings for a coach (returns null if not configured)
export async function getCoachSubscriptionSettings(coachId: number)

// Upsert subscription settings for a coach
export async function upsertCoachSubscriptionSettings(coachId: number, data: {
  enabled: boolean;
  monthlyPriceCents: number;
  description?: string;
})

// Check if a user is actively subscribed to a coach
export async function isUserSubscribedToCoach(subscriberId: number, coachId: number): Promise<boolean>

// Subscribe a user to a coach (creates or reactivates)
export async function subscribeToCoach(subscriberId: number, coachId: number, monthlyPriceCents: number): Promise<number>

// Cancel a subscription
export async function cancelCoachSubscription(subscriberId: number, coachId: number): Promise<void>

// Get all active subscriptions for a user (to populate coach picker)
export async function getActiveSubscriptionsForUser(subscriberId: number): Promise<Array<{
  coachId: number;
  coachName: string;
  coachTitle: string | null;
  monthlyPriceCents: number;
  status: string;
}>>

// Get subscriber count for a coach
export async function getCoachSubscriberCount(coachId: number): Promise<number>
```

### 1c. tRPC procedures (`server/routers.ts`)

Add a `coachSubscription` router:

```ts
coachSubscription: router({
  // Get subscription settings for a coach (public — shown on coach profile page)
  getSettings: publicProcedure
    .input(z.object({ coachId: z.number() }))
    .query(async ({ input }) => {
      return await db.getCoachSubscriptionSettings(input.coachId);
    }),

  // Coach updates their own subscription settings
  updateSettings: coachProcedure
    .input(z.object({
      enabled: z.boolean(),
      monthlyPriceCents: z.number().int().min(0).max(10000), // max $100/mo
      description: z.string().max(500).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await db.upsertCoachSubscriptionSettings(ctx.user.id, input);
      return { success: true };
    }),

  // Subscribe to a coach (any authenticated user)
  subscribe: protectedProcedure
    .input(z.object({ coachId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.id === input.coachId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot subscribe to yourself" });
      }
      const settings = await db.getCoachSubscriptionSettings(input.coachId);
      if (!settings?.enabled) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This coach does not have subscriptions enabled" });
      }
      // For paid subscriptions (monthlyPriceCents > 0): for now, create the
      // subscription record with status "active" and monthlyPriceCents stored.
      // Stripe recurring billing integration is deferred — add a // TODO comment.
      const id = await db.subscribeToCoach(ctx.user.id, input.coachId, settings.monthlyPriceCents);
      // Notify coach of new subscriber
      const subscriber = await db.getUserById(ctx.user.id);
      const coach = await db.getUserById(input.coachId);
      if (coach?.email && subscriber) {
        await sendEmail({
          to: coach.email,
          subject: `New subscriber on BooGMe — ${subscriber.name || "A user"} subscribed`,
          html: getNewSubscriberEmail({
            coachName: coach.name || "Coach",
            subscriberName: subscriber.name || "A user",
            monthlyPriceCents: settings.monthlyPriceCents,
          }),
        });
      }
      // In-app notification record
      await db.createNotification({
        userId: input.coachId,
        type: "new_subscriber",
        title: "New subscriber",
        body: `${subscriber?.name || "Someone"} subscribed to your channel${settings.monthlyPriceCents > 0 ? ` ($${(settings.monthlyPriceCents / 100).toFixed(2)}/mo)` : " (free)"}`,
        relatedUserId: ctx.user.id,
      });
      return { success: true, id };
    }),

  // Cancel subscription
  cancel: protectedProcedure
    .input(z.object({ coachId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db.cancelCoachSubscription(ctx.user.id, input.coachId);
      return { success: true };
    }),

  // Check if current user is subscribed to a coach
  isSubscribed: protectedProcedure
    .input(z.object({ coachId: z.number() }))
    .query(async ({ ctx, input }) => {
      return await db.isUserSubscribedToCoach(ctx.user.id, input.coachId);
    }),

  // Get all active subscriptions for the current user
  mySubscriptions: protectedProcedure.query(async ({ ctx }) => {
    return await db.getActiveSubscriptionsForUser(ctx.user.id);
  }),
}),
```

### 1d. Coach profile page (`CoachDetail.tsx`)

Add a **Subscribe button** to the coach profile page. It should appear in the coach's action area (near the "Book a lesson" button), visible to any authenticated user.

**Logic:**
- If the coach has `subscriptionSettings.enabled === false`: hide the button entirely.
- If `subscriptionSettings.monthlyPriceCents === 0`: show "Follow (Free)" button.
- If `monthlyPriceCents > 0`: show "Subscribe — $X/mo" button.
- If the current user is already subscribed (`isSubscribed === true`): show "Following ✓" (terracotta/ember color) with an "Unsubscribe" option in a small dropdown or secondary button.

**Visual style:** Match the existing dark aesthetic. Use the ember/terracotta accent for the active/subscribed state. The button should sit below or beside the "Book a lesson" CTA.

**Subscriber count:** Show a small "N followers" count below the coach's name/title (only if `subscriptionSettings.enabled === true`).

### 1e. Coach dashboard profile section

In the coach's `id="profile"` section (added in S-DASH-2), add a **Subscription Settings** card below the profile editor:

```
┌─────────────────────────────────────────────────┐
│  SUBSCRIPTION CHANNEL                           │
│                                                 │
│  [Toggle: Enable subscription channel]          │
│                                                 │
│  Monthly price:  [$ ___] /mo  (0 = free)        │
│                                                 │
│  Description:  [textarea — what subscribers get]│
│                                                 │
│  N active subscribers                           │
│                                                 │
│  [Save subscription settings]                   │
└─────────────────────────────────────────────────┘
```

Wire to `trpc.coachSubscription.updateSettings.useMutation()` and `trpc.coachSubscription.getSettings.useQuery({ coachId: userId })`.

---

## Feature 2: Expanded Content Request & DM Access Rules

### 2a. Who can send a content request to a coach

**Current behavior:** The `NewContentRequestDialog` coach picker is populated from `studentCoaches` — coaches the student has had at least one lesson with.

**New behavior:** The coach picker should include **any coach the student has a relationship with**, defined as:
- Had at least one lesson with the coach (existing behavior), OR
- Is actively subscribed to the coach (`coachSubscriptions.status = 'active'`)

**Change in `StudentDashboard.tsx`:** Replace the `studentCoaches` derivation with a combined list. Add a new tRPC query to get subscription coaches and merge:

```tsx
const { data: subscriptionCoaches } = trpc.coachSubscription.mySubscriptions.useQuery();

// In the coach picker derivation:
const allEligibleCoaches = useMemo(() => {
  const map = new Map<number, { id: number; name: string; title: string | null }>();
  // From past lessons
  (lessons || []).forEach((l: any) => {
    if (!map.has(l.coachId)) {
      map.set(l.coachId, { id: l.coachId, name: l.coachName || `Coach #${l.coachId}`, title: l.coachTitle || null });
    }
  });
  // From active subscriptions
  (subscriptionCoaches || []).forEach((s: any) => {
    if (!map.has(s.coachId)) {
      map.set(s.coachId, { id: s.coachId, name: s.coachName, title: s.coachTitle });
    }
  });
  return Array.from(map.values());
}, [lessons, subscriptionCoaches]);
```

Pass `allEligibleCoaches` to `NewContentRequestDialog` instead of `studentCoaches`.

### 2b. DM access rules

**Current behavior:** `messages.send` and `messages.getForLesson` check `lesson.studentId === ctx.user.id || lesson.coachId === ctx.user.id`. DMs are always tied to a specific `lessonId`.

**New behavior:** DMs should be accessible if the user has either:
- Had at least one lesson with the counterpart (existing behavior), OR
- Is actively subscribed to the coach's channel

**Important architectural note:** The current `messages` table requires a `lessonId`. For subscription-only users (no lesson), there is no `lessonId` to attach to. The cleanest solution is to **create a virtual "subscription thread" lesson row** when a subscriber first sends a DM — a special lesson record with `status = 'subscription_dm'` and `scheduledAt = NOW()`, `durationMinutes = 0`, `priceCents = 0`. This avoids a schema change to the messages table.

**Add to `messages.send` procedure** — before the existing lesson ownership check, add:

```ts
// Allow if sender is subscribed to the coach (subscription DM)
const isSubscribed = lesson.status === 'subscription_dm' 
  ? await db.isUserSubscribedToCoach(ctx.user.id, lesson.coachId)
  : false;

if (lesson.studentId !== ctx.user.id && lesson.coachId !== ctx.user.id && !isSubscribed) {
  throw new TRPCError({ code: "FORBIDDEN", message: "Not your lesson" });
}
```

**Add a new procedure `messages.getOrCreateSubscriptionThread`:**

```ts
getOrCreateSubscriptionThread: protectedProcedure
  .input(z.object({ coachId: z.number() }))
  .mutation(async ({ ctx, input }) => {
    // Check subscription
    const isSubscribed = await db.isUserSubscribedToCoach(ctx.user.id, input.coachId);
    if (!isSubscribed) {
      throw new TRPCError({ code: "FORBIDDEN", message: "You must be subscribed to message this coach" });
    }
    // Find or create the subscription_dm lesson
    const existing = await db.getSubscriptionDmLesson(ctx.user.id, input.coachId);
    if (existing) return { lessonId: existing.id };
    const lessonId = await db.createSubscriptionDmLesson(ctx.user.id, input.coachId);
    return { lessonId };
  }),
```

**Add to `server/db.ts`:**
```ts
export async function getSubscriptionDmLesson(studentId: number, coachId: number)
export async function createSubscriptionDmLesson(studentId: number, coachId: number): Promise<number>
```

The `createSubscriptionDmLesson` creates a lesson row with:
- `studentId`, `coachId` as given
- `status = 'subscription_dm'` — **add this enum value to the lessons.status enum in schema.ts**
- `scheduledAt = new Date()`
- `durationMinutes = 0`
- `priceCents = 0`
- `topic = 'Direct Message Channel'`

**Add `'subscription_dm'` to the lessons status enum in `drizzle/schema.ts`.** Check the current enum values and append it.

---

## Feature 3: In-App Notification System

### 3a. New DB table: `notifications`

```ts
export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),           // recipient
  type: mysqlEnum("type", [
    "new_subscriber",
    "new_content_request",
    "new_message",
    "lesson_booked",
    "lesson_confirmed",
    "lesson_cancelled",
    "lesson_completed",
    "new_review",
    "content_delivered",
  ]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  body: text("body").notNull(),
  relatedUserId: int("relatedUserId"),       // who triggered it (optional)
  relatedLessonId: int("relatedLessonId"),   // related lesson (optional)
  relatedContentRequestId: int("relatedContentRequestId"), // optional
  readAt: timestamp("readAt"),               // null = unread
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type Notification = typeof notifications.$inferSelect;
```

**Run `pnpm db:push` after adding this.**

### 3b. DB helpers for notifications (`server/db.ts`)

```ts
export async function createNotification(data: {
  userId: number;
  type: string;
  title: string;
  body: string;
  relatedUserId?: number;
  relatedLessonId?: number;
  relatedContentRequestId?: number;
}): Promise<number>

export async function getNotificationsForUser(userId: number, limit?: number): Promise<Notification[]>
// Returns most recent `limit` (default 20) notifications, ordered by createdAt DESC

export async function getUnreadNotificationCount(userId: number): Promise<number>

export async function markNotificationRead(notificationId: number, userId: number): Promise<void>

export async function markAllNotificationsRead(userId: number): Promise<void>
```

### 3c. tRPC notification procedures (`server/routers.ts`)

Add a `notifications` router:

```ts
notifications: router({
  list: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(20) }).optional())
    .query(async ({ ctx, input }) => {
      return await db.getNotificationsForUser(ctx.user.id, input?.limit ?? 20);
    }),

  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    return await db.getUnreadNotificationCount(ctx.user.id);
  }),

  markRead: protectedProcedure
    .input(z.object({ notificationId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db.markNotificationRead(input.notificationId, ctx.user.id);
      return { success: true };
    }),

  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    await db.markAllNotificationsRead(ctx.user.id);
    return { success: true };
  }),
}),
```

### 3d. Wire notifications into existing event triggers

**Three events that must now create a notification record AND send an email:**

#### Event A: New content request (`contentRequest.create`)

After `db.createContentRequest(...)`, add:

```ts
// 1. Get coach info
const coach = await db.getUserById(input.coachId);
const student = await db.getUserById(ctx.user.id);

// 2. In-app notification for coach
await db.createNotification({
  userId: input.coachId,
  type: "new_content_request",
  title: "New content request",
  body: `${student?.name || "A student"} requested: "${input.title}"`,
  relatedUserId: ctx.user.id,
  relatedContentRequestId: id,
});

// 3. Email to coach
if (coach?.email && student) {
  await sendEmail({
    to: coach.email,
    subject: `New content request from ${student.name || "a student"} — BooGMe`,
    html: getNewContentRequestEmail({
      coachName: coach.name || "Coach",
      studentName: student.name || "A student",
      requestTitle: input.title,
      requestDescription: input.description,
    }),
  });
}
```

#### Event B: New direct message (`messages.send`)

After `db.createMessage(...)`, add:

```ts
// Notify the recipient (the other party in the lesson)
const recipientId = lesson.studentId === ctx.user.id ? lesson.coachId : lesson.studentId;
const sender = await db.getUserById(ctx.user.id);
const recipient = await db.getUserById(recipientId);

await db.createNotification({
  userId: recipientId,
  type: "new_message",
  title: "New message",
  body: `${sender?.name || "Someone"} sent you a message`,
  relatedUserId: ctx.user.id,
  relatedLessonId: input.lessonId,
});

if (recipient?.email && sender) {
  await sendEmail({
    to: recipient.email,
    subject: `New message from ${sender.name || "your coach"} — BooGMe`,
    html: getNewMessageEmail({
      recipientName: recipient.name || "there",
      senderName: sender.name || "Your coach",
      messagePreview: input.content.slice(0, 200),
    }),
  });
}
```

**Important:** Do NOT send an email notification for every single message in a rapid-fire conversation. Add a simple cooldown: only send the email if the recipient has no unread messages from this sender in this lesson from the last 30 minutes. Check `messages` table for `readAt IS NULL AND senderId = sender AND lessonId = lessonId AND createdAt > NOW() - INTERVAL 30 MINUTE`. If count > 0, skip the email (they already got one).

#### Event C: New subscriber (`coachSubscription.subscribe`) — already specified in Feature 1c above.

### 3e. Email templates to add (`server/emailService.ts`)

Add three new template functions:

**`getNewContentRequestEmail(params: { coachName, studentName, requestTitle, requestDescription? }): string`**
- Subject line style: `New content request from [studentName]`
- Body: Coach's name, student's name, request title in a highlighted box, optional description, CTA button "View request" → `https://boogme.com/dashboard` (links to coach dashboard)
- Match existing BooGMe dark email template style (dark background `#0d1117`, ember CTA buttons, bone text)

**`getNewMessageEmail(params: { recipientName, senderName, messagePreview }): string`**
- Subject line style: `New message from [senderName]`
- Body: Recipient name, sender name, message preview (truncated at 200 chars with "..."), CTA "Read message" → `https://boogme.com/dashboard`

**`getNewSubscriberEmail(params: { coachName, subscriberName, monthlyPriceCents }): string`**
- Subject line style: `New subscriber — [subscriberName] is now following you`
- Body: Coach name, subscriber name, subscription tier (free or $X/mo), CTA "View your channel" → `https://boogme.com/dashboard`

---

## Feature 4: Notification Panel on Landing Page

### 4a. New `NotificationBell` component (`client/src/components/NotificationBell.tsx`)

This component replaces the plain `UserMenu` in the Home.tsx nav for authenticated users. It sits **next to** the `UserMenu` (not inside it).

**Structure:**
```
[Bell icon] [N badge]   [User name ▾]
```

The bell icon is a `lucide-react` `Bell` icon. When `unreadCount > 0`, show a small red/ember badge with the count (max "9+").

Clicking the bell opens a **popover/dropdown** (use shadcn `Popover` or `DropdownMenu`) with:

```
┌──────────────────────────────────────────┐
│  NOTIFICATIONS                  Mark all read │
├──────────────────────────────────────────┤
│  [icon] New content request               │
│         Elena Petrov requested "Caro-Kann"│
│         2 minutes ago                     │
├──────────────────────────────────────────┤
│  [icon] New message                       │
│         GM Alex K. sent you a message     │
│         1 hour ago                        │
├──────────────────────────────────────────┤
│  [icon] New subscriber                   │
│         John D. subscribed to your channel│
│         Yesterday                         │
├──────────────────────────────────────────┤
│         View all notifications →          │
└──────────────────────────────────────────┘
```

**Visual style:**
- Background: `bg-ink-deep` (dark, matching the dashboard aesthetic)
- Width: `w-80` (320px)
- Max height: `max-h-96` with `overflow-y-auto`
- Each notification row: icon on left (type-specific: `MessageSquare` for messages, `Star` for content requests, `UserPlus` for subscribers), title bold, body text smaller and muted, timestamp in `text-[11px] text-bone-muted`
- Unread notifications: left border `border-l-2 border-ember` and slightly lighter background
- Read notifications: no border, standard background
- Clicking a notification: marks it read (`trpc.notifications.markRead.mutate`), then navigates to `/dashboard`
- "Mark all read" button: calls `trpc.notifications.markAllRead.mutate`

**Polling:** Use `refetchInterval: 30_000` on `trpc.notifications.unreadCount.useQuery()` to keep the badge fresh.

### 4b. Update `Home.tsx` nav

Replace:
```tsx
{loading ? null : user ? (
  <UserMenu />
) : (...)}
```

With:
```tsx
{loading ? null : user ? (
  <div className="flex items-center gap-2">
    <NotificationBell />
    <UserMenu />
  </div>
) : (...)}
```

Import `NotificationBell` from `@/components/NotificationBell`.

### 4c. Fix `UserMenu.tsx` Settings link

The Settings item in `UserMenu` currently calls `toast.info("Settings coming soon")`. Fix it to navigate to `/settings`:

```tsx
<DropdownMenuItem
  onClick={() => setLocation("/settings")}
  className="cursor-pointer"
>
  <Settings className="mr-2 h-4 w-4" />
  <span>Settings</span>
</DropdownMenuItem>
```

---

## Summary of all changes

| # | File(s) | Change | Priority |
|---|---|---|---|
| 1 | `drizzle/schema.ts` | Add `coachSubscriptionSettings`, `coachSubscriptions`, `notifications` tables; add `subscription_dm` to lessons status enum | Critical |
| 2 | `server/db.ts` | Add 12 new helpers (subscription CRUD, notification CRUD, subscription DM lesson) | Critical |
| 3 | `server/routers.ts` | Add `coachSubscription` router (6 procedures), `notifications` router (4 procedures), `messages.getOrCreateSubscriptionThread`; wire notifications into `contentRequest.create` and `messages.send` | Critical |
| 4 | `server/emailService.ts` | Add 3 new email templates: `getNewContentRequestEmail`, `getNewMessageEmail`, `getNewSubscriberEmail` | Critical |
| 5 | `client/src/pages/CoachDetail.tsx` | Add Subscribe/Follow button, subscriber count, subscription settings display | High |
| 6 | `client/src/pages/CoachDashboard.tsx` | Add subscription settings card to `id="profile"` section | High |
| 7 | `client/src/pages/StudentDashboard.tsx` | Expand coach picker to include subscription coaches | High |
| 8 | `client/src/components/NotificationBell.tsx` | New component — bell icon + popover panel | High |
| 9 | `client/src/pages/Home.tsx` | Add `NotificationBell` next to `UserMenu` for authenticated users | High |
| 10 | `client/src/components/UserMenu.tsx` | Fix Settings link (currently a toast stub) | Low |

---

## DB migrations to run (Manus will run these)

After Claude runs `pnpm db:push`, Manus will confirm the three new tables exist in the live DB. No manual SQL needed — `pnpm db:push` handles it via Drizzle.

---

## Test requirements (`server/dash3.test.ts`)

Write tests covering:

```
1. coachSubscription.getSettings — returns null when not configured
2. coachSubscription.updateSettings — coach can enable subscription
3. coachSubscription.subscribe — creates subscription record
4. coachSubscription.subscribe — rejects self-subscription
5. coachSubscription.subscribe — rejects when coach has subscriptions disabled
6. coachSubscription.isSubscribed — returns true after subscribing
7. coachSubscription.cancel — sets status to cancelled
8. notifications.list — returns notifications for user
9. notifications.unreadCount — returns correct count
10. notifications.markRead — marks one notification read
11. notifications.markAllRead — marks all notifications read
12. contentRequest.create — creates in-app notification for coach
13. messages.send — creates in-app notification for recipient
14. messages.getOrCreateSubscriptionThread — creates subscription_dm lesson
15. messages.getOrCreateSubscriptionThread — rejects non-subscriber
16. messages.send — allows subscription_dm lesson participants
17. messages.send — rejects non-subscriber, non-lesson user
18. messages.send — email cooldown: does not double-send within 30 min
19. getNewContentRequestEmail — renders valid HTML with coach/student names
```

Target: **490+ tests** (currently 471).

---

## Do NOT change

- All S-DASH-1 and S-DASH-2 preserved behaviors
- The `messages` table schema (no column changes — use the `subscription_dm` lesson row approach)
- The existing lesson booking and payment flow
- The existing Stripe Connect coach payout flow
- The `notifyOwner` helper in `server/_core/notification.ts` — this is for owner-only Manus platform alerts, not user-to-user notifications
