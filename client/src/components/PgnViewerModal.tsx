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

const ARROW_COLOR = "rgba(0, 255, 200, 0.7)"; // electric cyan

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

  // ── Stockfish worker lifecycle ───────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
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
        setEngineReady(true);
        worker.postMessage("isready");
        return;
      }
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

    return () => {
      try {
        worker.postMessage("quit");
        worker.terminate();
      } catch { /* noop */ }
      stockfishRef.current = null;
      setEngineReady(false);
      setEngineDepth(0);
    };
  }, [open]);

  // ── Trigger evaluation when the viewed position changes ──────────────────────
  useEffect(() => {
    const fen = fens[currentIndex];
    if (!engineReady || !stockfishRef.current || !fen) return;
    sideToMoveRef.current = fen.split(" ")[1] === "b" ? "b" : "w";
    setBestMove(null);
    setEvaluation(null);
    setEngineDepth(0);
    stockfishRef.current.postMessage("stop");
    stockfishRef.current.postMessage(`position fen ${fen}`);
    stockfishRef.current.postMessage("go depth 18");
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
      <DialogContent className="max-w-4xl">
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
              <Chessboard
                options={{
                  position: fens[currentIndex],
                  boardOrientation,
                  allowDragging: false,
                  arrows,
                  darkSquareStyle: { backgroundColor: "#1a1a2e" },
                  lightSquareStyle: { backgroundColor: "#2d2d4e" },
                }}
              />
            </div>
          </div>

          {/* Right: move list + controls */}
          <div className="sm:flex-[2] flex flex-col min-h-0">
            <div className="overflow-y-auto max-h-[260px] sm:max-h-[360px] font-mono text-sm border border-border/40 rounded-md">
              {moves.length === 0 ? (
                <p className="text-xs text-muted-foreground p-3">No moves to display.</p>
              ) : (
                Array.from({ length: Math.ceil(moves.length / 2) }, (_, i) => (
                  <div key={i} className="flex gap-2 px-2 py-0.5 hover:bg-muted/30">
                    <span className="text-muted-foreground w-6 shrink-0">{i + 1}.</span>
                    <button
                      onClick={() => goTo(2 * i + 1)}
                      className={`flex-1 text-left ${currentIndex === 2 * i + 1 ? "text-cyan-400 font-bold" : ""}`}
                    >
                      {moves[2 * i]}
                    </button>
                    {moves[2 * i + 1] ? (
                      <button
                        onClick={() => goTo(2 * i + 2)}
                        className={`flex-1 text-left ${currentIndex === 2 * i + 2 ? "text-cyan-400 font-bold" : ""}`}
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
              <Button
                variant="outline"
                size="icon"
                onClick={() => setBoardOrientation((o) => (o === "white" ? "black" : "white"))}
                aria-label="Flip board"
                className="ml-auto"
              >
                <FlipHorizontal2 className="h-4 w-4" />
              </Button>
            </div>

            {/* Engine status */}
            <div className="mt-3 text-xs text-muted-foreground font-mono">
              {engineReady ? (
                <>Stockfish · depth {engineDepth} · <span className="text-cyan-400">{evalLabel(evaluation)}</span></>
              ) : (
                "Starting engine…"
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
