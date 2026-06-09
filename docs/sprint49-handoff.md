# Sprint 49 Handoff — Interactive PGN Viewer with Engine Analysis

**Date:** 2026-06-09
**Issue:** S49-1
**Branch:** `claude/sprint-49-pgn-viewer`

---

## Overview

Right now, PGN messages in the messaging thread are rendered as a raw `<pre>` block of
notation text. The user wants to click a PGN message and open a full in-app analysis
board — with move navigation, a clickable move list, a flip-board button, and a
Stockfish engine evaluation bar. Everything runs client-side; no backend changes are
needed.

---

## Technical Approach

### Libraries to install

```bash
pnpm add chess.js react-chessboard stockfish
```

| Package | Version | Purpose |
|---------|---------|---------|
| `chess.js` | ^1.3.0 | PGN parsing, move validation, FEN generation |
| `react-chessboard` | ^5.x | Interactive chessboard UI component |
| `stockfish` | ^16.x | Stockfish WASM engine (runs in a Web Worker, no server needed) |

> **Why not `@lichess-org/pgn-viewer`?**
> The Lichess PGN viewer explicitly lists "engine support" as a **Non-Goal** in its
> README. It is a read-only widget for browsing game notation — it cannot show
> centipawn evaluations or best-move arrows. It also requires SCSS setup and its own
> DOM lifecycle. Building on `chess.js` + `react-chessboard` gives us full control and
> is the standard pattern for React chess apps. The Lichess library would still require
> all the same Stockfish integration work on top.

### Architecture

All logic lives in a single new component: `client/src/components/PgnViewerModal.tsx`.

The component is a `Dialog` (shadcn/ui) that:
1. Receives the raw PGN string as a prop
2. Parses the PGN with `chess.js` to extract the move list and headers
3. Renders the board with `react-chessboard` at the current move position
4. Runs Stockfish WASM in a `useRef`-held Worker for engine evaluation
5. Displays a centipawn evaluation bar and best-move depth indicator

`MessageThread.tsx` is the only other file that needs to change — add a click handler
on PGN bubbles that opens the modal.

---

## Implementation Spec

### New file: `client/src/components/PgnViewerModal.tsx`

#### Props

```tsx
interface PgnViewerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pgn: string;
}
```

#### State

```tsx
const [moves, setMoves] = useState<string[]>([]);       // SAN move list
const [fens, setFens] = useState<string[]>([]);          // FEN after each move (index 0 = start)
const [currentIndex, setCurrentIndex] = useState(0);    // which move we're viewing
const [boardOrientation, setBoardOrientation] = useState<"white" | "black">("white");
const [evaluation, setEvaluation] = useState<number | null>(null);  // centipawns (positive = white advantage)
const [bestMove, setBestMove] = useState<string | null>(null);       // UCI string e.g. "e2e4"
const [engineDepth, setEngineDepth] = useState(0);
const [engineReady, setEngineReady] = useState(false);
const stockfishRef = useRef<Worker | null>(null);
```

#### PGN parsing (run in a `useEffect` when `pgn` or `open` changes)

```tsx
useEffect(() => {
  if (!open || !pgn) return;
  const chess = new Chess();
  try {
    chess.loadPgn(pgn);
  } catch {
    // malformed PGN — show empty board
    setMoves([]);
    setFens([new Chess().fen()]);
    setCurrentIndex(0);
    return;
  }
  const history = chess.history();
  const fenList: string[] = [new Chess().fen()];
  const tempChess = new Chess();
  for (const move of history) {
    tempChess.move(move);
    fenList.push(tempChess.fen());
  }
  setMoves(history);
  setFens(fenList);
  setCurrentIndex(fenList.length - 1); // start at final position
}, [pgn, open]);
```

#### Stockfish Web Worker setup

