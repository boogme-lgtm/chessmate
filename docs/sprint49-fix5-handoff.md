# Sprint 49 Fix-5 Handoff — PGN Viewer Layout Overhaul

**Branch:** continue on `claude/code-audit-review-icD40`
**File:** `client/src/components/PgnViewerModal.tsx` only
**Tests:** 376 must still pass, tsc must exit 0

---

## What the User Sees (3 Screenshots Provided)

1. **Screenshot 1 (move 1):** Dialog is wide (~92vw), board is reasonable size, eval bar is below the board and disconnected from it — a tall orange column floating under the board with the label at the top.
2. **Screenshot 2 (move 2):** Same layout, engine at depth 9 (stall still occurring intermittently).
3. **Screenshot 3 (move 3):** Dialog has **shrunk back** to a narrower size — the `max-w-[92vw]` is not being held. Eval bar is still below the board, disconnected.

**Reference (Lichess screenshot provided):** The eval bar is a **thin vertical strip flush to the left edge of the board**, exactly the same height as the board, with a tiny horizontal notch at the 50% midpoint. The board is large and dominates the left side. The move list and engine panel are on the right.

---

## Root Cause Analysis

### S49-17: Dialog shrinks on 3rd move

The `DialogContent` component from shadcn/ui has a default `max-h-[calc(100vh-2rem)]` and `overflow-y-auto`. When the engine panel populates with 3 variation rows (each wrapping to 2 lines), the right column grows taller than the left column (the board). The flex container's height grows. The `DialogContent` then applies its `max-height` constraint and the browser recalculates the dialog's intrinsic width — because the dialog is `max-w-[92vw]` but the **content** is now taller than the viewport allows, the browser may shrink the dialog width to accommodate. 

The real fix is to **give the dialog a fixed height** and make both columns scroll internally, so the dialog dimensions are stable regardless of content.

### S49-18: Eval bar below the board

The current layout is:
```
<div class="flex gap-2 sm:flex-[3]">
  <div class="eval-bar self-stretch">   ← self-stretch means: match the flex container height
  <div class="flex-1 board">
```

`self-stretch` on the eval bar makes it match the **flex container** height, not the **board** height. The flex container is `sm:flex-[3]` inside the outer `flex-col sm:flex-row` — its height is determined by the taller of the two columns (board vs. right panel). When the right panel (move list + engine) is taller than the board, the eval bar stretches to match the right panel height, making it extend far below the board.

### S49-19: Eval bar aesthetics

The label floating at `bottom: ${evalPct}%` looks awkward — it jumps around and can overlap the center line. Lichess doesn't put a label on the bar at all; the eval is shown in the text panel. The bar should be clean: dark background, orange fill from bottom, thin white notch at 50%.

### S49-20: Board too small

The board is `sm:flex-[3]` vs right panel `sm:flex-[2]` — a 3:2 ratio. On a 92vw dialog that's roughly 55% for the board side (including the eval bar). The board itself is `flex-1` inside that, minus the eval bar width. This gives a board of roughly 45–50% of viewport width. It needs to be larger.

---

## The Fix: Complete Layout Restructure

Replace the entire JSX body (everything inside `<DialogContent>`) with a new layout that:

1. Uses a **fixed dialog size** (`max-w-[96vw] h-[90vh]`) so it never shrinks
2. Uses a **two-column grid** (`grid-cols-[auto_1fr]` or explicit pixel columns) for board side vs. right panel
3. The eval bar is **absolutely positioned** or **explicitly sized** to match the board height exactly
4. The right panel has `overflow-y-auto` to scroll internally without affecting dialog size

### New Layout Structure

```
DialogContent: max-w-[96vw] w-full h-[90vh] flex flex-col overflow-hidden
├── DialogHeader (fixed height, shrink-0)
├── Main area: flex-1 flex flex-row gap-4 overflow-hidden min-h-0
│   ├── Left column: flex flex-row gap-1.5 items-start (board + eval bar)
│   │   ├── Eval bar: w-3 self-stretch (height matches board via align-items:stretch on parent)
│   │   └── Board wrapper: flex-1 (board fills available width)
│   └── Right column: w-[280px] shrink-0 flex flex-col gap-3 overflow-y-auto
│       ├── Move list (overflow-y-auto, flex-1)
│       ├── Nav controls (shrink-0)
│       ├── Flip board row (shrink-0)
│       └── Engine panel (shrink-0)
```

