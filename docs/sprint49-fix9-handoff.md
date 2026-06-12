# Sprint 49 Fix-9 Handoff — Last-Move Frame + Branch Choice Popup

**Branch:** `claude/code-audit-review-icD40`  
**File to change:** `client/src/components/PgnViewerModal.tsx` (914 lines)  
**Baseline:** checkpoint `af9540d0` — 376 tests passing, tsc clean  
**Do NOT touch:** engine UCI state machine, `parsePgnTree`/`buildPgnTree`/`tokenizePgn`, eval bar internals, board sizing CSS vars, or any server-side code.

---

## Issue S49-28 — White Click-Frame Persists on Wrong Square

### Root Cause

The screenshot shows a white square outline (a CSS `outline` or `box-shadow` ring) on a square that was last mouse-clicked, independent of the orange `squareStyles` tint. This is react-chessboard v5's **internal click-selection state** — it tracks the last clicked square internally and renders a ring via its own CSS, completely separate from the `squareStyles` prop.

Looking at the v5 source, the internal ring is applied as a `box-shadow` or `outline` on the square's inner div. The `squareStyles` prop adds a style to an *overlay* div inside the square, so the two layers are independent — the orange tint appears on the overlay, the white ring appears on the square itself.

**The fix has two parts:**

**Part 1 — Suppress the internal click ring.** Add `onSquareClick` to the Chessboard options with an empty handler. This prevents v5 from updating its internal "selected square" state on click, which removes the white ring:

```tsx
onSquareClick: () => {}, // suppress internal click-selection ring (S49-28)
```

**Part 2 — Ensure the orange tint is visible.** The `squareStyles` overlay div needs `pointerEvents: 'none'` and must be on top. Check that the existing `lastMoveStyle` uses a visible opacity. The current `rgba(232, 99, 58, 0.35)` is correct but verify it renders. If the internal ring is suppressed, the orange tint should be clearly visible.

**Exact change:** In the Chessboard `options` object (around line 811), add after `squareStyles`:

```tsx
onSquareClick: () => {},
```

That's the entire fix for S49-28.

---

## Issue S49-29 — Branch Choice Popup on Right-Arrow at Bifurcation

### Design

When the user presses `→` (right arrow) and the **current main-line node has variations**, show a small popup listing all candidate continuations:
- The main-line next move (always first)
- Each sideline's first move (in order)

The user clicks/presses a move to navigate to it. If the user presses `→` again without choosing (or presses `Escape`), default to the main line.

This matches how Lichess and ChessBase handle bifurcations during keyboard navigation.

### Implementation

**Step 1: Add branch-choice state.**

```ts
// State for the branch-choice popup
const [branchChoices, setBranchChoices] = useState<Array<{
  label: string;    // SAN of the first move (e.g. "Be7")
  fen: string;      // FEN after this move
  from: string;     // for last-move highlight
  to: string;
  isMainLine: boolean;
}> | null>(null);
```

**Step 2: Compute bifurcation at the current position.**

A bifurcation exists when `pgnNodes[currentIndex]` (the node we just navigated TO, i.e. the current position) has `.variations.length > 0`. Wait — actually we need to check the node we're about to advance FROM. The current position is `fens[currentIndex]`. The next main-line move is `pgnNodes[currentIndex]` (since `fens[0]` = start, `fens[1]` = after move 0, so `pgnNodes[currentIndex]` is the node for the move that leads to `fens[currentIndex + 1]`).

More precisely: `pgnNodes` is 0-indexed and `fens` is 0-indexed with `fens[0]` = start. So:
- `fens[i]` = position after `pgnNodes[i-1]`
- `pgnNodes[i]` = the move that leads from `fens[i]` to `fens[i+1]`

When the user is at `currentIndex` and presses `→`:
- The next main-line move is `pgnNodes[currentIndex]` (if it exists)
- Bifurcation: `pgnNodes[currentIndex]?.variations.length > 0`

