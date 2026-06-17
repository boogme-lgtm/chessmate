# Handoff: Content Request Coach Actions + Chess Platform Progress Tracking — S-CONTENT-1 / S-PROGRESS-1

---

## Part A — Content Request Coach Actions (S-CONTENT-1)

### Problem

The coach's content request flow is missing three critical actions:
1. **Set a price** — the coach cannot update `amountCents` after a request arrives (the student submits with $0 by default).
2. **Set a delivery date** — the `dueDate` column exists in the DB but the coach has no UI to set it.
3. **Decline a request** — the `cancelled` status exists in the schema but `updateStatus` only accepts `in_progress | delivered | cancelled` and there is no UI for it.
4. **Add a coach note / start a conversation** — there is no `coachNote` column and no messaging thread tied to a content request.

The current coach UI shows only: `[START]` → `[MARK DELIVERED]`. That's it.

---

### Schema changes required

#### 1 — Add `coachNote` column to `content_requests`

File: `drizzle/schema.ts`

```ts
// Inside the contentRequests mysqlTable definition, add after `deliveredAt`:
coachNote: text("coachNote"),
```

Run `pnpm db:push` after this change.

---

### Backend changes required

#### 2 — New `contentRequest.quote` procedure

Add to the `contentRequest` router in `server/routers.ts`, after the existing `updateStatus` procedure:

```ts
// Coach sets price, due date, and optional note on a queued request.
// This moves the request from "queued" → "queued" (price is set, waiting for student acknowledgement).
// The coach can call this multiple times to revise the quote before starting.
quote: coachProcedure
  .input(z.object({
    requestId: z.number(),
    amountCents: z.number().int().min(0).max(500000),
    dueDate: z.string().datetime().optional(),
    coachNote: z.string().max(2000).optional(),
  }))
  .mutation(async ({ ctx, input }) => {
    const request = await db.getContentRequestById(input.requestId);
    if (!request) throw new TRPCError({ code: "NOT_FOUND", message: "Content request not found" });
    if (request.coachId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Not your content request" });
    if (request.status !== "queued") throw new TRPCError({ code: "BAD_REQUEST", message: "Can only quote a queued request" });
    await db.updateContentRequestQuote(input.requestId, {
      amountCents: input.amountCents,
      dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
      coachNote: input.coachNote,
    });
    // Notify student of the quote
    const student = await db.getUserById(request.studentId);
    const coach = await db.getUserById(ctx.user.id);
    await db.createNotification({
      userId: request.studentId,
      type: "content_request_quoted",
      title: "Your content request has been priced",
      body: `${coach?.name || "Your coach"} set a price for "${request.title}"`,
      relatedUserId: ctx.user.id,
      relatedContentRequestId: input.requestId,
      recipientRole: "student",
    });
    return { success: true };
  }),

// Coach declines a queued or in-progress request.
decline: coachProcedure
  .input(z.object({
    requestId: z.number(),
    coachNote: z.string().max(2000).optional(),
  }))
  .mutation(async ({ ctx, input }) => {
    const request = await db.getContentRequestById(input.requestId);
    if (!request) throw new TRPCError({ code: "NOT_FOUND", message: "Content request not found" });
    if (request.coachId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Not your content request" });
    if (request.status === "delivered") throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot decline a delivered request" });
    await db.updateContentRequestStatus(input.requestId, "cancelled", {
      coachNote: input.coachNote,
    });
    // Notify student
    const coach = await db.getUserById(ctx.user.id);
    await db.createNotification({
      userId: request.studentId,
      type: "content_request_declined",
      title: "Content request declined",
      body: `${coach?.name || "Your coach"} declined your request: "${request.title}"`,
      relatedUserId: ctx.user.id,
      relatedContentRequestId: input.requestId,
      recipientRole: "student",
    });
    return { success: true };
  }),
```

#### 3 — New DB helpers in `server/db.ts`

Add after `updateContentRequestStatus`:

```ts
export async function updateContentRequestQuote(
  id: number,
  data: { amountCents: number; dueDate?: Date; coachNote?: string }
) {
  const db = await getDb();
  if (!db) return;
  await db.update(contentRequests)
    .set({
      amountCents: data.amountCents,
      ...(data.dueDate !== undefined ? { dueDate: data.dueDate } : {}),
      ...(data.coachNote !== undefined ? { coachNote: data.coachNote } : {}),
    })
    .where(eq(contentRequests.id, id));
}
```

Also update `updateContentRequestStatus` to accept `coachNote` in the `extra` parameter:

```ts
// Change the signature from:
export async function updateContentRequestStatus(
  id: number,
  status: "in_progress" | "delivered" | "cancelled",
  extra?: { deliveredAt?: Date; contentItemId?: number }
)

// To:
export async function updateContentRequestStatus(
  id: number,
  status: "in_progress" | "delivered" | "cancelled",
  extra?: { deliveredAt?: Date; contentItemId?: number; coachNote?: string }
)
// And add coachNote to the .set() call:
await db.update(contentRequests).set({ status, ...extra }).where(eq(contentRequests.id, id));
// (The spread already handles it — just add coachNote to the type.)
```

Also update `getContentRequestsByCoach` and `getContentRequestsByStudent` in `server/db.ts` to include `coachNote` in the SELECT:

```ts
// Add to both queries:
coachNote: contentRequests.coachNote,
```

#### 4 — Add notification types to the schema enum (if needed)

Check `drizzle/schema.ts` for the notifications `type` enum. If `content_request_quoted` and `content_request_declined` are not already present, add them:

```ts
// In the notifications table type enum, add:
"content_request_quoted",
"content_request_declined",
```

Then run `pnpm db:push`.

---

### Frontend changes required — Coach side (`client/src/pages/CoachDashboard.tsx`)

#### 5 — Replace the `ContentRequestsModule` component

The current component renders a flat list with only `[START]` and `[MARK DELIVERED]` buttons. Replace it with an expanded card that opens an inline action panel when a request is clicked/expanded.

**New UX flow per request row:**

```
[Queued]   "Caro-Kann video series" · cchirila
           [$0.00]  [SET PRICE & DATE ▾]  [DECLINE]

  ↓ expanded (when SET PRICE & DATE is clicked):
  Price (USD):  [____]   Due date: [____]
  Note to student: [________________________________]
  [SAVE QUOTE]   [CANCEL]

[In Progress]  "Caro-Kann video series" · cchirila
               [$49.00 · Due Jun 30]  [MARK DELIVERED]  [DECLINE]

[Delivered]    "Caro-Kann video series" · cchirila
               [$49.00]  Delivered ✓
```

**Implementation notes:**
- Use `useState<number | null>(null)` for `expandedId` to track which row is open.
- The "SET PRICE & DATE" button toggles the inline form for that row.
- Price input: `type="number"` min=0, interpreted as dollars (multiply by 100 for `amountCents`).
- Due date input: `type="date"` — convert to ISO datetime string before sending.
- Coach note textarea: optional, max 2000 chars.
- On submit, call `trpc.contentRequest.quote.useMutation()`.
- Decline button: opens a small inline confirmation with optional note field, then calls `trpc.contentRequest.decline.useMutation()`.
- After any mutation, call `utils.contentRequest.listForCoach.invalidate()`.
- Show `dueDate` formatted as `"Due MMM d"` next to the price when set.
- Show `coachNote` as a small italic line under the request title when present.

**Imports to add at the top of CoachDashboard.tsx:**
```ts
import { format } from "date-fns";
```
(already imported — just use it)

---

### Frontend changes required — Student side (`client/src/pages/StudentDashboard.tsx`)

#### 6 — Show price, due date, and coach note on the student's content request list

The student's request list currently shows only status badge + title + price. Enhance each row to show:
- `coachNote` as a small italic line below the title when present (e.g. `"Coach: I'll cover the main lines and key traps."`).
- `dueDate` formatted as `"Due MMM d"` next to the price when set.
- A `"Declined"` badge (red) for `cancelled` status — currently cancelled requests are filtered out; show them with a distinct badge instead so the student knows.

The `getContentRequestsByStudent` query already returns `coachNote` and `dueDate` after the backend changes above — just render them.

---

### Tests required — `server/sprint-content1.test.ts`

Create this new test file. Use the same mock pattern as `sprint50fix1.test.ts`.

```ts
// Test suite: S-CONTENT-1
describe("contentRequest.quote", () => {
  it("coach can set price and due date on a queued request", ...)
  it("coach cannot quote a delivered request", ...)
  it("outsider cannot quote someone else's request", ...)
})

describe("contentRequest.decline", () => {
  it("coach can decline a queued request", ...)
  it("coach can decline an in-progress request", ...)
  it("coach cannot decline a delivered request", ...)
  it("outsider cannot decline someone else's request", ...)
})
```

Mock `db.getContentRequestById`, `db.updateContentRequestQuote`, `db.updateContentRequestStatus`, `db.createNotification`, `db.getUserById`.

---

## Part B — Chess Platform Progress Tracking (S-PROGRESS-1)

### Problem

The current Progress module shows a synthetic (fake) sparkline based on the student's manually-entered rating. The student cannot link their Chess.com, Lichess, or FIDE profiles. The handoff screenshot shows "Set your rating to track progress over time →" — there is no way to connect real platform data.

