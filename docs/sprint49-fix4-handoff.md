# Sprint 49 Fix-4 Handoff — Engine Stability + UX Polish

**Branch:** continue on `claude/code-audit-review-icD40`
**File:** `client/src/components/PgnViewerModal.tsx` only — no backend, no new deps
**Tests:** 376 must still pass, tsc must exit 0

---

## S49-12: Engine 3-Step Degradation — Root Cause and Fix

### Root Cause

`setoption name MultiPV value 3` is currently sent in the **per-position evaluation effect** (line 239), between `stop` and `go infinite`:

```
stop → position fen X → setoption name MultiPV value 3 → go infinite
```

This is wrong. `setoption` is an **initialization command** — it configures the engine before a search. Sending it between `stop` and `go infinite` on every position change causes the single-threaded WASM engine to stall intermittently. The 3-step pattern (works → depth 9 stall → depth 0) is the engine getting progressively confused by receiving `setoption` mid-stream.

### Fix

Move `setoption name MultiPV value 3` to the **engine initialization sequence** in `startEngine()`, between `uci` and `isready`. It only needs to be set once per worker lifetime.

**In `startEngine()` (line 215), change:**
```ts
worker.postMessage("uci");
```
**To:**
```ts
worker.postMessage("uci");
// setoption is sent after uciok, before isready — see onmessage handler
```

**In the `onmessage` handler, change the `uciok` branch (line 167-169):**
```ts
if (line === "uciok") {
  worker.postMessage("setoption name MultiPV value 3");
  worker.postMessage("isready");
  return;
}
```

**In the evaluation effect (lines 237-240), remove `setoption`:**
```ts
stockfishRef.current.postMessage("stop");
stockfishRef.current.postMessage(`position fen ${fen}`);
// setoption MultiPV is set once at init — do NOT send here
stockfishRef.current.postMessage("go infinite");
```

The per-position hot path is now the minimal 3-command sequence: `stop → position fen X → go infinite`. No configuration commands in the hot path.

---

## S49-13: Show Full PV Line (4-5 Moves Deep) Per Variation

### Current behavior

Each variation row shows only the first move of the PV (`Nf3`).

### Required behavior

Each variation row shows the full PV line, 4-5 moves deep, like Lichess:
```
1  +0.3  Nf3 d5 e3 Nc6 Bb5
2  +0.1  d4 Nf6 c4 e6 Nc3
3   0.0  c4 c5 Nf3 Nf6 Nc3
```

### Changes

**1. Update the `Variation` type** — store the full PV array instead of just the first move:

```ts
type Variation = {
  multipv: number;
  eval: Evaluation;
  pvUci: string[];   // full PV as UCI moves (e.g. ["e2e4", "e7e5", "g1f3"])
};
```

**2. Add a `pvToSan` helper** — converts a sequence of UCI moves to SAN, starting from a given FEN:

```ts
function pvToSan(pvUci: string[], startFen: string, maxMoves = 5): string {
  if (!pvUci.length || !startFen) return "";
  try {
    const chess = new Chess(startFen);
    const san: string[] = [];
    for (const uci of pvUci.slice(0, maxMoves)) {
      const move = chess.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci[4] ?? undefined,
      });
      if (!move) break;
      san.push(move.san);
    }
    return san.join(" ");
  } catch {
    return pvUci.slice(0, maxMoves).map((u) => `${u.slice(0, 2)}→${u.slice(2, 4)}`).join(" ");
  }
}
```

**3. Update the multipv parser** in `onmessage` — parse the full PV, not just the first move:

The UCI info line format is:
```
info depth 18 ... multipv 2 score cp 20 ... pv d2d4 d7d5 c2c4 e7e6 g1f3
```
The `pv` token is followed by all remaining moves to end of line. Parse them all:

```ts
// Replace the current pvMatch line:
const pvIdx = line.indexOf(" pv ");
const pvUci = pvIdx >= 0 ? line.slice(pvIdx + 4).trim().split(/\s+/) : [];

if (multipvMatch && pvUci.length > 0) {
  const mpv = parseInt(multipvMatch[1], 10);
  // ... eval parsing unchanged ...
  setVariations((prev) => {
    const next = prev.filter((v) => v.multipv !== mpv);
    return [...next, { multipv: mpv, eval: ev, pvUci }].sort(
      (a, b) => a.multipv - b.multipv
    );
  });
  if (mpv === 1) {
    setBestMove(pvUci[0] ?? null);  // arrow still uses first move only
    if (ev) setEvaluation(ev);
  }
}
```

**4. Update the variation display UI** — show the full PV line:

```tsx
{variations.map((v) => (
  <div key={v.multipv} className="flex items-start gap-2 text-xs font-mono py-0.5">
    <span className="text-muted-foreground w-3 shrink-0">{v.multipv}</span>
    <span style={{ color: BRAND, minWidth: "3rem", flexShrink: 0 }}>
      {evalLabel(v.eval)}
    </span>
    <span className="text-foreground leading-relaxed">
      {pvToSan(v.pvUci, fens[currentIndex])}
    </span>
  </div>
))}
```

**5. Update `bestMove` usage** — the arrow still uses `pvUci[0]` (first move only), unchanged.

