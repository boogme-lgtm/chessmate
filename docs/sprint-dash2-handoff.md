# S-DASH-2 — Dashboard Polish: Nav Sync, Profile Access, Rating Fix

**Branch:** `claude/s-dash-2-polish`  
**Priority:** High — these are visible UX breaks on the live site  
**Scope:** `DashShell.tsx`, `StudentDashboard.tsx`, `CoachDashboard.tsx`, `Settings.tsx`, `server/routers.ts`  
**Tests target:** 464 → 470+ (add tests for new `student.updateRating` procedure)

---

## Background

S-DASH-1 shipped a solid layout, but there are several nav-to-content mismatches and broken/missing interactions that need to be fixed before the dashboards are user-ready. This handoff documents every discrepancy found by auditing the live screenshots against the code.

---

## 1. Nav ↔ Section Mismatches (the core issue)

`DashShell.handleNavClick` calls `document.getElementById(key)` and scrolls to it. If the `id` doesn't exist in the rendered content, the click does nothing — the page doesn't move and the active highlight is wrong.

### 1a. Student nav — missing section IDs

| Nav key | Nav label | Section `id` in DOM | Status |
|---|---|---|---|
| `overview` | Overview | `id="overview"` ✓ | OK |
| `lessons` | Lessons | **MISSING** | ❌ Broken |
| `messages` | Messages | `id="messages"` ✓ | OK |
| `content-requests` | Content requests | `id="content-requests"` ✓ | OK |
| `content-library` | Content library | `id="content-library"` ✓ | OK |
| `progress` | Progress | `id="progress"` ✓ | OK |
| `billing` | Billing | `id="billing"` ✓ | OK |

**Fix required:** The student dashboard has no `id="lessons"` section. The "Lessons" nav item currently scrolls nowhere. There are two options:

**Option A (preferred):** Add a dedicated `id="lessons"` section below the hero (Module 1) that shows a compact list of all upcoming + past lessons. This is the natural place for a student to see their full lesson history. The data is already fetched (`trpc.lesson.myLessons`). Render it as a simple card with a table: date, coach name, duration, status, amount. Include a "Show cancelled" toggle. This replaces the need to go anywhere else to see lesson history.

**Option B (fallback):** Remove "Lessons" from `STUDENT_NAV` entirely and merge lesson history into the Overview section.

→ **Go with Option A.**

### 1b. Coach nav — missing and mismatched section IDs

| Nav key | Nav label | Section `id` in DOM | Status |
|---|---|---|---|
| `overview` | Overview | `id="overview"` ✓ | OK |
| `schedule` | Schedule | `id="schedule"` exists but renders "All Lessons" | ⚠️ Label mismatch |
| `students` | Students | `id="students"` ✓ | OK |
| `inbox` | Inbox | `id="inbox"` ✓ | OK |
| `content-requests` | Content requests | `id="content-requests"` ✓ | OK |
| `storefront` | Storefront | `id="storefront"` ✓ | OK |
| `earnings` | Earnings | `id="earnings"` ✓ | OK |
| `reviews` | Reviews | `id="reviews"` ✓ | OK |
| `profile` | Profile | **MISSING** | ❌ Broken |

**Fix 1 — Schedule label:** The section with `id="schedule"` renders a card titled "All Lessons". The eyebrow says "All lessons". The nav says "Schedule". Either:
- Rename the nav label from "Schedule" to "All Lessons", OR
- Rename the section eyebrow/card title from "All Lessons" to "Schedule"

→ **Rename the nav label to "All Lessons"** (it more accurately describes what's there — it's a historical list, not a forward-looking schedule). Update `COACH_NAV` key `schedule` → label `"All Lessons"`.

**Fix 2 — Profile section:** The coach nav has a "Profile" item but there is no `id="profile"` section anywhere in `CoachDashboard.tsx`. Clicking "Profile" does nothing.

The coach's public profile is at `/coach/:id` (the `CoachDetail` page). The coach should be able to edit their profile from the dashboard. The `Settings` page at `/settings` handles name/bio/country/timezone but has no chess-specific coach fields.

