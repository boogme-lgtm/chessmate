/**
 * PgnViewerModal — interactive analysis board for a PGN message (S49-1).
 *
 * chess.js parses the PGN; react-chessboard (v5) renders the position;
 * Stockfish (single-threaded WASM, served from /public/stockfish) runs in a
 * Web Worker for evaluation + best-move arrow. Single-threaded build avoids
 * SharedArrayBuffer, so NO COOP/COEP headers are needed (keeps OAuth intact).
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  ChevronFirst,
  ChevronLeft,
  ChevronRight,
  ChevronLast,
  FlipHorizontal2,
  Power,
} from "lucide-react";

interface PgnViewerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pgn: string;
}

type Evaluation =
  | { type: "cp"; value: number } // white-POV centipawns
  | { type: "mate"; value: number } // white-POV mate-in-N (sign = who mates)
  | null;

// S49-11: one engine line from MultiPV analysis.
type Variation = {
  multipv: number; // 1, 2, or 3
  eval: Evaluation; // white-POV
  pvUci: string[]; // S49-13: full PV as UCI moves (e.g. ["e2e4", "e7e5", "g1f3"])
};

const ARROW_COLOR = "rgba(0, 255, 200, 0.7)"; // electric cyan (arrow stays cyan — reads on both square colors)
const BRAND = "#E8633A"; // BooGMe terracotta (S49-8)

function evalToPercent(ev: Evaluation): number {
  if (!ev) return 50;
  if (ev.type === "mate") return ev.value >= 0 ? 100 : 0;
  const clamped = Math.max(-800, Math.min(800, ev.value));
  return 50 + (clamped / 800) * 50;
}

function evalLabel(ev: Evaluation): string {
  if (!ev) return "–";
  if (ev.type === "mate") return `${ev.value >= 0 ? "" : "-"}M${Math.abs(ev.value)}`;
  const pawns = ev.value / 100;
  return `${pawns >= 0 ? "+" : ""}${pawns.toFixed(1)}`;
}

// S49-5: convert a UCI move ("e2e4", "e7e8q") to SAN ("e4", "e8=Q") for the
// status line. Returns null if the move is illegal in the given position.
function uciToSan(uci: string | null, fen: string | undefined): string | null {
  if (!uci || uci.length < 4 || !fen) return null;
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

// S49-13: convert a UCI PV sequence to SAN from a starting position, up to
// maxMoves deep ("Nf3 d5 e3 Nc6 Bb5"). A move that fails to apply (stale PV
// from a previous position) truncates the line at the last legal move; if not
// even the first move applies, fall back to arrow notation.
function pvToSan(pvUci: string[], startFen: string | undefined, maxMoves = 5): string {
  if (!pvUci.length || !startFen) return "";
  const san: string[] = [];
  try {
    const chess = new Chess(startFen);
    for (const uci of pvUci.slice(0, maxMoves)) {
      try {
        const move = chess.move({
          from: uci.slice(0, 2),
          to: uci.slice(2, 4),
          promotion: uci[4] ?? undefined,
        });
        if (!move) break;
        san.push(move.san);
      } catch {
        break;
      }
    }
  } catch {
    /* invalid FEN — fall through to fallback */
  }
  if (san.length > 0) return san.join(" ");
  return pvUci
    .slice(0, maxMoves)
    .map((u) => `${u.slice(0, 2)}→${u.slice(2, 4)}`)
    .join(" ");
}

