# S-DASH-1 — Dashboard Redesign Handoff

**Sprint goal:** Completely rewrite `StudentDashboard.tsx`, `CoachDashboard.tsx`, and `Dashboard.tsx` to match the provided mockup screenshots and the owner's text description. Both dashboards share a new `DashShell` sidebar chrome. The student dashboard has 7 modules; the coach dashboard has 7 modules. All existing backend procedures are reused — no new tRPC routes are required for this sprint unless explicitly noted.

**Baseline tests:** 454 passing. Target after this sprint: **470+ passing** (add tests for new components and the two new backend procedures noted below).

---

## 1. Design Language (must match exactly)

The existing design tokens are already in `client/src/index.css`. Use them consistently:

| Token | Value | Usage |
|---|---|---|
| `bg-background` / `#0a0a0a` | Near-black | Page background |
| `bg-ink-raised` / `#141414` | Raised surface | Cards, sidebar |
| `bg-ink-deep` / `#0d0d0d` | Deepest surface | Sidebar bg, pill switcher |
| `text-ember` / `hsl(24,100%,45%)` | Electric orange | Active nav item, CTAs, escrow pills, accent borders |
| `text-bone` / `#e8e0d0` | Warm off-white | Primary text |
| `text-bone-muted` / `#9a9080` | Muted warm | Secondary text, labels |
| `border-border/40` | Semi-transparent | Card borders |
| `font-mono tabular-nums` | Monospace | All currency and number displays |

**Typography rules:**
- Section eyebrows: `text-[10px] font-bold tracking-[0.2em] uppercase text-bone-muted` (class `.eyebrow` already exists)
- Card headers: `text-sm font-semibold text-bone-muted uppercase tracking-wider`
- Primary values: `text-2xl font-bold font-mono tabular-nums text-bone`
- Timestamps: `text-[11px] text-bone-muted`

**No rounded corners** on primary containers. Cards use `rounded-none` or at most `rounded-sm`. Buttons use `rounded-sm`. The aesthetic is sharp-edged, not bubbly.

**Terracotta/ember accent** on the active sidebar item: left border `border-l-2 border-ember` + `text-ember`. Inactive items: `text-bone-muted hover:text-bone`.

---

## 2. Shared Chrome — `DashShell`

**File to create:** `client/src/components/DashShell.tsx`

This replaces `DashboardLayout` for the dashboard pages only. `DashboardLayout` stays untouched (used by other pages).

### 2a. Sidebar (left column, fixed, ~200px wide)

```
┌─────────────────────┐
│  BooGMe logo        │  ← text "BooGMe" in ember, 14px bold
│  STUDENT            │  ← role badge: "STUDENT" or "COACH" in 9px uppercase, muted
├─────────────────────┤
│  MENU               │  ← eyebrow label
│  ● Overview         │  ← active: ember left border + ember text
│  ○ Lessons          │
│  ○ Messages    [2]  │  ← unread badge (orange pill) when count > 0
│  ○ Content requests │
│  ○ Content library  │
│  ○ Progress         │
│  ○ Billing          │
├─────────────────────┤
│  [Avatar] Marcus R. │  ← user name
│  MR STUDENT · 1480  │  ← role tag · chess rating (from studentProfile.currentRating)
└─────────────────────┘
```

**Coach sidebar nav items** (when in coach view):
- Overview
- Schedule
- Students
- Inbox `[3]` (unread badge)
- Content requests `[2]` (pending count badge)
- Storefront
- Earnings
- Reviews
- Profile

**Implementation notes:**
- `DashShell` accepts `role: "student" | "coach"`, `activeSection: string`, `onSectionChange: (s: string) => void`, and `children`.
- The sidebar nav items are rendered as `<button>` elements — clicking them calls `onSectionChange` and scrolls the main content to the matching section via `id` anchors (no page navigation, single-page scroll).
- The unread message badge count comes from `trpc.messages.getUnreadCounts` (already used in both dashboards — sum all lesson unread counts for the sidebar badge).
- The account footer shows: avatar initials, user name, role tag (`MR STUDENT` / `ND COACH`), and chess rating. Rating source: `studentProfile.currentRating` for student view; `coachProfile.fideRating` for coach view.
- For users with `userType === "both"`, render a compact role switcher pill at the top of the sidebar (below the logo) — two buttons "Student" / "Coach" with ember background on active. This replaces the current header-level `RoleSwitcher`.

