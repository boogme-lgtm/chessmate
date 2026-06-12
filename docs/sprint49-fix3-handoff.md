# Sprint 49 Fix-3 Handoff — PGN Viewer Polish

**Branch:** continue on `claude/code-audit-review-icD40`
**File:** `client/src/components/PgnViewerModal.tsx` only — no backend, no new deps
**Tests:** 376 must still pass, tsc must exit 0

---

## Brand Colors Reference

BooGMe's design tokens (from `client/src/index.css`):

```
--background:   #0F1419   (near-black navy)
--surface:      #151B22   (card bg)
--surface-elevated: #1A2230
--primary:      #E8633A   (terracotta orange — the brand accent)
--foreground:   #F4EFE6   (warm off-white)
--muted-foreground: #7A8290
--border:       #22303C
```

---

## S49-8: Board Square Colors — BooGMe Branded Palette

Replace the Lichess brown/cream with a palette derived from BooGMe's brand colors. The goal is that the board feels instantly recognizable as part of the BooGMe product.

**Recommended palette:**
- **Dark squares:** `#1A2C3D` — a deep navy-blue that echoes `--surface-elevated` (`#1A2230`) but with a slight blue shift for chess-board readability
- **Light squares:** `#C8B89A` — a warm tan/cream that complements the terracotta primary without clashing

This gives a dark-navy / warm-tan contrast that is chess-board readable, clearly branded (navy + warm tones = BooGMe), and visually distinct from both the Lichess brown and the generic blue-grey default.

In the `<Chessboard options={{...}}>` block, update lines 287–288:
```tsx
darkSquareStyle: { backgroundColor: "#1A2C3D" },
lightSquareStyle: { backgroundColor: "#C8B89A" },
```

Also update the **eval bar** to use brand colors instead of `bg-gray-800` / `bg-white`:
- Bar background: `backgroundColor: '#151B22'` (matches `--surface`)
- White (high eval) fill: `backgroundColor: '#E8633A'` (primary terracotta)
- Black (low eval) fill: stays at bottom (the bar background is dark)
- The eval label text: keep `text-[var(--primary)]` or `#E8633A`

Update the eval bar div (line 255–263):
```tsx
<div
  className="relative w-4 shrink-0 self-stretch rounded overflow-hidden border border-border/30"
  style={{ backgroundColor: '#151B22' }}
  title="Engine evaluation"
>
  <div
    className="absolute bottom-0 left-0 right-0 transition-[height] duration-500"
    style={{ height: `${evalPct}%`, backgroundColor: '#E8633A' }}
  />
  <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[8px] font-mono z-10 whitespace-nowrap" style={{ color: '#E8633A' }}>
    {evalLabel(evaluation)}
  </span>
</div>
```

Also update the **active move highlight** in the move list (lines 305, 312) from `text-cyan-400` to the brand primary:
```tsx
className={`flex-1 text-left ${currentIndex === 2 * i + 1 ? "font-bold" : ""}`}
style={currentIndex === 2 * i + 1 ? { color: '#E8633A' } : undefined}
```
Do the same for the black move button (line 312).

And the **Best move text** (line 359): change `text-cyan-300` to brand primary:
```tsx
<div style={{ color: '#E8633A' }}>
```

And the **eval label** in the engine status line (line 355): change `text-cyan-400` to brand primary:
```tsx
<span style={{ color: '#E8633A' }}>{evalLabel(evaluation)}</span>
```

---

## S49-9: File/Rank Notation Overlapping Pieces

The default notation style uses `fontSize: '13px'` which is too large for the board squares at the dialog's width. The notation letters/numbers overlap the piece images.

Fix by overriding the notation styles in the `<Chessboard options={{...}}>` block:

```tsx
// Reduce notation font size so it doesn't overlap pieces
alphaNotationStyle: {
  fontSize: '9px',
  position: 'absolute',
  bottom: 1,
  right: 3,
  userSelect: 'none',
  color: 'rgba(255,255,255,0.55)',  // subtle on dark squares
},
numericNotationStyle: {
  fontSize: '9px',
  position: 'absolute',
  top: 1,
  left: 2,
  userSelect: 'none',
  color: 'rgba(255,255,255,0.55)',
},
darkSquareNotationStyle: {
  color: 'rgba(200,184,154,0.7)',   // light tan on dark squares
},
lightSquareNotationStyle: {
  color: 'rgba(26,44,61,0.7)',      // dark navy on light squares
},
```