→ **Add a `id="profile"` section** at the bottom of `CoachDashboardContent` (after the referral card). This section should render an inline profile editor with the following fields, all pre-populated from `trpc.coach.getMyProfile`:
- Display name (from `users.name`)
- Bio (from `coachProfiles.bio`)
- Hourly rate (from `coachProfiles.hourlyRate`) — editable number input
- Chess.com username (from `coachProfiles.chessComUsername`) — with a "Verify" link that opens chess.com
- FIDE ID (from `coachProfiles.fideId`) — text input
- Specialties (from `coachProfiles.specialties`) — comma-separated tags
- A "View public profile" link that navigates to `/coach/:userId`

Wire a "Save changes" button to `trpc.coach.updateProfile.useMutation()` (this procedure already exists at line ~855 in `routers.ts`). Show a success toast on save.

---

## 2. Student: "Set your rating" text does nothing

**File:** `StudentDashboard.tsx`, `ProgressModule` component (~line 1700)

**Current behavior:** When `currentRating === null`, the module shows:
```
Set your rating in your profile to track progress over time.
```
This is plain text — it does nothing when clicked. There is no link, no button, no navigation.

**Root cause:** There is no way to set a chess rating from the student dashboard or from the Settings page. `Settings.tsx` has a `ProfileSection` that edits name/bio/country/timezone but has **no `currentRating` field**. `student.saveQuizResults` can set a rating but only via the onboarding quiz flow, not from the dashboard.

**Fix — two parts:**

**Part A: Add `student.updateRating` procedure** to `server/routers.ts` inside the `student` router:
```ts
updateRating: protectedProcedure
  .input(z.object({
    currentRating: z.number().min(100).max(3200),
  }))
  .mutation(async ({ ctx, input }) => {
    const existing = await db.getStudentProfileByUserId(ctx.user.id);
    if (!existing) {
      // Create a minimal student profile if none exists
      await db.createStudentProfile({
        userId: ctx.user.id,
        currentRating: input.currentRating,
        skillLevel: input.currentRating >= 2000 ? "expert" : input.currentRating >= 1500 ? "advanced" : input.currentRating >= 1000 ? "intermediate" : "beginner",
        primaryGoal: "rating_improvement",
        playingStyle: "balanced",
        learningStyle: "analytical",
        practiceSchedule: "regular",
      });
    } else {
      await db.updateStudentRating(ctx.user.id, input.currentRating);
    }
    return { success: true };
  }),
```

**Part B: Add `db.updateStudentRating` helper** to `server/db.ts`:
```ts
export async function updateStudentRating(userId: number, currentRating: number) {
  await db.update(studentProfiles)
    .set({ currentRating })
    .where(eq(studentProfiles.userId, userId));
}
```

**Part C: Make the text a clickable button** in `ProgressModule`. Replace the plain `<p>` with a button that opens an inline input:

```tsx
{currentRating === null && (
  <div className="mt-3 flex items-center gap-2">
    {showRatingInput ? (
      <>
        <input
          type="number"
          min={100}
          max={3200}
          placeholder="e.g. 1200"
          value={ratingInput}
          onChange={(e) => setRatingInput(e.target.value)}
          className="w-24 px-2 py-1 text-sm bg-background border border-border/40 rounded-sm text-bone font-mono"
        />
        <button
          onClick={handleSaveRating}
          disabled={updateRatingMutation.isPending}
          className="px-2 py-1 text-xs bg-ember text-white rounded-sm hover:bg-ember/90"
        >
          Save
        </button>
        <button
          onClick={() => setShowRatingInput(false)}
          className="text-xs text-bone-muted hover:text-bone"
        >
          Cancel
        </button>
      </>
    ) : (
      <button
        onClick={() => setShowRatingInput(true)}
        className="text-xs text-ember hover:text-ember/80 underline underline-offset-2"
      >
        Set your rating to track progress over time →
      </button>
    )}
  </div>
)}
```

Wire `updateRatingMutation` to `trpc.student.updateRating.useMutation()` with `onSuccess` that invalidates `trpc.student.getProfile` and shows a toast. Add local state: `const [showRatingInput, setShowRatingInput] = useState(false)` and `const [ratingInput, setRatingInput] = useState("")`.

**Write a test** in `server/dash1.test.ts` (or a new `server/dash2.test.ts`) covering:
1. `student.updateRating` — creates profile if none exists
2. `student.updateRating` — updates existing profile rating

---

## 3. No way to access/edit profile from either dashboard

