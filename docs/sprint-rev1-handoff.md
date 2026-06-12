# Sprint S-REV-1 Handoff — Reviews Table Schema Fix

## Summary

Both coach and student review submissions fail with:

```
Failed query: insert into `reviews` (`id`, `lessonId`, `reviewerId`, `revieweeId`,
`reviewerType`, `rating`, `comment`, `knowledgeRating`, `communicationRating`,
`preparednessRating`, `isVisible`, `visibleAt`, `isPublic`, `createdAt`) values
(default, ?, ?, ?, ?, ?, ?, ?, ?, ?, default, ?, default, default)
params: 330001,1,990004,coach,5,test,5
```

The INSERT references `reviewerId`, `revieweeId`, `reviewerType` — columns that **do not exist** in the live database.

---

## Root Cause

**Schema drift between migration 0001 and the current `drizzle/schema.ts`.**

### Live DB (migration 0001 — what actually exists):
```sql
CREATE TABLE `reviews` (
  `id` int AUTO_INCREMENT NOT NULL,
  `lessonId` int NOT NULL,
  `studentId` int NOT NULL,
  `coachId` int NOT NULL,
  `rating` int NOT NULL,
  `comment` text,
  `knowledgeRating` int,
  `communicationRating` int,
  `preparednessRating` int,
  `isPublic` boolean DEFAULT true,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `reviews_id` PRIMARY KEY(`id`),
  CONSTRAINT `reviews_lessonId_unique` UNIQUE(`lessonId`)
);
```

Note: `isVisible` and `visibleAt` were added manually via ALTER TABLE but the original columns `studentId` and `coachId` still exist.

### Current `drizzle/schema.ts` (wrong — does not match live DB):
```ts
export const reviews = mysqlTable("reviews", {
  id: int("id").autoincrement().primaryKey(),
  lessonId: int("lessonId").notNull(),
  reviewerId: int("reviewerId").notNull(),   // ← WRONG: column doesn't exist
  revieweeId: int("revieweeId").notNull(),   // ← WRONG: column doesn't exist
  reviewerType: mysqlEnum("reviewerType", ["student", "coach"]).notNull(), // ← WRONG
  ...
});
```

---

## Fix Strategy

**Do NOT rename or drop existing columns** — data may exist. Instead, revert the schema to match the live DB.

### Step 1: Fix `drizzle/schema.ts`

Replace the reviews table definition with one that matches the live DB exactly:

```ts
export const reviews = mysqlTable("reviews", {
  id: int("id").autoincrement().primaryKey(),
  lessonId: int("lessonId").notNull(),

  // Participants — stored directly (role is implicit from context)
  studentId: int("studentId").notNull(),
  coachId: int("coachId").notNull(),

  rating: int("rating").notNull(),
  comment: text("comment"),

  // Detailed ratings
  knowledgeRating: int("knowledgeRating"),
  communicationRating: int("communicationRating"),
  preparednessRating: int("preparednessRating"),

  // Airbnb-style hidden reviews until both submit
  isVisible: boolean("isVisible").default(false),
  visibleAt: timestamp("visibleAt"),

  isPublic: boolean("isPublic").default(true),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
```

Remove `reviewerType` from the schema entirely — it's not needed because the role is always determinable from context (the caller is either the lesson's student or the lesson's coach).

### Step 2: Fix `server/db.ts`

**`createReview`** — update the `InsertReview` type usage. The caller must now pass `studentId` and `coachId` directly:

```ts
export async function createReview(data: {
  lessonId: number;
  studentId: number;
  coachId: number;
  rating: number;
  comment?: string;
  knowledgeRating?: number;
  communicationRating?: number;
  preparednessRating?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(reviews).values(data);
  // Update coach stats after new review
  await updateCoachStats(data.coachId);
  return result;
}
```

**`getReviewByLessonAndReviewer`** — currently queries by `reviewerId`. Change to accept `userId` and check both `studentId` and `coachId`:

```ts
export async function getReviewByLessonAndUser(lessonId: number, userId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(reviews)
    .where(
      and(
        eq(reviews.lessonId, lessonId),
        or(eq(reviews.studentId, userId), eq(reviews.coachId, userId))
      )
    )
    .limit(1);
  return rows[0] || null;
}
```

**`getCounterpartReview`** — currently queries by `reviewerType`. Change to accept `userId` and return the review where the user is NOT the reviewer:

```ts
export async function getCounterpartReview(lessonId: number, userId: number) {
  const db = await getDb();
  if (!db) return null;
  // Return the review where userId is NOT the reviewer
  // i.e., if userId is the student, return the coach's review and vice versa
  const rows = await db
    .select()
    .from(reviews)
    .where(
      and(
        eq(reviews.lessonId, lessonId),
        ne(reviews.studentId, userId),  // not the student reviewer
        ne(reviews.coachId, userId)     // not the coach reviewer — wait, this is wrong
      )
    )
    .limit(1);
  return rows[0] || null;
}
```

Actually the simplest approach: store which side has submitted using a separate approach. Since `studentId` and `coachId` are always the same for a given lesson, the counterpart check should be:

```ts
// If userId === lesson.studentId → look for a review where studentId = lesson.studentId AND coachId = lesson.coachId
// but where the COACH submitted (i.e., the review was submitted by the coach)
// Problem: we can't tell who submitted without reviewerType
```

**IMPORTANT NOTE:** The `reviewerType` column is actually needed to distinguish "which side submitted this review" since both the student and coach reviews for the same lesson will have the same `studentId` and `coachId` values. Without `reviewerType`, we can't tell which party submitted which review.

### Revised Fix Strategy

Keep `reviewerType` but add it as a column to the **live DB** via a new migration, rather than removing it from the schema. The issue is that the column was in the schema but never migrated to the live DB.

**Correct approach:**

1. Keep `drizzle/schema.ts` as-is (with `reviewerId`, `revieweeId`, `reviewerType`)
2. The live DB already has these columns added manually (via the ALTER TABLE I ran earlier)
3. The real problem is that `pnpm db:push` was never run after the schema was updated, so the Drizzle migration journal is out of sync with the live DB
4. Run `pnpm db:push` — it should detect the columns already exist and produce a no-op or minimal diff

**BUT** — the live DB still has `studentId` and `coachId` as NOT NULL columns. The new schema doesn't include them. Drizzle may try to DROP those columns, which would break existing data.

### Safest Fix Strategy

**Revert the schema to use `studentId`/`coachId` AND add `reviewerType` as a separate nullable column:**

```ts
export const reviews = mysqlTable("reviews", {
  id: int("id").autoincrement().primaryKey(),
  lessonId: int("lessonId").notNull(),

  // Original columns — always present
  studentId: int("studentId").notNull(),
  coachId: int("coachId").notNull(),

  // Which side submitted this review
  reviewerType: mysqlEnum("reviewerType", ["student", "coach"]).notNull(),

  rating: int("rating").notNull(),
  comment: text("comment"),

  knowledgeRating: int("knowledgeRating"),
  communicationRating: int("communicationRating"),
  preparednessRating: int("preparednessRating"),

  isVisible: boolean("isVisible").default(false),
  visibleAt: timestamp("visibleAt"),
  isPublic: boolean("isPublic").default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
```

This schema matches the live DB (which has all these columns) and preserves `reviewerType` for counterpart detection.

### Step 3: Fix `server/db.ts` helpers

**`createReview`**:
```ts
export async function createReview(data: {
  lessonId: number;
  studentId: number;
  coachId: number;
  reviewerType: "student" | "coach";
  rating: number;
  comment?: string;
  knowledgeRating?: number;
  communicationRating?: number;
  preparednessRating?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(reviews).values(data);
  if (data.reviewerType === "student") {
    await updateCoachStats(data.coachId);
  }
  return result;
}
```

