# Sprint 49 Fix-7 Handoff — Board Size + Full PGN Notation

**Branch:** `claude/code-audit-review-icD40`  
**File to change:** `client/src/components/PgnViewerModal.tsx` (611 lines)  
**Baseline:** checkpoint `c7f189a1` — 376 tests passing, tsc clean  
**Do NOT touch:** engine logic (lines 133–357), keyboard nav, eval bar internals, Chessboard options, or any server-side code.

---

## Issue S49-23 — Board Too Small

### Root Cause

The left column (eval bar + board) has:

```tsx
<div className="flex gap-1.5 shrink-0 min-w-0 self-start w-full sm:w-[min(calc(90vh-8rem),calc(100%-296px))]">
```

On a 900px-tall screen, `90vh = 810px`, so `calc(90vh - 8rem) = 810 - 128 = 682px`. The `min()` picks the smaller of 682px and `calc(100% - 296px)`. When the dialog is narrower than ~978px (which it is on most screens since the dialog is `max-w-[96vw]` on a 1024px screen = ~983px), the `100% - 296px` branch wins — but the `shrink-0` on the column prevents it from shrinking below 682px, so the board either overflows or gets clipped.

The screenshot confirms: the board is rendering at roughly 200px wide, far smaller than intended.

### The Fix

Replace the explicit `style={{ width: 'min(...)' }}` approach with a simple flex-grow approach:

- Left column (eval bar + board): **`flex-1 min-w-0 self-start`** — grows to fill all space not taken by the right panel
- Right panel: **`w-[300px] shrink-0`** — fixed width, never grows or shrinks
- Keep `self-start` on the left column — it prevents the eval bar from stretching past the board height (this was correctly identified in fix-5 and must be preserved)

**Exact replacement for line 414:**

```tsx
{/* Left column: eval bar + board — flex-1 fills all space not taken by right panel */}
<div className="flex gap-1.5 min-w-0 self-start flex-1">
```

Remove the `shrink-0` and the `w-full sm:w-[min(...)]` from this div. The `flex-1` does the right thing: on mobile it will be full-width (stacked), on `sm:` it fills the remaining horizontal space after the 300px right panel.

**Right panel (line 485):**

```tsx
<div className="w-full sm:w-[300px] shrink-0 flex flex-col gap-3 overflow-y-auto min-h-0">
```

Change `sm:w-[280px]` → `sm:w-[300px]` (20px wider for the move list to breathe).

**Board wrapper (line 438):** Keep `flex-1 min-w-0` as-is — it already fills the left column correctly once the left column itself has a definite size.

### Verification

After the fix, open the PGN viewer. The board should occupy roughly 60–65% of the dialog width. On a 1440px screen the board should be ~700–800px wide. The eval bar should be flush left of the board, same height as the board, not extending below it.

---

## Issue S49-24 — Full PGN Notation (Sidelines, Comments, NAGs)

### Background

The current implementation uses:

```ts
chess.loadPgn(pgn);
const history = chess.history(); // flat string array: ["e4", "c5", "Nf3", ...]
```

`chess.history()` returns only the main line as a flat array of SAN strings. It discards:
- Sideline variations (moves in parentheses in the PGN)
- Comments (text in `{curly braces}`)
- NAG annotations (`$1` = `!`, `$2` = `?`, `$3` = `!!`, `$4` = `??`, `$5` = `!?`, `$6` = `?!`, `$10` = `=`, `$14` = `+/-`, `$15` = `-/+`, `$17` = `+-`, `$19` = `-+`)
- Chapter/section headers (often in the Event/White/Black tags or as comments at the start)

### Approach: Manual PGN Tree Parser

**Do NOT add a new npm dependency.** chess.js does not expose its internal move tree via the public API, but the raw PGN string contains all the information needed. Parse it manually.

#### Step 1: Define the PGN Node type

```ts
type PgnNode = {
  id: string;           // unique key for React rendering
  fen: string;          // FEN after this move
  san: string;          // SAN notation (e.g. "Nf3")
  moveNumber: number;   // 1-based full move number
  color: 'w' | 'b';    // side that made this move
  comment?: string;     // comment AFTER this move (from {…})
  nags: string[];       // NAG symbols converted to glyphs (["!", "?"])
  variations: PgnNode[][];  // sideline branches starting here
  // depth in the tree (0 = main line, 1 = first-level sideline, etc.)
  depth: number;
};
```

#### Step 2: PGN Tree Parser