**Current state:** Neither the student nor coach dashboard has a link to the user's profile or settings. The only escape routes are "Sign out" (bottom of sidebar) and the BooGMe logo (goes to `/`). There is no "Settings", "Edit profile", or "My account" link.

**Fix — add a Settings link to the DashShell account footer:**

In `DashShell.tsx`, in the account footer section (the bottom of the sidebar where name + role tag + Sign out live), add a "Settings" link between the name block and the Sign out button:

```tsx
{/* Account footer */}
<div className="mt-auto px-4 py-4 border-t border-border/20">
  <div className="flex items-center gap-2.5">
    {/* initials avatar + name + role tag — unchanged */}
  </div>
  <div className="mt-3 flex items-center gap-3">
    <button
      onClick={() => setLocation("/settings")}
      className="text-[11px] text-bone-muted hover:text-bone transition-colors"
    >
      Settings
    </button>
    <span className="text-bone-muted/30 text-[10px]">·</span>
    <button
      onClick={logout}
      className="text-[11px] text-bone-muted hover:text-bone transition-colors"
    >
      Sign out
    </button>
  </div>
</div>
```

---

## 4. No "Back to Home" / home navigation

**Current state:** The BooGMe logo in the top-left of the sidebar is a button that calls `setLocation("/")`, which does navigate home. However, it is visually indistinguishable from plain text — there is no hover state, no underline, no cursor change, no visual affordance that it is clickable.

**Fix:** Add `cursor-pointer` and a subtle hover color transition to the BooGMe logo button:

```tsx
<button
  onClick={() => setLocation("/")}
  className="text-ember text-sm font-bold tracking-tight cursor-pointer hover:text-ember/80 transition-colors"
>
  BooGMe
</button>
```

Also add a small home icon or "← Home" text below the logo as a secondary affordance (optional but recommended):

```tsx
<button
  onClick={() => setLocation("/")}
  className="flex items-center gap-1 text-[10px] text-bone-muted hover:text-bone transition-colors mt-0.5"
>
  <Home className="w-2.5 h-2.5" />
  Home
</button>
```

Import `Home` from `lucide-react`.

---

## 5. Coach "Upload Content" header button does nothing

**Current state:** The `+ Upload Content` button in the coach header calls `toast.info("Content upload: coming soon")`. This is a stub.

**For now:** This is acceptable as a stub, but the toast message should be more informative. Change it to:

```tsx
toast.info("Content upload is coming soon. Use the Storefront section below to manage your content.")
```

And make clicking it scroll to the `id="storefront"` section:

```tsx
onClick={() => {
  const el = document.getElementById("storefront");
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  toast.info("Content upload is coming soon — stay tuned!");
}}
```

---

## 6. Student sidebar: "CC STUDENT" label in account footer

**Current state (screenshot):** The account footer shows:
```
Cristian Chirila
CC STUDENT
```

The `CC` initials prefix before `STUDENT` is redundant — it repeats the initials that are already shown in the avatar. The role tag should just be `STUDENT` or `COACH`.

**Fix in `DashShell.tsx`:** Change the role tag line from:
```tsx
<div className="text-[10px] font-bold tracking-[0.15em] uppercase text-bone-muted">
  {initials} {roleTag}
</div>
```
to:
```tsx
<div className="text-[10px] font-bold tracking-[0.15em] uppercase text-bone-muted">
  {roleTag}
</div>
```

---

## 7. Earnings bar chart: synthetic data with hardcoded "+22%"

**Current state:** The 12-week bar chart in `EarningsModule` uses synthetic data (`Math.sin(i * 2.1) * 120`). The "+22% this month" badge is hardcoded. The monthly total is computed from all-time lessons, not filtered to the current calendar month.

**Fix — filter to current month:**

Replace the `monthlyTotal` computation:
```ts
// BEFORE (all-time):
const monthlyTotal = (lessons || [])
  .filter((l: any) => !CANCELLED_STATUSES.includes(l.status))
  .reduce((sum: number, l: any) => sum + (l.coachPayoutCents || 0), 0);

// AFTER (current calendar month only):
const now = new Date();
const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
const monthlyTotal = (lessons || [])
  .filter((l: any) => 
    !CANCELLED_STATUSES.includes(l.status) &&
    new Date(l.scheduledAt) >= monthStart
  )
  .reduce((sum: number, l: any) => sum + (l.coachPayoutCents || 0), 0);
```