**Key points:**
- `h-[90vh]` on DialogContent + `overflow-hidden` = dialog never changes size
- `flex-1 overflow-hidden min-h-0` on the main area = fills remaining height
- The left column uses `items-stretch` (default flex behavior) so the eval bar and board wrapper both stretch to the same height
- `self-stretch` on the eval bar works correctly when the **left column** is the height reference, not the outer container
- The right column is a **fixed width** (`w-[280px]`) with `overflow-y-auto` — it scrolls internally

### Eval Bar (S49-18 + S49-19)

The eval bar should be:
- `w-3` (12px) — thin, like Lichess
- `self-stretch` — fills the exact height of the left column (= board height)
- `rounded-sm overflow-hidden`
- Background: `#151B22`
- Orange fill from bottom: `height: ${evalPct}%` with `backgroundColor: BRAND`
- Center notch: a `2px` wide horizontal line at `top: 50%`, `backgroundColor: rgba(244,239,230,0.4)`, `zIndex: 2`
- **No floating label** — remove the label from the bar entirely. The eval is already shown in the engine status text below.

```tsx
{/* Eval bar — thin strip flush to board left edge */}
<div
  className="w-3 shrink-0 self-stretch rounded-sm overflow-hidden relative"
  style={{ backgroundColor: "#151B22" }}
  title={`Engine evaluation: ${evalLabel(evaluation)}`}
>
  {/* Fill — grows from bottom (white advantage = more orange) */}
  <div
    className="absolute bottom-0 left-0 right-0 transition-[height] duration-300"
    style={{ height: `${evalPct}%`, backgroundColor: BRAND }}
  />
  {/* Midpoint notch */}
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
```

### Board Wrapper (S49-20)

The board wrapper should be `flex-1 min-w-0`. On a `96vw` dialog with a `280px` right panel and `gap-4` (16px) and `gap-1.5` (6px) and `w-3` eval bar (12px), the board gets approximately:
```
96vw - 280px - 16px (gap) - 12px (eval bar) - 6px (gap) ≈ 96vw - 314px
```
On a 1440px screen that's ~1067px — much larger than before. On a 768px screen it's ~424px. This is correct.

### Right Panel Width

`w-[280px] shrink-0` gives the move list and engine panel a fixed comfortable width. On very small screens (mobile) the layout should stack: add `sm:flex-row flex-col` to the main area and `sm:w-[280px] w-full` to the right panel.

### DialogContent Override

The shadcn `DialogContent` has `max-h-[calc(100vh-2rem)]` and `overflow-y-auto` baked in. Override both:

```tsx
<DialogContent className="max-w-[96vw] w-full h-[90vh] flex flex-col overflow-hidden p-6">
```

The `flex flex-col` turns the dialog into a flex container so the header + main area fill it correctly. `overflow-hidden` prevents the dialog itself from scrolling — only the right panel scrolls internally.

---

## Engine Stall (S49-12 Regression)

The screenshots show depth 9 on move 2 — the stall is still occurring. The S49-12 fix moved `setoption MultiPV 3` to the `uciok` handler, which was correct. But the stall at depth 9 specifically suggests the engine is hitting a **hash table size limit** for the single-threaded WASM build.

Add this to the `uciok` handler, before `isready`:

```ts
worker.postMessage("setoption name Hash value 16");  // 16MB hash — safe for WASM
worker.postMessage("setoption name MultiPV value 3");
worker.postMessage("isready");
```

The default hash size for Stockfish is 16MB but the WASM build may default to a smaller value. Setting it explicitly prevents the engine from stalling when it fills the hash table at depth 9.

---

## Summary of All Changes

All in `PgnViewerModal.tsx`:

| Item | Change |
|------|--------|
| S49-17 | `DialogContent` → `max-w-[96vw] w-full h-[90vh] flex flex-col overflow-hidden` |
| S49-18 | Left column uses `items-stretch`; eval bar is `w-3 self-stretch` inside left column only |
| S49-19 | Remove floating label from eval bar; keep midpoint notch only |
| S49-20 | Right panel fixed `w-[280px] shrink-0 overflow-y-auto`; board gets all remaining width |
| Engine | Add `setoption name Hash value 16` to `uciok` handler before `isready` |

---

## Verification

```bash
pnpm test    # 376 pass
pnpm check   # tsc exits 0
```

Manual smoke:
1. Open PGN viewer → dialog is large and **stays the same size** through all moves
2. Eval bar is a thin strip flush to the left of the board, exactly the board's height, with a notch at the midpoint
3. Board is large — dominates the left side
4. Engine depth climbs past 9 without stalling
5. Right panel scrolls internally if content overflows