Wait — that's wrong. `pgnNodes[currentIndex]` is the move that was played to REACH `fens[currentIndex]`. The variations on `pgnNodes[currentIndex]` are alternatives to `pgnNodes[currentIndex]` itself, not alternatives to the next move.

Let me re-read the tree structure. In `buildPgnTree`, `node.variations` are branches that start from the position BEFORE this node (i.e. `parentFen`). So `pgnNodes[i].variations` = sidelines that could have been played instead of `pgnNodes[i]`.

So when the user is at position `fens[currentIndex]` and presses `→`:
- The next main-line move is `pgnNodes[currentIndex]` (leads to `fens[currentIndex + 1]`)
- Sideline alternatives are `pgnNodes[currentIndex].variations` — each is an array of nodes, and `variations[j][0]` is the first move of sideline j

A bifurcation exists when `pgnNodes[currentIndex]` exists AND `pgnNodes[currentIndex].variations.length > 0`.

**Step 3: Update the right-arrow handler.**

```ts
const handleRightArrow = useCallback(() => {
  setSelectedFen(null);
  setSelectedLastMove(null);
  
  const nextNode = pgnNodes[currentIndex];
  if (!nextNode) return; // already at end
  
  if (nextNode.variations.length > 0) {
    // Bifurcation — build the choice list
    const choices = [
      // Main line first
      {
        label: nextNode.san + (nextNode.nags.length > 0 ? nextNode.nags.join('') : ''),
        fen: nextNode.fen,
        from: nextNode.from,
        to: nextNode.to,
        isMainLine: true,
      },
      // Then each sideline's first move
      ...nextNode.variations.map((varNodes) => {
        const firstNode = varNodes[0];
        return {
          label: firstNode.san + (firstNode.nags.length > 0 ? firstNode.nags.join('') : ''),
          fen: firstNode.fen,
          from: firstNode.from,
          to: firstNode.to,
          isMainLine: false,
        };
      }),
    ];
    setBranchChoices(choices);
  } else {
    // No bifurcation — advance normally
    setCurrentIndex((i) => Math.min(fens.length - 1, i + 1));
  }
}, [currentIndex, pgnNodes, fens.length]);
```

**Step 4: Handle branch choice selection.**

```ts
const chooseBranch = useCallback((choice: typeof branchChoices extends null ? never : NonNullable<typeof branchChoices>[0]) => {
  setBranchChoices(null);
  if (choice.isMainLine) {
    setCurrentIndex((i) => Math.min(fens.length - 1, i + 1));
  } else {
    // Sideline: use selectFen to jump to that position
    setSelectedFen(choice.fen);
    setSelectedLastMove({ from: choice.from, to: choice.to });
  }
}, [fens.length]);
```

Simplify the type — just use the inline shape:

```ts
const chooseBranch = useCallback((choice: {
  label: string; fen: string; from: string; to: string; isMainLine: boolean;
}) => {
  setBranchChoices(null);
  if (choice.isMainLine) {
    setCurrentIndex((i) => Math.min(fens.length - 1, i + 1));
  } else {
    setSelectedFen(choice.fen);
    setSelectedLastMove({ from: choice.from, to: choice.to });
  }
}, [fens.length]);
```

**Step 5: Update the keyboard handler.**

Replace the `ArrowRight` handler in the `useEffect` (line 700):

```ts
// OLD:
if (e.key === "ArrowRight") { e.preventDefault(); leaveSideline(); setCurrentIndex((i) => Math.min(fens.length - 1, i + 1)); }

// NEW:
if (e.key === "ArrowRight") { e.preventDefault(); handleRightArrow(); }
if (e.key === "Escape") { if (branchChoices) { e.preventDefault(); setBranchChoices(null); setCurrentIndex((i) => Math.min(fens.length - 1, i + 1)); } }
```

The `useEffect` dependency array needs `handleRightArrow` and `branchChoices` added.

**Step 6: Render the branch-choice popup.**

