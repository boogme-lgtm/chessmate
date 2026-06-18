# S-STOREFRONT-1 — Coach Content Upload & Access Control

**Sprint goal:** Give coaches a fully functional "Your Content" section where they can upload, manage, and sell content — with three distinct audience modes: public storefront, specific-student-only, and request fulfillment.

---

## Context

The `content_items` table and `content_purchases` table already exist. The `content.list`, `content.getById`, and `content.recordPurchase` tRPC procedures already exist. The `StorefrontModule` in `CoachDashboard.tsx` is currently a placeholder toast. The `ContentLibraryModule` in `StudentDashboard.tsx` is also a placeholder with a `// TODO: wire to trpc.content.listOwned` comment.

---

## 1. Schema changes — `pnpm db:push` required

### 1a. Add two columns to `content_items`

```ts
// drizzle/schema.ts — inside contentItems table definition
accessType: mysqlEnum("accessType", ["public", "student_only", "request_fulfillment"])
  .default("public")
  .notNull(),
targetStudentId: int("targetStudentId"),  // nullable — only set when accessType = "student_only"
```

**`accessType` semantics:**
- `"public"` — visible on the coach's public storefront, purchasable by anyone
- `"student_only"` — visible only to a specific student (targetStudentId), not on public storefront; student can download without paying (treat as free gift)
- `"request_fulfillment"` — linked to a content request via `content_requests.contentItemId`; visible only to the requesting student; automatically unlocked when the request is marked delivered

### 1b. No changes to `content_purchases` — existing table handles all access tracking

---

## 2. New tRPC procedures

All new procedures live in the existing `content: router({...})` block in `server/routers.ts`.

### 2a. `content.listMine` — coach's own content list

```ts
listMine: coachProcedure.query(async ({ ctx }) => {
  // Return ALL content items for this coach (published + unpublished)
  // Include: id, title, kind, accessType, targetStudentId, priceCents, published, publishedAt, createdAt, thumbnailUrl, storageKey
  // Include targetStudentName: join users table on targetStudentId for display
  // Order: createdAt DESC
})
```

### 2b. `content.create` — upload a new content item

```ts
create: coachProcedure
  .input(z.object({
    title: z.string().min(3).max(255),
    description: z.string().max(2000).optional(),
    kind: z.enum(["course", "video", "pdf", "pgn", "bundle"]),
    accessType: z.enum(["public", "student_only", "request_fulfillment"]),
    targetStudentId: z.number().optional(),  // required when accessType = "student_only"
    contentRequestId: z.number().optional(), // required when accessType = "request_fulfillment"
    priceCents: z.number().int().min(0).max(500000).default(0),
    fileBase64: z.string(),     // base64-encoded file content (same pattern as coach profile photo)
    fileName: z.string(),       // original filename for extension detection
    thumbnailBase64: z.string().optional(),
    previewContent: z.string().max(2000).optional(),
  }))
  .mutation(async ({ ctx, input }) => {
    // 1. Validate: if accessType = "student_only", targetStudentId must be set and must be one of the coach's active students
    // 2. Validate: if accessType = "request_fulfillment", contentRequestId must be set, request must belong to this coach, and request must be in "in_progress" or "payment_collected" status
    // 3. Decode base64 → Buffer, call storagePut with key `coach-content/${ctx.user.id}/${nanoid()}.${ext}`
    // 4. If thumbnailBase64 provided, upload thumbnail similarly
    // 5. INSERT into content_items with published = false (coach must explicitly publish)
    // 6. If accessType = "request_fulfillment", UPDATE content_requests SET contentItemId = newId WHERE id = contentRequestId
    // 7. Return { id, storageKey, url }
  })
```

**File size limit:** 50 MB. Validate `fileBase64.length * 0.75 <= 52_428_800` before decoding.

**Supported file types by kind:**
- `video`: mp4, mov, webm
- `pdf`: pdf
- `pgn`: pgn, txt
- `course`: zip (bundled course package)
- `bundle`: zip