### 2b. Main Content Area (right of sidebar)

```
┌─────────────────────────────────────────────────────────┐
│  TUESDAY · APRIL 14, 2026          [Find Coach] [+ Book] │
│  Good afternoon, Marcus.                                  │
├─────────────────────────────────────────────────────────┤
│  [Module 1]                                              │
│  [Module 2]                                              │
│  ...                                                     │
└─────────────────────────────────────────────────────────┘
```

**Header row (sticky, `top-0 z-40`):**
- Left: day + date in `text-[11px] font-bold tracking-widest uppercase text-bone-muted`, then `Good afternoon/morning/evening, {firstName}.` in `text-xl font-semibold text-bone`
- Right (student view): `[Find Another Coach]` ghost button → `/coaches`; `[+ Book a Lesson]` ember-filled button → `/coaches`
- Right (coach view): `[Share Booking Link]` ghost button (copies `${origin}/coach/${coachId}` to clipboard with toast); `[+ Upload Content]` ember-filled button → `/coach/content/new` (placeholder route, toast "Coming soon" for now)
- Greeting uses `new Date().getHours()` to pick morning/afternoon/evening. First name is `user.name.split(" ")[0]`.

---

## 3. Student Dashboard — 7 Modules

**File to rewrite:** `client/src/pages/StudentDashboard.tsx`

The page renders `DashShell` with `role="student"` and the 7 modules stacked vertically with `id` anchors matching the sidebar nav. Each module is a full-width section separated by `mb-8`.

### Module 1 — YOUR NEXT LESSON (Hero)

**Section id:** `overview`

This is the most prominent module. It occupies the full width and is split into a **left panel** (lesson details) and a **right panel** (latest coach message preview).

**Data source:** `trpc.lesson.myLessons` (already queried). Filter to the single soonest upcoming confirmed lesson (`status === "confirmed"` and `scheduledAt` in the future). If none, show the soonest `payment_collected` lesson. If none of those, show an empty state with "No upcoming lessons — [Browse Coaches]".

**Left panel layout:**
```
YOUR NEXT LESSON                              [eyebrow]
┌──────────────────────────────────────────────────────┐
│  [$60 IN ESCROW]                                     │  ← amber pill: "$XX IN ESCROW"
│                                                      │
│  Endgame fundamentals — King & pawn races            │  ← lesson.topic (large, ~text-2xl bold)
│                                                      │
│  Nadia will walk you through three opposition        │  ← lesson.notes (truncated to 2 lines)
│  positions you flagged in last week's review.        │
│  Bring your Lichess account.                         │
│                                                      │
│  TODAY    5:00 PM    STARTS IN  2h 14m               │  ← date/time + live countdown
│                                                      │
│  [JOIN LESSON]  [RESCHEDULE]                         │
└──────────────────────────────────────────────────────┘
```

- **Escrow pill:** `bg-amber-900/40 text-amber-400 border border-amber-600/40 text-[11px] font-bold tracking-wider uppercase px-2 py-0.5`. Amount = `lesson.amountCents / 100` formatted as `$XX`.
- **Topic:** `lesson.topic || "Chess Lesson"` — `text-2xl font-bold text-bone leading-tight`
- **Notes:** `lesson.notes` — `text-sm text-bone-muted` — clamp to 3 lines with CSS (`line-clamp-3`)
- **Date/time row:** `format(scheduledAt, "EEEE")` + `format(scheduledAt, "h:mm a")` + `STARTS IN` + live countdown using the existing `useCountdown` hook (already in StudentDashboard.tsx — keep it)
- **JOIN LESSON button:** ember-filled, links to `lesson.meetingUrl` in new tab. Only shown when `lesson.meetingUrl` is set and lesson is within 15 minutes or started.
- **RESCHEDULE button:** ghost button — for now, toast "Reschedule: contact your coach via Messages" (feature not yet built).
- **Cancel:** Move the cancel button to a small `×` icon in the top-right corner of the card (not a prominent CTA). Keep the existing `CancellationDialog` logic intact.