**`getReviewByLessonAndReviewer`** — rename to `getReviewByLessonAndUser`, query by `studentId` or `coachId` based on `reviewerType`:
```ts
export async function getReviewByLessonAndUser(
  lessonId: number,
  userId: number,
  reviewerType: "student" | "coach"
) {
  const db = await getDb();
  if (!db) return null;
  const col = reviewerType === "student" ? reviews.studentId : reviews.coachId;
  const rows = await db
    .select()
    .from(reviews)
    .where(and(eq(reviews.lessonId, lessonId), eq(col, userId), eq(reviews.reviewerType, reviewerType)))
    .limit(1);
  return rows[0] || null;
}
```

**`getCounterpartReview`** — same signature as before, works correctly:
```ts
export async function getCounterpartReview(
  lessonId: number,
  reviewerType: "student" | "coach"
) {
  const otherType = reviewerType === "student" ? "coach" : "student";
  const rows = await db.select().from(reviews)
    .where(and(eq(reviews.lessonId, lessonId), eq(reviews.reviewerType, otherType)))
    .limit(1);
  return rows[0] || null;
}
```

### Step 4: Fix `server/routers.ts` — `review.submit` procedure

The procedure currently calls `createReview` with `reviewerId`/`revieweeId`/`reviewerType`. Update to use `studentId`/`coachId`/`reviewerType`:

```ts
await db.createReview({
  lessonId: input.lessonId,
  studentId: lesson.studentId,
  coachId: lesson.coachId,
  reviewerType,
  rating: input.rating,
  comment: input.comment || "",
  knowledgeRating: input.knowledgeRating,
  communicationRating: input.communicationRating,
  preparednessRating: input.preparednessRating,
});
```

Also update the duplicate-check call:
```ts
// Replace:
const existing = await db.getReviewByLessonAndReviewer(input.lessonId, ctx.user.id);
// With:
const existing = await db.getReviewByLessonAndUser(input.lessonId, ctx.user.id, reviewerType);
```

### Step 5: Fix `server/routers.ts` — lesson completion review (line ~1470)

There's a second `createReview` call inside the lesson completion flow. Update it similarly:
```ts
await db.createReview({
  lessonId: input.lessonId,
  studentId: ctx.user.id,
  coachId: lesson.coachId,
  reviewerType: 'student',
  rating: input.rating,
  comment: input.comment || '',
});
```

### Step 6: Run `pnpm db:push`

After updating the schema, run `pnpm db:push`. The live DB already has `studentId`, `coachId`, `reviewerType`, `isVisible`, `visibleAt` columns. Drizzle should produce a minimal diff (possibly adding `reviewerType` enum if it wasn't created with the right type).

If `pnpm db:push` tries to DROP `reviewerId`/`revieweeId` columns (which were added manually), that's fine — those columns have no data.

### Step 7: Update `getReviewsByCoach` in `server/db.ts`

```ts
export async function getReviewsByCoach(coachId: number, limit: number = 20) {
  return await db.select().from(reviews)
    .where(and(
      eq(reviews.coachId, coachId),
      eq(reviews.reviewerType, 'student'),  // only student reviews of coaches are public
      eq(reviews.isPublic, true),
      eq(reviews.isVisible, true)
    ))
    .orderBy(desc(reviews.createdAt))
    .limit(limit);
}
```

---

## Files to Change

| File | Change |
|---|---|
| `drizzle/schema.ts` | Revert reviews table to `studentId`/`coachId` + keep `reviewerType` |
| `server/db.ts` | Update `createReview`, `getReviewByLessonAndReviewer` → `getReviewByLessonAndUser`, `getReviewsByCoach` |
| `server/routers.ts` | Update `review.submit` and lesson-completion review call |
| Run `pnpm db:push` | Sync schema with live DB |

## Tests to Update

- Update any existing review tests that use `reviewerId`/`revieweeId` to use `studentId`/`coachId`
- Add a test that verifies a student can submit a review (happy path)
- Add a test that verifies a coach can submit a review (happy path)
- Add a test that verifies duplicate review is rejected

## Do NOT Change

- `PgnViewerModal.tsx` — not related to this bug
- `analysisRouter.ts` — not related to this bug
- Any Sprint 49/50 navigation code