```tsx
useEffect(() => {
  if (!open) return;
  // stockfish npm package exports a path to the WASM worker file
  const worker = new Worker(new URL('stockfish/src/stockfish-nnue-16.js', import.meta.url));
  stockfishRef.current = worker;

  worker.onmessage = (e: MessageEvent<string>) => {
    const line = e.data;
    if (line === 'uciok') {
      setEngineReady(true);
      worker.postMessage('isready');
    }
    if (line === 'readyok') {
      // engine is ready; evaluation will start when position changes
    }
    // Parse "info depth N score cp X" lines
    const cpMatch = line.match(/score cp (-?\d+)/);
    const depthMatch = line.match(/depth (\d+)/);
    if (cpMatch) setEvaluation(parseInt(cpMatch[1], 10));
    if (depthMatch) setEngineDepth(parseInt(depthMatch[1], 10));
    // Parse "bestmove e2e4" line
    const bmMatch = line.match(/^bestmove (\S+)/);
    if (bmMatch && bmMatch[1] !== '(none)') setBestMove(bmMatch[1]);
  };

  worker.postMessage('uci');

  return () => {
    worker.postMessage('quit');
    worker.terminate();
    stockfishRef.current = null;
    setEngineReady(false);
  };
}, [open]);
```

#### Trigger engine evaluation when `currentIndex` changes

```tsx
useEffect(() => {
  if (!engineReady || !stockfishRef.current || !fens[currentIndex]) return;
  const fen = fens[currentIndex];
  setBestMove(null);
  setEvaluation(null);
  setEngineDepth(0);
  stockfishRef.current.postMessage('stop');
  stockfishRef.current.postMessage(`position fen ${fen}`);
  stockfishRef.current.postMessage('go depth 18');
}, [currentIndex, fens, engineReady]);
```

#### Keyboard navigation

```tsx
useEffect(() => {
  if (!open) return;
  const handler = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') setCurrentIndex(i => Math.max(0, i - 1));
    if (e.key === 'ArrowRight') setCurrentIndex(i => Math.min(fens.length - 1, i + 1));
    if (e.key === 'ArrowUp') setCurrentIndex(0);
    if (e.key === 'ArrowDown') setCurrentIndex(fens.length - 1);
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}, [open, fens.length]);
```

#### Evaluation bar helper

The evaluation bar is a vertical bar (or horizontal on mobile). Positive cp = white
advantage (bar fills from bottom). Clamp to ±800cp for display purposes.

```tsx
function evalToPercent(cp: number | null): number {
  if (cp === null) return 50;
  const clamped = Math.max(-800, Math.min(800, cp));
  return 50 + (clamped / 800) * 50; // 0% = black winning, 100% = white winning
}
```

Display: a narrow vertical strip (e.g. `w-3`) left of the board. White fills from
bottom; black fills from top. Show the numeric eval (e.g. `+1.2` or `-0.4`) as a small
label at the edge of the bar.

#### Best-move arrow

`react-chessboard` supports custom arrows via the `customArrows` prop:

```tsx
// Convert UCI bestmove string "e2e4" to arrow format
function uciToArrow(uci: string | null): [string, string][] {
  if (!uci || uci.length < 4) return [];
  return [[uci.slice(0, 2), uci.slice(2, 4)]];
}

// In the Chessboard component:
<Chessboard
  position={fens[currentIndex]}
  boardOrientation={boardOrientation}
  customArrows={uciToArrow(bestMove)}
  customArrowColor="rgba(0, 255, 200, 0.7)"  // electric cyan to match theme
  areDraggable={false}
/>
```

#### Move list

Render moves in pairs (White + Black) in a scrollable list. Clicking a move navigates
to that position.

```tsx
<div className="overflow-y-auto max-h-[400px] font-mono text-sm">
  {Array.from({ length: Math.ceil(moves.length / 2) }, (_, i) => (
    <div key={i} className="flex gap-2 px-2 py-0.5 hover:bg-muted/30">
      <span className="text-muted-foreground w-6 shrink-0">{i + 1}.</span>
      {/* White move = index 2i+1 in fens */}
      <button
        onClick={() => setCurrentIndex(2 * i + 1)}
        className={`flex-1 text-left ${currentIndex === 2 * i + 1 ? "text-cyan-400 font-bold" : ""}`}
      >
        {moves[2 * i]}
      </button>
      {/* Black move = index 2i+2 in fens */}
      {moves[2 * i + 1] && (
        <button
          onClick={() => setCurrentIndex(2 * i + 2)}
          className={`flex-1 text-left ${currentIndex === 2 * i + 2 ? "text-cyan-400 font-bold" : ""}`}
        >
          {moves[2 * i + 1]}
        </button>
      )}
    </div>
  ))}
</div>
```