---

### Schema changes required

#### 7 — Add chess platform username columns to `student_profiles`

File: `drizzle/schema.ts`

```ts
// Inside studentProfiles mysqlTable, add after currentRating:
chesscomUsername: varchar("chesscomUsername", { length: 64 }),
lichessUsername: varchar("lichessUsername", { length: 64 }),
fideId: varchar("fideId", { length: 20 }),  // FIDE ID number as string (e.g. "2016192")
```

Run `pnpm db:push` after this change.

> **Note:** The `users` table and `coachProfiles` already have `lichessUsername` and `chesscomUsername`. The student profile does not — these new columns are on `student_profiles`, not `users`.

---

### Backend changes required

#### 8 — New `student.updateChessProfiles` procedure

Add to the `student` router in `server/routers.ts`:

```ts
updateChessProfiles: protectedProcedure
  .input(z.object({
    chesscomUsername: z.string().max(64).optional(),
    lichessUsername: z.string().max(64).optional(),
    fideId: z.string().max(20).optional(),
  }))
  .mutation(async ({ ctx, input }) => {
    const existing = await db.getStudentProfileByUserId(ctx.user.id);
    if (!existing) {
      // Create minimal profile if none exists
      await db.createStudentProfile({
        userId: ctx.user.id,
        skillLevel: "beginner",
        primaryGoal: "rating_improvement",
        playingStyle: "balanced",
        learningStyle: "analytical",
        practiceSchedule: "regular",
        chesscomUsername: input.chesscomUsername,
        lichessUsername: input.lichessUsername,
        fideId: input.fideId,
      });
    } else {
      await db.updateStudentChessProfiles(ctx.user.id, input);
    }
    return { success: true };
  }),
```

#### 9 — New `student.fetchLiveRatings` procedure

This procedure fetches live ratings from Chess.com and Lichess APIs (FIDE has no public unauthenticated API — use manual entry for FIDE).

```ts
fetchLiveRatings: protectedProcedure.query(async ({ ctx }) => {
  const profile = await db.getStudentProfileByUserId(ctx.user.id);
  if (!profile) return { chesscom: null, lichess: null };

  const results: {
    chesscom: { rapid?: number; blitz?: number; bullet?: number } | null;
    lichess: { rapid?: number; blitz?: number; bullet?: number; classical?: number } | null;
  } = { chesscom: null, lichess: null };

  // Chess.com: GET https://api.chess.com/pub/player/{username}/stats
  if (profile.chesscomUsername) {
    try {
      const res = await fetch(
        `https://api.chess.com/pub/player/${encodeURIComponent(profile.chesscomUsername)}/stats`,
        { headers: { "User-Agent": "BooGMe/1.0 (https://boogme.com)" } }
      );
      if (res.ok) {
        const data = await res.json();
        results.chesscom = {
          rapid: data.chess_rapid?.last?.rating,
          blitz: data.chess_blitz?.last?.rating,
          bullet: data.chess_bullet?.last?.rating,
        };
      }
    } catch { /* ignore — show stale data */ }
  }

  // Lichess: use existing getPlayerProfile helper
  if (profile.lichessUsername) {
    try {
      const { getPlayerProfile, summarizeRatings } = await import("./lichess");
      const lichessProfile = await getPlayerProfile(profile.lichessUsername);
      results.lichess = summarizeRatings(lichessProfile);
    } catch { /* ignore */ }
  }

  return results;
}),
```

#### 10 — New DB helper in `server/db.ts`

```ts
export async function updateStudentChessProfiles(
  userId: number,
  data: { chesscomUsername?: string; lichessUsername?: string; fideId?: string }
) {
  const db = await getDb();
  if (!db) return;
  await db.update(studentProfiles)
    .set(data)
    .where(eq(studentProfiles.userId, userId));
}
```

Also update `getStudentProfileByUserId` to include the new columns in its SELECT (or use `select()` without arguments to return all columns — check current implementation and add `chesscomUsername`, `lichessUsername`, `fideId` if it uses an explicit column list).

---

### Frontend changes required — Student Progress module (`client/src/pages/StudentDashboard.tsx`)

#### 11 — Expand `ProgressModule` to show platform links and live ratings

The `ProgressModule` currently receives only `currentRating: number | null`. Expand its props to also receive `studentProfile` (the full profile object).

**New props:**
```ts
interface ProgressModuleProps {
  currentRating: number | null;
  studentProfile: any; // full profile from trpc.student.getProfile
}
```

**New UI structure (replace the current card content):**

```
┌─────────────────────────────────────────────────────────────┐
│  Rating Progress                                            │
│                                                             │
│  1200  [sparkline]                                          │
│  +80 from start                                             │
│                                                             │
│  ── Chess Platforms ──────────────────────────────────────  │
│                                                             │
│  Chess.com   [username or "Link account"]                   │
│              Rapid: 1240  Blitz: 1180  Bullet: —            │
│                                                             │
│  Lichess     [username or "Link account"]                   │
│              Rapid: 1310  Blitz: 1250  Classical: 1290      │
│                                                             │
│  FIDE        [ID or "Add FIDE ID"]                          │
│              Rating entered manually: 1200                  │
│                                                             │
│  [Edit Platforms]                                           │
└─────────────────────────────────────────────────────────────┘
```

**Implementation notes:**

1. **Live ratings:** Call `trpc.student.fetchLiveRatings.useQuery(undefined, { enabled: !!studentProfile?.chesscomUsername || !!studentProfile?.lichessUsername, staleTime: 5 * 60 * 1000 })`. Show a small spinner while loading. Show `—` for any format not played.

2. **Edit Platforms dialog:** A `Dialog` with three fields:
   - Chess.com username (text input)
   - Lichess username (text input)
   - FIDE ID (text input, numeric string)
   - Submit calls `trpc.student.updateChessProfiles.useMutation()`, then invalidates `trpc.student.getProfile` and `trpc.student.fetchLiveRatings`.

3. **Platform logos:** Use text labels only (no external image dependencies). Style each platform with a small colored dot:
   - Chess.com: `bg-green-500`
   - Lichess: `bg-orange-500`
   - FIDE: `bg-blue-500`

4. **FIDE:** Since there is no public unauthenticated FIDE API, FIDE is manual-entry only. Show the stored `currentRating` as the FIDE rating when a FIDE ID is linked, with a note: `"Rating entered manually"`. Do not attempt to fetch from FIDE.

5. **Sparkline:** Keep the existing synthetic sparkline for now. In a future sprint it can be replaced with real historical data.

6. **Pass `studentProfile` down:** In `StudentDashboardContent`, change:
   ```tsx
   <ProgressModule currentRating={currentRating} />
   ```
   to:
   ```tsx
   <ProgressModule currentRating={currentRating} studentProfile={studentProfile} />
   ```

---

### Tests required — `server/sprint-progress1.test.ts`

```ts
describe("student.updateChessProfiles", () => {
  it("student can save chess.com and lichess usernames", ...)
  it("creates a minimal student profile if none exists", ...)
})

