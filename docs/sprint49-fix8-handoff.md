# Sprint 49 Fix-8 Handoff — Board Size (Definitive), NAG $11, Last-Move Highlight

**Branch:** `claude/code-audit-review-icD40`  
**File to change:** `client/src/components/PgnViewerModal.tsx` (914 lines)  
**Baseline:** checkpoint `85d298ab` — 376 tests passing, tsc clean  
**Do NOT touch:** engine UCI state machine (lines 438–656), `parsePgnTree`/`buildPgnTree`/`tokenizePgn`, eval bar internals, or any server-side code.

---

## Issue S49-25 — Board Still Too Small (Definitive Fix)

### Root Cause Analysis

The current layout (line 718):
```tsx
<div className="flex-1 flex gap-1.5 min-w-0 self-start justify-center">
```

**`self-start` is the killer.** In a flex row, `self-start` means the cross-axis size (height) of this column collapses to its content's natural height. The board wrapper inside it uses:
```tsx
style={{ width: "min(calc(100% - 18px), calc(90vh - 8rem))" }}
```

`calc(100% - 18px)` resolves to `(left column width - 18px)`. The left column's width is determined by `flex-1` — that part is correct. But `self-start` means the left column has no intrinsic height, so `100%` inside the board wrapper refers to the column's *width*, not the available height. On a 1440px-wide dialog, `flex-1` gives the column ~1100px of width, so `calc(100% - 18px) ≈ 1082px` — a 1082×1082 board that overflows vertically. The browser then clips it to the dialog's height, making the board appear tiny.

The `calc(90vh - 8rem)` branch should win on most screens (90vh ≈ 810px on a 900px screen → 810-128 = 682px), but the `min()` picks the *smaller* of the two, and on wide screens the `100%` branch is smaller only if the column is narrower than ~700px — which it isn't on desktop.

### The Definitive Fix

**Stop fighting CSS percentages. Use a concrete pixel size derived from the dialog height.**

The dialog is `h-[90vh]`. The header is ~56px, the nav row is ~40px, the flip row is ~32px, the engine panel is ~80px, gaps are ~32px. Total non-board height ≈ 240px. So the board can safely be `calc(90vh - 240px)` tall, capped at `calc(90vw - 340px)` wide (dialog width minus right panel minus eval bar minus gaps).

**Replace lines 718–791 (left column + eval bar + board wrapper) with:**

```tsx
{/* Left column: eval bar + board — board is a fixed CSS square */}
<div className="shrink-0 flex gap-1.5 items-start">
  {/* Eval bar — height matches the board via CSS variable */}
  <div
    className="w-3 shrink-0 rounded-sm overflow-hidden relative"
    style={{
      height: "var(--board-size)",
      backgroundColor: "#151B22",
    }}
    title={`Engine evaluation: ${evalLabel(evaluation)}`}
  >
    <div
      className="absolute bottom-0 left-0 right-0 transition-[height] duration-300"
      style={{ height: `${evalPct}%`, backgroundColor: BRAND }}
    />
    <div
      className="absolute left-0 right-0"
      style={{
        top: "50%",
        height: "2px",
        backgroundColor: "rgba(244,239,230,0.4)",
        zIndex: 2,
      }}
    />
  </div>
  {/* Board — explicit CSS square, never overflows dialog */}
  <div style={{ width: "var(--board-size)", height: "var(--board-size)" }}>
    <Chessboard
      options={{
        position: displayFen,
        boardOrientation,
        allowDragging: false,
        arrows,
        lastMove: lastMoveSquares,
        boardStyle: {
          display: "grid",
          gridTemplateColumns: "repeat(8, 1fr)",
          overflow: "hidden",
          width: "100%",
          height: "auto",
          position: "relative",
        },
        darkSquareStyle: { backgroundColor: "#1A2C3D" },
        lightSquareStyle: { backgroundColor: "#C8B89A" },
        alphaNotationStyle: {
          fontSize: "9px",
          position: "absolute",
          bottom: 1,
          right: 3,
          userSelect: "none",
        },
        numericNotationStyle: {
          fontSize: "9px",
          position: "absolute",
          top: 1,
          left: 2,
          userSelect: "none",
        },
        darkSquareNotationStyle: { color: "rgba(200,184,154,0.7)" },
        lightSquareNotationStyle: { color: "rgba(26,44,61,0.7)" },
      }}
    />
  </div>
</div>
```

**Add the CSS variable to the DialogContent** (line 695):

