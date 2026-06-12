# Sprint 50 Fix-1 Handoff — Coach Analysis Support

**Items:** S50-F1, S50-F2  
**Checkpoint base:** `0efa7ac5`  
**Files to touch:** `server/analysisRouter.ts`, `server/db.ts`, `client/src/components/PgnViewerModal.tsx`  
**Files to NOT touch:** UCI state machine, board sizing CSS vars, SidelineContext navigation, eval bar, focus-ring suppressor, `serializePgn`, `parsePgnTree`

---

## Problem Summary

From the coach's dashboard, opening the PGN viewer and clicking **Save** or **Analyse** throws `"Not your lesson"` (FORBIDDEN). Two root causes:

1. **Server:** `analysisRouter.create` checks `lesson.studentId !== ctx.user.id` — coaches are always rejected. The db helpers `updatePgnAnalysis`, `getPgnAnalysisById` filter by `studentId` only, so even if a coach analysis row existed, the coach couldn't read or update it.

2. **Frontend:** The `PgnViewerModal` has no concept of who opened it. The button always says "Send to Coach" regardless of whether the viewer was opened by a student or a coach.

---

## Part 1 — New prop: `viewerRole`

Add `viewerRole?: "student" | "coach"` to `PgnViewerModalProps` (default `"student"`).

```ts
interface PgnViewerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pgn: string;
  lessonId?: number;
  analysisId?: number;
  viewerRole?: "student" | "coach";  // NEW — defaults to "student"
}
```

Destructure it in the component function with default:

```ts
viewerRole = "student" as const,
```

---

## Part 2 — DB helpers (server/db.ts)

Add two new helpers alongside the existing student-scoped ones. Do NOT modify the existing helpers — the student path must remain unchanged.

```ts
/** Fetch one analysis by id, scoped to the coach who owns it. */
export async function getPgnAnalysisByIdForCoach(id: number, coachId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(pgnAnalyses)
    .where(and(eq(pgnAnalyses.id, id), eq(pgnAnalyses.coachId, coachId)))
    .limit(1);
  return rows[0] ?? null;
}

/** Update the annotated PGN, scoped to the coach. Returns false if not found/not owned. */
export async function updatePgnAnalysisForCoach(
  id: number,
  coachId: number,
  annotatedPgn: string
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const result: any = await db
    .update(pgnAnalyses)
    .set({ annotatedPgn, updatedAt: new Date() })
    .where(and(eq(pgnAnalyses.id, id), eq(pgnAnalyses.coachId, coachId)));
  return (result[0]?.affectedRows ?? 0) > 0;
}

/** List all analyses where the caller is the coach, most recently updated first. */
export async function listPgnAnalysesByCoach(coachId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(pgnAnalyses)
    .where(eq(pgnAnalyses.coachId, coachId))
    .orderBy(desc(pgnAnalyses.updatedAt));
}
```

---

## Part 3 — Analysis router (server/analysisRouter.ts)

### 3a. `create` — allow coaches

Replace the current ownership check block:

```ts
// CURRENT (student-only):
if (lesson.studentId !== ctx.user.id) {
  throw new TRPCError({ code: "FORBIDDEN", message: "Not your lesson" });
}
coachId = lesson.coachId;
```

With a dual-role check:

```ts
const isStudent = lesson.studentId === ctx.user.id;
const isCoach   = lesson.coachId   === ctx.user.id;
if (!isStudent && !isCoach) {
  throw new TRPCError({ code: "FORBIDDEN", message: "Not your lesson" });
}
coachId = lesson.coachId;
```

Also fix the `createPgnAnalysis` call — when the caller is the coach, `studentId` must be the lesson's student (not the coach), and `coachId` is the caller:

```ts
const { id } = await db.createPgnAnalysis({
  lessonId: input.lessonId ?? null,
  contentItemId: input.contentItemId ?? null,
  studentId: isCoach ? lesson.studentId : ctx.user.id,
  coachId,
  title: input.title,
  originalPgn: input.originalPgn,
  annotatedPgn: null,
  status: "draft",
});
```

### 3b. `save` — try student ownership, then coach ownership

```ts
save: protectedProcedure
  .input(z.object({ id: z.number(), annotatedPgn: z.string().min(1).max(500_000) }))
  .mutation(async ({ ctx, input }) => {
    // Try student ownership first, then coach ownership.
    let updated = await db.updatePgnAnalysis(input.id, ctx.user.id, input.annotatedPgn);
    if (!updated) {
      updated = await db.updatePgnAnalysisForCoach(input.id, ctx.user.id, input.annotatedPgn);
    }
    if (!updated) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Analysis not found" });
    }
    return { ok: true };
  }),
```

### 3c. `byId` — try student ownership, then coach ownership

