# Sprint 50 Handoff — PGN Analysis Mode + Send-to-Coach Recap

**Branch:** `claude/code-audit-review-icD40`  
**Baseline:** checkpoint `4c49ac4d` — 376 tests passing, tsc clean  
**Primary file:** `client/src/components/PgnViewerModal.tsx`  
**New files:** `drizzle/schema.ts` (additive), `server/routers/analysis.ts` (new), `server/routers.ts` (import), `client/src/components/AnnotationToolbar.tsx` (new)

---

## Overview

This sprint adds a full **self-analysis mode** to the PGN viewer. When a student opens a PGN (from a lesson, a content item, or a standalone upload), they can:

1. **Toggle analysis mode** — the board becomes interactive; pieces are draggable.
2. **Play moves** — moves played on the board are recorded as new variations from the current position, branching off the existing tree.
3. **Annotate moves** — click any move in the text panel to add a comment; click NAG glyphs (!, ?, !!, ??, !?, ?!) to annotate the selected move.
4. **Save** — the annotated PGN is serialized back to a valid PGN string and saved to the database.
5. **Send to coach** — sends the annotated PGN as a message in the lesson chat, with an optional personal note.

---

## Part 1 — Database Schema (S50-1, S50-2)

Add one new table to `drizzle/schema.ts`:

```ts
/**
 * PGN analyses — student self-analysis sessions.
 * Can be linked to a lesson (lessonId) or a content item (contentItemId),
 * or standalone (both null). coachId is set when the student has a coach
 * to send the recap to.
 */
export const pgnAnalyses = mysqlTable("pgn_analyses", {
  id: int("id").autoincrement().primaryKey(),

  // Context — at least one should be set, both can be null for standalone
  lessonId: int("lessonId"),
  contentItemId: int("contentItemId"),

  // Participants
  studentId: int("studentId").notNull(),
  coachId: int("coachId"), // null if no coach context

  // PGN content
  title: varchar("title", { length: 255 }).notNull(),
  originalPgn: mediumtext("originalPgn").notNull(), // unmodified source PGN
  annotatedPgn: mediumtext("annotatedPgn"),         // student's annotated version

  // Workflow
  status: mysqlEnum("status", ["draft", "sent"]).default("draft").notNull(),
  sentAt: timestamp("sentAt"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PgnAnalysis = typeof pgnAnalyses.$inferSelect;
export type InsertPgnAnalysis = typeof pgnAnalyses.$inferInsert;
```

After adding the table, run:
```bash
pnpm db:push
```

---

## Part 2 — Server Router (S50-3)

Create `server/routers/analysis.ts`:

```ts
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { db } from "../db";
import { pgnAnalyses } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { notifyOwner } from "../_core/notification";
import { TRPCError } from "@trpc/server";

export const analysisRouter = router({
  // Create a new analysis session (or return existing draft for this context)
  create: protectedProcedure
    .input(z.object({
      lessonId: z.number().optional(),
      contentItemId: z.number().optional(),
      coachId: z.number().optional(),
      originalPgn: z.string(),
      title: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await db.insert(pgnAnalyses).values({
        lessonId: input.lessonId ?? null,
        contentItemId: input.contentItemId ?? null,
        studentId: ctx.user.id,
        coachId: input.coachId ?? null,
        title: input.title,
        originalPgn: input.originalPgn,
        annotatedPgn: null,
        status: "draft",
      });
      return { id: row.insertId };
    }),

  // Save the current annotated PGN (auto-creates if analysisId is 0)
  save: protectedProcedure
    .input(z.object({
      id: z.number(),
      annotatedPgn: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const existing = await db.query.pgnAnalyses.findFirst({
        where: and(eq(pgnAnalyses.id, input.id), eq(pgnAnalyses.studentId, ctx.user.id)),
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      await db.update(pgnAnalyses)
        .set({ annotatedPgn: input.annotatedPgn })
        .where(eq(pgnAnalyses.id, input.id));
      return { ok: true };
    }),

  // Send the annotated PGN to the coach as a lesson message
  sendToCoach: protectedProcedure
    .input(z.object({
      id: z.number(),
      note: z.string().optional(), // personal note prepended to the message
    }))
    .mutation(async ({ ctx, input }) => {
      const analysis = await db.query.pgnAnalyses.findFirst({
        where: and(eq(pgnAnalyses.id, input.id), eq(pgnAnalyses.studentId, ctx.user.id)),
      });
      if (!analysis) throw new TRPCError({ code: "NOT_FOUND" });
      if (!analysis.lessonId) throw new TRPCError({ code: "BAD_REQUEST", message: "No lesson context" });
      if (!analysis.coachId) throw new TRPCError({ code: "BAD_REQUEST", message: "No coach context" });

      const pgn = analysis.annotatedPgn ?? analysis.originalPgn;
      const content = input.note ? `${input.note}\n\n${pgn}` : pgn;

      // Insert as a PGN message in the lesson chat
      await db.insert(messages).values({
        lessonId: analysis.lessonId,
        senderId: ctx.user.id,
        contentType: "pgn",
        content,
      });

      // Mark as sent
      await db.update(pgnAnalyses)
        .set({ status: "sent", sentAt: new Date(), annotatedPgn: pgn })
        .where(eq(pgnAnalyses.id, input.id));

      // Notify the coach
      await notifyOwner({
        title: "Student sent you an annotated game",
        content: `${ctx.user.name ?? "A student"} sent an analysis for lesson #${analysis.lessonId}: "${analysis.title}"`,
      });

      return { ok: true };
    }),

  // List all analyses for the current student
  myAnalyses: protectedProcedure
    .query(async ({ ctx }) => {
      return db.query.pgnAnalyses.findMany({
        where: eq(pgnAnalyses.studentId, ctx.user.id),
        orderBy: (t, { desc }) => [desc(t.updatedAt)],
      });
    }),

  // Get a single analysis by ID (student must own it)
  byId: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const row = await db.query.pgnAnalyses.findFirst({
        where: and(eq(pgnAnalyses.id, input.id), eq(pgnAnalyses.studentId, ctx.user.id)),
      });
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      return row;
    }),
});
```

In `server/routers.ts`, import and mount:
```ts
import { analysisRouter } from "./routers/analysis";
// inside appRouter:
analysis: analysisRouter,
```

Also add `messages` to the import from `drizzle/schema` in `analysis.ts`.

---

## Part 3 — PGN Serializer (S50-7)

Add a `serializePgn` function at the top of `PgnViewerModal.tsx` (near `parsePgnTree`). This is the inverse of the parser — it converts the in-memory `PgnNode[]` tree back to a valid PGN string.

```ts
function serializeVariation(nodes: PgnNode[], depth: number = 0): string {
  const parts: string[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const moveNum = node.moveNumber;
    const isBlack = node.san.startsWith("...") || (moveNum !== undefined && i % 2 === 1);
    
    // Move number token
    if (i === 0 || node.color === "w") {
      parts.push(`${moveNum}.${node.color === "b" ? ".." : ""}`);
    }
    
    // SAN + NAGs
    parts.push(node.san + node.nags.map(n => n).join(""));
    
    // Comment
    if (node.comment) {
      parts.push(`{${node.comment}}`);
    }
    
    // Variations (sidelines)
    for (const varNodes of node.variations) {
      if (varNodes.length > 0) {
        parts.push(`(${serializeVariation(varNodes, depth + 1)})`);
      }
    }
  }
  return parts.join(" ");
}