Note: `alphaNotationStyle` and `numericNotationStyle` set the base font/position; `darkSquareNotationStyle` and `lightSquareNotationStyle` override the color per square type (matching Lichess's convention of using the opposite square color for notation text).

---

## S49-10: Stockfish On/Off Toggle with Restart

### Problem

The engine freezes because `go infinite` in single-threaded WASM can lock up if the worker receives commands in an unexpected order (e.g., `stop` sent while the engine is still initializing). There is currently no way for the user to recover without closing and reopening the modal.

### Fix

Add an **engine on/off toggle button** next to the flip-board button. When toggled off, the worker is terminated. When toggled on, a fresh worker is spawned. This gives the user a reliable restart mechanism and matches Lichess's UX.

#### New state

```tsx
const [engineEnabled, setEngineEnabled] = useState(true);
```

#### Refactor worker lifecycle into a `startEngine` / `stopEngine` pattern

Extract the worker startup logic from the `useEffect([open])` into a `startEngine` callback:

```tsx
const startEngine = useCallback(() => {
  // Terminate any existing worker first
  if (stockfishRef.current) {
    try { stockfishRef.current.postMessage("quit"); stockfishRef.current.terminate(); } catch { /* noop */ }
    stockfishRef.current = null;
  }
  setEngineReady(false);
  setEngineDepth(0);
  setEvaluation(null);
  setBestMove(null);
  setVariations([]);

  let worker: Worker;
  try {
    worker = new Worker("/stockfish/stockfish-18-lite-single.js");
  } catch (err) {
    console.error("[PgnViewer] Failed to start Stockfish worker:", err);
    return;
  }
  stockfishRef.current = worker;

  worker.onmessage = (e: MessageEvent) => {
    // ... same handler as current, but reference stockfishRef.current for postMessage
  };
  worker.onerror = (err) => console.error("[PgnViewer] Stockfish worker error:", err);
  worker.postMessage("uci");
}, []); // no deps — uses refs only
```

The main `useEffect([open])` becomes:
```tsx
useEffect(() => {
  if (!open) return;
  if (engineEnabled) startEngine();
  return () => {
    if (stockfishRef.current) {
      try { stockfishRef.current.postMessage("quit"); stockfishRef.current.terminate(); } catch { /* noop */ }
      stockfishRef.current = null;
    }
    setEngineReady(false);
    setEngineDepth(0);
  };
}, [open, engineEnabled, startEngine]);
```

#### Toggle button

Add a `Power` icon button next to the flip-board button in the navigation controls row:

```tsx
import { Power, FlipHorizontal2 } from "lucide-react";

// In the navigation controls div:
<Button
  variant="outline"
  size="icon"
  onClick={() => setEngineEnabled((e) => !e)}
  aria-label={engineEnabled ? "Stop engine" : "Start engine"}
  className={`ml-2 ${engineEnabled ? "border-primary/50" : "opacity-50"}`}
  title={engineEnabled ? "Engine on — click to stop" : "Engine off — click to start"}
>
  <Power className="h-4 w-4" style={{ color: engineEnabled ? '#E8633A' : undefined }} />
</Button>
```

#### Engine status line

Update the engine status section to show three states:
- Engine off: `"Engine off"` with a muted style + a "Restart" hint
- Starting: `"Starting engine…"`
- Ready: depth + eval (existing)

```tsx
{!engineEnabled ? (
  <div className="text-muted-foreground">Engine off · <button onClick={() => setEngineEnabled(true)} className="underline">turn on</button></div>
) : !engineReady ? (
  <div>Starting engine…</div>
) : (
  // existing depth + eval + best move display
)}
```

---

## S49-11: Multipv Variation Lines

### What to add

Below the engine status line, show the **top 3 engine variations** as a small table, similar to Lichess's analysis panel. Each row shows:
- Variation number (1, 2, 3)
- Eval score (`+0.3`, `-M5`, etc.)
- First move in SAN (`Nf3`, `e4`, etc.)

### New state

```tsx
type Variation = {
  multipv: number;      // 1, 2, or 3
  eval: Evaluation;     // white-POV
  bestMove: string | null;  // UCI string of first PV move
};
const [variations, setVariations] = useState<Variation[]>([]);
```

### Engine setup change

Before `go infinite`, send `setoption name MultiPV value 3`:

```tsx
// In the evaluation effect (lines 192–202):
stockfishRef.current.postMessage("stop");
stockfishRef.current.postMessage(`position fen ${fen}`);
stockfishRef.current.postMessage("setoption name MultiPV value 3");
stockfishRef.current.postMessage("go infinite");
```

Also reset variations on position change:
```tsx
setVariations([]);
```

### Parsing multipv lines

In the `onmessage` handler, add multipv parsing. Info lines with multipv look like:
```
info depth 18 seldepth 25 multipv 2 score cp 20 nodes 123456 ... pv d2d4 d7d5 ...
```

Parse and update the variations array:
```tsx
const multipvMatch = line.match(/\bmultipv (\d+)/);
const pvMatch = line.match(/\bpv (\S+)/);
const cpMatch2 = line.match(/score cp (-?\d+)/);
const mateMatch2 = line.match(/score mate (-?\d+)/);

if (multipvMatch && pvMatch) {
  const mpv = parseInt(multipvMatch[1], 10);
  let ev: Evaluation = null;
  if (cpMatch2) {
    const cp = parseInt(cpMatch2[1], 10);
    ev = { type: "cp", value: sideToMoveRef.current === "w" ? cp : -cp };
  } else if (mateMatch2) {
    const m = parseInt(mateMatch2[1], 10);
    ev = { type: "mate", value: sideToMoveRef.current === "w" ? m : -m };
  }
  setVariations((prev) => {
    const next = prev.filter((v) => v.multipv !== mpv);
    return [...next, { multipv: mpv, eval: ev, bestMove: pvMatch[1] }]
      .sort((a, b) => a.multipv - b.multipv);
  });
  // multipv 1 is the main line — also update the top-level bestMove and evaluation
  if (mpv === 1) {
    setBestMove(pvMatch[1]);
    if (ev) setEvaluation(ev);
  }
}

// Also update depth from any info line
const depthMatch = line.match(/\bdepth (\d+)/);
if (depthMatch) setEngineDepth(parseInt(depthMatch[1], 10));
```

Note: with MultiPV enabled, the existing `score cp` / `score mate` / `pv` parsing should be **replaced** by the multipv-aware parsing above to avoid double-updating state.

### Variation display UI

Add a variations section below the engine status line (inside the `engineReady` branch):

```tsx
{variations.length > 0 && (
  <div className="mt-2 space-y-0.5">
    {variations.map((v) => (
      <div key={v.multipv} className="flex items-center gap-2 text-xs font-mono">
        <span className="text-muted-foreground w-3">{v.multipv}</span>
        <span style={{ color: '#E8633A', minWidth: '3rem' }}>
          {evalLabel(v.eval)}
        </span>
        <span className="text-foreground">
          {uciToSan(v.bestMove, fens[currentIndex]) ??
            (v.bestMove ? `${v.bestMove.slice(0, 2)}→${v.bestMove.slice(2, 4)}` : '–')}
        </span>
      </div>
    ))}
  </div>
)}
```

---

## Summary of All Changes

All in `client/src/components/PgnViewerModal.tsx`:

| Change | What |
|--------|------|
| S49-8 | `darkSquareStyle` → `#1A2C3D`, `lightSquareStyle` → `#C8B89A`; eval bar uses `#151B22` bg + `#E8633A` fill; active move / best move / eval label use `#E8633A` |
| S49-9 | Add `alphaNotationStyle`, `numericNotationStyle`, `darkSquareNotationStyle`, `lightSquareNotationStyle` with 9px font and per-square-type colors |
| S49-10 | Add `engineEnabled` state; extract `startEngine` callback; add `Power` toggle button; three-state engine status display |
| S49-11 | Add `variations` state; `setoption name MultiPV value 3` before `go infinite`; multipv-aware info line parsing; variation rows UI below engine status |

---

## Verification

```bash
pnpm test        # 376 tests pass
pnpm check       # tsc exits 0
```

Manual smoke test:
1. Open PGN viewer → board uses dark navy / warm tan squares (BooGMe branded)
2. File/rank notation is small (9px) and does not overlap pieces
3. Engine starts, depth climbs, eval bar fills in terracotta orange
4. Active move in move list highlighted in terracotta orange
5. Top 3 variations appear below engine status: `1  +0.3  Nf3`, `2  +0.1  d4`, `3  0.0  Nc3`
6. Click the Power button → engine stops, status shows "Engine off"
7. Click Power again → engine restarts cleanly, depth climbs from 1
8. Navigate moves → variations reset and repopulate on each position
