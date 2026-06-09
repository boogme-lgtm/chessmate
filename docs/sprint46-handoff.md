# Sprint 46 Handoff — Coach Dashboard & Post-Payment UX Fixes

**Date:** 2026-06-09  
**Prepared by:** Manus  
**For:** Claude Code  
**Branch:** `claude/sprint46`

---

## Context

The booking flow is now working end-to-end (Sprint 45 fixed the critical webhook path mismatch). This sprint addresses 6 UX/data bugs found during E2E testing of the coach and student dashboards after a successful paid booking.

---

## Bug List (all 6 must be fixed in this sprint)

### S46-1 — Coach dashboard shows "Student #990004" instead of student name [HIGH]

**File:** `client/src/pages/CoachDashboard.tsx` (line ~387–410)  
**File:** `server/db.ts` — `getLessonsByCoach()`

**Problem:** The booking request card renders `lesson.studentId` as `Student #990004`. The student's display name is not returned by `getLessonsByCoach`.

**Fix:**
1. In `server/db.ts`, update `getLessonsByCoach` to JOIN with the `users` table and return `studentName` (the user's `name` field). Use the same pattern as `getLessonsByStudent` which already returns `coachName`.
2. In `CoachDashboard.tsx`, replace `Student #${lesson.studentId}` with `lesson.studentName || Student #${lesson.studentId}` as fallback.

**Reference:** The same fix was done for coach name in Sprint 44 (S44-2). Follow that exact pattern.

---

### S46-2 — Coach dashboard lesson list sort order [HIGH]

**File:** `client/src/pages/CoachDashboard.tsx` (line ~418–490, the lesson list section)

**Problem:** Cancelled lessons appear before confirmed/active lessons in the "All Lessons" list. The current sort is by `scheduledAt DESC` from the DB query, but cancelled lessons from earlier dates are mixed with active ones.

**Fix:** In `CoachDashboard.tsx`, sort the lessons array client-side before rendering:
1. Define a status priority map: `payment_collected` = 0, `confirmed` = 1, `completed` = 2, `cancelled` = 3, `declined` = 4, everything else = 5.
2. Sort by status priority first (ascending), then by `scheduledAt` ascending (soonest first) for active lessons.

```ts
const STATUS_PRIORITY: Record<string, number> = {
  payment_collected: 0,
  confirmed: 1,
  completed: 2,
  cancelled: 3,
  declined: 4,
};
const sortedLessons = [...(lessons || [])].sort((a, b) => {
  const pa = STATUS_PRIORITY[a.status] ?? 5;
  const pb = STATUS_PRIORITY[b.status] ?? 5;
  if (pa !== pb) return pa - pb;
  return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
});
```

Then use `sortedLessons` in the render instead of `lessons`.

---

### S46-3 — "Lessons: 3" count includes cancelled lessons [MEDIUM]

**File:** `client/src/pages/CoachDashboard.tsx` (line ~298)

**Problem:** `{lessons?.length || 0}` counts all lessons including cancelled and declined ones. The stat card should only show active/completed lessons.

**Fix:** Replace `lessons?.length || 0` with:
```ts
lessons?.filter((l: any) => !["cancelled", "declined"].includes(l.status)).length || 0
```

---

### S46-4 — "Pending: $0.00" should show escrowed amount [MEDIUM]

**File:** `server/db.ts` — `getCoachPendingEarnings()` (line ~810)

**Problem:** `getCoachPendingEarnings` only counts lessons with `status = "completed"`. But a lesson in `payment_collected` state (student paid, coach hasn't accepted yet) also represents escrowed money the coach will earn. The coach sees $0.00 pending when there's $132 in escrow.

**Fix:** Update the WHERE clause to include both `payment_collected` and `confirmed` statuses (money is escrowed for all of these):
```ts
.where(and(
  eq(lessons.coachId, coachId),
  inArray(lessons.status, ["payment_collected", "confirmed", "completed"])
));
```

This makes the "Pending" card show the true amount the coach has coming to them.

---

### S46-5 — Payout threshold progress bar shows $0 despite money in escrow [MEDIUM]

**Affected by:** S46-4 fix above

**Problem:** `getCoachEarningsSummary` uses `pendingEarnings` in the `percentToThreshold` calculation, so once S46-4 is fixed, the progress bar will automatically reflect the correct amount. **No additional code change needed** — this is resolved by S46-4.

However, verify after fixing S46-4 that the progress bar in `CoachDashboard.tsx` uses `earnings.percentToThreshold` (it should — confirm at line ~330).

---

### S46-6 — Payment success screen copy is inaccurate [LOW]

**File:** `client/src/components/BookingModal.tsx` — the payment success step

**Problem:** The green info box says: *"Your payment is held securely until after your lesson. You'll only be charged once both you and your coach confirm the lesson was completed."*

This is wrong — the student **was already charged** at checkout. What's held in escrow is the **payout to the coach**, not the student's charge.

**Fix:** Replace the copy with:
> "Your payment is held securely in escrow and will be released to your coach only after the lesson is completed."

Search for `You'll only be charged once` in `BookingModal.tsx` and update that string.

---

## Files to Change

| File | Changes |
|------|---------|
| `server/db.ts` | `getLessonsByCoach` — JOIN users to return `studentName`; `getCoachPendingEarnings` — include `payment_collected` and `confirmed` statuses |
| `client/src/pages/CoachDashboard.tsx` | Sort lessons by status priority + date; filter lesson count to exclude cancelled/declined; use `lesson.studentName` in booking request cards |
| `client/src/components/BookingModal.tsx` | Fix payment success copy |

---

## Tests Required

Add to `server/sprint46.test.ts`:

1. `getLessonsByCoach` returns `studentName` field populated from users table
2. `getCoachPendingEarnings` includes `payment_collected` and `confirmed` lessons
3. `getCoachEarningsSummary` `percentToThreshold` reflects escrowed lessons

---

## Definition of Done

- [ ] All 6 bugs fixed
- [ ] `pnpm test` passes (362+ tests)
- [ ] `tsc --noEmit` exits 0
- [ ] Push to `claude/sprint46` branch