```ts
byId: protectedProcedure
  .input(z.object({ id: z.number() }))
  .query(async ({ ctx, input }) => {
    let row = await db.getPgnAnalysisById(input.id, ctx.user.id);
    if (!row) row = await db.getPgnAnalysisByIdForCoach(input.id, ctx.user.id);
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Analysis not found" });
    return row;
  }),
```

### 3d. `myAnalyses` — return both student and coach analyses

```ts
myAnalyses: protectedProcedure.query(async ({ ctx }) => {
  const [asStudent, asCoach] = await Promise.all([
    db.listPgnAnalysesByStudent(ctx.user.id),
    db.listPgnAnalysesByCoach(ctx.user.id),
  ]);
  // Merge and deduplicate (a row can't be both), sort by updatedAt desc.
  const seen = new Set<number>();
  const merged = [...asStudent, ...asCoach]
    .filter(r => { if (seen.has(r.id)) return false; seen.add(r.id); return true; })
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return merged;
}),
```

### 3e. `sendToCoach` — dual-direction send

Rename the procedure to `sendToRecipient` internally but keep the tRPC key as `sendToCoach` for backwards compatibility (the frontend already calls `trpc.analysis.sendToCoach`).

The logic: if the caller is the student → send to coach (existing behavior). If the caller is the coach → send to student.

```ts
sendToCoach: protectedProcedure
  .input(z.object({ id: z.number(), note: z.string().max(2000).optional() }))
  .mutation(async ({ ctx, input }) => {
    // Resolve the analysis — try student ownership, then coach ownership.
    let analysis = await db.getPgnAnalysisById(input.id, ctx.user.id);
    const callerIsCoach = !analysis;
    if (!analysis) analysis = await db.getPgnAnalysisByIdForCoach(input.id, ctx.user.id);
    if (!analysis) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Analysis not found" });
    }
    if (!analysis.lessonId) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "No lesson context for this analysis" });
    }

    // Determine recipient: coach sends to student, student sends to coach.
    const recipientId = callerIsCoach ? analysis.studentId : analysis.coachId;
    if (!recipientId) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "No recipient for this analysis" });
    }

    const pgn = analysis.annotatedPgn ?? analysis.originalPgn;

    if (input.note?.trim()) {
      await db.createMessage({
        lessonId: analysis.lessonId,
        senderId: ctx.user.id,
        contentType: "text",
        content: input.note.trim(),
      });
    }
    await db.createMessage({
      lessonId: analysis.lessonId,
      senderId: ctx.user.id,
      contentType: "pgn",
      content: pgn,
    });

    await db.markPgnAnalysisSent(input.id, pgn);

    // Best-effort email to the recipient.
    (async () => {
      try {
        const recipient = await db.getUserById(recipientId);
        if (!recipient?.email) return;
        const senderLabel = ctx.user.name ?? (callerIsCoach ? "Your coach" : "Your student");
        const recipientLabel = callerIsCoach ? "student" : "coach";
        await sendEmail({
          to: recipient.email,
          subject: `${senderLabel} sent you an annotated game`,
          html: `<p>${senderLabel} sent you an annotated game: <strong>${analysis.title}</strong>.</p><p>Open your lesson chat to review it on the analysis board.</p>`,
        });
      } catch (err) {
        console.error(`[analysis.sendToCoach] recipient email failed for analysis ${input.id}:`, err);
      }
    })();

    return { ok: true };
  }),
```

---

## Part 4 — Frontend (PgnViewerModal.tsx)

### 4a. Button label

Find the "Send to Coach" button (line ~1461). Change it to:

```tsx
{viewerRole === "coach" ? "Send to Student" : "Send to Coach"}
```

### 4b. Tooltip label (if any)

If there is a tooltip on the send button, update it to match.

### 4c. No other frontend changes needed

The `trpc.analysis.sendToCoach` mutation call stays the same — the server now handles direction automatically based on who owns the analysis row.

---

## Tests to add (server/sprint50fix1.test.ts)

1. Coach on their own lesson can `create` an analysis (returns `{ id }`)
2. Coach can `save` the analysis they created
3. Coach can `byId` their own analysis
4. Coach calling `sendToCoach` posts a message and the recipient is the student
5. Student calling `sendToCoach` still works (regression)
6. A third party (neither student nor coach) gets FORBIDDEN on `create`, `save`, `byId`

---

## DO NOT TOUCH

- UCI state machine (`useEffect` with `stockfishRef`, `engineReady`, `pendingFen`, `handleEngineMessage`)
- Board sizing CSS vars (`--board-size`)
- `SidelineContext` navigation (`sidelineCtx`, `handleRightArrow`, `chooseBranch`)
- `serializePgn` and `parsePgnTree`
- The `pnpm db:push` migration — no schema change is needed (the `coachId` column already exists in `pgn_analyses`)