**Right panel — Latest Coach Message Preview:**
```
┌──────────────────────────────────────────────────────┐
│  [ND]  Nadia D.                                      │
│        2280 USCF · Endgames                          │
│                                                      │
│  "Looked at your Tuesday game. Pawn structure on     │
│   move 24 is what we'll study today."                │
│                                                      │
│  2 HOURS AGO                                         │
│                                                      │
│  [= REPLY]                                           │
└──────────────────────────────────────────────────────┘
```

- **Data source:** `trpc.messages.getForLesson` queried for the next lesson's `lessonId`. Take the last message where `senderId === lesson.coachId`.
- **Coach avatar:** 2-letter initials in a `w-9 h-9 rounded-sm bg-ember/20 text-ember` box.
- **Coach name:** `lesson.coachName` (already joined in `getLessonsByStudent`).
- **Coach subtitle:** `coachProfile.fideRating` + `·` + first specialty from `coachProfile.specialties`. Fetch via `trpc.coach.getProfile` with `coachId: lesson.coachId` (public procedure, already exists).
- **Message preview:** last coach message content, clamped to 3 lines, in `text-sm text-bone italic` with quotation marks.
- **Timestamp:** relative time (e.g., "2 hours ago") using `date-fns formatDistanceToNow`.
- **REPLY button:** ember outline button — opens the existing `MessageThread` dialog for this lesson.
- If no messages yet: show placeholder "No messages yet — your coach will reach out before the lesson."

### Module 2 — CONTENT REQUESTS

**Section id:** `content-requests`

This is the **new pillar** — students ask their coach for specific video content. This requires **one new backend procedure** (see Section 6 below).

**Layout:**
```
CONTENT REQUESTS                    [+ NEW REQUEST]     [eyebrow + CTA]
Ask your coach for what you need

┌─────────────────────────────────────────────────────────────────────┐
│  Caro-Kann Advance variation — Black     [IN PROGRESS]  $24        │
│  Nadia D. · Tomorrow                                               │
├─────────────────────────────────────────────────────────────────────┤
│  Review my Lichess loss vs. Imran        [DELIVERED]    $18        │
│  Nadia D. · Yesterday                                              │
└─────────────────────────────────────────────────────────────────────┘
```

- **Status badges:**
  - `IN PROGRESS`: `bg-amber-900/40 text-amber-400 border border-amber-600/40`
  - `DELIVERED`: `bg-emerald-900/40 text-emerald-400 border border-emerald-600/40`
  - `QUEUED`: `bg-zinc-800 text-zinc-400 border border-zinc-600/40`
- **Price:** `text-sm font-mono text-bone-muted` right-aligned.
- **Coach name + due date:** `text-xs text-bone-muted`
- **[+ NEW REQUEST] button:** ember outline — opens a `NewContentRequestDialog` (see Section 6).
- **Empty state:** "No content requests yet. Ask your coach for specific videos or analysis."

### Module 3 — MESSAGES

**Section id:** `messages`

A compact inbox preview showing the 3 most recent message threads across all lessons.

```
MESSAGES                                    VIEW ALL →   [eyebrow + link]
Conversations

[ND]  Nadia D. ●        Looked at your Tuesday game...     2h
[?]   BooGMe             Your refund window cl...           Yesterday
[ND]  Nadia D.           Sent you a King-pawn drill PDF     2d
```

- **Data source:** `trpc.lesson.myLessons` (already loaded). For each lesson, show the latest message preview. Sort by most recent message timestamp descending. Show max 3 rows.
- **Unread indicator:** orange dot `●` next to name when `unreadCount > 0` for that lesson.
- **Clicking a row:** opens `MessageThread` dialog for that lesson (existing component).
- **VIEW ALL →:** links to `/messages` (placeholder route — toast "Full inbox coming soon").
- **"BooGMe" system messages:** for lessons with status changes (e.g., refund notices), show sender as "BooGMe" with the platform logo initials.

### Module 4 — LIBRARY

**Section id:** `content-library`

Shows PPV content the student owns plus recommended content.

```
LIBRARY                                   BROWSE STORE →  [eyebrow + link]
Your content

[thumbnail]          [thumbnail]          [thumbnail $14]
King & pawn endgames  Caro-Kann masterclass  Tactical patterns vol. 1
Nadia D. · 9 videos   Nadia D. · 12 videos   Marcus K. · 24 videos
```

