# Sprint 49 Fix-11 Handoff — Right-Arrow Picker Confirm + Sideline Continuation

**Branch:** `claude/code-audit-review-icD40`  
**File to change:** `client/src/components/PgnViewerModal.tsx`  
**Baseline:** checkpoint `bf0c5650` — 376 tests passing, tsc clean  
**Do NOT touch:** engine UCI state machine, `parsePgnTree`/`buildPgnTree`/`tokenizePgn`, eval bar, board sizing CSS vars, `onMouseDownCapture` focus-ring suppressor, or any server-side code.

---

## Issue S49-32 — Three Related Right-Arrow Navigation Bugs

### Bug 1: `→` while picker is open confirms the main line, not the focused choice

**Current code (line 794–798):**
```ts
} else if (e.key === "ArrowRight") {
  // → again while picker is open = accept the main line (fix-9)
  e.preventDefault();
  handleRightArrow();
}
```

`handleRightArrow()` when `branchChoices !== null` calls `setBranchChoices(null)` and `setCurrentIndex((i) => i + 1)` — always the main line, regardless of `focusedChoiceIndex`.

**Fix:** Replace the `ArrowRight` branch in the picker-open block with `chooseBranch`:

```ts
} else if (e.key === "ArrowRight") {
  e.preventDefault();
  chooseBranch(branchChoices[focusedChoiceIndex]);
}
```

This makes `→` behave identically to `Enter`/`Space` — it confirms whatever row is currently focused (main line if index 0, sideline if the user pressed `↓`).

---

### Bug 2: After choosing a sideline, `→` redirects to the main line

**Root cause:** `selectedFen` stores the FEN of the sideline position, but `handleRightArrow` always reads from `pgnNodes[currentIndex]` — the main-line node at the current cursor. When the user is on a sideline, `pgnNodes[currentIndex]` is the main-line move at the same depth, not the sideline's next move.

**The architecture problem:** The current state model has two separate cursors:
- `currentIndex` — main-line cursor (used for `fens[]` and `pgnNodes[]`)
- `selectedFen` — sideline override (a FEN string with no associated tree node)

When `selectedFen !== null`, the board shows the sideline position, but `handleRightArrow` has no way to find the next move in the sideline because `selectedFen` is just a FEN — there's no pointer to the `PgnNode` that produced it.

**Fix:** Add a `selectedNode` state that stores the full `PgnNode` when a sideline is selected, not just the FEN.

```ts
// Replace:
const [selectedFen, setSelectedFen] = useState<string | null>(null);
const [selectedLastMove, setSelectedLastMove] = useState<{ from: string; to: string } | null>(null);

// With:
const [selectedNode, setSelectedNode] = useState<PgnNode | null>(null);
```

`displayFen` becomes:
```ts
const displayFen = selectedNode?.fen ?? fens[currentIndex] ?? fens[0];
```

`lastMoveSquares` becomes:
```ts
const lastMoveSquares =
  selectedNode !== null
    ? { from: selectedNode.from, to: selectedNode.to }
    : lastMoves[currentIndex] ?? null;
```

Update every call site that currently sets `selectedFen`/`selectedLastMove`:
- `setSelectedFen(null); setSelectedLastMove(null);` → `setSelectedNode(null);`
- `setSelectedFen(choice.fen); setSelectedLastMove({ from: choice.from, to: choice.to });` → `setSelectedNode(choiceNode);`
- `selectFen(fen, from, to)` callback → `selectNode(node: PgnNode)` callback

The `MoveList` `onSelectFen` prop becomes `onSelectNode: (node: PgnNode) => void`.

---

### Bug 3: `handleRightArrow` when on a sideline

With `selectedNode` in place, `handleRightArrow` can now navigate within a sideline:

```ts
const handleRightArrow = useCallback(() => {
  // Picker is open — → confirms the focused choice (handled in keyboard effect)
  // This function is only called when picker is CLOSED.
  
  if (selectedNode !== null) {
    // We are on a sideline. Find the next move in this sideline's parent array.
    // selectedNode.id uniquely identifies the node; we need its parent variation array.
    // The simplest approach: store the sideline array alongside the node.
    // See "selectedSideline" state below.
  } else {
    // Main line navigation
    setSelectedNode(null);
    const nextNode = pgnNodes[currentIndex];
    if (!nextNode) return;
    if (nextNode.variations.length > 0) {
      // Open picker
      setBranchChoices([...]);
      setFocusedChoiceIndex(0);
    } else {
      setCurrentIndex((i) => Math.min(fens.length - 1, i + 1));
    }
  }
}, [...]);
```

To navigate within a sideline, we need to know which array the current node belongs to and what its index is within that array. The cleanest approach is to store the **sideline array** and **sideline index** alongside `selectedNode`:

```ts
type SidelineContext = {
  node: PgnNode;
  varArray: PgnNode[];   // the variation array this node belongs to
  varIndex: number;      // index of this node within varArray
};
const [sidelineCtx, setSidelineCtx] = useState<SidelineContext | null>(null);
```