### 2c. `content.update` — edit metadata (not the file)

```ts
update: coachProcedure
  .input(z.object({
    id: z.number(),
    title: z.string().min(3).max(255).optional(),
    description: z.string().max(2000).optional(),
    priceCents: z.number().int().min(0).max(500000).optional(),
    previewContent: z.string().max(2000).optional(),
    thumbnailBase64: z.string().optional(),
  }))
  .mutation(async ({ ctx, input }) => {
    // Verify ownership: SELECT coachId FROM content_items WHERE id = input.id
    // Update only provided fields
    // If thumbnailBase64 provided, upload new thumbnail and update thumbnailUrl
  })
```

### 2d. `content.publish` — toggle published state

```ts
publish: coachProcedure
  .input(z.object({
    id: z.number(),
    published: z.boolean(),
  }))
  .mutation(async ({ ctx, input }) => {
    // Verify ownership
    // UPDATE content_items SET published = input.published, publishedAt = NOW() WHERE id = input.id AND coachId = ctx.user.id
    // Only allow publishing "public" items — student_only and request_fulfillment items are never published to the public storefront
  })
```

### 2e. `content.delete` — soft delete (unpublish + mark deleted)

```ts
delete: coachProcedure
  .input(z.object({ id: z.number() }))
  .mutation(async ({ ctx, input }) => {
    // Verify ownership
    // If item has purchases, do NOT hard delete — set published = false only and return { deleted: false, unpublished: true }
    // If no purchases, hard DELETE from content_items
    // Return { deleted: true }
  })
```

### 2f. `content.listOwned` — student's purchased/unlocked content

```ts
listOwned: protectedProcedure.query(async ({ ctx }) => {
  // JOIN content_purchases → content_items WHERE content_purchases.userId = ctx.user.id
  // Also include student_only items where content_items.targetStudentId = ctx.user.id (no purchase record needed)
  // Also include request_fulfillment items where the linked content_request.studentId = ctx.user.id AND request status = "delivered"
  // Return: id, title, kind, thumbnailUrl, storageKey (presigned URL via storageGet), unlockedAt, coachName
  // Order: unlockedAt DESC
})
```

### 2g. `content.getDownloadUrl` — get a fresh presigned S3 URL

```ts
getDownloadUrl: protectedProcedure
  .input(z.object({ id: z.number() }))
  .query(async ({ ctx, input }) => {
    // Verify the user has access (owns, purchased, or is targetStudentId)
    // Call storageGet(storageKey, 3600) to get a 1-hour presigned URL
    // Return { url }
  })
```

### 2h. `content.createStorefrontCheckout` — Stripe checkout for public content purchase

```ts
createStorefrontCheckout: protectedProcedure
  .input(z.object({ contentItemId: z.number() }))
  .mutation(async ({ ctx, input }) => {
    // Fetch content item — must be published, accessType = "public", priceCents > 0
    // Verify user hasn't already purchased
    // Create Stripe Checkout Session with:
    //   metadata: { type: "content_item", contentItemId: item.id, buyerId: ctx.user.id }
    //   payment_intent_data.transfer_data.destination = coach's stripeAccountId
    //   payment_intent_data.application_fee_amount = Math.round(item.priceCents * PLATFORM_FEE_RATE)
    //   success_url: /dashboard?section=content-library&purchase=success
    //   cancel_url: /dashboard?section=content-library
    // Return { url }
  })
```

**Webhook handler addition** in `server/webhooks.ts`:
```ts
// In handleCheckoutCompleted, add before the lesson fallback:
if (session.metadata?.type === 'content_item') {
  await handleContentItemCheckoutCompleted(session);
  return;
}

async function handleContentItemCheckoutCompleted(session: Stripe.Checkout.Session) {
  const contentItemId = parseInt(session.metadata!.contentItemId, 10);
  const buyerId = parseInt(session.metadata!.buyerId, 10);
  const paymentIntentId = typeof session.payment_intent === 'string'
    ? session.payment_intent
    : session.payment_intent?.id;
  // INSERT INTO content_purchases (contentItemId, userId, unlockMethod, amountPaidCents, stripePaymentIntentId)
  // VALUES (contentItemId, buyerId, 'purchase', session.amount_total, paymentIntentId)
  // ON DUPLICATE KEY IGNORE
  // Notify student: "Your content is ready to download"
}
```

