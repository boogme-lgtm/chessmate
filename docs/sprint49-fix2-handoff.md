# Sprint 49 Fix-2 Handoff — PGN Viewer Board Gap & Engine Stall

**Branch:** continue on `claude/code-audit-review-icD40`
**File:** `client/src/components/PgnViewerModal.tsx` only — no backend, no new deps
**Tests:** 376 must still pass, tsc must exit 0

---

## Bug S49-6: Dark Gaps Between Board Rows

### Root Cause

The `react-chessboard` v5 `defaultBoardStyle` sets `width: '100%', height: '100%'`. The board grid has `gridTemplateColumns: repeat(8, 1fr)` but **no** `gridTemplateRows`. Each square has `aspectRatio: '1/1'`.

When the board container has `height: 100%` and the wrapper has `aspect-square` (Tailwind `aspect-ratio: 1/1`), the grid rows are stretched to fill the container height. Each row gets `height = containerHeight / 8`. But the squares inside each row have `aspectRatio: 1/1`, so they only fill `width / 8` of that row height. The remaining space appears as a dark gap between rows.

The `aspect-square` Tailwind class on the wrapper also fights with `flex-1` in a flex container — `aspect-ratio` on a flex child is not reliably enforced when the flex algorithm sets height independently.

### Fix

Two changes:

**1. Override `boardStyle` to remove `height: '100%'`:**

```tsx
// In the <Chessboard options={{...}}> block, add:
boardStyle: {
  display: 'grid',
  gridTemplateColumns: 'repeat(8, 1fr)',
  overflow: 'hidden',
  width: '100%',
  height: 'auto',  // ← key change: let grid auto-size to content
  position: 'relative',
},
```

With `height: auto`, the grid rows auto-size to their content (the squares with `aspectRatio: 1/1`). Each row height = column width = container width / 8. Total board height = 8 × (container width / 8) = container width. The board is naturally square with no gaps.

**2. Remove `aspect-square` from the board wrapper div and replace with `w-full`:**

Current (line 275):
```tsx
<div className="flex-1 min-w-0 aspect-square">
```

Replace with:
```tsx
<div className="flex-1 min-w-0">
```

The board will now auto-size its height to match its width via the `boardStyle` fix above. No need for `aspect-square` on the wrapper.

---

## Bug S49-7: Stockfish Stalls at Depth 0 After Navigation

### Root Cause

The `isready`/`readyok` sync barrier is the **wrong pattern for single-threaded WASM Stockfish**. The `isready`/`readyok` handshake is designed for multi-threaded Stockfish where `stop` is asynchronous (search threads need time to wind down). In single-threaded WASM, `stop` is processed synchronously in the message queue — the engine is idle immediately after processing `stop`.

The current code sends `stop` + `isready` and waits for `readyok` before sending `position fen + go`. This causes two problems:

1. **Rapid navigation race:** If the user navigates quickly (arrow keys), multiple effects fire. Each overwrites `pendingFenRef` and sends `stop + isready`. The worker queues multiple `stop + isready` commands. When `readyok` fires for the first one, it dispatches `position + go`. But then the second `stop` arrives immediately, killing the search before any `info` lines are emitted. Depth stays at 0.

2. **`go depth 18` is finite:** The engine runs to depth 18 then emits `bestmove` and stops. The user sees the evaluation freeze at depth 18 with no further updates. Real chess GUIs use `go infinite` so the engine keeps improving its evaluation until the user navigates away.

### Fix

**Replace the entire engine evaluation model** with the standard chess GUI pattern:

- **`go infinite`** instead of `go depth 18` — engine runs continuously per position
- **No `isready`/`readyok` barrier** — for single-threaded WASM, `stop` is synchronous; just send `stop → position fen X → go infinite` directly
- **Remove `pendingFenRef`** entirely — it was only needed for the barrier
- **On `bestmove`:** just update state; the engine is now idle waiting for the next command (which will come when the user navigates)

#### Changes to the worker lifecycle effect (lines 126–195)

Remove `pendingFenRef` handling from `onmessage`. The handler becomes:

```tsx
worker.onmessage = (e: MessageEvent) => {
  const line = typeof e.data === "string" ? e.data : e.data?.data;
  if (typeof line !== "string") return;

  if (line === "uciok") {
    worker.postMessage("isready");  // still need this for initial ready check
    return;
  }
  if (line === "readyok") {
    setEngineReady(true);  // move engineReady here (was set on uciok before)
    return;
  }

  // info lines — update depth and eval continuously
  const depthMatch = line.match(/\bdepth (\d+)/);
  if (depthMatch) setEngineDepth(parseInt(depthMatch[1], 10));

  const cpMatch = line.match(/score cp (-?\d+)/);
  if (cpMatch) {
    const cp = parseInt(cpMatch[1], 10);
    const white = sideToMoveRef.current === "w" ? cp : -cp;
    setEvaluation({ type: "cp", value: white });
  }
  const mateMatch = line.match(/score mate (-?\d+)/);
  if (mateMatch) {
    const m = parseInt(mateMatch[1], 10);
    const white = sideToMoveRef.current === "w" ? m : -m;
    setEvaluation({ type: "mate", value: white });
  }
  const bmMatch = line.match(/^bestmove (\S+)/);
  if (bmMatch && bmMatch[1] !== "(none)") setBestMove(bmMatch[1]);
};

worker.onerror = (err) => console.error("[PgnViewer] Stockfish worker error:", err);
worker.postMessage("uci");
```

Note: move `setEngineReady(true)` from the `uciok` handler to the `readyok` handler. This ensures the evaluation effect only fires after the engine has confirmed it is ready.

#### Changes to the evaluation effect (lines 202–212)

Remove `pendingFenRef` entirely. The effect becomes:

```tsx
useEffect(() => {
  const fen = fens[currentIndex];
  if (!engineReady || !stockfishRef.current || !fen) return;
  sideToMoveRef.current = fen.split(" ")[1] === "b" ? "b" : "w";
  setBestMove(null);
  setEvaluation(null);
  setEngineDepth(0);
  // Single-threaded WASM: stop is synchronous, no isready/readyok barrier needed.
  // Just send stop → position → go infinite directly.
  stockfishRef.current.postMessage("stop");
  stockfishRef.current.postMessage(`position fen ${fen}`);
  stockfishRef.current.postMessage("go infinite");
}, [currentIndex, fens, engineReady]);
```

#### Remove `pendingFenRef`

Delete line 91:
```tsx
const pendingFenRef = useRef<string | null>(null);
```

And remove the cleanup in the worker teardown:
```tsx
pendingFenRef.current = null;  // delete this line
```

---

## Expected Behavior After Fix

| Scenario | Expected |
|----------|----------|
| Open modal | Engine starts, evaluates starting position, depth climbs continuously: depth 1, 2, 3... |
| Navigate to move 5 | Depth resets to 0, immediately starts climbing again: 1, 2, 3... |
| Rapid arrow-key navigation | Each position gets a fresh search; no stale depth-0 lockup |
| Eval bar | Updates continuously as depth climbs |
| Best move arrow | Updates as engine finds better moves at higher depths |
| Best move text | Shows `Best: Nf3` (SAN), updates as depth climbs |

---

## Verification

```bash
pnpm test        # 376 tests pass
pnpm check       # tsc exits 0
```

Manual smoke test:
1. Open a PGN message → board renders with NO dark gaps between rows
2. Engine starts immediately, depth counter climbs: 1, 2, 3, 4...
3. Navigate with arrow keys → depth resets and climbs on EVERY move
4. Rapid arrow-key navigation → engine recovers on every position (no depth-0 lockup)
5. Eval bar and Best move text update continuously

---

## Summary of Changes

Only `client/src/components/PgnViewerModal.tsx`:

| Change | Lines affected |
|--------|---------------|
| Remove `pendingFenRef` | ~line 91 |
| Move `setEngineReady(true)` from `uciok` to `readyok` handler | ~lines 142–157 |
| Remove `pendingFenRef` guard from `onmessage` | ~line 161 |
| Remove `pendingFenRef.current = null` from teardown | ~line 191 |
| Eval effect: remove `pendingFenRef`, use `stop→position→go infinite` | ~lines 202–212 |
| Board wrapper: remove `aspect-square` | ~line 275 |
| Chessboard options: add `boardStyle: { height: 'auto' }` | ~lines 276–289 |