`displayFen` → `sidelineCtx?.node.fen ?? fens[currentIndex] ?? fens[0]`

When a sideline choice is made:
```ts
const chooseBranch = useCallback((choice: BranchChoiceWithNode) => {
  setBranchChoices(null);
  if (choice.isMainLine) {
    setSidelineCtx(null);
    setCurrentIndex((i) => Math.min(fens.length - 1, i + 1));
  } else {
    setSidelineCtx({
      node: choice.node,
      varArray: choice.varArray,
      varIndex: 0,
    });
  }
}, [fens.length]);
```

`branchChoices` entries need to carry the full node and array:
```ts
type BranchChoice = {
  label: string;
  node: PgnNode;
  varArray: PgnNode[] | null; // null for main line
  varIndex: number;
  isMainLine: boolean;
};
```

`handleRightArrow` when `sidelineCtx !== null`:
```ts
if (sidelineCtx !== null) {
  const { varArray, varIndex } = sidelineCtx;
  const nextVarIndex = varIndex + 1;
  if (nextVarIndex < varArray.length) {
    const nextNode = varArray[nextVarIndex];
    if (nextNode.variations.length > 0) {
      // Bifurcation within the sideline — open picker
      setBranchChoices([
        { label: nextNode.san + nextNode.nags.join(""), node: nextNode, varArray, varIndex: nextVarIndex, isMainLine: true },
        ...nextNode.variations.filter(v => v.length > 0).map(v => ({
          label: v[0].san + v[0].nags.join(""),
          node: v[0],
          varArray: v,
          varIndex: 0,
          isMainLine: false,
        })),
      ]);
      setFocusedChoiceIndex(0);
    } else {
      setSidelineCtx({ node: nextNode, varArray, varIndex: nextVarIndex });
    }
  }
  // If nextVarIndex >= varArray.length, we're at the end of the sideline — do nothing.
  return;
}
```

`←` when on a sideline:
```ts
if (sidelineCtx !== null) {
  const { varArray, varIndex } = sidelineCtx;
  if (varIndex > 0) {
    const prevNode = varArray[varIndex - 1];
    setSidelineCtx({ node: prevNode, varArray, varIndex: varIndex - 1 });
  } else {
    // At the start of the sideline — go back to the main line position before the variation
    setSidelineCtx(null);
    // currentIndex is already pointing to the position before the sideline started
    // (the sideline branches from pgnNodes[currentIndex - 1].variations)
    // No need to change currentIndex.
  }
  return;
}
```

`leaveSideline` → `setSidelineCtx(null)`.

---

## Summary of All State Changes

Replace `selectedFen` + `selectedLastMove` with `sidelineCtx: SidelineContext | null`.

| Old state | New state |
|---|---|
| `selectedFen: string \| null` | `sidelineCtx: SidelineContext \| null` |
| `selectedLastMove: {from,to} \| null` | (folded into `sidelineCtx.node`) |

```ts
type SidelineContext = {
  node: PgnNode;       // current node in the sideline
  varArray: PgnNode[]; // the variation array this node belongs to
  varIndex: number;    // index of node within varArray
};
```

`displayFen` = `sidelineCtx?.node.fen ?? fens[currentIndex] ?? fens[0]`

`lastMoveSquares` = `sidelineCtx !== null ? { from: sidelineCtx.node.from, to: sidelineCtx.node.to } : lastMoves[currentIndex] ?? null`

`MoveList` `displayFen` prop is unchanged — it still receives `displayFen` and compares `node.fen === displayFen` to highlight the active move.

`MoveList` `onSelectFen(fen, from, to)` → `onSelectNode(node: PgnNode, varArray: PgnNode[], varIndex: number)`. The MoveList already has access to the node and its index (`idx`) within the current array, so this is straightforward.

---

## Updated `BranchChoice` Type

```ts
type BranchChoice = {
  label: string;
  node: PgnNode;
  varArray: PgnNode[] | null; // null = main line (uses fens[]/pgnNodes[])
  varIndex: number;
  isMainLine: boolean;
};
```

---

## `chooseBranch` Rewrite

```ts
const chooseBranch = useCallback((choice: BranchChoice) => {
  setBranchChoices(null);
  if (choice.isMainLine) {
    setSidelineCtx(null);
    setCurrentIndex((i) => Math.min(fens.length - 1, i + 1));
  } else {
    setSidelineCtx({
      node: choice.node,
      varArray: choice.varArray!,
      varIndex: choice.varIndex,
    });
  }
}, [fens.length]);
```

---

## `handleRightArrow` Rewrite

