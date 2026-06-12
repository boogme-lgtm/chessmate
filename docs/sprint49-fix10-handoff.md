# Sprint 49 Fix-10 Handoff — Branch Picker Keyboard Nav + PGN Auto-Scroll

**Branch:** `claude/code-audit-review-icD40`  
**File to change:** `client/src/components/PgnViewerModal.tsx` (1090 lines after fix-9)  
**Baseline:** checkpoint `97aa3cb4` — 376 tests passing, tsc clean  
**Do NOT touch:** engine UCI state machine, `parsePgnTree`/`buildPgnTree`/`tokenizePgn`, eval bar, board sizing CSS vars, or any server-side code.

---

## Issue S49-30 — Branch Picker Not Keyboard-Navigable

### What the user sees

The first screenshot shows the branch picker open with four options (0-0, h5, b5, Qc7). Pressing `↑`/`↓` does not cycle through the options — instead the `↑` handler calls `leaveSideline(); setCurrentIndex(0)` (jumps to start) and `↓` calls `leaveSideline(); setCurrentIndex(fens.length - 1)` (jumps to end). The picker is mouse-only.

### Root cause

The keyboard handler at line 761–771 runs `↑`/`↓` unconditionally regardless of whether `branchChoices !== null`. The picker has no focused-row state.

### Fix

**Step 1 — Add `focusedChoiceIndex` state.**

```ts
const [focusedChoiceIndex, setFocusedChoiceIndex] = useState<number>(0);
```

Reset it to 0 whenever `branchChoices` is set (in `handleRightArrow`, where `setBranchChoices([...])` is called):

```ts
setBranchChoices([...]);
setFocusedChoiceIndex(0); // always start with main line highlighted
```

**Step 2 — Update the keyboard handler** (lines 761–771). Guard `↑`/`↓` on `branchChoices !== null`:

```ts
const handler = (e: KeyboardEvent) => {
  // ── Branch picker is open — ↑/↓/Enter/Space/Escape navigate the list ──
  if (branchChoices !== null) {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedChoiceIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedChoiceIndex((i) => Math.min(branchChoices.length - 1, i + 1));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      chooseBranch(branchChoices[focusedChoiceIndex]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setBranchChoices(null);
      setCurrentIndex((i) => Math.min(fens.length - 1, i + 1));
    }
    return; // consume all keys while picker is open
  }

  // ── Normal navigation — picker is closed ──
  if (e.key === "ArrowLeft") { e.preventDefault(); leaveSideline(); setCurrentIndex((i) => Math.max(0, i - 1)); }
  if (e.key === "ArrowRight") { e.preventDefault(); handleRightArrow(); }
  if (e.key === "ArrowUp") { e.preventDefault(); leaveSideline(); setCurrentIndex(0); }
  if (e.key === "ArrowDown") { e.preventDefault(); leaveSideline(); setCurrentIndex(fens.length - 1); }
};
```

