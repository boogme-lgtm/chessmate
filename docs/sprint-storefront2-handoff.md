# S-STOREFRONT-2 — Public Storefront on Coach Detail Page

**Sprint goal:** Surface a coach's public content catalogue directly on their public profile page, and wire the student dashboard "Browse Store" button to the right coach's store. No new schema changes — everything builds on what S-STOREFRONT-1 already shipped.

---

## Context

S-STOREFRONT-1 shipped the coach-side upload/manage/publish flow and the student Content Library with download. What is missing:

1. **`content.list` leaks private items** — the SQL query at line 2202 of `server/routers.ts` does not filter by `accessType = 'public'`. Any `student_only` or `request_fulfillment` item that a coach accidentally publishes will appear in the public list. This is a data-privacy bug that must be fixed first.

2. **CoachDetail page has no storefront section** — `client/src/pages/CoachDetail.tsx` shows bio, stats, specialisations, availability, online presence, video intro, and reviews, but nothing about purchasable content.

3. **"Browse Store" button in StudentDashboard is a toast stub** — `client/src/pages/StudentDashboard.tsx` line ~2075 has `onClick={() => toast.info("Store coming soon")}`. It should navigate to the student's primary coach's profile page (which will now have the store section).

---

## 1. Server fix — `content.list` must filter `accessType = 'public'`

**File:** `server/routers.ts` — the `list` procedure starting at line 2202.

Change the SQL query to add `AND accessType = 'public'` so private items can never leak through the public endpoint:

```ts
// BEFORE (line ~2215):
const result: any = await database.execute(sql`
  SELECT id, coachId, title, description, kind, thumbnailUrl,
         priceCents, currency, previewContent, publishedAt
  FROM content_items
  WHERE published = 1
    ${coachFilter}
    ${kindFilter}
  ORDER BY publishedAt DESC
  LIMIT ${limit}
`);

// AFTER:
const result: any = await database.execute(sql`
  SELECT id, coachId, title, description, kind, thumbnailUrl,
         priceCents, currency, previewContent, publishedAt
  FROM content_items
  WHERE published = 1
    AND accessType = 'public'
    ${coachFilter}
    ${kindFilter}
  ORDER BY publishedAt DESC
  LIMIT ${limit}
`);
```

No schema change, no migration needed.

---

## 2. CoachDetail page — "Store" section

**File:** `client/src/pages/CoachDetail.tsx`

### 2a. Add the `content.list` query

Add this query near the other `trpc.*` hooks at the top of the `CoachDetail` component (around line 107):

```ts
const { data: storeItems, isLoading: storeLoading } = trpc.content.list.useQuery(
  { coachId, limit: 20 },
  { enabled: coachId > 0 }
);
```

Also add a `utils` reference for the checkout redirect:

```ts
const utils = trpc.useUtils();
const [checkoutPending, setCheckoutPending] = useState<number | null>(null);
```

### 2b. Add the Store section card

Insert the following JSX **between the "Video Introduction" card and the "Reviews" card** (around line 507 — after the `</Card>` that closes the video intro block, before the `{reviews && reviews.length > 0 && (`):

```tsx
{/* Store */}
{(storeLoading || (storeItems && storeItems.length > 0)) && (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <ShoppingBag className="h-5 w-5" />
        Store
      </CardTitle>
    </CardHeader>
    <CardContent>
      {storeLoading ? (
        <div className="space-y-3">
          {[...Array(2)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {(storeItems || []).map((item: any) => (
            <StoreItemRow
              key={item.id}
              item={item}
              user={user}
              coachId={coachId}
              checkoutPending={checkoutPending}
              setCheckoutPending={setCheckoutPending}
              utils={utils}
              setLocation={setLocation}
            />
          ))}
        </div>
      )}
    </CardContent>
  </Card>
)}
```

### 2c. Add the `StoreItemRow` component

Add this as a standalone function **below the `CoachDetailSkeleton` function** at the bottom of the file:

```tsx
const KIND_LABELS: Record<string, string> = {
  video: "Video",
  pdf: "PDF",
  pgn: "PGN Pack",
  course: "Course",
  bundle: "Bundle",
};

function StoreItemRow({
  item,
  user,
  coachId,
  checkoutPending,
  setCheckoutPending,
  utils,
  setLocation,
}: {
  item: any;
  user: any;
  coachId: number;
  checkoutPending: number | null;
  setCheckoutPending: (id: number | null) => void;
  utils: any;
  setLocation: (path: string) => void;
}) {
  const handleBuy = async () => {
    if (!user) {
      setLocation(`/sign-in?redirect=/coach/${coachId}`);
      return;
    }
    setCheckoutPending(item.id);
    try {
      const { url } = await utils.client.content.createStorefrontCheckout.mutate({
        contentItemId: item.id,
      });
      if (url) window.location.href = url;
    } catch (err: any) {
      toast.error(err?.message || "Could not start checkout");
    } finally {
      setCheckoutPending(null);
    }
  };

  const price =
    item.priceCents > 0
      ? `$${(item.priceCents / 100).toFixed(2)}`
      : "Free";

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-border/40 hover:border-border/70 transition-colors">
      {item.thumbnailUrl ? (
        <img
          src={item.thumbnailUrl}
          alt={item.title}
          className="h-12 w-12 rounded object-cover shrink-0"
        />
      ) : (
        <div className="h-12 w-12 rounded bg-muted flex items-center justify-center shrink-0">
          <BookOpen className="h-5 w-5 text-muted-foreground" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{item.title}</p>
        <p className="text-xs text-muted-foreground">
          {KIND_LABELS[item.kind] ?? item.kind}
          {item.description ? ` · ${item.description.slice(0, 60)}${item.description.length > 60 ? "…" : ""}` : ""}
        </p>
      </div>
      <Button
        size="sm"
        variant={item.priceCents > 0 ? "default" : "outline"}
        disabled={checkoutPending === item.id}
        onClick={handleBuy}
        className="shrink-0"
      >
        {checkoutPending === item.id ? "…" : price}
      </Button>
    </div>
  );
}
```

### 2d. Add `ShoppingBag` to the lucide-react import

The current import block starts at line 7. Add `ShoppingBag` to the list:

```ts
import {
  Star, Clock, Globe, Award, BookOpen, Shield,
  ChevronLeft, Calendar, ExternalLink, Video,
  ShoppingBag,   // ← add this
} from "lucide-react";
```

---

## 3. StudentDashboard — wire "Browse Store" button

**File:** `client/src/pages/StudentDashboard.tsx`

The `ContentLibraryModule` component (line ~2049) currently has no props. It needs to know the student's primary coach so the "Browse Store" button can link to that coach's profile.

### 3a. Pass `coaches` prop to `ContentLibraryModule`

In the `StudentDashboardContent` render, change:

```tsx
// BEFORE (line ~287):
<ContentLibraryModule />

// AFTER:
<ContentLibraryModule coaches={studentCoaches} />
```

### 3b. Update `ContentLibraryModule` signature and button

```tsx
// BEFORE:
function ContentLibraryModule() {
  // ...
  <button
    className="text-xs text-ember hover:text-ember/80 transition-colors"
    onClick={() => toast.info("Store coming soon")}
  >
    Browse Store
  </button>

// AFTER:
function ContentLibraryModule({ coaches }: { coaches: { id: number; name: string }[] }) {
  const [, setLocation] = useLocation();
  // ...
  const primaryCoachId = coaches[0]?.id ?? null;
  // ...
  <button
    className="text-xs text-ember hover:text-ember/80 transition-colors"
    onClick={() => {
      if (primaryCoachId) {
        setLocation(`/coach/${primaryCoachId}`);
      } else {
        setLocation("/coaches");
      }
    }}
  >
    Browse Store
  </button>
```

`useLocation` is already imported at the top of the file.

---

## 4. Tests — `server/sprint-storefront2.test.ts`

Create a new test file. Baseline is 558 tests across 44 files. This sprint must add **≥ 6 new tests** and keep the full suite green.

