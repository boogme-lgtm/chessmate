# Sprint 49 Fix — PGN Viewer Visual & Engine Bugs

**Date:** 2026-06-09
**Issues:** S49-2, S49-3, S49-4, S49-5
**File:** `client/src/components/PgnViewerModal.tsx` (only file that needs to change)
**Branch:** continue on `claude/sprint-49-pgn-viewer` or open a new `claude/sprint-49-fix`

---

## Overview

Four bugs were found in the deployed PGN viewer. All are in `PgnViewerModal.tsx`. No
backend changes, no new dependencies.

---

## Bug 1 — S49-2: Board Too Narrow

### Problem

The board column uses `sm:flex-[3]` against the move-list column's `sm:flex-[2]`, but
the eval bar (`w-3`) and the `gap-2` inside the left column eat into the board's space.
On a `max-w-4xl` dialog the board ends up noticeably narrower than it is tall — it is
not square.

### Fix

The board must be constrained to a square. `react-chessboard` v5 respects its
container width and renders a square board, so the fix is to give the board container
an explicit square constraint.

Replace the left column structure (lines 221–244):

```tsx
{/* Left: eval bar + board */}
<div className="flex gap-2 sm:flex-[3]">
  {/* Evaluation bar */}
  <div className="relative w-3 shrink-0 rounded overflow-hidden bg-gray-900" title="Engine evaluation">
    <div
      className="absolute bottom-0 left-0 right-0 bg-white transition-[height] duration-300"
      style={{ height: `${evalPct}%` }}
    />
    <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 text-[9px] font-mono text-cyan-400 z-10 whitespace-nowrap">
      {evalLabel(evaluation)}
    </span>
  </div>
  <div className="flex-1 min-w-0">
    <Chessboard ... />
  </div>
</div>
```

With:

```tsx
{/* Left: eval bar + board — board must be square */}
<div className="flex gap-2 sm:flex-[3] min-w-0">
  {/* Evaluation bar — full height of the board */}
  <div className="relative w-4 shrink-0 self-stretch rounded overflow-hidden bg-gray-800 border border-border/30" title="Engine evaluation">
    <div
      className="absolute bottom-0 left-0 right-0 bg-white transition-[height] duration-500"
      style={{ height: `${evalPct}%` }}
    />
    <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[8px] font-mono text-cyan-400 z-10 whitespace-nowrap rotate-0">
      {evalLabel(evaluation)}
    </span>
  </div>
  {/* Board wrapper: aspect-square forces the board to be square */}
  <div className="flex-1 min-w-0 aspect-square">
    <Chessboard ... />
  </div>
</div>
```

The `aspect-square` class on the board wrapper is the key fix — it forces the div to
maintain a 1:1 ratio regardless of the flex container's width.

---

## Bug 2 — S49-3: Board Square Colors Indistinguishable

### Problem

The current colors `#1a1a2e` (dark) and `#2d2d4e` (light) are both very dark navy
shades with only ~13 lightness points of difference. On a dark monitor they are nearly
identical.

### Fix

Use colors that maintain the dark cyberpunk aesthetic but have strong contrast between
light and dark squares. Good options that work on dark backgrounds:

```tsx
// In the Chessboard options:
darkSquareStyle: { backgroundColor: "#4a3728" },   // warm dark brown
lightSquareStyle: { backgroundColor: "#c8a882" },  // classic tan/cream
```

Or a cooler palette that fits the electric cyan accent:

```tsx
darkSquareStyle: { backgroundColor: "#1e3a5f" },   // deep navy blue
lightSquareStyle: { backgroundColor: "#7fa8c9" },  // steel blue
```

**Recommended** — use the classic brown/tan palette. It is the most readable for
chess analysis (it is what Lichess and Chess.com use for their dark themes) and still
looks good against the dark modal background:

```tsx
darkSquareStyle: { backgroundColor: "#b58863" },   // classic dark square (Lichess brown)
lightSquareStyle: { backgroundColor: "#f0d9b5" },  // classic light square (Lichess cream)
```

This is the Lichess board color scheme — universally recognized by chess players,
high contrast, and readable at all depths.

---

## Bug 3 — S49-4: Stockfish Does Not Re-Evaluate on Move Navigation

### Problem

The evaluation `useEffect` at lines 160–170 has `[currentIndex, fens, engineReady]` as
its dependency array. The issue is that `fens` is a state array — its reference does
not change when `currentIndex` changes (only the index into it changes). So the effect
fires correctly when `currentIndex` changes, **but** the single-threaded Stockfish WASM
worker has a known behavior: after `go depth 18` completes and emits `bestmove`, the
worker enters a quiescent state. A subsequent `stop` + new `position` + `go` command
sequence should restart it — but only if the worker is not still processing.

The real bug is a **race condition**: the `stop` command is sent, but the worker may
not have fully stopped before the new `position fen` command arrives, causing the
second search to be silently dropped.

### Fix

Add a small delay between `stop` and the new `go`, or better, use the `readyok`
handshake to ensure the engine is idle before sending the new position. The cleanest
approach for a single-threaded worker is to use `isready` as a synchronization
barrier:

Replace the evaluation effect (lines 160–170):

```tsx
// ── Trigger evaluation when the viewed position changes ──────────────────────
useEffect(() => {
  const fen = fens[currentIndex];
  if (!engineReady || !stockfishRef.current || !fen) return;

  const worker = stockfishRef.current;
  sideToMoveRef.current = fen.split(" ")[1] === "b" ? "b" : "w";
  setBestMove(null);
  setEvaluation(null);
  setEngineDepth(0);

  // Stop any running search, then use isready as a sync barrier before
  // sending the new position. The worker will respond with "readyok" once
  // it has fully processed the stop and is ready for new commands.
  worker.postMessage("stop");
  worker.postMessage("isready");

  // The onmessage handler will send "position fen + go" when it sees "readyok".
  // Store the pending FEN so the handler can pick it up.
  pendingFenRef.current = fen;
}, [currentIndex, fens, engineReady]);
```

Add a `pendingFenRef` to hold the FEN waiting to be analyzed:

```tsx
const pendingFenRef = useRef<string | null>(null);
```

Update the `worker.onmessage` handler to handle `readyok` by sending the pending
position (add this case alongside the existing `uciok` handler):

```tsx
if (line === "readyok") {
  // If there's a pending position from a move navigation, start the search now.
  if (pendingFenRef.current) {
    const fen = pendingFenRef.current;
    pendingFenRef.current = null;
    worker.postMessage(`position fen ${fen}`);
    worker.postMessage("go depth 18");
  }
  return;
}
```

Also update the initial `uciok` handler — when the engine first starts up, it sends
`uciok` then we send `isready`, and `readyok` arrives. At that point `pendingFenRef`
will already be set (from the evaluation effect running before the engine was ready),
so the initial position will be analyzed automatically.

**Summary of the flow:**
1. User navigates to a move → effect fires → `stop` + `isready` sent
2. Worker finishes stopping → sends `readyok`
3. `onmessage` sees `readyok` → sends `position fen <fen>` + `go depth 18`
4. Engine searches → streams `info depth N score cp X` lines → sends `bestmove`
5. State updates: depth counter increments, eval bar moves, best-move arrow updates

---

## Bug 4 — S49-5: No Best-Move Text Displayed

### Problem

The best move from Stockfish is shown as an arrow on the board but there is no text
label. The engine status line (line 302–308) shows `Stockfish · depth N · +0.3` but
does not show what the best move is in human-readable notation.

### Fix

Convert the UCI best-move string (e.g. `"e2e4"`) to SAN notation using `chess.js`
so it reads as `"Best: e4"` rather than `"Best: e2e4"`.

Add a helper function:

```tsx
function uciToSan(uci: string | null, fen: string): string | null {
  if (!uci || uci.length < 4) return null;
  try {
    const chess = new Chess(fen);
    const move = chess.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci[4] ?? undefined,
    });
    return move?.san ?? null;
  } catch {
    return null;
  }
}
```

Update the engine status line (lines 302–308):

```tsx
{/* Engine status */}
<div className="mt-2 text-xs text-muted-foreground font-mono space-y-0.5">
  {engineReady ? (
    <>
      <div>
        Stockfish · depth {engineDepth} · <span className="text-cyan-400">{evalLabel(evaluation)}</span>
      </div>
      {bestMove && (
        <div className="text-cyan-300">
          Best: {uciToSan(bestMove, fens[currentIndex]) ?? bestMove.slice(0, 2) + "→" + bestMove.slice(2, 4)}
        </div>
      )}
    </>
  ) : (
    <div>Starting engine…</div>
  )}
</div>
```

This shows `Best: Nf3` (SAN) when available, falling back to `e2→e4` (UCI formatted
with arrow) if SAN conversion fails.

---

## Summary of All Changes to `PgnViewerModal.tsx`

| Bug | Change | Lines affected |
|-----|--------|----------------|
| S49-2 Board narrow | Add `aspect-square` to board wrapper div; widen eval bar to `w-4` | ~221–244 |
| S49-3 Colors | Change square colors to Lichess classic brown/cream | ~239–240 |
| S49-4 Engine lock | Add `pendingFenRef`; use `isready`/`readyok` sync barrier | ~67, ~117–143, ~160–170 |
| S49-5 No move text | Add `uciToSan()` helper; add "Best: Nf3" line to engine status | ~48–53, ~302–308 |

No other files need to change. No new dependencies. No backend changes.

---

## Tests

No new server tests needed — these are all frontend/UI fixes. Confirm:

- [ ] `pnpm test` passes (376 tests)
- [ ] `pnpm check` exits 0

---

## Acceptance Criteria

- [ ] Board is visibly square at all dialog widths
- [ ] Light and dark squares are clearly distinguishable (Lichess classic colors)
- [ ] Navigating to any move triggers a new Stockfish search (depth counter resets and climbs)
- [ ] Engine status line shows "Best: Nf3" (or equivalent SAN) when a best move is available
- [ ] Best-move arrow still appears on the board
- [ ] Eval bar still updates correctly on each move
- [ ] No regression on existing copy-PGN, move list navigation, or keyboard shortcuts