The `useEffect` dependency array needs `focusedChoiceIndex` added (it's read inside the handler via closure).

**Step 3 — Update the Popover item rendering** to show the focused row visually:

```tsx
{branchChoices.map((choice, i) => (
  <button
    key={i}
    onClick={() => chooseBranch(choice)}
    className={`block w-full text-left text-xs px-3 py-1.5 rounded font-mono ${
      i === focusedChoiceIndex ? "bg-muted/60" : "hover:bg-muted/60"
    } ${choice.isMainLine ? "font-semibold" : "text-muted-foreground"}`}
    style={
      i === focusedChoiceIndex || choice.isMainLine
        ? { color: BRAND }
        : undefined
    }
  >
    {i === focusedChoiceIndex ? "▶ " : choice.isMainLine ? "★ " : "   "}
    {choice.label}
  </button>
))}
```

The `▶` prefix on the focused row gives a clear visual cursor regardless of whether the user is using keyboard or mouse.

---

## Issue S49-31 — PGN Viewer Does Not Scroll to Follow the Current Move

### What the user sees

The second screenshot shows the board on move h5 (deep in the game), but the PGN text panel is still scrolled to the top showing the opening moves. The active move (bold terracotta) is somewhere below the visible area — the user cannot see where they are in the game.

### Root cause

The `MoveList` component renders the active move with `font-bold` and `color: BRAND` but has no scroll-following logic. The parent `div.overflow-y-auto` at line 943 never scrolls programmatically.

### Fix

The cleanest approach is a `useEffect` in the **parent component** (`PgnViewerModal`) that fires whenever `displayFen` changes and scrolls the active move button into view. This avoids threading refs through the recursive `MoveList` tree.

**Step 1 — Add a `data-active` attribute to the active move button in `MoveList`.**

In the `<button>` element (line 400), add:

```tsx
data-active={isActive ? "true" : undefined}
```

So the button becomes:

```tsx
<button
  data-active={isActive ? "true" : undefined}
  onClick={...}
  className={...}
  style={...}
>
```

**Step 2 — Add a ref to the move list container in `PgnViewerModal`.**

```ts
const moveListRef = useRef<HTMLDivElement>(null);
```

Attach it to the `div` at line 947 (the `p-2 leading-relaxed` wrapper):

```tsx
<div ref={moveListRef} className="p-2 leading-relaxed">
```

**Step 3 — Add a `useEffect` that scrolls the active button into view when `displayFen` changes.**

```ts
useEffect(() => {
  if (!moveListRef.current) return;
  const activeBtn = moveListRef.current.querySelector<HTMLElement>('[data-active="true"]');
  if (activeBtn) {
    activeBtn.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
}, [displayFen]);
```

`block: "nearest"` is the correct value here — it only scrolls if the element is outside the visible area, and scrolls the minimum distance needed. It never jumps the user away from where they are if the active move is already visible.

The `scrollIntoView` call targets the `button` element directly. Since the button is inside the `div.overflow-y-auto` at line 943, the browser will scroll that container (not the window) to bring the button into view — this is the correct behavior.

**Note on `behavior: "smooth"`:** smooth scrolling can feel laggy on rapid keyboard navigation (holding `→`). If this is a problem in practice, change to `behavior: "instant"`. The handoff recommends starting with `"smooth"` and adjusting based on feedback.

---

## Summary of All Changes

All changes are in `client/src/components/PgnViewerModal.tsx`:

| Item | Change |
|------|--------|
| S49-30 — focused state | Add `focusedChoiceIndex` state; reset to 0 in `handleRightArrow` when picker opens |
| S49-30 — keyboard handler | Guard `↑`/`↓`/`Enter`/`Space`/`Escape` on `branchChoices !== null`; normal `↑`/`↓` only when picker is closed |
| S49-30 — picker UI | Show `▶` prefix and `bg-muted/60` on the focused row; `focusedChoiceIndex` in deps array |
| S49-31 — data-active | Add `data-active={isActive ? "true" : undefined}` to the active move `<button>` in `MoveList` |
| S49-31 — ref | Add `moveListRef` on the `p-2 leading-relaxed` div |
| S49-31 — scroll effect | `useEffect` on `displayFen` → query `[data-active="true"]` → `scrollIntoView` |

No new imports needed. No backend changes. No new npm packages.

---

## Verification

```bash
pnpm test    # must still be 376 passing
pnpm check   # tsc exits 0
```

Manual smoke test:
1. Open an annotated PGN. Press `→` to a bifurcation — picker opens with first option highlighted (▶ terracotta). Press `↓` — focus moves to next option. Press `↓` again — third option. Press `↑` — back to second. Press `Enter` — board jumps to that position, picker closes.
2. Press `→` to a bifurcation. Press `Escape` — picker closes, main line advances.
3. Navigate to a move deep in the game (e.g. move 20+). The PGN text panel should scroll to keep the active move visible. Press `←` — panel scrolls back. Press `→` — panel scrolls forward.
4. Click a sideline move in the text panel — panel should scroll to keep that move visible.

---

## Important: Do NOT Change

- The UCI state machine (`pendingFenRef`, `searchingRef`, `dispatchSearch`, `bestmove` gate, watchdog).
- The `parsePgnTree`/`buildPgnTree`/`tokenizePgn` functions or `PgnNode` type.
- The `--board-size` CSS var, `sm:max-w-[96vw]`, or the board wrapper sizing.
- The eval bar fill direction, midpoint notch, or `evalToPercent`/`evalLabel`.
- The `onMouseDownCapture` focus-ring suppressor on the board wrapper div.
- Any server-side files.