#### Navigation controls

Four buttons: `|<` (first), `<` (prev), `>` (next), `>|` (last), plus a flip-board
button. Use `ChevronFirst`, `ChevronLeft`, `ChevronRight`, `ChevronLast`, `FlipHorizontal2`
from `lucide-react`.

#### PGN headers

Parse and display game headers (White, Black, Event, Date, Result) from
`chess.header()` above the board if present.

#### Modal layout

Use a two-column layout inside the Dialog:
- **Left column**: evaluation bar (narrow) + chessboard (square, fills available width)
- **Right column**: PGN headers (if any), move list (scrollable), navigation controls,
  engine status line ("Stockfish depth N · +1.2")

On mobile (`sm:` breakpoint), stack vertically: board on top, move list below.

```
┌─────────────────────────────────────────────────┐
│  [White] vs [Black]  [Event]  [Date]  [Result]  │
├──────────────────────────┬──────────────────────┤
│  │                       │  1. e4   e5           │
│  │                       │  2. Nf3  Nc6          │
│  │   CHESSBOARD          │  3. Bb5  a6  ← active │
│  │   (react-chessboard)  │  ...                  │
│  │                       │  ─────────────────    │
│  │                       │  [|<] [<] [>] [>|] [⇄]│
│  │                       │  Stockfish d18 · +0.3 │
└──────────────────────────┴──────────────────────┘
```

The narrow vertical strip on the far left of the board column is the evaluation bar.

---

## Changes to `client/src/components/MessageThread.tsx`

### 1. Add state for the PGN viewer modal

```tsx
const [pgnViewerOpen, setPgnViewerOpen] = useState(false);
const [selectedPgn, setSelectedPgn] = useState<string>("");
```

### 2. Add a click handler on PGN bubbles

In the PGN message rendering block (currently lines ~129–153), wrap the `<div
className="space-y-1">` in a `<button>` or add an `onClick` to the outer bubble div:

```tsx
{msg.contentType === "pgn" ? (
  <div
    className="space-y-1 cursor-pointer"
    onClick={() => {
      setSelectedPgn(msg.content);
      setPgnViewerOpen(true);
    }}
    title="Click to open analysis board"
  >
    <div className="flex items-center justify-between gap-1 text-xs opacity-80">
      <span className="flex items-center gap-1">
        <FileText className="h-3 w-3" /> PGN
      </span>
      {/* ... existing Copy PGN button ... */}
    </div>
    <pre className="text-xs whitespace-pre-wrap font-mono line-clamp-6">
      {msg.content}
    </pre>
    <p className="text-[10px] opacity-60 italic">Click to open analysis board</p>
  </div>
) : (
  // ... existing text message rendering ...
)}
```

### 3. Render the modal at the bottom of the component

```tsx
<PgnViewerModal
  open={pgnViewerOpen}
  onOpenChange={setPgnViewerOpen}
  pgn={selectedPgn}
/>
```

### 4. Add import

```tsx
import PgnViewerModal from "@/components/PgnViewerModal";
```

---

## Stockfish WASM — Vite configuration note

The `stockfish` npm package ships a `.js` file that itself loads a `.wasm` file. Vite
needs to serve the WASM file correctly. Add the following to `vite.config.ts`:

```ts
// In the plugins array or optimizeDeps section:
optimizeDeps: {
  exclude: ['stockfish'],
},
assetsInclude: ['**/*.wasm'],
```

If the `new URL('stockfish/...', import.meta.url)` worker pattern causes issues with
Vite's bundler, an alternative is to copy the stockfish files to `client/public/` and
reference them as `/stockfish-nnue-16.js`. The `stockfish` package README documents
both approaches.

