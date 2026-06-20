# S-STOREFRONT-3: Post-Purchase Notifications, Earnings, & Student Receipt Email

**Branch:** `claude/sprint-storefront3`  
**Base commit:** `dc23415` (HEAD — S-STOREFRONT-2 merged, 565 tests passing)  
**Baseline test count:** 565 across 45 files  
**Target test count:** ≥ 573 (≥ 8 new tests)

---

## Context

S-STOREFRONT-1 and S-STOREFRONT-2 wired the full storefront purchase flow: coach uploads public content → student visits coach profile → student pays via Stripe → `content.confirmStorefrontPurchase` records the purchase and grants access. The flow works end-to-end, but three post-purchase signals are missing:

1. **Coach gets no in-app notification** when a student buys their content.
2. **Coach Earnings module shows `$0` for Content** — content sale revenue is never counted.
3. **Student gets no receipt/confirmation email** — only an in-app notification fires.

---

## Bug 1 — Coach In-App Notification Missing

### Root cause

`content.confirmStorefrontPurchase` (server/routers.ts ~line 2240) inserts the `content_purchases` row and immediately returns `{ success: true }`. There is no `db.createNotification(...)` call for the coach.

### What needs to be added

**Schema change required:** Add `"new_content_sale"` to the `notifications.type` enum in `drizzle/schema.ts` and run `pnpm db:push`.

```ts
// drizzle/schema.ts — notifications.type enum, add:
"new_content_sale",
```

**After the INSERT in `confirmStorefrontPurchase`**, add (inside a try/catch so a notification failure never blocks the purchase):

```ts
// Notify the coach
try {
  // Fetch the content item to get coachId and title
  const itemResult: any = await database.execute(sql`
    SELECT ci.coachId, ci.title, u.name AS studentName, u.email AS studentEmail
    FROM content_items ci
    JOIN users u ON u.id = ${ctx.user.id}
    WHERE ci.id = ${input.contentItemId}
    LIMIT 1
  `);
  const item = itemResult[0]?.[0];
  if (item) {
    await db.createNotification({
      userId: item.coachId,
      type: "new_content_sale",
      title: "New content sale",
      body: `${item.studentName} purchased "${item.title}" for $${(amountPaidCents / 100).toFixed(2)}`,
      relatedUserId: ctx.user.id,
      recipientRole: "coach",
    });
  }
} catch (notifyErr) {
  console.error("[content.confirmStorefrontPurchase] coach notify failed:", notifyErr);
}
```

---

## Bug 2 — Coach Earnings "Content" Column Always Shows $0

### Root cause

`getCoachTotalEarnings` in `server/db.ts` (line 886) only sums `lessons.coachPayoutCents` for `status = 'released'` lessons. It does not query `content_purchases` at all. The `EarningsModule` in `CoachDashboard.tsx` (line ~780) hardcodes `$0` for the Content cell — it was a placeholder stub.

### What needs to be changed

**`server/db.ts`** — add a new helper:

```ts
export async function getCoachContentEarnings(coachId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db
    .select({
      total: sql<number>`COALESCE(SUM(cp.amountPaidCents), 0)`,
    })
    .from(contentPurchases)
    .innerJoin(contentItems, eq(contentItems.id, contentPurchases.contentItemId))
    .where(eq(contentItems.coachId, coachId));
  return result[0]?.total || 0;
}
```

**`server/db.ts` — `getCoachEarningsSummary`** — include content earnings in the summary:

```ts
export async function getCoachEarningsSummary(coachId: number) {
  const totalEarnings = await getCoachTotalEarnings(coachId);
  const pendingEarnings = await getCoachPendingEarnings(coachId);
  const contentEarnings = await getCoachContentEarnings(coachId);   // NEW
  return {
    ...buildCoachEarningsSummary(totalEarnings, pendingEarnings),
    contentEarningsCents: contentEarnings,                           // NEW
  };
}
```

**`server/routers.ts` — `coach.getEarnings`** — the return already spreads `earnings`, so `contentEarningsCents` will flow through automatically. No change needed here.

**`client/src/pages/CoachDashboard.tsx` — `EarningsModule`** — replace the hardcoded `$0`:

```tsx
// Before (line ~780):
<div className="text-lg font-bold font-mono tabular-nums text-bone-muted">
  $0
</div>

// After:
<div className="text-lg font-bold font-mono tabular-nums text-bone">
  {formatCurrency(earnings?.contentEarningsCents || 0)}
</div>
```

---

## Bug 3 — Student Gets No Receipt Email

### Root cause

`confirmStorefrontPurchase` sends no email. The student sees an in-app notification ("Your content is ready to download") but receives nothing in their inbox. For a paid purchase, a receipt email is expected.

### What needs to be added

**`server/emailService.ts`** — add a new email template at the end of the file:

```ts
export function getStudentContentPurchaseReceiptEmail(params: {
  studentName: string;
  itemTitle: string;
  itemKind: string;
  coachName: string;
  amountPaidCents: number;
  purchaseDate: string;
}): string {
  const { studentName, itemTitle, itemKind, coachName, amountPaidCents, purchaseDate } = params;
  const frontendUrl = process.env.VITE_FRONTEND_URL || 'http://localhost:3000';
  const amount = `$${(amountPaidCents / 100).toFixed(2)}`;
  const body = `
  <p style="margin:0 0 20px;font-size:16px;line-height:1.6;color:#e0e0e0;">Hi ${studentName},</p>
  <p style="margin:0 0 20px;font-size:16px;line-height:1.6;color:#e0e0e0;">
    Your purchase of <strong>"${itemTitle}"</strong> from <strong>${coachName}</strong> was successful.
    The content is now available in your Content Library.
  </p>
  <div style="background-color:#2a2a2a;padding:25px;margin:30px 0;border-radius:8px;border-left:4px solid #8b4513;">
    <table width="100%" cellpadding="8" cellspacing="0">
      ${detailRow("Item", itemTitle)}
      ${detailRow("Type", itemKind)}
      ${detailRow("Coach", coachName)}
      ${detailRow("Amount Paid", amount)}
      ${detailRow("Date", purchaseDate)}
    </table>
  </div>
  <p style="margin:0 0 20px;font-size:16px;line-height:1.6;color:#e0e0e0;">
    You can download your content at any time from your Content Library.
  </p>`;
  return disputeEmailShell('Purchase Receipt', body, `${frontendUrl}/dashboard`, 'Go to Content Library');
}
```

**`server/routers.ts`** — import the new template and send it after the INSERT:

```ts
// Add to imports at top of file:
import { getStudentContentPurchaseReceiptEmail } from "./emailService";

// After the coach notification block in confirmStorefrontPurchase:
try {
  const student = await db.getUserById(ctx.user.id);
  if (student?.email && item) {
    const coach = await db.getUserById(item.coachId);
    await sendEmail({
      to: student.email,
      subject: `Receipt: "${item.title}" — BooGMe`,
      html: getStudentContentPurchaseReceiptEmail({
        studentName: student.name || "Student",
        itemTitle: item.title,
        itemKind: item.kind || "content",
        coachName: coach?.name || "Your coach",
        amountPaidCents,
        purchaseDate: new Date().toLocaleDateString("en-US", {
          year: "numeric", month: "long", day: "numeric",
        }),
      }),
    });
  }
} catch (emailErr) {
  console.error("[content.confirmStorefrontPurchase] receipt email failed:", emailErr);
}
```

Note: the SQL query in Bug 1 already fetches `studentName` and `studentEmail` from the JOIN. Refactor that single query to also return `coachId`, `kind`, and `item.title` so both the notification and the email share one DB round-trip.

---

## Files to Change

| File | Change |
|---|---|
| `drizzle/schema.ts` | Add `"new_content_sale"` to `notifications.type` enum |
| `server/db.ts` | Add `getCoachContentEarnings()`, update `getCoachEarningsSummary()` |
| `server/routers.ts` | Post-INSERT: coach notification + student receipt email in `confirmStorefrontPurchase` |
| `server/emailService.ts` | Add `getStudentContentPurchaseReceiptEmail()` template |
| `client/src/pages/CoachDashboard.tsx` | Replace hardcoded `$0` with `earnings?.contentEarningsCents` |

---

## Migration

After editing `drizzle/schema.ts`, run:

```bash
pnpm db:push
```

This adds `"new_content_sale"` to the `notifications.type` MySQL enum. No data migration needed.

---

## Tests — `server/sprint-storefront3.test.ts`

Write ≥ 8 new tests. Required coverage:

| # | Test |
|---|---|
| 1 | `confirmStorefrontPurchase` creates a `new_content_sale` notification for the coach |
| 2 | Notification body includes student name, item title, and formatted price |
| 3 | Notification failure does NOT throw — purchase still returns `{ success: true }` |
| 4 | `getCoachContentEarnings` returns 0 when coach has no purchases |
| 5 | `getCoachContentEarnings` returns correct sum for multiple purchases |
| 6 | `getCoachEarningsSummary` includes `contentEarningsCents` field |
| 7 | `coach.getEarnings` procedure returns `contentEarningsCents` in response |
| 8 | Receipt email is attempted after successful purchase (mock `sendEmail`, assert called with student email) |

Full suite must stay green (≥ 573 total).

---

## Acceptance Criteria

1. After a student buys public content, the coach sees a bell notification: **"New content sale — [StudentName] purchased "[Title]" for $X.XX"**
2. Coach Earnings module shows a non-zero **Content** figure equal to the sum of all `content_purchases.amountPaidCents` for that coach's items.
3. Student receives a receipt email to their registered address with item title, coach name, amount paid, and date.
4. All three post-purchase side-effects are wrapped in `try/catch` — a notification or email failure must never cause `confirmStorefrontPurchase` to throw.
5. `pnpm test` passes with ≥ 573 tests.

---

## Opus Review Checklist

- [ ] Notification type `"new_content_sale"` added to schema enum AND migration run
- [ ] `getCoachContentEarnings` uses a proper Drizzle join (not raw SQL) to avoid SQL injection
- [ ] Single DB round-trip for the post-purchase data fetch (no N+1)
- [ ] Email send wrapped in try/catch, failure logged but not re-thrown
- [ ] `contentEarningsCents` flows from `db.ts` → `routers.ts` → frontend without type errors
- [ ] `EarningsModule` renders the live value with `formatCurrency`, not a hardcoded string
- [ ] 8 new tests, full suite ≥ 573