describe("student.fetchLiveRatings", () => {
  it("returns null for both platforms when no usernames are set", ...)
  // Note: do NOT test actual Chess.com/Lichess API calls in unit tests —
  // mock the fetch call and verify the procedure handles a successful response
  // and a failed fetch gracefully (returns null, does not throw).
})
```

---

## Summary of all file changes

| File | Change |
|---|---|
| `drizzle/schema.ts` | Add `coachNote` to `contentRequests`; add `chesscomUsername`, `lichessUsername`, `fideId` to `studentProfiles`; add `content_request_quoted` and `content_request_declined` to notifications type enum |
| `server/db.ts` | Add `updateContentRequestQuote`; update `updateContentRequestStatus` to accept `coachNote`; add `updateStudentChessProfiles`; update both `getContentRequests*` queries to return `coachNote`; update `getStudentProfileByUserId` to return new columns |
| `server/routers.ts` | Add `contentRequest.quote`, `contentRequest.decline`; add `student.updateChessProfiles`, `student.fetchLiveRatings` |
| `client/src/pages/CoachDashboard.tsx` | Replace `ContentRequestsModule` with expanded inline-action version |
| `client/src/pages/StudentDashboard.tsx` | Enhance student content request list to show `coachNote`/`dueDate`/declined state; expand `ProgressModule` with platform links and live ratings |
| `server/sprint-content1.test.ts` | New test file for content request coach actions |
| `server/sprint-progress1.test.ts` | New test file for chess platform profile procedures |

**Run `pnpm db:push` after all schema changes.**

---

## Acceptance criteria

### Content requests (S-CONTENT-1)
- Coach can set a price (in dollars) and optional due date on any queued request.
- Coach can add an optional note visible to the student.
- Coach can decline any non-delivered request with an optional note.
- Student sees the price, due date, coach note, and declined status on their request list.
- Notifications fire to the student on quote and decline.
- All new procedures are covered by unit tests.

### Progress tracking (S-PROGRESS-1)
- Student can link Chess.com username, Lichess username, and FIDE ID from the Progress section.
- Live rapid/blitz/bullet ratings are fetched from Chess.com and Lichess APIs and displayed.
- FIDE is manual-entry only (no API call).
- Edit dialog allows updating all three at once.
- All new procedures are covered by unit tests.
