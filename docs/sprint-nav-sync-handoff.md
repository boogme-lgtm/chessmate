# Handoff: Dashboard Nav ↔ Section Order Sync — S-NAV-SYNC-1

## Problem

The sidebar nav items and the rendered section order in the main content area are out of sync on **both** the coach and student dashboards. The scroll-spy highlights whichever section is in the viewport, but because the sections are rendered in a different order than the nav, clicking a nav item scrolls to the wrong position relative to what the user expects, and the visual numbering on the eyebrow labels is also inconsistent.

---

## Current state vs. required state

### Coach dashboard

| Position | Sidebar nav (left) | Section render order (right) | Match? |
|---|---|---|---|
| 1 | Overview | overview | ✓ |
| 2 | All Lessons | **earnings** | ✗ |
| 3 | Students | **inbox** | ✗ |
| 4 | Inbox | **content-requests** | ✗ |
| 5 | Content requests | **storefront** | ✗ |
| 6 | Storefront | **students** | ✗ |
| 7 | Earnings | **reviews** | ✗ |
| 8 | Reviews | referral (no nav item) | — |
| 9 | Profile | **schedule** (All Lessons) | ✗ |
| — | — | **profile** | ✗ |

**Required section render order (to match the nav):**
`overview → schedule → students → inbox → content-requests → storefront → earnings → reviews → profile`

The `referral` section has no nav item — it should be appended **after** `profile` (bottom of page, least prominent).

### Student dashboard

| Position | Sidebar nav (left) | Section render order (right) | Match? |
|---|---|---|---|
| 1 | Overview | overview | ✓ |
| 2 | Lessons | lessons | ✓ |
| 3 | Messages | **content-requests** | ✗ |
| 4 | Content requests | **messages** | ✗ |
| 5 | Content library | content-library | ✓ |
| 6 | Progress | progress | ✓ |
| 7 | Billing | billing | ✓ |

**Required section render order (to match the nav):**
`overview → lessons → messages → content-requests → content-library → progress → billing`

---

## Files to change

| File | What to change |
|---|---|
| `client/src/pages/CoachDashboard.tsx` | Reorder the `<section>` blocks inside `CoachDashboardContent` |
| `client/src/pages/StudentDashboard.tsx` | Swap the `messages` and `content-requests` `<section>` blocks |

**No changes needed to `DashShell.tsx`** — the nav arrays are already in the correct order. The fix is purely reordering the JSX sections in the two dashboard content components.

---

## Exact changes required

### 1 — `client/src/pages/CoachDashboard.tsx`

Inside `CoachDashboardContent`, the sections currently render in this order:

```
overview → earnings → inbox → content-requests → storefront → students → reviews → referral → schedule → profile
```

They must be reordered to:

```
overview → schedule → students → inbox → content-requests → storefront → earnings → reviews → profile → referral
```

The eyebrow labels must also be renumbered to match:

| Section id | New eyebrow label |
|---|---|
| `overview` | `01 — Today` (unchanged) |
| `schedule` | `02 — All Lessons` |
| `students` | `03 — Active Students` |
| `inbox` | `04 — Inbox` |
| `content-requests` | `05 — Content Requests` |
| `storefront` | `06 — Storefront` |
| `earnings` | `07 — Earnings` |
| `reviews` | `08 — Reviews` |
| `profile` | `09 — Profile` |
| `referral` | *(no eyebrow number — keep as-is, just move to the bottom)* |

### 2 — `client/src/pages/StudentDashboard.tsx`

Inside `StudentDashboardContent`, swap the two middle sections so `messages` comes before `content-requests`:

```
// Current (wrong):
<section id="content-requests"> ... </section>   {/* 03 */}
<section id="messages"> ... </section>            {/* 04 */}

// Required (correct):
<section id="messages"> ... </section>            {/* 03 — Messages */}
<section id="content-requests"> ... </section>    {/* 04 — Content requests */}
```

Update the eyebrow labels accordingly:
- `messages` section: `03 — Messages`
- `content-requests` section: `04 — Content requests`

The remaining sections (`content-library 05`, `progress 06`, `billing 07`) are already in the correct order and do not need to move — only their eyebrow numbers need to be confirmed/left as-is.

> **Note:** The student dashboard currently has a gap — eyebrow label `07 — Billing` but no `07` exists (it jumps from `06` to `08`). Fix this: `billing` should be labelled `07 — Billing`.

---

## What NOT to change

- The JSX content inside each `<section>` block — only the **order** of the blocks changes.
- The `COACH_NAV` and `STUDENT_NAV` arrays in `DashShell.tsx` — they are already correct.
- Any backend code, database schema, or tRPC procedures.

---

## Testing checklist

1. **Coach — click each nav item in order** → the page scrolls to the matching section and the scroll-spy highlights that item. ✓
2. **Coach — scroll from top to bottom** → the sidebar highlight advances through Overview → All Lessons → Students → Inbox → Content requests → Storefront → Earnings → Reviews → Profile in that order. ✓
3. **Student — click Messages** → page scrolls to the Messages section (above Content requests). ✓
4. **Student — scroll from top to bottom** → highlight advances through Overview → Lessons → Messages → Content requests → Content library → Progress → Billing. ✓
5. **No visual regressions** — the content inside each section is unchanged; only position on the page changes. ✓

---

## Acceptance criteria

- Sidebar nav item order and section render order are identical on both dashboards.
- Eyebrow labels are sequentially numbered and match the nav order.
- Scroll-spy correctly highlights items top-to-bottom as the user scrolls.
