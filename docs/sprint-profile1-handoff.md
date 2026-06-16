# S-PROFILE-1: Coach Profile Page Upgrade

## Goal
Upgrade `CoachDetail.tsx` from a minimal stub into a full, conversion-optimised coach profile page. No schema changes required — all needed data already exists.

---

## Current State

`/coach/:id` (`client/src/pages/CoachDetail.tsx`, 373 lines) already has:
- Back nav + 3-column grid layout (2/3 content + 1/3 sticky booking card)
- Coach name, FIDE title badge, FIDE rating
- Star rating + review count
- Quick stats: totalLessons, totalStudents, experienceYears
- Specialties badges
- Teaching style badge (single word, no context)
- Lichess verified stats block (rapid/blitz/classical/games)
- Reviews list (rating + comment + date, no reviewer name)
- Sticky booking card: price, Book a Lesson button, payment protection badge
- `BookingModal` already wired and working

**What's missing (the upgrade):**
1. **Coach photo** — `profile.profilePhotoUrl` and `user.avatarUrl` both exist but are never rendered
2. **Bio / About section** — `user.bio` exists (set in onboarding step 2) but is not shown
3. **Reviewer name on reviews** — `getReviewsByCoach` returns `studentId` but not the student's name; needs a new DB helper + procedure update
4. **Detailed ratings on reviews** — `knowledgeRating`, `communicationRating`, `preparednessRating` exist in the `reviews` table but are not shown
5. **Availability calendar** — `trpc.coach.getAvailability` already exists and returns `{ schedule, bookedSlots, minAdvanceHours, lessonDurations }`. The profile page should show a read-only weekly availability grid so students can see when the coach is generally available before booking
6. **Lesson durations** — `profile.lessonDurations` (JSON array) is not shown; students don't know if 30/60/90 min sessions are offered
7. **Languages** — `profile.languages` (JSON array) is not shown
8. **Chess.com username link** — `profile.chesscomUsername` exists but is not shown; should link to `chess.com/member/{username}`
9. **Video intro** — `profile.videoIntroUrl` exists but is not rendered
10. **"Book Now" CTA** — the sticky card shows "60-minute sessions" hardcoded; should show actual available durations and their prices

---

## Data Available (no schema changes needed)

### From `trpc.coach.getById` (already called):
```ts
coach.name           // user.name
coach.bio            // user.bio (set in onboarding)
coach.avatarUrl      // user.avatarUrl (set via uploadPhoto)
coach.profile = {
  title,             // "GM", "IM", etc.
  fideRating,
  lichessUsername,
  chesscomUsername,
  specialties,       // JSON array string
  teachingStyle,     // "visual"|"interactive"|"analytical"|"competitive"
  experienceYears,
  languages,         // JSON array string
  hourlyRateCents,
  totalStudents,
  totalLessons,
  averageRating,
  totalReviews,
  profilePhotoUrl,   // S3 URL
  videoIntroUrl,     // YouTube/Vimeo URL
  lessonDurations,   // JSON array string: [30, 60, 90]
  isAvailable,
}
```

### From `trpc.coach.getAvailability` (already exists, not yet called in CoachDetail):
```ts
{ schedule, bookedSlots, minAdvanceHours, lessonDurations }
// schedule = { monday: { enabled: bool, slots: [{start, end}] }, ... }
```

### From `trpc.coach.getReviews` (already called, needs upgrade):
- Currently returns raw review rows without student name
- **New DB helper needed**: `getReviewsByCoachWithStudentName(coachId, limit)` — LEFT JOIN `users` on `studentId` to get `users.name as reviewerName`
- **New procedure**: `coach.getReviewsPublic` (or upgrade `coach.getReviews`) to use the new helper

---

## Implementation Plan

### Phase 1: DB helper + procedure (server)

**1a. New DB helper in `server/db.ts`:**
```ts
export async function getReviewsByCoachWithStudentName(coachId: number, limit: number = 20) {
  // SELECT reviews.*, users.name as reviewerName
  // FROM reviews
  // LEFT JOIN users ON reviews.studentId = users.id
  // WHERE reviews.coachId = ? AND reviews.reviewerType = 'student'
  //   AND reviews.isPublic = true AND reviews.isVisible = true
  // ORDER BY reviews.createdAt DESC
  // LIMIT ?
}
```

**1b. Update `coach.getReviews` procedure** in `server/routers.ts` to call `getReviewsByCoachWithStudentName` instead of `getReviewsByCoach`. This is a backwards-compatible change — the new helper returns all the same fields plus `reviewerName`.

---

### Phase 2: Frontend — CoachDetail.tsx upgrade

Rewrite `CoachDetail.tsx` with the following layout. Keep the existing 2/3 + 1/3 grid structure. Vary the section layouts (not all cards — use some full-bleed sections).

#### 2a. Coach Hero Header (top of left column)
```
[Photo]  Name + Title badge + FIDE rating
         ★ 4.8  ·  42 reviews  ·  128 lessons  ·  67 students
         [Bio text if set]
```
- Photo: use `profile.profilePhotoUrl || coach.avatarUrl`. If neither, show a dark avatar placeholder with the coach's initials (first letter of name).
- Photo size: 96px × 96px, rounded-full, object-cover
- Bio: `coach.bio` — show if set, truncate at 300 chars with "Read more" expand toggle if longer

#### 2b. Credentials & Stats row (3–4 stat boxes)
Keep the existing 3-card grid (Lessons, Students, Years). Add a 4th card if `profile.fideRating` is set: "FIDE Rating" with the number.

