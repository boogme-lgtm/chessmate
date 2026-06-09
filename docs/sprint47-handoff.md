# Sprint 47 Handoff — PGN Message Limit & Landing Page Copy

**Date:** 2026-06-09  
**Issues:** S47-1, S47-2  
**S47-3 is deferred** — message notification on main dashboard will be handled as part of the post-sign-up authenticated landing page redesign.

---

## S47-1: PGN Message Content Limit Too Low

### Problem
The `lesson.send` tRPC procedure in `server/routers.ts` line 1692 caps `content` at 4000 characters:

```ts
content: z.string().min(1).max(4000),
```

Real PGN files (annotated games, opening repertoires, study files) routinely exceed this. A typical annotated game is 5,000–20,000 characters; a full opening chapter can be 50,000+.

The error shown to the user was:
```
[{ "origin": "string", "code": "too_big", "maximum": 4000, "inclusive": true, "path": ["content"], "message": "Too big: expected string to have <=4000 characters" }]
```

### Fix Required

**Step 1 — Raise the tRPC validator limit (`server/routers.ts` line 1692):**
```ts
// Before:
content: z.string().min(1).max(4000),

// After:
content: z.string().min(1).max(500_000), // 500KB — covers largest PGN files
```

**Step 2 — Migrate the DB column from `text` to `mediumtext` (`drizzle/schema.ts`):**

MySQL `text` type holds 64KB (65,535 bytes). A 500KB PGN would overflow it. Change the column to `mediumtext` (16MB limit):

```ts
// In drizzle/schema.ts, messages table:
// Before:
content: text("content").notNull(),

// After:
content: mediumtext("content").notNull(),
```

Then run `pnpm db:push` to migrate the database.

**Step 3 — Check frontend textarea maxLength:**

Search `client/src/` for any `maxLength` attribute on the PGN textarea in the messaging component and remove or raise it to match:
```
grep -rn "maxLength\|maxlength" client/src/
```

**Step 4 — Add a test in `server/sprint47.test.ts`:**
- Verify that a message with 100,000 characters passes validation
- Verify that a message with 500,001 characters is rejected

---

## S47-2: Landing Page Stat "48h · Refund Window" Is Stale

### Problem
The cancellation policy was changed to 1 hour in Sprint 45, but the landing page (`client/src/pages/Home.tsx`) still shows the old 48h figure in two places:

**Location 1 — Stat block (line 239):**
```tsx
{ value: "48h", label: "Refund window" },
```

**Location 2 — Feature copy (line 369):**
```tsx
copy: "Your payment sits in escrow until the lesson is complete. Dispute it within 48 hours, get it all back.",
```

### Fix Required

**Location 1 — Update the stat block:**
```tsx
// Before:
{ value: "48h", label: "Refund window" },

// After:
{ value: "1h", label: "Cancellation window" },
```

**Location 2 — Update the feature copy:**
```tsx
// Before:
copy: "Your payment sits in escrow until the lesson is complete. Dispute it within 48 hours, get it all back.",

// After:
copy: "Your payment sits in escrow until the lesson is complete. Cancel more than 1 hour before your lesson for a full refund.",
```

No DB changes or tests needed for this fix — it's a pure copy update.

---

## Testing Checklist

- [ ] Send a PGN message with >4000 characters — should succeed
- [ ] Send a PGN message with >500,000 characters — should fail with validation error
- [ ] Visit boogme.com home page — stat block shows "1h · Cancellation window"
- [ ] Feature section copy no longer mentions "48 hours"
- [ ] `pnpm test` passes (368+ tests)
- [ ] `npx tsc --noEmit` exits 0

---

## Files to Touch

| File | Change |
|------|--------|
| `server/routers.ts` | Line 1692: raise `.max(4000)` to `.max(500_000)` |
| `drizzle/schema.ts` | `messages.content`: change `text` to `mediumtext` |
| `client/src/pages/Home.tsx` | Line 239: `"48h"` → `"1h"`, `"Refund window"` → `"Cancellation window"` |
| `client/src/pages/Home.tsx` | Line 369: update copy to remove "48 hours" reference |
| `server/sprint47.test.ts` | New test file: PGN content length validation |

Run `pnpm db:push` after schema change.