**6. Remove `uciToSan` call for the "Best:" line** — now redundant since `pvToSan` handles it. The `Best:` line can use `pvToSan(variations[0]?.pvUci ?? [], fens[currentIndex], 1)` or keep using `uciToSan(bestMove, fens[currentIndex])` — either works.

---

## S49-14: Larger Dialog

### Change

In the `<DialogContent>` element (line 274), change `max-w-4xl` to `max-w-[92vw]`:

```tsx
<DialogContent className="max-w-[92vw] w-full">
```

`max-w-[92vw]` gives a responsive large dialog on all screen sizes without overflowing. The board will automatically fill more of the available width since it's `flex-[3]` in the layout.

Also increase the move list max-height to use more of the available space:

```tsx
// Line 360 — increase max-h values:
className="overflow-y-auto max-h-[320px] sm:max-h-[480px] font-mono text-sm border border-border/40 rounded-md"
```

---

## S49-15: Eval Bar — Grow From Center (White Up, Black Down)

### Current behavior

The bar fills from the **bottom** upward. White advantage = bar fills up from bottom. This is correct for white but the midpoint (50%) is not visually centered — the bar is just a single-color fill from the bottom.

### Required behavior

The bar should have a **visual midpoint** at the center of the bar. White advantage fills **upward from center** in terracotta orange. Black advantage fills **downward from center** in a dark color (the bar background). Equal position = bar is half orange (bottom half) / half dark (top half) — the dividing line is exactly at center.

This is the Lichess model: the bar is split at 50%, white fills from bottom to the split point, black fills from the split point to the top.

### Implementation

The current `evalToPercent` returns 0–100 where 50 = equal. The fill height is `${evalPct}%` from the bottom. This is already correct — the issue is purely visual: there's no center marker.

Add a **center line marker** to the eval bar:

```tsx
<div
  className="relative w-4 shrink-0 self-stretch rounded overflow-hidden border border-border/30"
  style={{ backgroundColor: "#151B22" }}
  title="Engine evaluation"
>
  {/* White (advantage) fill — grows upward from bottom */}
  <div
    className="absolute bottom-0 left-0 right-0 transition-[height] duration-500"
    style={{ height: `${evalPct}%`, backgroundColor: BRAND }}
  />
  {/* Center line — visual midpoint marker */}
  <div
    className="absolute left-0 right-0"
    style={{
      top: "50%",
      height: "1px",
      backgroundColor: "rgba(244,239,230,0.25)",
      zIndex: 2,
    }}
  />
  {/* Eval label — positioned at the fill boundary for dynamic feel */}
  <span
    className="absolute left-1/2 -translate-x-1/2 text-[8px] font-mono z-10 whitespace-nowrap"
    style={{
      // Position label just above the fill line, or at bottom if fill is very small
      bottom: evalPct > 15 ? `${evalPct}%` : "2px",
      color: BRAND,
    }}
  >
    {evalLabel(evaluation)}
  </span>
</div>
```

The center line at `top: 50%` gives the user a clear visual reference: when the bar fill reaches the center line, the position is equal. Above center = white advantage; below center = black advantage.

**Note on label positioning:** Moving the label to float at the fill boundary (rather than fixed at bottom) makes it feel dynamic and connected to the evaluation. When eval is near 0, the label sits near the center line. When white is clearly better, the label floats higher.

---

## S49-16: Flip Board Button Visibility

The `FlipHorizontal2` button already exists (line 404–412) and works. The issue from the screenshots is that it's visually indistinct from the nav buttons.

Make it more prominent by adding a label and moving it to a dedicated row above the engine status:

```tsx
{/* Flip board — dedicated row for visibility */}
<div className="flex items-center gap-2 mt-2">
  <Button
    variant="outline"
    size="sm"
    onClick={() => setBoardOrientation((o) => (o === "white" ? "black" : "white"))}
    aria-label="Flip board"
    className="gap-1.5 text-xs"
  >
    <FlipHorizontal2 className="h-3.5 w-3.5" />
    Flip board
  </Button>
  <span className="text-xs text-muted-foreground">
    {boardOrientation === "white" ? "White's perspective" : "Black's perspective"}
  </span>
</div>
```

Remove the `FlipHorizontal2` button from the navigation controls row (line 404–412) since it now has its own row.

---

## Summary of All Changes

All in `client/src/components/PgnViewerModal.tsx`:

| Item | Change |
|------|--------|
| S49-12 | `setoption MultiPV 3` moved to `uciok` handler (init); removed from per-position eval effect |
| S49-13 | `Variation.pvUci: string[]` (full PV); `pvToSan()` helper; variation rows show full 5-move line |
| S49-14 | `DialogContent` → `max-w-[92vw]`; move list `max-h` increased |
| S49-15 | Eval bar: center line marker at `top: 50%`; eval label floats at fill boundary |
| S49-16 | Flip board gets its own labeled row with perspective indicator; removed from nav row |

---

## Verification

```bash
pnpm test        # 376 tests pass
pnpm check       # tsc exits 0
```

Manual smoke test:
1. Open PGN viewer → large dialog fills most of screen
2. Navigate 5+ moves rapidly with arrow keys → engine depth climbs continuously on EVERY move, no stalls
3. Each variation row shows 4-5 moves: `1  +0.3  Nf3 d5 e3 Nc6 Bb5`
4. Eval bar has a visible center line; orange fill grows up from bottom toward center for white advantage
5. "Flip board" button is clearly labeled with perspective indicator
