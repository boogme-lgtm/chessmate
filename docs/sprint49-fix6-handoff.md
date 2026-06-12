# Sprint 49 Fix-6 Handoff — Engine Death Root Cause + Board Size

**Branch:** continue on `claude/code-audit-review-icD40`
**File:** `client/src/components/PgnViewerModal.tsx` only
**Tests:** 376 must still pass, tsc must exit 0

---

## Engine Death — Definitive Root Cause

Every previous fix attempt used the pattern:
```
stop → position fen X → go infinite
```

**This is wrong for single-threaded WASM Stockfish.** Here is why it fails on the 3rd move:

The single-threaded WASM engine processes UCI commands sequentially in the JS event loop. When you call `worker.postMessage('stop')`, the engine queues a stop. It then emits `bestmove` to confirm it has stopped. **But you are sending `position` and `go` immediately after `stop` — before the engine has processed the stop and emitted `bestmove`.**

On the first 1-2 moves this works by luck (the event loop timing is favorable). On the 3rd move, the engine receives:
```
[from previous search]: stop, position fen A, go infinite  ← still being processed
[from new navigation]:  stop, position fen B, go infinite  ← queued immediately
```

The engine processes `stop` (stops search A, emits `bestmove A`), then `position fen A`, then `go infinite` (starts search A), then `stop` (stops search A again, emits `bestmove A` again), then `position fen B`, then `go infinite` (starts search B). But by this point the engine's internal state machine has been corrupted by the double-stop — it enters a state where it no longer emits `info` lines, and `depth 0` is all you see.

**The correct UCI protocol for stopping and restarting analysis is:**
```
1. Send: stop
2. Wait for: bestmove (this confirms the engine has fully stopped)
3. Send: position fen X
4. Send: go infinite
```

This is how every real chess GUI (Lichess, ChessBase, Arena) communicates with Stockfish. The `bestmove` line is the engine's acknowledgment that it is idle and ready for a new position.

**Previous fix-3 comment was wrong:** "under `go infinite`, the engine never emits `bestmove` during a search — it only emits one after a `stop`." This is actually **correct behavior** — and it means `bestmove` IS the right signal to use. The mistake was concluding that `bestmove` should be ignored. It should be used as the stop-confirmation gate.

---

## The Fix: `pendingFenRef` + `bestmove` as Stop Gate

This is the correct architecture:

```ts
// Ref that holds the FEN we want to analyze next.
// Set immediately on navigation; consumed when bestmove arrives.
const pendingFenRef = useRef<string | null>(null);
// Whether a search is currently running (between go infinite and bestmove).
const searchingRef = useRef(false);
```

**Navigation handler (eval effect):**
```ts
useEffect(() => {
  const fen = fens[currentIndex];
  if (!engineReady || !stockfishRef.current || !fen) return;
  
  // Reset display state immediately
  setBestMove(null);
  setEvaluation(null);
  setEngineDepth(0);
  setVariations([]);
  sideToMoveRef.current = fen.split(" ")[1] === "b" ? "b" : "w";
  
  if (searchingRef.current) {
    // Engine is searching — store the new FEN and send stop.
    // The bestmove handler will pick up pendingFenRef and start the new search.
    pendingFenRef.current = fen;
    stockfishRef.current.postMessage("stop");
  } else {
    // Engine is idle (e.g., first position after init) — start directly.
    pendingFenRef.current = null;
    searchingRef.current = true;
    stockfishRef.current.postMessage(`position fen ${fen}`);
    stockfishRef.current.postMessage("go infinite");
  }
}, [currentIndex, fens, engineReady]);
```

**`bestmove` handler (inside `worker.onmessage`):**
```ts
if (line.startsWith("bestmove")) {
  searchingRef.current = false;
  const pending = pendingFenRef.current;
  if (pending && stockfishRef.current) {
    // A new position was queued while we were stopping — start it now.
    pendingFenRef.current = null;
    searchingRef.current = true;
    stockfishRef.current.postMessage(`position fen ${pending}`);
    stockfishRef.current.postMessage("go infinite");
  }
  return;
}
```

**`readyok` handler:** Set `searchingRef.current = false` here (engine is idle after init).

**`stopEngine`:** Reset both refs: `pendingFenRef.current = null; searchingRef.current = false;`

This architecture guarantees:
- Only one `position + go` is ever in flight at a time
- Rapid navigation queues at most one pending FEN (the latest one)
- The engine never receives `position` or `go` while it is still processing a previous `stop`
- No matter how fast the user navigates, the engine always ends up analyzing the current position

---

## Board Size Regression

The current layout has `max-w-[calc(90vh-8rem)]` on the board wrapper. On a 1440×900 screen, `90vh = 810px`, so `calc(90vh-8rem) = 810 - 128 = 682px`. But the board wrapper is inside a `self-start` left column inside a `flex-1 min-h-0` main area. The `self-start` collapses the left column to its content width — but the board wrapper has `flex-1` which means "fill the remaining width of the left column." The left column has no explicit width, so `flex-1` on the board wrapper resolves to 0 in some browsers.

**The fix:** Give the left column an explicit width instead of relying on `flex-1`:

```tsx
{/* Left column: eval bar + board */}
<div className="flex flex-row gap-1.5 shrink-0" style={{ width: 'min(calc(90vh - 8rem), calc(100% - 296px))' }}>
  {/* eval bar: w-3 */}
  {/* board wrapper: flex-1 */}
</div>
```

`min(calc(90vh - 8rem), calc(100% - 296px))` means:
- On wide screens: capped at `90vh - 8rem` so the board fits vertically
- On narrow screens: `100% - 296px` (dialog width minus right panel 280px + gap 16px) so the board fills available horizontal space

Remove `self-start` from the left column — it is no longer needed since the column has an explicit width.

The right panel stays `w-[280px] shrink-0`.

---

## Summary of Changes

All in `PgnViewerModal.tsx`:

| Item | Change |
|------|--------|
| Engine death | Replace `stop → position → go` with `pendingFenRef` + `bestmove` gate pattern |
| Board size | Left column gets explicit `style={{ width: 'min(calc(90vh - 8rem), calc(100% - 296px))' }}` |
| Remove `self-start` | No longer needed with explicit width |

---

## Verification

```bash
pnpm test    # 376 pass
pnpm check   # tsc exits 0
```

Manual smoke — the definitive test:
1. Open PGN viewer
2. Press the right arrow key 20 times as fast as possible
3. Depth must be climbing (not 0) on every single position
4. Board must be large — roughly 60% of the dialog width
5. Dialog must stay the same size throughout

If depth ever shows 0 after the first position, the fix did not work.