Import `Popover`, `PopoverContent`, `PopoverTrigger` from `@/components/ui/popover`. The popup should appear anchored to the navigation controls (the `←` `→` button row), triggered programmatically when `branchChoices !== null`.

Since `Popover` needs a trigger element, use `open={branchChoices !== null}` with a zero-size trigger div positioned near the `→` button:

```tsx
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
```

In the navigation controls row (around line 820), wrap the `→` button area:

```tsx
{/* Branch choice popup — appears when right-arrow hits a bifurcation */}
<Popover open={branchChoices !== null} onOpenChange={(open) => { if (!open) setBranchChoices(null); }}>
  <PopoverTrigger asChild>
    <Button
      variant="outline"
      size="icon"
      onClick={() => handleRightArrow()}
      aria-label="Next move"
    >
      <ChevronRight className="h-4 w-4" />
    </Button>
  </PopoverTrigger>
  {branchChoices && (
    <PopoverContent
      className="w-auto p-1"
      side="top"
      align="center"
      onOpenAutoFocus={(e) => e.preventDefault()}
    >
      <div className="text-xs text-muted-foreground px-2 py-1 font-sans">
        Choose continuation:
      </div>
      {branchChoices.map((choice, i) => (
        <button
          key={i}
          onClick={() => chooseBranch(choice)}
          className={`
            block w-full text-left text-xs px-3 py-1.5 rounded
            hover:bg-muted/60 font-mono
            ${choice.isMainLine ? 'font-semibold' : 'text-muted-foreground'}
          `}
          style={choice.isMainLine ? { color: BRAND } : undefined}
          autoFocus={i === 0}
        >
          {choice.isMainLine ? '★ ' : '  '}{choice.label}
        </button>
      ))}
    </PopoverContent>
  )}
</Popover>
```

**Also update the `→` button in the nav row** — the existing `<Button ... onClick={() => goTo(currentIndex + 1)}>` should be replaced with the above Popover-wrapped version. The `⟨` `⟩` buttons (first/last) stay as-is.

**Step 7: Handle `Escape` to dismiss and default to main line.**

Already covered in Step 5. When the user presses `Escape` with `branchChoices` open, dismiss the popup and advance to the main-line next move.

---

## Summary of All Changes

All changes are in `client/src/components/PgnViewerModal.tsx`:

| Item | Change |
|------|--------|
| S49-28 White frame | Add `onSquareClick: () => {}` to Chessboard options |
| S49-29 Branch popup — state | Add `branchChoices` state |
| S49-29 Branch popup — logic | Add `handleRightArrow` callback; add `chooseBranch` callback |
| S49-29 Branch popup — keyboard | Replace `ArrowRight` handler; add `Escape` handler; update deps |
| S49-29 Branch popup — UI | Import `Popover`; replace `→` button with Popover-wrapped version |

New import needed:
```ts
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
```

No backend changes. No new npm packages. No changes to engine logic.

---

## Verification

```bash
pnpm test    # must still be 376 passing
pnpm check   # tsc exits 0
```

Manual smoke test:
1. Open a PGN with sidelines (e.g. the Najdorf chapter). Navigate with `→` to a move that has a variation. A popup should appear listing the main-line move (starred, orange) and each sideline first move.
2. Click a sideline move — board and engine should jump to that position, orange tint on the from/to squares.
3. Press `Escape` — popup dismisses, main line advances.
4. Click any square on the board — no white ring should appear.
5. Navigate with `→`/`←` — orange tint follows the current move's squares.

---

## Important: Do NOT Change

- The UCI state machine (`pendingFenRef`, `searchingRef`, `dispatchSearch`, `bestmove` gate, watchdog).
- The `parsePgnTree`/`buildPgnTree`/`tokenizePgn` functions or `PgnNode` type.
- The `--board-size` CSS var, `sm:max-w-[96vw]`, or the board wrapper sizing.
- The eval bar fill direction, midpoint notch, or `evalToPercent`/`evalLabel`.
- The `MoveList` recursive renderer (sideline clicks already work correctly).
- Any server-side files.