function serializePgn(headers: Record<string, string>, nodes: PgnNode[]): string {
  const headerLines = Object.entries(headers)
    .map(([k, v]) => `[${k} "${v}"]`)
    .join("\n");
  const moves = serializeVariation(nodes);
  const result = headers["Result"] ?? "*";
  return `${headerLines}\n\n${moves} ${result}\n`;
}
```

**Important note on move numbers:** `PgnNode` currently stores `fen` and `san` but may not store `moveNumber` and `color` explicitly. The serializer needs these to reconstruct move number tokens correctly. Two options:

**Option A (preferred):** Add `moveNumber: number` and `color: 'w' | 'b'` fields to `PgnNode` and populate them in `buildPgnTree` from `chess.moveNumber()` and `chess.turn()` (called after `chess.move(san)`).

**Option B (fallback):** Parse the move number from the FEN string — the 5th space-separated token is the full move number, and the 2nd token is the active color ('w'/'b').

Use Option A. Add to `PgnNode`:
```ts
type PgnNode = {
  san: string;
  fen: string;
  from: string;
  to: string;
  nags: string[];
  comment: string;
  variations: PgnNode[][];
  moveNumber: number;   // ADD
  color: 'w' | 'b';    // ADD
};
```

In `buildPgnTree`, after `chess.move(san)`, set:
```ts
node.moveNumber = chess.moveNumber();
node.color = chess.turn() === 'w' ? 'b' : 'w'; // color of the move just played
```

---

## Part 4 — Analysis Mode in PgnViewerModal (S50-4, S50-5, S50-6, S50-8)

### 4.1 New Props

```ts
type PgnViewerModalProps = {
  open: boolean;
  onClose: () => void;
  pgn: string;
  title?: string;
  // Analysis context (optional)
  lessonId?: number;
  coachId?: number;
  analysisId?: number; // if provided, load annotatedPgn from DB
};
```

### 4.2 Analysis Mode State

```ts
const [analysisMode, setAnalysisMode] = useState(false);
const [analysisId, setAnalysisId] = useState<number | null>(props.analysisId ?? null);
const [editingNodePath, setEditingNodePath] = useState<string | null>(null); // node.fen for the node being annotated
const [commentDraft, setCommentDraft] = useState("");
const [selectedNodeForNag, setSelectedNodeForNag] = useState<string | null>(null); // node.fen
```

The PGN tree (`pgnNodes`) is already in state as a result of `parsePgnTree`. In analysis mode, it becomes **mutable** — moves played on the board and annotations added by the user modify it directly via `useState` (the tree is cloned on each mutation to trigger re-render).

### 4.3 Playing Moves in Analysis Mode

When `analysisMode` is true, set `arePiecesDraggable={true}` on the `Chessboard` component and provide an `onPieceDrop` handler:

```ts
const onPieceDrop = useCallback((sourceSquare: string, targetSquare: string, piece: string) => {
  if (!analysisMode) return false;
  
  // Try the move on a chess instance at the current display position
  const chess = new Chess(displayFen);
  const move = chess.move({ from: sourceSquare, to: targetSquare, promotion: "q" });
  if (!move) return false; // illegal move
  
  // Build a new PgnNode for this move
  const newNode: PgnNode = {
    san: move.san,
    fen: chess.fen(),
    from: sourceSquare,
    to: targetSquare,
    nags: [],
    comment: "",
    variations: [],
    moveNumber: chess.moveNumber(),
    color: move.color,
  };
  
  // Insert the new node into the tree:
  // - If we are on the main line at currentIndex, append to pgnNodes as a new variation
  //   of pgnNodes[currentIndex - 1] (or as a new main-line move if at the end)
  // - If we are in a sideline (sidelineCtx !== null), append to sidelineCtx.varArray
  
  setPgnNodes(prev => {
    const tree = deepClone(prev); // structuredClone or JSON parse/stringify
    if (sidelineCtx !== null) {
      // Append to current sideline
      const { varArray, varIndex } = sidelineCtx;
      // varArray is a reference into the tree — we need to find it by identity
      // Use a helper: appendToVariation(tree, varArray[0].fen, newNode)
      appendNodeToVariation(tree, varArray, varIndex + 1, newNode);
    } else {
      // Main line: if currentIndex < pgnNodes.length - 1, this is a new variation
      // of pgnNodes[currentIndex]; otherwise append to main line
      if (currentIndex < tree.length) {
        tree[currentIndex].variations.push([newNode]);
      } else {
        tree.push(newNode);
      }
    }
    return tree;
  });
  
  // Advance to the new position
  if (sidelineCtx !== null) {
    setSidelineCtx(prev => prev ? {
      node: newNode,
      varArray: [...prev.varArray, newNode],
      varIndex: prev.varIndex + 1,
    } : null);
  } else if (currentIndex >= pgnNodes.length - 1) {
    setCurrentIndex(i => i + 1);
  } else {
    setSidelineCtx({
      node: newNode,
      varArray: [newNode],
      varIndex: 0,
    });
  }
  
  return true;
}, [analysisMode, displayFen, sidelineCtx, currentIndex, pgnNodes]);
```

**Note on `appendNodeToVariation`:** Since `varArray` in `sidelineCtx` is a reference to an array inside the cloned tree, the cleanest approach is to store a unique path (e.g., the FEN of the first node in the variation) and traverse the cloned tree to find the matching array. Alternatively, store the variation's parent node FEN and the variation index.

The simplest correct implementation: after `deepClone(prev)`, re-derive `sidelineCtx` by traversing the new tree using the stored `varArray[0].fen` as a key. This is O(n) but the tree is small.

### 4.4 Annotation Editor (S50-5)

In `MoveList`, when `analysisMode` is true, clicking a move shows an inline comment editor instead of (or in addition to) navigating to that position:

```tsx
// In MoveList button onClick when analysisMode is true:
onClick={() => {
  onSelectNode(node, nodes, idx);
  onEditComment(node.fen); // new prop
}}
```

Below the move button, if `editingNodePath === node.fen`, render:

```tsx
{editingNodePath === node.fen && (
  <div className="flex gap-1 mt-0.5 ml-2">
    <input
      autoFocus
      className="flex-1 text-xs bg-muted/40 border border-border/50 rounded px-1.5 py-0.5 font-sans"
      placeholder="Add comment…"
      value={commentDraft}
      onChange={e => setCommentDraft(e.target.value)}
      onKeyDown={e => {
        if (e.key === "Enter") { onSaveComment(node.fen, commentDraft); setEditingNodePath(null); }
        if (e.key === "Escape") setEditingNodePath(null);
      }}
      onBlur={() => { onSaveComment(node.fen, commentDraft); setEditingNodePath(null); }}
    />
  </div>
)}
```

`onSaveComment(fen, comment)` in `PgnViewerModal` finds the node by FEN in the tree and updates its `.comment` field (deep clone + setState).

### 4.5 NAG Toolbar (S50-6)

Create `client/src/components/AnnotationToolbar.tsx`:

```tsx
const NAGS = [
  { label: "!", nag: "$1", title: "Good move" },
  { label: "?", nag: "$2", title: "Mistake" },
  { label: "!!", nag: "$3", title: "Brilliant move" },
  { label: "??", nag: "$4", title: "Blunder" },
  { label: "!?", nag: "$5", title: "Interesting move" },
  { label: "?!", nag: "$6", title: "Dubious move" },
  { label: "=", nag: "$10", title: "Equal position" },
  { label: "±", nag: "$16", title: "White is better" },
  { label: "∓", nag: "$17", title: "Black is better" },
];