```ts
const handleRightArrow = useCallback(() => {
  if (sidelineCtx !== null) {
    // Navigate within the current sideline
    const { varArray, varIndex } = sidelineCtx;
    const nextIdx = varIndex + 1;
    if (nextIdx >= varArray.length) return; // end of sideline
    const nextNode = varArray[nextIdx];
    if (nextNode.variations.length > 0) {
      setBranchChoices([
        { label: nextNode.san + nextNode.nags.join(""), node: nextNode, varArray, varIndex: nextIdx, isMainLine: true },
        ...nextNode.variations.filter(v => v.length > 0).map(v => ({
          label: v[0].san + v[0].nags.join(""),
          node: v[0], varArray: v, varIndex: 0, isMainLine: false,
        })),
      ]);
      setFocusedChoiceIndex(0);
    } else {
      setSidelineCtx({ node: nextNode, varArray, varIndex: nextIdx });
    }
    return;
  }

  // Main line
  setSelectedFen_REMOVED(); // no-op, sidelineCtx is already null
  const nextNode = pgnNodes[currentIndex];
  if (!nextNode) return;
  if (nextNode.variations.length > 0) {
    setBranchChoices([
      { label: nextNode.san + nextNode.nags.join(""), node: nextNode, varArray: null, varIndex: -1, isMainLine: true },
      ...nextNode.variations.filter(v => v.length > 0).map(v => ({
        label: v[0].san + v[0].nags.join(""), node: v[0], varArray: v, varIndex: 0, isMainLine: false,
      })),
    ]);
    setFocusedChoiceIndex(0);
  } else {
    setCurrentIndex((i) => Math.min(fens.length - 1, i + 1));
  }
}, [sidelineCtx, pgnNodes, currentIndex, fens.length]);
```

---

## Keyboard Handler Change (Bug 1)

In the `branchChoices !== null` block, replace:
```ts
} else if (e.key === "ArrowRight") {
  e.preventDefault();
  handleRightArrow(); // was: accept main line
}
```
With:
```ts
} else if (e.key === "ArrowRight") {
  e.preventDefault();
  chooseBranch(branchChoices[focusedChoiceIndex]); // confirm focused choice
}
```

---

## `←` Handler Change (Sideline Back-Navigation)

In the normal-navigation block, replace:
```ts
if (e.key === "ArrowLeft") { e.preventDefault(); leaveSideline(); setCurrentIndex((i) => Math.max(0, i - 1)); }
```
With:
```ts
if (e.key === "ArrowLeft") {
  e.preventDefault();
  if (sidelineCtx !== null) {
    if (sidelineCtx.varIndex > 0) {
      const prevNode = sidelineCtx.varArray[sidelineCtx.varIndex - 1];
      setSidelineCtx({ node: prevNode, varArray: sidelineCtx.varArray, varIndex: sidelineCtx.varIndex - 1 });
    } else {
      setSidelineCtx(null); // back to main line at currentIndex
    }
  } else {
    setCurrentIndex((i) => Math.max(0, i - 1));
  }
}
```

---

## `MoveList` Prop Change

Change `onSelectFen: (fen: string, from: string, to: string) => void` to `onSelectNode: (node: PgnNode, varArray: PgnNode[], varIndex: number) => void`.

In the `MoveList` button `onClick`:
```tsx
// Old:
onClick={() => depth === 0 ? onSelectMainline(idx + 1) : onSelectFen(node.fen, node.from, node.to)}

// New:
onClick={() => depth === 0 ? onSelectMainline(idx + 1) : onSelectNode(node, nodes, idx)}
```

`nodes` here is the array passed as the `nodes` prop to the current `MoveList` instance — it IS the `varArray` for this level.

In `PgnViewerModal`, `selectFen` becomes `selectNode`:
```ts
const selectNode = useCallback((node: PgnNode, varArray: PgnNode[], varIndex: number) => {
  setBranchChoices(null);
  setSidelineCtx({ node, varArray, varIndex });
}, []);
```

Pass `onSelectNode={selectNode}` to `MoveList`.

---

## Verification

```bash
pnpm test    # must still be 376 passing
pnpm check   # tsc exits 0
```

Manual smoke test:
1. Open an annotated PGN. Press `→` to a bifurcation. Press `↓` to focus the sideline. Press `→` — board jumps to the sideline move (same as `Enter`). ✓
2. With the sideline active, press `→` again — board advances to the next move in the sideline. ✓
3. Press `→` again — continues in the sideline. ✓
4. Press `←` — goes back one move in the sideline. ✓
5. Press `←` until at the start of the sideline — returns to the main line position. ✓
6. Click a sideline move in the text panel — `→` continues in that sideline. ✓
7. Navigate to a bifurcation within a sideline — picker opens correctly. ✓

---

## Important: Do NOT Change

- The UCI state machine (`pendingFenRef`, `searchingRef`, `dispatchSearch`, `bestmove` gate, watchdog).
- The `parsePgnTree`/`buildPgnTree`/`tokenizePgn` functions or `PgnNode` type.
- The `--board-size` CSS var, `sm:max-w-[96vw]`, or the board wrapper sizing.
- The eval bar fill direction, midpoint notch, or `evalToPercent`/`evalLabel`.
- The `onMouseDownCapture` focus-ring suppressor on the board wrapper div.
- The `data-active` + `moveListRef` + scroll effect (S49-31).
- Any server-side files.