#### 2c. Specializations section
Keep existing badges. Add language badges below if `profile.languages` is set.

#### 2d. Teaching Approach section
Upgrade from a single badge to a small descriptive block:
- Teaching style label with a one-sentence description:
  - `visual` → "Uses diagrams, board annotations, and visual patterns"
  - `interactive` → "Hands-on, puzzle-solving, and live game analysis"
  - `analytical` → "Deep positional analysis and opening preparation"
  - `competitive` → "Tournament preparation and competitive mindset"
- Lesson durations: show as pill badges (e.g. "30 min · $75", "60 min · $150", "90 min · $225")
  - Derive price per duration: `hourlyRateCents / 60 * duration / 100`

#### 2e. Availability Preview (read-only weekly grid)
Call `trpc.coach.getAvailability` with a 7-day window from today.

Show a compact weekly grid:
```
Mon  Tue  Wed  Thu  Fri  Sat  Sun
 ●    ●    —    ●    ●    —    —
```
- `●` = coach has enabled slots that day
- `—` = not available
- Below the grid: "Schedules in {coach.timezone}" and "Book at least {minAdvanceHours}h in advance"
- Do NOT show individual time slots here — that's the BookingModal's job
- If `getAvailability` is loading, show a skeleton row

#### 2f. Online Presence (Lichess + Chess.com)
Keep existing Lichess block. Add Chess.com link below if `profile.chesscomUsername` is set:
```
Chess.com: @username  [View profile ↗]
```
Link to `https://www.chess.com/member/{chesscomUsername}`.

#### 2g. Video Intro
If `profile.videoIntroUrl` is set, render an `<iframe>` embed. Support YouTube and Vimeo:
- YouTube: extract video ID from URL, embed as `https://www.youtube.com/embed/{id}`
- Vimeo: extract video ID, embed as `https://player.vimeo.com/video/{id}`
- Fallback: show a plain link if URL format is unrecognised
- Wrap in a Card with title "Video Introduction"

#### 2h. Reviews section
Upgrade each review card:
- Show `reviewerName` (from new helper) — display as "A. Smith" (first name + last initial) for privacy, or "Anonymous" if null
- Show detailed sub-ratings if set: Knowledge ★, Communication ★, Preparedness ★ (small, below main stars)
- Keep date display

#### 2i. Sticky Booking Card (right column) — upgrade
Replace hardcoded "60-minute sessions" with actual lesson durations:
```
$150 / hr

[Book a Lesson]

Available durations:
  30 min — $75
  60 min — $150
  90 min — $225

✓ Payment Protection
  Pay only after your lesson

⏱ Book at least 24h in advance
🌐 Online via video call
```
- Derive duration prices from `hourlyRateCents`
- Show `minAdvanceHours` from availability data
- If coach is not available (`profile.isAvailable === false`), grey out the Book button and show "Currently unavailable"

---

## Schema Changes

**None required.** All data already exists. The only DB change is a new helper function.

---

## Files to Touch

| File | Change |
|---|---|
| `server/db.ts` | Add `getReviewsByCoachWithStudentName` |
| `server/routers.ts` | Update `coach.getReviews` to use new helper |
| `client/src/pages/CoachDetail.tsx` | Full rewrite per spec above |

Do NOT touch `BookingModal.tsx` — it already works correctly.

---

## Tests

Write in `server/sprint-profile1.test.ts`:

1. `getReviewsByCoachWithStudentName` returns reviews with `reviewerName` field
2. `getReviewsByCoachWithStudentName` returns null `reviewerName` gracefully when student is deleted
3. `coach.getReviews` procedure returns `reviewerName` field
4. `coach.getReviews` filters to `isVisible = true` and `reviewerType = 'student'` only
5. `coach.getById` returns `profilePhotoUrl` and `videoIntroUrl` in profile

Target: **443 tests** (438 existing + 5 new).

---

## Acceptance Criteria

- [ ] Coach photo renders (or initials placeholder if no photo)
- [ ] Bio shows with read-more toggle for long bios
- [ ] Lesson durations and derived prices shown in both the content area and the sticky card
- [ ] Weekly availability grid shows enabled days correctly
- [ ] Chess.com link renders if username is set
- [ ] Video intro embeds if URL is set
- [ ] Reviews show reviewer first name + last initial
- [ ] Detailed sub-ratings render if set
- [ ] "Currently unavailable" state disables the Book button
- [ ] tsc 0, all tests pass

---

## Notes for Claude

- The `coach.getById` procedure returns `{ ...userFields, profile: coachProfile }`. The `profile` key is the `coachProfiles` row. Access photo as `coach.profile?.profilePhotoUrl ?? coach.avatarUrl`.
- `profile.specialties`, `profile.languages`, `profile.lessonDurations` are JSON strings — always wrap in try/catch when parsing.
- For the availability grid, call `trpc.coach.getAvailability` with `startDate = new Date().toISOString()` and `endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()`. The `schedule` object has keys `monday`–`sunday` with `{ enabled: boolean, slots: [...] }`.
- Reviewer name privacy: display as `"${firstName} ${lastName[0]}.".trim()` — split on space, take first word as first name, first char of second word as last initial. If only one word, show it as-is.
- Keep `BookingModal` import and wiring exactly as-is — do not refactor it.
- Do not add framer-motion animations to the new sections unless they already exist on the page — keep it consistent.