```tsx
<DialogContent
  className="max-w-[96vw] w-full h-[90vh] flex flex-col overflow-hidden p-6"
  style={{
    "--board-size": "min(calc(90vh - 240px), calc(96vw - 340px))",
  } as React.CSSProperties}
>
```

**Update the main area flex container** (line 712) — remove `self-start` from the left column since we're no longer using it:

```tsx
<div className="flex-1 flex flex-col sm:flex-row gap-4 overflow-hidden min-h-0">
```

This is unchanged. The left column no longer needs `flex-1` or `self-start` — it's `shrink-0` with an explicit size.

**Why this works:** `--board-size` is computed once at the dialog level from viewport units, not from the column's percentage width. The board is always `min(90vh-240px, 96vw-340px)` — the largest square that fits both the dialog height and the dialog width minus the right panel. On a 1440×900 screen: `min(810-240, 1382-340) = min(570, 1042) = 570px`. On a 1280×800 screen: `min(720-240, 1229-340) = min(480, 889) = 480px`. Both are correct and visible.

---

## Issue S49-26 — NAG $11 Shows Raw Text

### Root Cause

The `NAG_GLYPHS` map (lines 133–138) is missing NAG 11. The full FIDE/PGN standard defines:

- `$11` = `=` (equal position) — same as `$10` but specifically "equal chances, quiet position"
- `$12` = `=` (equal chances, active position)

The current map has `10: "="` but not `11` or `12`. When the tokenizer encounters `$11`, it falls through to the `?? tok` fallback in `buildPgnTree` line 264:
```ts
const glyph = NAG_GLYPHS[parseInt(tok.slice(1), 10)] ?? tok;
```
`tok` is `"$11"` — so it renders literally as `$11`.

### The Fix

**Replace the `NAG_GLYPHS` constant (lines 133–138) with the complete standard set:**

```ts
const NAG_GLYPHS: Record<number, string> = {
  1: "!", 2: "?", 3: "!!", 4: "??", 5: "!?", 6: "?!",
  7: "□", 8: "□",
  10: "=", 11: "=", 12: "=",
  13: "∞", 14: "⩲", 15: "⩱", 16: "±", 17: "∓",
  18: "+-", 19: "-+",
  20: "-+", 21: "+-",
  22: "⨀", 23: "⨀",
  32: "⟳", 33: "⟳",
  36: "→", 37: "→",
  40: "↑", 41: "↑",
  44: "⌓", 45: "⌓",
  132: "⇆", 133: "⇆",
  138: "⊕", 139: "⊕",
  140: "△", 141: "△",
  142: "⌓", 143: "⌓",
  145: "RR", 146: "N",
};
```

Also change the fallback in `buildPgnTree` line 264 so unknown NAGs render as empty string instead of raw `$N`:

```ts
const glyph = NAG_GLYPHS[parseInt(tok.slice(1), 10)] ?? "";
if (glyph && nodes.length > 0) nodes[nodes.length - 1].nags.push(glyph);
```

(The `if (glyph && ...)` guard replaces the old `if (nodes.length > 0)` guard.)

---

## Issue S49-27 — Last-Move Highlight Doesn't Follow Navigation

### Root Cause

The `react-chessboard` v5 `Chessboard` component has a `lastMove` option (or `lastMoveSquares`) that highlights the from/to squares of the most recently played move. Currently the component is not passing this prop at all — the highlight you see is the browser's `:focus` or `:hover` state on the square element, not a controlled prop. That's why it stays on whichever square you last touched with the mouse.

### The Fix

**Step 1: Derive `lastMoveSquares` from `displayFen`.**

The FEN alone doesn't encode the last move. We need to track it separately. Add a `lastMoveSquares` state:

```ts
const [lastMoveSquares, setLastMoveSquares] = useState<{ from: string; to: string } | null>(null);
```

**Step 2: Update `lastMoveSquares` whenever `displayFen` changes.**

The cleanest approach: store the last move alongside the FEN. Modify `parsePgnTree` to return `moves` (the from/to pairs for each main-line move) alongside `fens`:

```ts
// In parsePgnTree, after building nodes:
const moves: Array<{ from: string; to: string } | null> = [null]; // index 0 = start position, no last move
for (const node of nodes) {
  // Reconstruct from/to from the FEN transition using chess.js
  // Actually simpler: re-walk the main line and capture moveResult.from/to
  moves.push(null); // placeholder — see below
}
```

Actually the simplest approach is to store `from`/`to` directly on `PgnNode`. Add two fields to the type:

```ts
type PgnNode = {
  // ... existing fields ...
  from: string;  // e.g. "e2"
  to: string;    // e.g. "e4"
};
```