- **Data source:** `trpc.content.list` (public, already exists) — fetch content items where the student has purchased them. Use `trpc.content.list` with no filter to get all published content, then cross-reference with a new `trpc.content.myPurchases` procedure (see Section 6). For now, show all published content and mark locked items with a price pill.
- **Locked items:** show a `$XX` amber pill in the top-right corner of the thumbnail. Clicking opens the content detail / purchase flow.
- **Owned items:** no price pill, play button overlay on thumbnail.
- **Thumbnail:** `w-full aspect-video bg-ink-raised rounded-sm` with a centered `▶` play icon.
- **BROWSE STORE →:** links to `/store` (placeholder — toast "Store coming soon").
- Show max 6 items in a 3-column grid.

### Module 5 — PROGRESS

**Section id:** `progress`

Rating sparkline chart showing the student's chess rating over the last 8 weeks.

```
PROGRESS
Rating · last 8 weeks

[sparkline chart — thin orange line on dark bg]

                                              CURRENT
                                              1480
                                              +78 SINCE START
```

- **Data source:** `trpc.student.getProfile` (already exists) — `studentProfile.currentRating`. The sparkline is **synthetic for now** — generate 8 data points ending at `currentRating` with small random walk. Add a `// TODO: replace with real rating history when rating_history table is added` comment.
- **Chart:** Use a simple SVG sparkline (no Chart.js dependency needed for a single line). Draw a `<polyline>` on a `100×40` SVG viewBox. Stroke: `hsl(24,100%,45%)` (ember), stroke-width 1.5, no fill.
- **Current rating:** `text-3xl font-bold font-mono tabular-nums text-bone`
- **Delta:** `+XX SINCE START` in `text-xs text-emerald-400` (green if positive, red if negative).

### Module 6 — PENDING REVIEWS (conditional)

**Section id:** `pending-reviews` (only rendered if there are pending reviews)

Keep the existing `PendingReviewsCard` component logic but restyle it to match the dark theme. The card should use `bg-ink-raised border border-border/40` instead of the current amber background.

### Module 7 — BILLING (stub)

**Section id:** `billing`

A minimal stub card:
```
BILLING
Manage your payment methods and invoices.
[Manage Billing] → (toast "Billing portal coming soon")
```

---

## 4. Coach Dashboard — 7 Modules

**File to rewrite:** `client/src/pages/CoachDashboard.tsx`

Renders `DashShell` with `role="coach"`. Same structure: 7 modules stacked vertically with `id` anchors.

### Module 1 — TODAY (Hero)

**Section id:** `overview`

Two-column layout: left = today's schedule list; right = "Up Next" focus card.

**Left — Schedule:**
```
TODAY
3 LESSONS TODAY                        [+ BLOCK TIME]

5:00 PM  Marcus Reid                    [$60 ESCROW]
         1:1 · Endgames · 60m
6:30 PM  Group: Rook endings            [$40 ESCROW]
         4 students · 45m
8:00 PM  Ava Lindqvist                  [$65 ESCROW]
         1:1 · Opening prep · 60m
```