---

## 3. Coach UI — StorefrontModule overhaul

**File:** `client/src/pages/CoachDashboard.tsx` — replace the `StorefrontModule` function.

### Layout

```
┌─────────────────────────────────────────────────────────┐
│  Your Content                          [+ Upload]        │
│                                                          │
│  [Public (3)]  [Student-Specific (1)]  [Requests (2)]   │  ← tab filter
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │ 🎬  Caro-Kann Masterclass          $29.00  [●]   │   │
│  │     video · 45 min · Published               [⋮] │   │
│  ├──────────────────────────────────────────────────┤   │
│  │ 📄  Sicilian PGN Pack              Free    [○]   │   │
│  │     pgn · Draft                          [⋮]    │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

- **Tab filter:** All | Public | Student-Specific | Request Fulfillment
- **Each row:** kind icon, title, price, publish toggle (●/○), kebab menu (Edit / Delete)
- **Publish toggle:** only enabled for `accessType = "public"` items; student_only and request_fulfillment rows show a lock icon instead
- **Empty state per tab:** contextual copy

### Upload dialog

Triggered by `[+ Upload]` button. Three-step flow:

**Step 1 — Audience**
```
Who is this content for?
○ Public storefront — anyone can purchase
○ Specific student — private delivery to one student
○ Content request — fulfill a pending request
```

**Step 2 — Details**
- Title (required)
- Description (optional)
- Kind: Video / PDF / PGN / Course / Bundle (dropdown)
- Price in $ (hidden when audience = "Specific student" or "Content request" — those are always free/included)
- Preview snippet (optional text or URL)
- Thumbnail (optional image upload)
- If audience = "Specific student": student picker (dropdown of coach's active students)
- If audience = "Content request": request picker (dropdown of in_progress requests, showing student name + title)

**Step 3 — File upload**
- File input with drag-and-drop
- Show accepted extensions based on kind selection
- Progress bar during upload (base64 encode → mutation)
- On success: close dialog, invalidate `content.listMine`, show toast "Content uploaded"

### Edit dialog
- Pre-populated form with title, description, price, preview
- Thumbnail re-upload optional
- No file re-upload (file is immutable after creation)

---

## 4. Student UI — ContentLibraryModule overhaul

**File:** `client/src/pages/StudentDashboard.tsx` — replace the `ContentLibraryModule` function.

```
┌─────────────────────────────────────────────────────────┐
│  Content Library                    [Browse Store →]     │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │ 🎬  Caro-Kann Masterclass                        │   │
│  │     from GM Elena Petrov · video          [↓]    │   │
│  ├──────────────────────────────────────────────────┤   │
│  │ 📄  Custom PGN Pack for Cristian                 │   │
│  │     from GM Elena Petrov · pgn            [↓]    │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  Empty state: "Your library is empty. Purchase content   │
│  from your coach's storefront to build your chess        │
│  library."                                               │
└─────────────────────────────────────────────────────────┘
```

- Wire to `trpc.content.listOwned.useQuery()`
- `[↓]` download button calls `trpc.content.getDownloadUrl.useQuery({ id })` on click, then `window.open(url)`
- `[Browse Store →]` link navigates to the coach's public storefront page (future sprint — for now show toast "Coming soon")

---

## 5. Stripe helper addition

In `server/stripe.ts`, add a `createContentItemCheckoutSession` function following the same pattern as `createLessonCheckoutSession`:

```ts
export async function createContentItemCheckoutSession({
  contentItem,
  buyer,
  coachStripeAccountId,
  platformFeeRate,
  baseUrl,
}: {
  contentItem: { id: number; title: string; priceCents: number; currency: string };
  buyer: { id: number; email: string };
  coachStripeAccountId: string;
  platformFeeRate: number;
  baseUrl: string;
}): Promise<{ url: string }> {
  // Stripe.checkout.sessions.create with:
  //   mode: "payment"
  //   metadata: { type: "content_item", contentItemId: contentItem.id, buyerId: buyer.id }
  //   payment_intent_data.transfer_data.destination = coachStripeAccountId
  //   payment_intent_data.application_fee_amount = Math.round(contentItem.priceCents * platformFeeRate)
  //   success_url / cancel_url
}
```

---

## 6. db.ts helpers needed

Add to `server/db.ts`:

```ts
// Insert a new content item
export async function createContentItem(data: InsertContentItem): Promise<number>