```ts
/**
 * S-STOREFRONT-2 — public storefront on coach detail page.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

vi.mock("./db");
vi.mock("./emailService");
vi.mock("./nurtureEmailScheduler");
vi.mock("./resendWelcomeEmails");
vi.mock("./_core/notification");

import * as db from "./db";

function anonCtx(): TrpcContext {
  return { user: null, req: { protocol: "https", headers: {} } as any, res: { setHeader: vi.fn() } as any };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("S-STOREFRONT-2 — content.list accessType filter", () => {
  it("1: only returns accessType=public items in the public list", async () => {
    // The DB mock should return a mix; the procedure must filter to public only.
    // Because the filter is now in SQL (not in JS), we verify the SQL string
    // passed to db.execute contains 'accessType' and 'public'.
    // We do this by mocking getDb and capturing the SQL call.
    const mockExecute = vi.fn().mockResolvedValue([[
      { id: 1, coachId: 10, title: "Public Video", kind: "video", priceCents: 1000, accessType: "public", published: 1 },
    ]]);
    vi.mocked(db.getDb).mockResolvedValue({ execute: mockExecute } as any);

    const caller = appRouter.createCaller(anonCtx());
    const res = await caller.content.list({ coachId: 10 });

    // The SQL sent to execute must include accessType = 'public'
    const sqlArg = mockExecute.mock.calls[0][0];
    const sqlStr = String(sqlArg);
    expect(sqlStr).toContain("accessType");
    expect(res).toHaveLength(1);
  });

  it("2: returns empty array when no public items exist for a coach", async () => {
    const mockExecute = vi.fn().mockResolvedValue([[]]);
    vi.mocked(db.getDb).mockResolvedValue({ execute: mockExecute } as any);

    const caller = appRouter.createCaller(anonCtx());
    const res = await caller.content.list({ coachId: 99 });
    expect(res).toHaveLength(0);
  });

  it("3: respects limit parameter", async () => {
    const mockExecute = vi.fn().mockResolvedValue([[]]);
    vi.mocked(db.getDb).mockResolvedValue({ execute: mockExecute } as any);

    const caller = appRouter.createCaller(anonCtx());
    await caller.content.list({ coachId: 10, limit: 5 });

    const sqlArg = mockExecute.mock.calls[0][0];
    const sqlStr = String(sqlArg);
    expect(sqlStr).toContain("5");
  });

  it("4: returns items without coachId filter when coachId is omitted", async () => {
    const mockExecute = vi.fn().mockResolvedValue([[
      { id: 1, coachId: 10, title: "Video A", kind: "video", priceCents: 500, published: 1 },
      { id: 2, coachId: 20, title: "PDF B", kind: "pdf", priceCents: 0, published: 1 },
    ]]);
    vi.mocked(db.getDb).mockResolvedValue({ execute: mockExecute } as any);

    const caller = appRouter.createCaller(anonCtx());
    const res = await caller.content.list();
    expect(res).toHaveLength(2);
  });

  it("5: filters by kind when kind is provided", async () => {
    const mockExecute = vi.fn().mockResolvedValue([[
      { id: 1, coachId: 10, title: "Video A", kind: "video", priceCents: 500, published: 1 },
    ]]);
    vi.mocked(db.getDb).mockResolvedValue({ execute: mockExecute } as any);

    const caller = appRouter.createCaller(anonCtx());
    const res = await caller.content.list({ kind: "video" });

    const sqlArg = mockExecute.mock.calls[0][0];
    const sqlStr = String(sqlArg);
    expect(sqlStr).toContain("video");
    expect(res).toHaveLength(1);
  });

  it("6: returns empty array when database is unavailable", async () => {
    vi.mocked(db.getDb).mockResolvedValue(null as any);

    const caller = appRouter.createCaller(anonCtx());
    const res = await caller.content.list({ coachId: 10 });
    expect(res).toHaveLength(0);
  });
});
```

---

## 5. `todo.md` entries to add

```
- [ ] S-STOREFRONT-2: content.list SQL must filter accessType = 'public' (privacy fix)
- [ ] S-STOREFRONT-2: CoachDetail page — Store section with StoreItemRow + checkout redirect
- [ ] S-STOREFRONT-2: StudentDashboard — "Browse Store" button navigates to primary coach's profile
- [ ] S-STOREFRONT-2: server/sprint-storefront2.test.ts — ≥ 6 tests, full suite green
```

---

## 6. Acceptance criteria

| # | Criterion |
|---|-----------|
| AC-1 | `content.list` SQL includes `AND accessType = 'public'` |
| AC-2 | CoachDetail page shows a "Store" card when `storeItems.length > 0` |
| AC-3 | Each store item shows title, kind badge, price, and a buy/free button |
| AC-4 | Clicking "Buy" on a paid item starts a Stripe checkout redirect; unauthenticated users are sent to `/sign-in?redirect=/coach/:id` |
| AC-5 | "Browse Store" in StudentDashboard navigates to `/coach/:primaryCoachId` (or `/coaches` if no coach yet) |
| AC-6 | `pnpm test` passes with ≥ 564 tests (558 + 6 new) |
| AC-7 | No TypeScript errors (`pnpm build` clean) |

---

## 7. What NOT to do

- Do **not** add a new route or page — the store lives on the existing `/coach/:id` page.
- Do **not** add a `getPublicStoreItems` DB helper — `content.list` with `coachId` filter is sufficient.
- Do **not** implement a "purchase success" page in this sprint — the Stripe webhook already records the purchase; the student will see the item in their Content Library after the redirect.
- Do **not** show the Store section when `storeItems` is an empty array and loading is done — hide the card entirely.