**Important:** Stockfish WASM requires `SharedArrayBuffer`, which requires the
following HTTP headers on the dev server and production:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Add these headers to `server/_core/index.ts` (or wherever the Express app is
configured):

```ts
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  next();
});
```

**Note:** If COOP/COEP headers cause issues with the Manus OAuth redirect flow (which
opens a popup), you may need to scope these headers only to routes that serve the PGN
viewer page, or use a fallback engine depth without `SharedArrayBuffer`. Test the OAuth
login flow after adding these headers.

An alternative that avoids `SharedArrayBuffer` entirely: use `stockfish.wasm` (the
older single-threaded WASM build, available as `stockfish/src/stockfish.js`) which is
slower but does not require COOP/COEP. Recommend starting with the single-threaded
version and upgrading to multi-threaded if performance is insufficient.

---

## Design Notes

- **Cyberpunk-lite theme**: The modal should use the same dark glassmorphism style as
  the rest of the app. Board squares can use custom colors — dark squares `#1a1a2e`,
  light squares `#2d2d4e`, or use the default react-chessboard colors and override with
  `customDarkSquareStyle` and `customLightSquareStyle` props.
- **Engine eval bar**: Use `bg-white` for the white portion and `bg-gray-900` for the
  black portion. The bar label (e.g. `+1.2`) should use `text-cyan-400` to match the
  accent color.
- **Active move highlight**: Use `text-cyan-400 font-bold` for the currently selected
  move in the move list.
- **Best-move arrow**: Use `rgba(0, 255, 200, 0.7)` (electric cyan) for the arrow color.
- **Modal size**: Use `max-w-4xl` for the Dialog to give the board enough space.
  On mobile, the board should be full-width with the move list below.

---

## Tests: `server/sprint49.test.ts`

Since this is a pure frontend feature, server-side tests are minimal. Add:

1. A smoke test confirming that `messages.getForLesson` returns the `contentType`
   field (the PGN viewer branches on this — regression guard).
2. A test confirming that a 500,000-character PGN message can be sent and retrieved
   (end-to-end validator + DB round-trip).

No new tRPC procedures or DB schema changes are needed.

---

## Files to Touch

| File | Change |
|------|--------|
| `client/src/components/PgnViewerModal.tsx` | **New file** — full analysis board modal |
| `client/src/components/MessageThread.tsx` | Add click handler on PGN bubbles + render `<PgnViewerModal>` |
| `vite.config.ts` | Add `optimizeDeps.exclude: ['stockfish']` and `assetsInclude: ['**/*.wasm']` |
| `server/_core/index.ts` | Add COOP/COEP headers (required for Stockfish WASM SharedArrayBuffer) |
| `server/sprint49.test.ts` | New test file — smoke tests for contentType field + large PGN round-trip |
| `package.json` | `pnpm add chess.js react-chessboard stockfish` |

---

## Acceptance Criteria

- [ ] Clicking a PGN message bubble opens the analysis modal
- [ ] The chessboard displays the correct position for the selected move
- [ ] Clicking any move in the move list navigates to that position
- [ ] Prev/Next/First/Last navigation buttons work correctly
- [ ] Arrow keys (←/→) navigate moves; ↑/↓ jump to start/end
- [ ] Flip board button switches perspective
- [ ] Stockfish engine evaluates the current position and shows centipawn score
- [ ] Best-move arrow is drawn on the board in electric cyan
- [ ] Engine depth counter increments as Stockfish searches deeper
- [ ] Malformed or empty PGN shows an empty starting board without crashing
- [ ] The existing "Copy PGN" button still works (not broken by the click handler)
- [ ] OAuth login flow still works after adding COOP/COEP headers
- [ ] `pnpm test` passes (374+ tests)
- [ ] `npx tsc --noEmit` exits 0
- [ ] Works on mobile (board full-width, move list below)

---

## Out of Scope for This Sprint

- Saving annotations/notes back to the server (future sprint)
- Opening explorer integration
- Multiple variation trees (only main line for now)
- Puzzle mode
- Engine vs. engine analysis