// Get all content items for a coach (all access types, published + unpublished)
export async function getContentItemsByCoach(coachId: number): Promise<ContentItem[]>

// Get all content items owned/unlocked by a student
export async function getOwnedContentItems(userId: number): Promise<Array<ContentItem & { unlockedAt: Date; coachName: string }>>

// Update content item fields
export async function updateContentItem(id: number, coachId: number, data: Partial<InsertContentItem>): Promise<void>

// Delete content item (hard delete — caller must verify no purchases first)
export async function deleteContentItem(id: number, coachId: number): Promise<void>

// Toggle published state
export async function setContentItemPublished(id: number, coachId: number, published: boolean): Promise<void>

// Check if user has access to a content item
export async function userHasContentAccess(userId: number, contentItemId: number): Promise<boolean>
```

---

## 7. Test file: `server/sprint-storefront1.test.ts`

Write a new test file covering:

1. `content.create` — coach can upload a public item
2. `content.create` — coach can upload a student_only item (valid student)
3. `content.create` — coach cannot upload student_only item for a non-student
4. `content.create` — coach can upload request_fulfillment item (valid in_progress request)
5. `content.publish` — coach can publish a public item
6. `content.publish` — coach cannot publish a student_only item (should throw)
7. `content.listMine` — returns all items for the coach
8. `content.listOwned` — student sees purchased items
9. `content.listOwned` — student sees student_only items without purchase record
10. `content.listOwned` — student sees request_fulfillment items after request is delivered
11. `content.delete` — hard delete when no purchases
12. `content.delete` — soft delete (unpublish only) when purchases exist

---

## 8. Files to change

| File | Change |
|---|---|
| `drizzle/schema.ts` | Add `accessType` and `targetStudentId` to `contentItems` |
| `server/db.ts` | Add 7 new db helpers |
| `server/routers.ts` | Add 7 new procedures to `content` router |
| `server/stripe.ts` | Add `createContentItemCheckoutSession` |
| `server/webhooks.ts` | Add `content_item` type handler in `handleCheckoutCompleted` |
| `client/src/pages/CoachDashboard.tsx` | Replace `StorefrontModule` |
| `client/src/pages/StudentDashboard.tsx` | Replace `ContentLibraryModule` |
| `server/sprint-storefront1.test.ts` | New test file (12 tests) |

**Run `pnpm db:push` after schema changes.**

---

## 9. Notes for Claude

- The base64 upload pattern is already used for coach profile photos — follow the same approach in `server/routers.ts` (decode → Buffer → `storagePut`)
- `storagePut` is in `server/storage.ts` and is already imported in routers.ts
- `coachProcedure` is already defined — use it for all coach-only mutations
- The `PLATFORM_FEE_RATE` constant is in `shared/pricing.ts`
- The coach's `stripeAccountId` is on `coach_profiles.stripeAccountId` — fetch via `db.getCoachProfileByUserId(ctx.user.id)`
- Free items (`priceCents = 0`) should skip Stripe entirely — `content.create` should auto-insert a `content_purchases` row with `unlockMethod = "free"` for the coach themselves, and for student_only items, insert the purchase row for `targetStudentId` immediately on creation
- Do not implement the public storefront browse page in this sprint — the `[Browse Store →]` button in the student library can show a "Coming soon" toast for now