**Remove the hardcoded "+22%" badge** — replace with actual month-over-month comparison if data is available, or simply remove it if not enough data exists:
```tsx
// Remove this:
<Badge className="bg-green-600/20 text-green-400 ...">+22%</Badge>

// Replace with nothing, or with a neutral label:
<span className="text-xs text-bone-muted">this month</span>
```

The bar chart synthetic data is acceptable for now (real historical data requires a separate earnings history table). Keep the last bar pinned to `monthlyTotal` as Claude already has it.

---

## 8. Student "Content library" shows "Coming soon" placeholders

**Current state (screenshot):** The Content library section shows three cards all labeled "Coming soon / Content library / 0 videos". These are stub placeholder cards.

**Fix:** Replace the three stub cards with a proper empty state. If the student has no purchased content, show:

```tsx
<div className="text-center py-12">
  <BookOpen className="h-10 w-10 mx-auto mb-3 text-bone-muted/30" />
  <p className="text-sm font-medium text-bone mb-1">Your library is empty</p>
  <p className="text-xs text-bone-muted max-w-xs mx-auto">
    Purchase content from your coach's storefront to build your personal chess library.
  </p>
</div>
```

If the student has purchased content items (from `trpc.content.list` filtered by ownership — check if this procedure exists), render them as cards with thumbnail, title, and a "Watch" button. If the procedure doesn't exist yet, use the empty state above and add a `// TODO: wire to trpc.content.listOwned` comment.

---

## 9. Summary of all changes

| # | File | Change | Priority |
|---|---|---|---|
| 1a | `StudentDashboard.tsx` | Add `id="lessons"` section with lesson history table | High |
| 1b | `DashShell.tsx` | Rename coach nav "Schedule" → "All Lessons" | Medium |
| 1c | `CoachDashboard.tsx` | Add `id="profile"` section with inline coach profile editor | High |
| 2a | `server/routers.ts` | Add `student.updateRating` procedure | High |
| 2b | `server/db.ts` | Add `updateStudentRating` helper | High |
| 2c | `StudentDashboard.tsx` | Make "set your rating" text an interactive inline input | High |
| 3 | `DashShell.tsx` | Add Settings link to account footer | High |
| 4 | `DashShell.tsx` | Add cursor-pointer + hover state to BooGMe logo; add Home link | Medium |
| 5 | `DashShell.tsx` | Make "Upload Content" scroll to storefront section | Low |
| 6 | `DashShell.tsx` | Remove redundant initials prefix from role tag | Low |
| 7 | `CoachDashboard.tsx` | Filter earnings to current month; remove hardcoded +22% | Medium |
| 8 | `StudentDashboard.tsx` | Replace "Coming soon" stub cards with proper empty state | Medium |

---

## 10. Do NOT change

- All 12 preserved behaviors from S-DASH-1 (countdown, cancel dialog, raise issue, confirm complete, tip flow, pay now, issue window banners, pending reviews, unread badges, Stripe onboarding banner, referral card, confirm/decline)
- The overall visual design: dark ink background, ember/terracotta accents, bone text, eyebrow labels, monospace numbers
- The `DashShell` sidebar width (200px), sticky positioning, and role switcher logic
- The `handleNavClick` scroll behavior — it's correct, the section IDs just need to exist

---

## 11. Test requirements

Add to `server/dash2.test.ts` (new file):

```
1. student.updateRating — creates minimal profile if none exists, returns { success: true }
2. student.updateRating — updates existing profile's currentRating field
3. student.updateRating — rejects rating < 100
4. student.updateRating — rejects rating > 3200
5. student.updateRating — requires authentication (rejects unauthenticated caller)
6. coach.updateProfile — updates bio and hourlyRate (already exists in routers, add test coverage)
```

Target: **470+ tests** (currently 464).

---

## 12. Files to touch

```
client/src/components/DashShell.tsx          — fixes 1b, 3, 4, 5, 6
client/src/pages/StudentDashboard.tsx        — fixes 1a, 2c, 8
client/src/pages/CoachDashboard.tsx          — fixes 1c, 7
server/routers.ts                            — fix 2a
server/db.ts                                 — fix 2b
server/dash2.test.ts                         — new test file
```

No schema changes required. No DB migrations required. No new npm packages required.