In `buildPgnTree`, the `moveResult` from `chess.move(tok)` already has `.from` and `.to`. Add them to the node:

```ts
nodes.push({
  id: `node-${_nodeCounter++}`,
  fen: chess.fen(),
  san: moveResult.san,
  from: moveResult.from,
  to: moveResult.to,
  // ... rest unchanged
});
```

In `parsePgnTree`, build a parallel `lastMoves` array:

```ts
const lastMoves: Array<{ from: string; to: string } | null> = [null];
for (const node of nodes) lastMoves.push({ from: node.from, to: node.to });
return { nodes, fens, lastMoves, headers };
```

Add `lastMoves` to the state:

```ts
const [lastMoves, setLastMoves] = useState<Array<{ from: string; to: string } | null>>([null]);
```

In the parse effect, set it:

```ts
setLastMoves(newLastMoves);
```

**Step 3: Derive `lastMoveSquares` from `displayFen`.**

For the main line, `lastMoveSquares = lastMoves[currentIndex]`. For a sideline click (`selectedFen !== null`), find the node whose FEN matches `selectedFen` in the full tree (a helper function, or just store it on `selectFen`):

```ts
// In selectFen callback, also track the last move:
const selectFen = useCallback((fen: string, from: string, to: string) => {
  setSelectedFen(fen);
  setSelectedLastMove({ from, to });
}, []);
```

Add `selectedLastMove` state:
```ts
const [selectedLastMove, setSelectedLastMove] = useState<{ from: string; to: string } | null>(null);
```

Derive the final value:
```ts
const lastMoveSquares = selectedFen !== null
  ? selectedLastMove
  : lastMoves[currentIndex] ?? null;
```

**Step 4: Update `MoveList` to pass `from`/`to` to `onSelectFen`.**

Change the `onSelectFen` signature:
```ts
onSelectFen: (fen: string, from: string, to: string) => void;
```

In the button onClick:
```tsx
onClick={() =>
  depth === 0
    ? onSelectMainline(idx + 1)
    : onSelectFen(node.fen, node.from, node.to)
}
```

**Step 5: Pass `lastMove` to Chessboard.**

In the Chessboard options:
```tsx
options={{
  position: displayFen,
  lastMove: lastMoveSquares
    ? { from: lastMoveSquares.from, to: lastMoveSquares.to }
    : undefined,
  // ... rest unchanged
}}
```

**Step 6: Clear `selectedLastMove` on keyboard navigation.**

In the keyboard handler, add `setSelectedLastMove(null)` alongside `setSelectedFen(null)`.

In `goTo`, add `setSelectedLastMove(null)` alongside `setSelectedFen(null)`.

---

## Summary of All Changes

All changes are in `client/src/components/PgnViewerModal.tsx`:

| Item | Change |
|------|--------|
| S49-25 Board size | `--board-size` CSS var on DialogContent; left column `shrink-0`; board wrapper uses `var(--board-size)`; eval bar height uses `var(--board-size)`; remove `self-start`/`flex-1`/`min-w-0`/`justify-center` from left column |
| S49-26 NAG $11 | Expand `NAG_GLYPHS` to cover 11, 12, and other common codes; fallback to `""` not raw token |
| S49-27 Last-move highlight | Add `from`/`to` to `PgnNode`; `lastMoves[]` array from `parsePgnTree`; `selectedLastMove` state; `lastMoveSquares` derived value; pass to `Chessboard` options; clear on navigation |

No backend changes. No new npm packages. No changes to engine logic.

---

## Verification

```bash
pnpm test    # must still be 376 passing
pnpm check   # tsc exits 0
```

Manual smoke test:
1. Open an annotated PGN. Board should be ~500-600px wide on a typical laptop.
2. Navigate with arrow keys — the orange last-move highlight squares should follow each move.
3. Click a sideline move — highlight should show the sideline move's squares.
4. `g6$11` should render as `g6=` (or just `g6` if you prefer to suppress `=`), never `g6$11`.
5. Board should not change size when navigating.

---

## Important: Do NOT Change

- The UCI state machine (`pendingFenRef`, `searchingRef`, `dispatchSearch`, `bestmove` gate, watchdog).
- The `parsePgnTree`/`buildPgnTree`/`tokenizePgn` logic (only add `from`/`to` fields to `PgnNode` and `lastMoves` to the return value).
- The eval bar fill direction, midpoint notch, or `evalToPercent`/`evalLabel` functions.
- The `MoveList` recursive renderer structure (only update the `onSelectFen` signature).
- Any server-side files.