export function AnnotationToolbar({
  activeNags,
  onToggleNag,
}: {
  activeNags: string[];
  onToggleNag: (nag: string) => void;
}) {
  return (
    <div className="flex gap-1 flex-wrap">
      {NAGS.map(({ label, nag, title }) => (
        <button
          key={nag}
          title={title}
          onClick={() => onToggleNag(nag)}
          className={`text-xs font-mono px-2 py-1 rounded border transition-colors ${
            activeNags.includes(nag)
              ? "bg-primary/20 border-primary/50 text-primary"
              : "border-border/40 text-muted-foreground hover:border-border hover:text-foreground"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
```

In `PgnViewerModal`, show `AnnotationToolbar` below the board when `analysisMode` is true and a node is selected (`sidelineCtx !== null` or `currentIndex > 0`). `activeNags` comes from the currently selected node's `.nags` array. `onToggleNag` clones the tree, finds the node, and toggles the NAG.

### 4.6 Analysis Mode Toggle + Save Button (S50-4, S50-8)

Add to the nav button row:

```tsx
{/* Analysis mode toggle */}
<Button
  variant={analysisMode ? "default" : "outline"}
  size="sm"
  onClick={() => setAnalysisMode(m => !m)}
  className="gap-1.5 text-xs ml-auto"
  title={analysisMode ? "Exit analysis mode" : "Enter analysis mode — play moves and annotate"}
>
  <Pencil className="h-3.5 w-3.5" />
  {analysisMode ? "Analysing" : "Analyse"}
</Button>

{analysisMode && (
  <Button
    variant="outline"
    size="sm"
    onClick={handleSave}
    className="gap-1.5 text-xs"
  >
    <Save className="h-3.5 w-3.5" />
    Save
  </Button>
)}
```

`handleSave`:
```ts
const saveMutation = trpc.analysis.save.useMutation();
const createMutation = trpc.analysis.create.useMutation();

const handleSave = useCallback(async () => {
  const pgn = serializePgn(pgnHeaders, pgnNodes);
  
  let id = analysisId;
  if (!id) {
    // First save — create the record
    const res = await createMutation.mutateAsync({
      lessonId: props.lessonId,
      coachId: props.coachId,
      originalPgn: props.pgn,
      title: props.title ?? "Untitled Analysis",
    });
    id = res.id;
    setAnalysisId(id);
  }
  
  await saveMutation.mutateAsync({ id, annotatedPgn: pgn });
  toast.success("Analysis saved");
}, [analysisId, pgnNodes, pgnHeaders, props]);
```

`pgnHeaders` is a new state: `const [pgnHeaders, setPgnHeaders] = useState<Record<string, string>>({})`. Populate it in `parsePgnTree` by extracting `[Key "Value"]` header lines from the raw PGN string before parsing.

---

## Part 5 — Send-to-Coach Dialog (S50-9)

Add a "Send to Coach" button next to Save (only when `props.coachId` is set and `analysisId !== null`):

```tsx
{analysisMode && props.coachId && analysisId && (
  <Button
    variant="outline"
    size="sm"
    onClick={() => setSendDialogOpen(true)}
    className="gap-1.5 text-xs"
  >
    <Send className="h-3.5 w-3.5" />
    Send to Coach
  </Button>
)}
```

The send dialog:
```tsx
<Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
  <DialogContent className="sm:max-w-md">
    <DialogHeader>
      <DialogTitle>Send Analysis to Coach</DialogTitle>
      <DialogDescription>
        Your annotated game will be sent as a message in your lesson chat.
      </DialogDescription>
    </DialogHeader>
    <Textarea
      placeholder="Add a personal note (optional)…"
      value={sendNote}
      onChange={e => setSendNote(e.target.value)}
      rows={3}
    />
    <DialogFooter>
      <Button variant="outline" onClick={() => setSendDialogOpen(false)}>Cancel</Button>
      <Button onClick={handleSendToCoach} disabled={sendMutation.isPending}>
        {sendMutation.isPending ? "Sending…" : "Send"}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

`handleSendToCoach`:
```ts
const sendMutation = trpc.analysis.sendToCoach.useMutation();

const handleSendToCoach = async () => {
  // Save first to ensure annotatedPgn is current
  await handleSave();
  await sendMutation.mutateAsync({ id: analysisId!, note: sendNote || undefined });
  setSendDialogOpen(false);
  setSendNote("");
  toast.success("Analysis sent to your coach!");
};
```

---

## Part 6 — Load Saved Analysis (S50-10)

When `props.analysisId` is provided, load the annotated PGN from the DB instead of `props.pgn`:

```ts
const { data: savedAnalysis } = trpc.analysis.byId.useQuery(
  { id: props.analysisId! },
  { enabled: !!props.analysisId }
);

// Use savedAnalysis.annotatedPgn ?? props.pgn as the source PGN for parsePgnTree
const sourcePgn = savedAnalysis?.annotatedPgn ?? props.pgn;
```

Re-parse whenever `sourcePgn` changes (already handled by the existing `useEffect` on `pgn`).

---

## Summary of New Files and Changes

| File | Change |
|---|---|
| `drizzle/schema.ts` | Add `pgnAnalyses` table |
| `server/routers/analysis.ts` | New router: create, save, sendToCoach, myAnalyses, byId |
| `server/routers.ts` | Import and mount `analysisRouter` |
| `client/src/components/AnnotationToolbar.tsx` | New component: NAG glyph toggle buttons |
| `client/src/components/PgnViewerModal.tsx` | Analysis mode toggle, onPieceDrop, comment editor, NAG toolbar, save/send buttons, pgnHeaders state, serializePgn, load saved analysis |

---

## Verification

```bash
pnpm db:push    # must complete without error
pnpm test       # must still be 376 passing
pnpm check      # tsc exits 0
```

Manual smoke test:
1. Open a PGN. Click "Analyse" — board becomes interactive (pieces draggable).
2. Play a move — it appears as a new variation in the PGN text panel.
3. Click the new move — comment input appears. Type a comment, press Enter — comment appears in italic.
4. Click a NAG glyph (!) — it appears next to the move in the text panel.
5. Click Save — toast "Analysis saved". Reopen the viewer — the annotated PGN is loaded.
6. Click "Send to Coach" — dialog opens. Add a note, click Send — toast "Analysis sent". Check the lesson chat — the PGN message appears.

---

## Important: Do NOT Change

- The UCI state machine (`pendingFenRef`, `searchingRef`, `dispatchSearch`, `bestmove` gate, watchdog).
- The `parsePgnTree`/`buildPgnTree`/`tokenizePgn` functions (only ADD `moveNumber`/`color` fields to `PgnNode`).
- The `--board-size` CSS var, `sm:max-w-[96vw]`, or the board wrapper sizing.
- The eval bar, `onMouseDownCapture` focus-ring suppressor, `SidelineContext` navigation.
- The `data-active` + `moveListRef` + scroll effect (S49-31).
- Any existing lesson/payment/booking server routes.