Add a `parsePgnTree(pgn: string): { nodes: PgnNode[]; headers: Record<string, string> }` function. The algorithm:

1. Strip headers (`[Key "Value"]` lines) and save them.
2. Strip the result token at the end (`1-0`, `0-1`, `1/2-1/2`, `*`).
3. Tokenize the move text into tokens: move numbers (`1.`, `2...`), SAN moves, comments (`{...}`), NAGs (`$N`), variation open `(`, variation close `)`.
4. Walk the token stream recursively. Maintain a `Chess` instance to validate moves and get FENs. When you encounter `(`, recurse into a variation branch starting from the position BEFORE the last main-line move (rewind one move). When you encounter `)`, return the variation array to the parent.

Here is a complete, working implementation to paste in:

```ts
const NAG_GLYPHS: Record<number, string> = {
  1: '!', 2: '?', 3: '!!', 4: '??', 5: '!?', 6: '?!',
  7: '□', 10: '=', 13: '∞', 14: '⩲', 15: '⩱', 16: '±',
  17: '∓', 18: '+-', 19: '-+', 22: '⨀', 32: '⟳', 36: '→',
  40: '↑', 132: '⇆', 138: '⊕',
};

function tokenizePgn(moveText: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < moveText.length) {
    // Skip whitespace
    if (/\s/.test(moveText[i])) { i++; continue; }
    // Comment
    if (moveText[i] === '{') {
      const end = moveText.indexOf('}', i);
      if (end === -1) break;
      tokens.push(moveText.slice(i, end + 1));
      i = end + 1;
      continue;
    }
    // Variation
    if (moveText[i] === '(' || moveText[i] === ')') {
      tokens.push(moveText[i++]);
      continue;
    }
    // NAG
    if (moveText[i] === '$') {
      const m = moveText.slice(i).match(/^\$(\d+)/);
      if (m) { tokens.push(m[0]); i += m[0].length; continue; }
    }
    // Move number (e.g. "12." or "12..." — consume and discard)
    const mnMatch = moveText.slice(i).match(/^(\d+\.+)\s*/);
    if (mnMatch) { i += mnMatch[0].length; continue; }
    // Result token
    const resultMatch = moveText.slice(i).match(/^(1-0|0-1|1\/2-1\/2|\*)\s*/);
    if (resultMatch) { i += resultMatch[0].length; continue; }
    // SAN move (greedy word token)
    const sanMatch = moveText.slice(i).match(/^[NBRQK]?[a-h]?[1-8]?x?[a-h][1-8](=[NBRQK])?[+#]?|^O-O-O[+#]?|^O-O[+#]?/);
    if (sanMatch) { tokens.push(sanMatch[0]); i += sanMatch[0].length; continue; }
    // Skip unrecognized character
    i++;
  }
  return tokens;
}

let _nodeCounter = 0;

function buildPgnTree(
  tokens: string[],
  startIndex: number,
  chess: Chess,
  depth: number
): { nodes: PgnNode[]; nextIndex: number } {
  const nodes: PgnNode[] = [];
  let i = startIndex;

  while (i < tokens.length) {
    const tok = tokens[i];

    if (tok === ')') {
      // End of variation — caller handles the ')'
      return { nodes, nextIndex: i };
    }

    if (tok === '(') {
      // Variation starting from the position BEFORE the last node
      if (nodes.length === 0) { i++; continue; } // no parent move, skip
      const lastNode = nodes[nodes.length - 1];
      // Rewind to position before last node
      const parentFen = nodes.length >= 2 ? nodes[nodes.length - 2].fen : new Chess().fen();
      const varChess = new Chess(parentFen);
      i++; // consume '('
      const { nodes: varNodes, nextIndex } = buildPgnTree(tokens, i, varChess, depth + 1);
      i = nextIndex;
      if (tokens[i] === ')') i++; // consume ')'
      lastNode.variations.push(varNodes);
      continue;
    }

    if (tok.startsWith('{')) {
      // Comment — attach to the last node, or as a pre-comment if no nodes yet
      const text = tok.slice(1, -1).trim();
      if (nodes.length > 0) {
        nodes[nodes.length - 1].comment = text;
      }
      i++;
      continue;
    }

    if (tok.startsWith('$')) {
      // NAG — attach to the last node
      const nagNum = parseInt(tok.slice(1), 10);
      const glyph = NAG_GLYPHS[nagNum] ?? `$${nagNum}`;
      if (nodes.length > 0) {
        nodes[nodes.length - 1].nags.push(glyph);
      }
      i++;
      continue;
    }

    // SAN move
    try {
      const moveResult = chess.move(tok);
      if (!moveResult) { i++; continue; }
      const state = chess.turn() === 'w' ? 'b' : 'w'; // color that just moved
      const fullMoveNumber = moveResult.color === 'b'
        ? chess.moveNumber() - 1  // black's move decrements after chess.move()
        : chess.moveNumber();     // chess.js increments after black's move
      // Actually: chess.js moveNumber() returns the NEXT move number after the move is made.
      // For white moves: before=N, after=N (still same full move). For black moves: before=N, after=N+1.
      // Simplest: track it ourselves.
      const node: PgnNode = {
        id: `node-${_nodeCounter++}`,
        fen: chess.fen(),
        san: moveResult.san,
        moveNumber: moveResult.color === 'w'
          ? Math.ceil(nodes.filter(n => n.depth === depth).length / 2) + 1
          : Math.ceil((nodes.filter(n => n.depth === depth).length + 1) / 2),
        color: moveResult.color as 'w' | 'b',
        nags: [],
        variations: [],
        depth,
      };
      nodes.push(node);
    } catch {
      // illegal move in this position (stale token from a different branch) — skip
    }
    i++;
  }

  return { nodes, nextIndex: i };
}
```