- **Data source:** `trpc.lesson.coachLessons` (already loaded). Filter to lessons where `scheduledAt` is today (same calendar day in user's local timezone). Sort by `scheduledAt` ascending.
- **Lesson row:** time in `text-sm font-mono text-bone`, student name in `text-sm font-semibold text-bone`, lesson type + topic + duration in `text-xs text-bone-muted`.
- **Escrow pill:** same amber pill as student side — `lesson.amountCents / 100`.
- **[+ BLOCK TIME] button:** ghost, top-right of section — toast "Block time: coming soon".
- **Empty state:** "No lessons today. Share your booking link to get started."
- **Lesson count eyebrow:** `N LESSONS TODAY` where N is the count.
- **Confirm/Decline:** For lessons in `payment_collected` status, show `[✓ CONFIRM]` and `[✗ DECLINE]` inline buttons using existing `trpc.lesson.confirmAsCoach` and `trpc.lesson.declineAsCoach` mutations.

**Right — Up Next focus card:**
```
UP NEXT
2h 14m

[MR]  Marcus Reid
      MR 1480 · 4th lesson

Last note: "Pawn structure on move 24 from
Tuesday's loss — focus there."

[OPEN LESSON $60M]
```

- **Data source:** The very next lesson (soonest `scheduledAt` in the future with `status === "confirmed"` or `payment_collected`).
- **Countdown:** `2h 14m` — live countdown using existing `useCountdown` hook.
- **Student info:** `lesson.studentName` + student rating (requires new `trpc.coach.getStudentRoster` procedure — see Section 6) + lesson count with this student.
- **Last note:** The most recent message from the student in this lesson's thread. Fetch via `trpc.messages.getForLesson`.
- **[OPEN LESSON] button:** ember-filled, links to `lesson.meetingUrl` or shows "Meeting link not set" toast.

### Module 2 — EARNINGS

**Section id:** `earnings`

```
EARNINGS
$3,840  THIS MONTH  [+22%]

IN ESCROW    LESSONS    CONTENT
$240         $3,120     $720

[12-week bar chart]

12 WEEKS AGO ←────────────────────────────────────→ NOW
```

- **Data source:** `trpc.coach.getEarnings` (already exists). Returns `totalEarningsCents`, `pendingEarningsCents`, `combinedEarningsCents`.
- **"This month"** figure = `combinedEarningsCents / 100` formatted as `$X,XXX`.
- **Breakdown row:** `pendingEarningsCents` = "IN ESCROW"; `totalEarningsCents` = "LESSONS"; content earnings = 0 for now (stub, labelled "CONTENT"). All in `font-mono tabular-nums`.
- **[+22%] badge:** stub — hardcode `+22%` for now with a `// TODO: compute MoM delta` comment. Style: `bg-emerald-900/40 text-emerald-400 text-[11px] font-bold px-1.5 py-0.5`.
- **12-week bar chart:** Use Chart.js `bar` chart. Generate 12 synthetic weekly bars ending at the current week's earnings. The last bar should be ember-colored (`hsl(24,100%,45%)`); earlier bars in `rgba(139,69,19,0.4)`. Chart height: `80px`. No axes labels, no legend. Add `// TODO: replace with real weekly_earnings table data` comment.
- **Stripe Dashboard link:** Keep the existing `getDashboardLink` button but style it as a small ghost link `text-xs text-bone-muted underline` rather than a prominent button.

### Module 3 — INBOX

**Section id:** `inbox`

```
INBOX                                      OPEN INBOX →
3 unread

[MR]  Marcus Reid ●      Oct 8 — Lichess is sunbeams1480     10m
[AL]  Ava Lindqvist ●    Can we cover the French defense...   1h
[IC]  Imran Choudhury ●  Thanks — that endgame video helped.  Yesterday
[GR]  Group: Rook endings  6 members confirmed for 6:30       Yesterday
```

- **Data source:** `trpc.lesson.coachLessons` (already loaded). For each lesson, show the latest student message. Sort by most recent message timestamp descending. Show max 5 rows.
- **Unread dot:** orange `●` when `unreadCount > 0`.
- **Clicking a row:** opens `MessageThread` dialog for that lesson.
- **OPEN INBOX →:** toast "Full inbox coming soon".
- **Unread count eyebrow:** `N unread` where N = sum of all unread counts.

### Module 4 — CONTENT REQUESTS

**Section id:** `content-requests`

The revenue side of the content-request pillar.

```
CONTENT REQUESTS                           $74 QUEUED
Paid requests in queue

Caro-Kann Advance — Black      [DUE SOON]  $24  [FULFILL]
Marcus Reid · due Tomorrow

Lichess loss review vs. Imran  [DELIVERED] $18  [VIEW]
Marcus Reid · due Delivered

Sicilian Najdorf English Attack [QUEUED]   $32  [FULFILL]
Ava Lindqvist · due 3 days
```

- **Data source:** New `trpc.contentRequest.listForCoach` procedure (see Section 6).
- **$74 QUEUED:** sum of `amountCents` for all non-delivered requests.
- **Status badges:** same as student side (DUE SOON = amber, DELIVERED = emerald, QUEUED = zinc).
- **[FULFILL] button:** ember outline — opens a `FulfillContentRequestDialog` (see Section 6).
- **[VIEW] button:** ghost — opens the delivered content item.

### Module 5 — STOREFRONT

**Section id:** `storefront`

```
STOREFRONT                                 [+ UPLOAD]
PPV tutorials

[thumb]  King & pawn endgames       $18  $684 ↑
         9 VIDEOS · 8 SOLD
[thumb]  Caro-Kann masterclass      $24  $576 ↑
         12 VIDEOS · 24 SOLD
[thumb]  Tactical patterns vol. 1   $32  $384 ↑
         24 VIDEOS · 12 SOLD
```

- **Data source:** `trpc.content.list` with `coachId: user.id` (already exists). Returns all published content items for this coach.
- **Revenue figure:** `priceCents * soldCount / 100` — requires `soldCount` on content items. This is a **new field** needed in the `content.list` response. Add a subquery to `getContentItemsByCoach` in `db.ts` that counts `content_purchases` per item. See Section 6.
- **[+ UPLOAD] button:** ember-filled — toast "Content upload: coming soon" for now.
- **Thumbnail:** `w-12 h-12 rounded-sm bg-ink-raised` with coach initials if no `thumbnailUrl`.

### Module 6 — ACTIVE STUDENTS (Roster)

**Section id:** `students`

```
ACTIVE STUDENTS                            VIEW ALL →

[MR]  Marcus Reid      Last · today      1480 ↑
[AL]  Ava Lindqvist    Last · Yesterday  1620 ↑
[IC]  Imran Choudhury  Last · 3 days     1620 →
[SB]  Sofia Bergmann   Last · 1 week     1340 ↓
```

- **Data source:** New `trpc.coach.getStudentRoster` procedure (see Section 6).
- **Rating:** student's `currentRating` from `student_profiles`.
- **Trend arrow:** ↑ green / → neutral / ↓ red. For now, generate a synthetic trend based on rating vs. a baseline. Add `// TODO: compute from rating_history` comment.
- **Last lesson:** relative time of the most recent completed lesson with this student.
- **Clicking a row:** opens a `StudentDetailDialog` showing lesson history with that student (stub — toast "Student detail: coming soon").
- **VIEW ALL →:** toast "Full roster: coming soon".

### Module 7 — REVIEWS

**Section id:** `reviews`

Keep the existing `CoachPendingReviewsCard` logic but restyle to match dark theme. Add a summary line: `{averageRating}★ average · {totalReviews} reviews` from `coachProfile`.

---

## 5. Dashboard.tsx — Unified Entry Point

**File to update:** `client/src/pages/Dashboard.tsx`

Replace the current layout with `DashShell`. The `DashShell` handles the sidebar and role switching internally.

```tsx
export default function Dashboard() {
  const { user, loading } = useAuth();
  // ... auth guard unchanged ...

  const userType = user?.userType as "student" | "coach" | "both";
  const [activeView, setActiveView] = useState<"student" | "coach">(
    userType === "coach" ? "coach" : "student"
  );
  const [activeSection, setActiveSection] = useState("overview");

  return (
    <DashShell
      role={activeView}
      activeSection={activeSection}
      onSectionChange={setActiveSection}
      onRoleChange={userType === "both" ? setActiveView : undefined}
    >
      {activeView === "coach"
        ? <CoachDashboardContent user={user} activeSection={activeSection} />
        : <StudentDashboardContent user={user} activeSection={activeSection} />
      }
    </DashShell>
  );
}
```

The `activeSection` prop is used by each dashboard content component to scroll to the correct section on mount if the sidebar nav was clicked.

---

## 6. New Backend Requirements

### 6a. Content Requests Table

Create a new table `content_requests` in `drizzle/schema.ts`:

```ts
export const contentRequests = mysqlTable("content_requests", {
  id: int("id").autoincrement().primaryKey(),
  studentId: int("studentId").notNull(),
  coachId: int("coachId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  amountCents: int("amountCents").notNull().default(0),
  status: mysqlEnum("status", ["queued", "in_progress", "delivered", "cancelled"]).default("queued").notNull(),
  dueDate: timestamp("dueDate"),
  deliveredAt: timestamp("deliveredAt"),
  contentItemId: int("contentItemId"), // FK to content_items when fulfilled
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
```

**Do NOT run `pnpm db:push`** — Manus will create this table directly with SQL:
```sql
CREATE TABLE IF NOT EXISTS content_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  studentId INT NOT NULL,
  coachId INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  amountCents INT NOT NULL DEFAULT 0,
  status ENUM('queued','in_progress','delivered','cancelled') NOT NULL DEFAULT 'queued',
  dueDate TIMESTAMP NULL,
  deliveredAt TIMESTAMP NULL,
  contentItemId INT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### 6b. New tRPC Procedures

Add to `server/routers.ts` under a new `contentRequest` router:

```ts
contentRequest: router({
  // Student: list their own requests
  listForStudent: protectedProcedure.query(async ({ ctx }) => {
    // SELECT cr.*, u.name AS coachName FROM content_requests cr
    // LEFT JOIN users u ON u.id = cr.coachId
    // WHERE cr.studentId = ctx.user.id ORDER BY cr.createdAt DESC
  }),

  // Coach: list requests assigned to them
  listForCoach: coachProcedure.query(async ({ ctx }) => {
    // SELECT cr.*, u.name AS studentName FROM content_requests cr
    // LEFT JOIN users u ON u.id = cr.studentId
    // WHERE cr.coachId = ctx.user.id AND cr.status != 'cancelled'
    // ORDER BY cr.status ASC, cr.dueDate ASC
  }),

  // Student: create a new request
  create: protectedProcedure
    .input(z.object({
      coachId: z.number(),
      title: z.string().min(3).max(255),
      description: z.string().max(2000).optional(),
      amountCents: z.number().int().min(0).max(50000).default(0),
      dueDate: z.date().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // INSERT into content_requests
      // Return the new request
    }),

  // Coach: update status (in_progress → delivered)
  updateStatus: coachProcedure
    .input(z.object({
      requestId: z.number(),
      status: z.enum(["in_progress", "delivered", "cancelled"]),
      contentItemId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify coachId matches ctx.user.id
      // UPDATE content_requests SET status = input.status WHERE id = input.requestId
    }),
}),
```

### 6c. Coach Student Roster Procedure

Add to the `coach` router:

```ts
getStudentRoster: coachProcedure.query(async ({ ctx }) => {
  // SELECT DISTINCT
  //   u.id, u.name, u.avatarUrl,
  //   sp.currentRating,
  //   MAX(l.scheduledAt) AS lastLessonAt,
  //   COUNT(l.id) AS totalLessons
  // FROM lessons l
  // LEFT JOIN users u ON u.id = l.studentId
  // LEFT JOIN student_profiles sp ON sp.userId = l.studentId
  // WHERE l.coachId = ctx.user.id
  //   AND l.status IN ('completed', 'released', 'confirmed', 'payment_collected')
  // GROUP BY u.id, u.name, u.avatarUrl, sp.currentRating
  // ORDER BY lastLessonAt DESC
  // LIMIT 20
}),
```

### 6d. Content Sales Count

In `server/db.ts`, update the `getContentItemsByCoach` helper (or the `content.list` procedure) to include a `soldCount` field:

```sql
SELECT ci.*, COUNT(cp.id) AS soldCount
FROM content_items ci
LEFT JOIN content_purchases cp ON cp.contentItemId = ci.id
WHERE ci.coachId = {coachId} AND ci.published = 1
GROUP BY ci.id
ORDER BY ci.publishedAt DESC
```

---

## 7. Files to Create / Modify

| File | Action | Notes |
|---|---|---|
| `client/src/components/DashShell.tsx` | **Create** | New shared sidebar chrome |
| `client/src/pages/StudentDashboard.tsx` | **Rewrite** | 7 modules, keep all existing dialog logic |
| `client/src/pages/CoachDashboard.tsx` | **Rewrite** | 7 modules, keep existing mutation logic |
| `client/src/pages/Dashboard.tsx` | **Update** | Wire DashShell, pass activeSection |
| `drizzle/schema.ts` | **Add** | `contentRequests` table definition |
| `server/routers.ts` | **Add** | `contentRequest` router + `coach.getStudentRoster` |
| `server/db.ts` | **Add** | DB helpers for content requests + roster + soldCount |

**Do NOT modify:**
- `DashboardLayout.tsx` — still used by other pages
- `MessageThread.tsx` — reuse as-is
- `ReviewDialog.tsx` — reuse as-is
- `CancellationDialog` (inline in StudentDashboard) — keep logic, just restyle
- Any existing tRPC procedures — only add new ones

---

## 8. Preserved Behaviors (must not regress)

These existing behaviors must continue to work exactly as before:

1. **Live countdown timer** — `useCountdown` hook in StudentDashboard. Keep it.
2. **Cancel lesson dialog** — full refund logic, `CancellationDialog` component. Keep it.
3. **Raise Issue dialog** — S-REF-1 categorized dispute intake. Keep it.
4. **Issue window banners** — 24h window active/expired/released banners. Keep them.
5. **Confirm lesson complete** — `canConfirmLessonComplete` from `shared/lessonTimeHelpers`. Keep it.
6. **Pay Now button** — `pending_payment` status checkout flow. Keep it.
7. **Coach confirm/decline** — `confirmAsCoach` / `declineAsCoach` mutations. Keep them.
8. **Pending reviews prompt** — `PendingReviewsCard` / `CoachPendingReviewsCard`. Keep them, restyle.
9. **Unread message badges** — `trpc.messages.getUnreadCounts`. Keep polling.
10. **Tip flow** — `tip.createCheckout` mutation, tip form in lesson detail. Keep it.
11. **Stripe onboarding banner** — `earnings.needsOnboarding` check. Keep it.
12. **Referral card** — keep in coach dashboard (can move to a less prominent position).

---

## 9. Test Targets

Add the following test cases in a new file `server/dash1.test.ts`:

1. `contentRequest.create` — creates a record, returns it with correct fields
2. `contentRequest.listForStudent` — returns only the requesting student's requests
3. `contentRequest.listForCoach` — returns only requests for that coach, excludes cancelled
4. `contentRequest.updateStatus` — coach can mark in_progress → delivered; student cannot
5. `coach.getStudentRoster` — returns distinct students with lesson counts and last lesson date
6. `coach.getStudentRoster` — excludes cancelled/declined lessons from count
7. `content.list` with `coachId` filter — returns soldCount field (number, not undefined)
8. `DashShell` renders student nav items when `role="student"` (React Testing Library or Vitest component test)
9. `DashShell` renders coach nav items when `role="coach"`
10. Greeting uses "Good morning" before noon, "Good afternoon" 12–17, "Good evening" 17+

Target: **454 + 16 = 470 passing tests** minimum.

---

## 10. Visual Reference Summary

### Student Dashboard (left to right, top to bottom)
1. **Sidebar:** BooGMe logo, "STUDENT" badge, 7 nav items (Overview active with ember border), account footer with name + "MR STUDENT · 1480"
2. **Header:** "TUESDAY · APRIL 14, 2026" / "Good afternoon, Marcus." / [Find Another Coach] [+ Book a Lesson]
3. **Module 1:** Full-width two-column hero — lesson card left, coach message right
4. **Module 2:** Content requests list with status badges and prices
5. **Module 3:** Messages inbox preview (3 rows)
6. **Module 4:** Library grid (3 columns, locked items have price pills)
7. **Module 5:** Progress sparkline with current rating

### Coach Dashboard (left to right, top to bottom)
1. **Sidebar:** BooGMe logo, "COACH" badge, 9 nav items, account footer with "ND COACH · 2280"
2. **Header:** "TUESDAY · APRIL 14, 2026" / "Good afternoon, Nadia." / [Share Booking Link] [+ Upload Content]
3. **Module 1:** Two-column hero — today's schedule list left, "Up Next" focus card right
4. **Module 2:** Earnings card with monthly total, breakdown row, 12-week bar chart
5. **Module 3:** Inbox preview (5 rows with unread dots)
6. **Module 4:** Content request queue with fulfill buttons
7. **Module 5:** Storefront list with thumbnail, price, and revenue
8. **Module 6:** Active students roster with ratings and trend arrows

---

## 11. Commit Instructions

Commit message: `feat: S-DASH-1 — DashShell chrome + student/coach dashboard redesign (7 modules each)`

Branch: `claude/code-audit-review-icD40` (existing Claude branch)

Manus will cherry-pick to main and run the `content_requests` SQL migration manually.