export default function PgnViewerModal({ open, onOpenChange, pgn }: PgnViewerModalProps) {
  const [moves, setMoves] = useState<string[]>([]);
  const [fens, setFens] = useState<string[]>([new Chess().fen()]);
  const [headers, setHeaders] = useState<Record<string, string | null>>({});
  const [parseError, setParseError] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [boardOrientation, setBoardOrientation] = useState<"white" | "black">("white");
  const [evaluation, setEvaluation] = useState<Evaluation>(null);
  const [bestMove, setBestMove] = useState<string | null>(null);
  const [engineDepth, setEngineDepth] = useState(0);
  const [engineReady, setEngineReady] = useState(false);
  // S49-10: user-controlled engine power switch (off = worker terminated).
  const [engineEnabled, setEngineEnabled] = useState(true);
  // S49-11: top-3 MultiPV lines for the variations table.
  const [variations, setVariations] = useState<Variation[]>([]);

  const stockfishRef = useRef<Worker | null>(null);
  // Side-to-move for the position currently being analyzed, so we can normalize
  // the engine's side-to-move score into a white-POV evaluation.
  const sideToMoveRef = useRef<"w" | "b">("w");

  // ── Parse PGN ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open || !pgn) return;
    const chess = new Chess();
    try {
      chess.loadPgn(pgn);
    } catch {
      setParseError(true);
      setMoves([]);
      setHeaders({});
      setFens([new Chess().fen()]);
      setCurrentIndex(0);
      return;
    }
    const history = chess.history();
    const fenList: string[] = [new Chess().fen()];
    const tmp = new Chess();
    for (const m of history) {
      try {
        tmp.move(m);
        fenList.push(tmp.fen());
      } catch {
        break;
      }
    }
    setParseError(false);
    setMoves(history);
    setHeaders(chess.header());
    setFens(fenList);
    setCurrentIndex(fenList.length - 1); // start at the final position
  }, [pgn, open]);

  // ── Stockfish worker lifecycle (S49-10: restartable) ─────────────────────────
  const stopEngine = useCallback(() => {
    if (stockfishRef.current) {
      try {
        stockfishRef.current.postMessage("quit");
        stockfishRef.current.terminate();
      } catch { /* noop */ }
      stockfishRef.current = null;
    }
    setEngineReady(false);
    setEngineDepth(0);
    setEvaluation(null);
    setBestMove(null);
    setVariations([]);
  }, []);

  const startEngine = useCallback(() => {
    stopEngine(); // terminate any existing worker first — fresh start every time

    let worker: Worker;
    try {
      // Single-threaded build served from /public — no SharedArrayBuffer / COOP-COEP.
      worker = new Worker("/stockfish/stockfish-18-lite-single.js");
    } catch (err) {
      console.error("[PgnViewer] Failed to start Stockfish worker:", err);
      return;
    }
    stockfishRef.current = worker;

    worker.onmessage = (e: MessageEvent) => {
      const line = typeof e.data === "string" ? e.data : e.data?.data;
      if (typeof line !== "string") return;

      if (line === "uciok") {
        // S49-12: setoption is an INITIALIZATION command — set MultiPV exactly
        // once per worker lifetime, here between uci and isready. Sending it in
        // the per-position hot path progressively stalled the single-threaded
        // engine (works → depth-9 stall → depth 0).
        worker.postMessage("setoption name MultiPV value 3");
        worker.postMessage("isready");
        return;
      }
      if (line === "readyok") {
        // S49-7: engineReady flips here (not on uciok) so the evaluation effect
        // only fires once the engine has confirmed it is ready.
        setEngineReady(true);
        return;
      }

      // Depth updates from any info line while `go infinite` runs.
      const depthMatch = line.match(/\bdepth (\d+)/);
      if (depthMatch) setEngineDepth(parseInt(depthMatch[1], 10));

      // S49-11: MultiPV-aware parsing. With MultiPV=3 every PV info line carries
      // "multipv N"; route each line into its variation slot. multipv 1 is the
      // main line and also drives the eval bar, the arrow, and the Best: text.
      // (`bestmove` lines are still ignored — under `go infinite` they only
      // arrive after a stop and always belong to the previous position.)
      const multipvMatch = line.match(/\bmultipv (\d+)/);
      // S49-13: the "pv" token is followed by ALL remaining moves to end of line.
      const pvIdx = line.indexOf(" pv ");
      const pvUci = pvIdx >= 0 ? line.slice(pvIdx + 4).trim().split(/\s+/) : [];
      if (multipvMatch && pvUci.length > 0) {
        const mpv = parseInt(multipvMatch[1], 10);
        const cpMatch = line.match(/score cp (-?\d+)/);
        const mateMatch = line.match(/score mate (-?\d+)/);
        let ev: Evaluation = null;
        if (cpMatch) {
          const cp = parseInt(cpMatch[1], 10);
          ev = { type: "cp", value: sideToMoveRef.current === "w" ? cp : -cp };
        } else if (mateMatch) {
          const m = parseInt(mateMatch[1], 10);
          ev = { type: "mate", value: sideToMoveRef.current === "w" ? m : -m };
        }
        setVariations((prev) => {
          const next = prev.filter((v) => v.multipv !== mpv);
          return [...next, { multipv: mpv, eval: ev, pvUci }].sort(
            (a, b) => a.multipv - b.multipv
          );
        });
        if (mpv === 1) {
          setBestMove(pvUci[0] ?? null); // arrow still uses the first move only
          if (ev) setEvaluation(ev);
        }
      }
    };

    worker.onerror = (err) => console.error("[PgnViewer] Stockfish worker error:", err);
    worker.postMessage("uci");
  }, [stopEngine]);

  useEffect(() => {
    if (!open) return;
    if (engineEnabled) startEngine();
    return () => stopEngine();
  }, [open, engineEnabled, startEngine, stopEngine]);

  // ── Trigger evaluation when the viewed position changes ──────────────────────
  // S49-7: single-threaded WASM processes `stop` synchronously in its message
  // queue, so no isready/readyok barrier is needed — send stop → position → go
  // directly. `go infinite` keeps the engine improving its eval until the next
  // navigation stops it (standard chess-GUI pattern).
  useEffect(() => {
    const fen = fens[currentIndex];
    if (!engineReady || !stockfishRef.current || !fen) return;
    sideToMoveRef.current = fen.split(" ")[1] === "b" ? "b" : "w";
    setBestMove(null);
    setEvaluation(null);
    setEngineDepth(0);
    setVariations([]); // S49-11: variations repopulate for the new position
    // S49-12: minimal 3-command hot path — MultiPV is configured once at engine
    // init (uciok handler), never mid-stream.
    stockfishRef.current.postMessage("stop");
    stockfishRef.current.postMessage(`position fen ${fen}`);
    stockfishRef.current.postMessage("go infinite");
  }, [currentIndex, fens, engineReady]);

  // ── Keyboard navigation ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") { e.preventDefault(); setCurrentIndex((i) => Math.max(0, i - 1)); }
      if (e.key === "ArrowRight") { e.preventDefault(); setCurrentIndex((i) => Math.min(fens.length - 1, i + 1)); }
      if (e.key === "ArrowUp") { e.preventDefault(); setCurrentIndex(0); }
      if (e.key === "ArrowDown") { e.preventDefault(); setCurrentIndex(fens.length - 1); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, fens.length]);

  const goTo = useCallback((i: number) => {
    setCurrentIndex((prev) => {
      const next = Math.max(0, Math.min(fens.length - 1, i));
      return next === prev ? prev : next;
    });
  }, [fens.length]);

  const arrows =
    bestMove && bestMove.length >= 4
      ? [{ startSquare: bestMove.slice(0, 2), endSquare: bestMove.slice(2, 4), color: ARROW_COLOR }]
      : [];

  const headerLine = [headers.White, headers.Black].filter(Boolean).join("  vs  ");
  const metaLine = [headers.Event, headers.Date, headers.Result].filter(Boolean).join(" · ");
  const evalPct = evalToPercent(evaluation);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[92vw] w-full">
        <DialogHeader>
          <DialogTitle className="text-base">
            {headerLine || "Game Analysis"}
            {metaLine && (
              <span className="block text-xs font-normal text-muted-foreground mt-1">{metaLine}</span>
            )}
          </DialogTitle>
        </DialogHeader>

        {parseError ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            This PGN couldn't be parsed. Showing an empty board.
          </p>
        ) : null}

        <div className="flex flex-col sm:flex-row gap-4">
          {/* Left: eval bar + board — board must be square (S49-2) */}
          <div className="flex gap-2 sm:flex-[3] min-w-0">
            {/* Evaluation bar — brand surface bg + terracotta fill (S49-8) */}
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
              {/* S49-15: center line — fill at this line = equal position */}
              <div
                className="absolute left-0 right-0"
                style={{
                  top: "50%",
                  height: "1px",
                  backgroundColor: "rgba(244,239,230,0.25)",
                  zIndex: 2,
                }}
              />
              {/* S49-15: label floats at the fill boundary so it tracks the eval */}
              <span
                className="absolute left-1/2 -translate-x-1/2 text-[8px] font-mono z-10 whitespace-nowrap"
                style={{
                  bottom: evalPct > 15 ? `${evalPct}%` : "2px",
                  color: BRAND,
                }}
              >
                {evalLabel(evaluation)}
              </span>
            </div>
            {/* S49-6: no aspect-square — boardStyle height:auto lets the grid rows
                size to the squares' own 1:1 aspect ratio, so the board is naturally
                square (height = width) with no dark gaps between rows. */}
            <div className="flex-1 min-w-0">
              <Chessboard
                options={{
                  position: fens[currentIndex],
                  boardOrientation,
                  allowDragging: false,
                  arrows,
                  // S49-6: v5's defaultBoardStyle sets height:'100%', which stretches
                  // grid rows past the squares' aspectRatio and leaves gaps. Same
                  // defaults, but height:'auto' so rows size to content.
                  boardStyle: {
                    display: "grid",
                    gridTemplateColumns: "repeat(8, 1fr)",
                    overflow: "hidden",
                    width: "100%",
                    height: "auto",
                    position: "relative",
                  },
                  // S49-8: BooGMe branded palette — deep navy (echoes
                  // --surface-elevated) + warm tan complementing the terracotta.
                  darkSquareStyle: { backgroundColor: "#1A2C3D" },
                  lightSquareStyle: { backgroundColor: "#C8B89A" },
                  // S49-9: 9px notation so it never overlaps pieces; color is set
                  // per square type below (opposite-tone convention, like Lichess).
                  alphaNotationStyle: {
                    fontSize: "9px",
                    position: "absolute",
                    bottom: 1,
                    right: 3,
                    userSelect: "none",
                  },
                  numericNotationStyle: {
                    fontSize: "9px",
                    position: "absolute",
                    top: 1,
                    left: 2,
                    userSelect: "none",
                  },
                  darkSquareNotationStyle: { color: "rgba(200,184,154,0.7)" },
                  lightSquareNotationStyle: { color: "rgba(26,44,61,0.7)" },
                }}
              />
            </div>
          </div>

          {/* Right: move list + controls */}
          <div className="sm:flex-[2] flex flex-col min-h-0">
            <div className="overflow-y-auto max-h-[320px] sm:max-h-[480px] font-mono text-sm border border-border/40 rounded-md">
              {moves.length === 0 ? (
                <p className="text-xs text-muted-foreground p-3">No moves to display.</p>
              ) : (
                Array.from({ length: Math.ceil(moves.length / 2) }, (_, i) => (
                  <div key={i} className="flex gap-2 px-2 py-0.5 hover:bg-muted/30">
                    <span className="text-muted-foreground w-6 shrink-0">{i + 1}.</span>
                    <button
                      onClick={() => goTo(2 * i + 1)}
                      className={`flex-1 text-left ${currentIndex === 2 * i + 1 ? "font-bold" : ""}`}
                      style={currentIndex === 2 * i + 1 ? { color: BRAND } : undefined}
                    >
                      {moves[2 * i]}
                    </button>
                    {moves[2 * i + 1] ? (
                      <button
                        onClick={() => goTo(2 * i + 2)}
                        className={`flex-1 text-left ${currentIndex === 2 * i + 2 ? "font-bold" : ""}`}
                        style={currentIndex === 2 * i + 2 ? { color: BRAND } : undefined}
                      >
                        {moves[2 * i + 1]}
                      </button>
                    ) : (
                      <span className="flex-1" />
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Navigation controls */}
            <div className="flex items-center gap-1 mt-3">
              <Button variant="outline" size="icon" onClick={() => goTo(0)} aria-label="First move">
                <ChevronFirst className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => goTo(currentIndex - 1)} aria-label="Previous move">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => goTo(currentIndex + 1)} aria-label="Next move">
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => goTo(fens.length - 1)} aria-label="Last move">
                <ChevronLast className="h-4 w-4" />
              </Button>
              {/* S49-10: engine power toggle — off terminates the worker, on spawns
                  a fresh one. Reliable recovery if the engine ever freezes. */}
              <Button
                variant="outline"
                size="icon"
                onClick={() => setEngineEnabled((e) => !e)}
                aria-label={engineEnabled ? "Stop engine" : "Start engine"}
                title={engineEnabled ? "Engine on — click to stop" : "Engine off — click to start"}
                className={`ml-auto ${engineEnabled ? "border-primary/50" : "opacity-50"}`}
              >
                <Power className="h-4 w-4" style={engineEnabled ? { color: BRAND } : undefined} />
              </Button>
            </div>

            {/* S49-16: flip board — dedicated labeled row so it can't be missed */}
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

            {/* Engine status — three states (S49-10) */}
            <div className="mt-3 text-xs text-muted-foreground font-mono space-y-0.5">
              {!engineEnabled ? (
                <div>
                  Engine off ·{" "}
                  <button onClick={() => setEngineEnabled(true)} className="underline">
                    turn on
                  </button>
                </div>
              ) : !engineReady ? (
                <div>Starting engine…</div>
              ) : (
                <>
                  <div>
                    Stockfish · depth {engineDepth} ·{" "}
                    <span style={{ color: BRAND }}>{evalLabel(evaluation)}</span>
                  </div>
                  {/* S49-5: best move in SAN, falling back to "e2→e4" if illegal */}
                  {bestMove && (
                    <div style={{ color: BRAND }}>
                      Best:{" "}
                      {uciToSan(bestMove, fens[currentIndex]) ??
                        `${bestMove.slice(0, 2)}→${bestMove.slice(2, 4)}`}
                    </div>
                  )}
                  {/* S49-11/S49-13: top-3 MultiPV lines, full 5-move PVs, live */}
                  {variations.length > 0 && (
                    <div className="mt-2 space-y-0.5">
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
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