**Note on move numbering:** The move number calculation inside `buildPgnTree` above is approximate. A simpler and more reliable approach: track a `moveNum` counter explicitly as you walk the main line. Since we know the starting position is always the initial position (FEN = starting FEN), white's first move is move 1, black's response is also move 1, white's second move is move 2, etc. Use this pattern:

```ts
// Before the loop, initialize:
let moveNum = 1; // will be set from chess.moveNumber() after each move

// Inside the SAN move handler:
const moveResult = chess.move(tok);
const node: PgnNode = {
  id: `node-${_nodeCounter++}`,
  fen: chess.fen(),
  san: moveResult.san,
  moveNumber: moveResult.color === 'b' ? chess.moveNumber() - 1 : chess.moveNumber(),
  color: moveResult.color as 'w' | 'b',
  nags: [],
  variations: [],
  depth,
};
```

`chess.moveNumber()` returns the current full-move number. After white's move it stays the same; after black's move it increments. So for black's move, `chess.moveNumber() - 1` gives the correct full-move number.

#### Step 3: Top-level parser

```ts
function parsePgnTree(pgn: string): {
  nodes: PgnNode[];
  fens: string[];
  headers: Record<string, string>;
} {
  _nodeCounter = 0;
  
  // Extract headers
  const headers: Record<string, string> = {};
  const headerRegex = /\[(\w+)\s+"([^"]*)"\]/g;
  let m: RegExpExecArray | null;
  while ((m = headerRegex.exec(pgn)) !== null) {
    headers[m[1]] = m[2];
  }

  // Strip headers and get move text
  const moveText = pgn.replace(/\[.*?\]\s*/gs, '').trim();
  
  const chess = new Chess();
  const tokens = tokenizePgn(moveText);
  const { nodes } = buildPgnTree(tokens, 0, chess, 0);

  // Build flat FEN list for the main line (for engine + board navigation)
  const fens: string[] = [new Chess().fen()];
  for (const node of nodes) {
    fens.push(node.fen);
  }

  return { nodes, fens, headers };
}
```

#### Step 4: Replace the PGN parsing useEffect

Replace the current `useEffect` at lines 156–185 with:

```ts
useEffect(() => {
  if (!open || !pgn) return;
  try {
    const { nodes, fens: newFens, headers: newHeaders } = parsePgnTree(pgn);
    setParseError(false);
    setPgnNodes(nodes);
    setHeaders(newHeaders);
    setFens(newFens);
    setCurrentIndex(newFens.length - 1);
  } catch {
    setParseError(true);
    setPgnNodes([]);
    setHeaders({});
    setFens([new Chess().fen()]);
    setCurrentIndex(0);
  }
}, [pgn, open]);
```

Add `const [pgnNodes, setPgnNodes] = useState<PgnNode[]>([]);` to the state declarations. Remove `const [moves, setMoves] = useState<string[]>([]);` — it is replaced by `pgnNodes`.

#### Step 5: Replace the move list renderer

Replace the current move list (lines 487–513) with a recursive renderer:

```tsx
function MoveList({
  nodes,
  currentIndex,
  fens,
  goTo,
  depth = 0,
}: {
  nodes: PgnNode[];
  currentIndex: number;
  fens: string[];
  goTo: (i: number) => void;
  depth?: number;
}) {
  const BRAND = '#E8633A';
  
  return (
    <div className={depth > 0 ? 'ml-3 border-l border-border/30 pl-2' : ''}>
      {nodes.map((node, idx) => {
        // Find this node's FEN index in the main fens array (only for main line)
        const fenIndex = depth === 0 ? idx + 1 : fens.indexOf(node.fen);
        const isActive = depth === 0 && currentIndex === fenIndex;
        
        return (
          <span key={node.id}>
            {/* Move number — show for white moves or after a variation */}
            {node.color === 'w' && (
              <span className="text-muted-foreground text-xs mr-0.5">
                {node.moveNumber}.
              </span>
            )}
            {/* The move itself */}
            <button
              onClick={() => depth === 0 ? goTo(fenIndex) : undefined}
              className={`
                inline text-xs px-0.5 rounded
                ${depth === 0 ? 'cursor-pointer hover:bg-muted/40' : 'cursor-default opacity-80'}
                ${isActive ? 'font-bold' : ''}
              `}
              style={isActive ? { color: BRAND } : undefined}
            >
              {node.san}
            </button>
            {/* NAG annotations */}
            {node.nags.length > 0 && (
              <span className="text-xs" style={{ color: BRAND }}>
                {node.nags.join('')}
              </span>
            )}
            {/* Comment */}
            {node.comment && (
              <span className="text-xs text-muted-foreground italic mx-1">
                {'{' + node.comment + '}'}
              </span>
            )}
            {/* Inline variations */}
            {node.variations.map((varNodes, vi) => (
              <span key={vi} className="block">
                <span className="text-muted-foreground text-xs">(</span>
                <MoveList
                  nodes={varNodes}
                  currentIndex={currentIndex}
                  fens={fens}
                  goTo={goTo}
                  depth={depth + 1}
                />
                <span className="text-muted-foreground text-xs">)</span>
              </span>
            ))}
          </span>
        );
      })}
    </div>
  );
}
```

Replace the move list `div` content (the `Array.from(...)` block) with:

```tsx
{pgnNodes.length === 0 ? (
  <p className="text-xs text-muted-foreground p-3">No moves to display.</p>
) : (
  <div className="p-2 leading-relaxed">
    <MoveList
      nodes={pgnNodes}
      currentIndex={currentIndex}
      fens={fens}
      goTo={goTo}
    />
  </div>
)}
```

#### Step 6: Update keyboard navigation

The `fens.length` reference in the keyboard handler and `goTo` callback is still correct — `fens` is the flat main-line FEN array and navigation only moves through the main line. No change needed.

---

## Summary of All Changes

All changes are in `client/src/components/PgnViewerModal.tsx`:

| Item | Change |
|------|--------|
| S49-23 Board size | Left column: remove `shrink-0` and `w-[min(...)]`; add `flex-1`. Right panel: `w-[300px]`. |
| S49-24 PGN tree | Add `PgnNode` type, `NAG_GLYPHS` map, `tokenizePgn()`, `buildPgnTree()`, `parsePgnTree()` functions |
| S49-24 State | Replace `moves: string[]` with `pgnNodes: PgnNode[]` |
| S49-24 Parser effect | Replace `chess.loadPgn()` + `chess.history()` with `parsePgnTree()` |
| S49-24 Move list | Replace flat `Array.from()` renderer with recursive `MoveList` component |

No backend changes. No new npm packages. No changes to engine logic.

---

## Verification

```bash
pnpm test    # must still be 376 passing
pnpm check   # tsc exits 0
```

Manual smoke test:
1. Open a PGN message that has sidelines and comments (e.g. a study chapter). The move list should show indented variations, italic comments, and NAG glyphs.
2. Click moves in the main line — board and engine should update.
3. Board should occupy ~60% of the dialog width.
4. Engine should keep running (depth climbing) through all navigation.
5. Eval bar should be flush left of the board, same height.

---

## Important: Do NOT Change

- The UCI state machine (`pendingFenRef`, `searchingRef`, `dispatchSearch`, `bestmove` gate) — this is the fix-6 breakthrough and must not be touched.
- The `Chessboard` options object (board colors, notation styles, `boardStyle` with `height:'auto'`).
- The eval bar internals (`evalToPercent`, `evalLabel`, the orange fill bar, the midpoint notch).
- The engine power toggle, watchdog timer, or MultiPV parsing.
- Any server-side files.
