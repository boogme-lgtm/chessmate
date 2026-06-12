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

// ═══════════════════════════════════════════════════════════════════════════
// S49-24: PGN tree parser — full notation support (sidelines, comments, NAGs).
// chess.js history() flattens to the main line only, so the move text is
// tokenized and walked manually; chess.js still validates every move and
// supplies the FEN after each one.
// ═══════════════════════════════════════════════════════════════════════════

type PgnNode = {
  id: string; // unique key for React rendering
  fen: string; // FEN after this move
  san: string; // SAN notation (e.g. "Nf3")
  from: string; // origin square (e.g. "e2") — S49-27 last-move highlight
  to: string; // destination square (e.g. "e4")
  moveNumber: number; // 1-based full move number
  color: "w" | "b"; // side that made this move
  commentBefore?: string; // comment immediately BEFORE this move
  comment?: string; // comment AFTER this move (from {…})
  nags: string[]; // NAG symbols converted to glyphs (["!", "?!"])
  variations: PgnNode[][]; // sideline branches starting at this move
  depth: number; // 0 = main line, 1 = first-level sideline, …
};

// S49-26: complete standard NAG set. Note two corrections to the handoff's
// table: $20/$21 are White/Black *crushing* advantage (+- / -+; the handoff had
// them swapped), and $141 is "aimed against" (∇), not △.
const NAG_GLYPHS: Record<number, string> = {
  1: "!", 2: "?", 3: "!!", 4: "??", 5: "!?", 6: "?!",
  7: "□", 8: "□",
  10: "=", 11: "=", 12: "=",
  13: "∞", 14: "⩲", 15: "⩱", 16: "±", 17: "∓",
  18: "+-", 19: "-+",
  20: "+-", 21: "-+",
  22: "⨀", 23: "⨀",
  32: "⟳", 33: "⟳",
  36: "→", 37: "→",
  40: "↑", 41: "↑",
  44: "=∞", 45: "=∞",
  132: "⇆", 133: "⇆",
  138: "⊕", 139: "⊕",
  140: "△", 141: "∇",
  142: "⌓", 143: "⌓",
  145: "RR", 146: "N",
};

// Strip embedded command tags ([%clk 0:03:00], [%eval 0.4], [%csl …]) that
// Lichess/chess.com put inside comments — they are machine data, not prose.
function cleanCommentText(raw: string): string | undefined {
  const text = raw.replace(/\[%[^\]]*\]/g, "").replace(/\s+/g, " ").trim();
  return text.length > 0 ? text : undefined;
}

function tokenizePgn(moveText: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < moveText.length) {
    const ch = moveText[i];
    if (/\s/.test(ch)) { i++; continue; }
    // Brace comment
    if (ch === "{") {
      const end = moveText.indexOf("}", i);
      if (end === -1) break;
      tokens.push(moveText.slice(i, end + 1));
      i = end + 1;
      continue;
    }
    // Semicolon comment — runs to end of line (PGN spec)
    if (ch === ";") {
      const end = moveText.indexOf("\n", i);
      const stop = end === -1 ? moveText.length : end;
      tokens.push(`{${moveText.slice(i + 1, stop)}}`);
      i = stop;
      continue;
    }
    if (ch === "(" || ch === ")") { tokens.push(ch); i++; continue; }
    // NAG ($N)
    if (ch === "$") {
      const m = moveText.slice(i).match(/^\$(\d+)/);
      if (m) { tokens.push(m[0]); i += m[0].length; continue; }
    }
    // Move number ("12." / "12...") — positional info we recompute; discard
    const mnMatch = moveText.slice(i).match(/^\d+\.+/);
    if (mnMatch) { i += mnMatch[0].length; continue; }
    // Result token — end of the game; discard (shown from headers)
    const resultMatch = moveText.slice(i).match(/^(1-0|0-1|1\/2-1\/2|\*)/);
    if (resultMatch) { i += resultMatch[0].length; continue; }
    // SAN move (castling first so "O-O-O" isn't split)
    const sanMatch = moveText
      .slice(i)
      .match(/^(O-O-O|O-O|[NBRQK]?[a-h]?[1-8]?x?[a-h][1-8](=[NBRQK])?)[+#]?/);
    if (sanMatch) {
      tokens.push(sanMatch[0]);
      i += sanMatch[0].length;
      // Suffix annotation glued to the move ("Qd2?!", "Nf3!") — Lichess
      // exports these as text, not $-NAGs. Emit as a suffix token.
      const suffix = moveText.slice(i).match(/^[!?]{1,2}/);
      if (suffix) { tokens.push(suffix[0]); i += suffix[0].length; }
      continue;
    }
    i++; // skip anything unrecognized
  }
  return tokens;
}

let _nodeCounter = 0;

/**
 * Recursive tree builder. `startFen` is the position this branch starts from —
 * needed so a variation on the branch's FIRST move rewinds to the branch
 * start, not the game start.
 */
function buildPgnTree(
  tokens: string[],
  startIndex: number,
  chess: Chess,
  depth: number,
  startFen: string
): { nodes: PgnNode[]; nextIndex: number } {
  const nodes: PgnNode[] = [];
  let pendingPreComment: string | undefined;
  let i = startIndex;

  while (i < tokens.length) {
    const tok = tokens[i];

    if (tok === ")") {
      return { nodes, nextIndex: i }; // caller consumes the ')'
    }

    if (tok === "(") {
      // Variation replaces the LAST move — it starts from the position before it.
      if (nodes.length === 0) {
        // Malformed (variation before any move) — skip the whole group.
        let bal = 1;
        i++;
        while (i < tokens.length && bal > 0) {
          if (tokens[i] === "(") bal++;
          if (tokens[i] === ")") bal--;
          i++;
        }
        continue;
      }
      const lastNode = nodes[nodes.length - 1];
      const parentFen = nodes.length >= 2 ? nodes[nodes.length - 2].fen : startFen;
      const varChess = new Chess(parentFen);
      i++; // consume '('
      const { nodes: varNodes, nextIndex } = buildPgnTree(tokens, i, varChess, depth + 1, parentFen);
      i = nextIndex;
      if (tokens[i] === ")") i++; // consume ')'
      if (varNodes.length > 0) lastNode.variations.push(varNodes);
      continue;
    }

    if (tok.startsWith("{")) {
      const text = cleanCommentText(tok.slice(1, -1));
      if (text) {
        if (nodes.length > 0) {
          const last = nodes[nodes.length - 1];
          last.comment = last.comment ? `${last.comment} ${text}` : text;
        } else {
          // Comment before any move in this branch — attach to the next node.
          pendingPreComment = pendingPreComment ? `${pendingPreComment} ${text}` : text;
        }
      }
      i++;
      continue;
    }

    if (tok.startsWith("$")) {
      // S49-26: unknown NAG codes render as NOTHING, never as raw "$N" text.
      const glyph = NAG_GLYPHS[parseInt(tok.slice(1), 10)] ?? "";
      if (glyph && nodes.length > 0) nodes[nodes.length - 1].nags.push(glyph);
      i++;
      continue;
    }

    if (/^[!?]{1,2}$/.test(tok)) {
      // Suffix annotation emitted by the tokenizer ("!", "?!", …)
      if (nodes.length > 0) nodes[nodes.length - 1].nags.push(tok);
      i++;
      continue;
    }

    // SAN move — chess.js validates it and yields the resulting FEN.
    try {
      const moveResult = chess.move(tok);
      if (moveResult) {
        nodes.push({
          id: `node-${_nodeCounter++}`,
          fen: chess.fen(),
          san: moveResult.san,
          from: moveResult.from, // S49-27: last-move highlight squares
          to: moveResult.to,
          // moveNumber(): unchanged after a white move, incremented after black's.
          moveNumber: moveResult.color === "b" ? chess.moveNumber() - 1 : chess.moveNumber(),
          color: moveResult.color as "w" | "b",
          commentBefore: pendingPreComment,
          nags: [],
          variations: [],
          depth,
        });
        pendingPreComment = undefined;
      }
    } catch {
      /* illegal token in this position — skip it */
    }
    i++;
  }

  return { nodes, nextIndex: i };
}

function parsePgnTree(pgn: string): {
  nodes: PgnNode[];
  fens: string[];
  lastMoves: Array<{ from: string; to: string } | null>;
  headers: Record<string, string>;
} {
  _nodeCounter = 0;

  // Header tags — line-anchored so bracketed text INSIDE comments
  // ([%clk …]) is never mistaken for a header.
  const headers: Record<string, string> = {};
  const headerRegex = /^\s*\[(\w+)\s+"([^"]*)"\]\s*$/gm;
  let m: RegExpExecArray | null;
  while ((m = headerRegex.exec(pgn)) !== null) headers[m[1]] = m[2];
  const moveText = pgn.replace(/^\s*\[\w+\s+"[^"]*"\]\s*$/gm, "").trim();

  const startFen = new Chess().fen();
  const chess = new Chess();
  const tokens = tokenizePgn(moveText);
  const { nodes } = buildPgnTree(tokens, 0, chess, 0, startFen);

  // Flat main-line FEN list for board/keyboard navigation and the engine,
  // plus the parallel last-move array (index-aligned: [0] = start, no move).
  const fens: string[] = [startFen];
  const lastMoves: Array<{ from: string; to: string } | null> = [null];
  for (const node of nodes) {
    fens.push(node.fen);
    lastMoves.push({ from: node.from, to: node.to });
  }

  return { nodes, fens, lastMoves, headers };
}

// ═══════════════════════════════════════════════════════════════════════════
// S49-24: recursive move-list renderer — flowing main line, indented sideline
// blocks, italic comments, terracotta NAG glyphs. EVERY move (sidelines too)
// is clickable: the board + engine jump to that position.
// ═══════════════════════════════════════════════════════════════════════════

function MoveList({
  nodes,
  displayFen,
  depth,
  onSelectMainline,
  onSelectFen,
}: {
  nodes: PgnNode[];
  displayFen: string;
  depth: number;
  onSelectMainline: (fenIndex: number) => void;
  onSelectFen: (fen: string, from: string, to: string) => void;
}) {
  return (
    <span>
      {nodes.map((node, idx) => {
        const isActive = node.fen === displayFen;
        const prev = idx > 0 ? nodes[idx - 1] : null;
        // Show "N." for white; "N…" for black when the flow was interrupted
        // (branch start, or the previous move carried a comment/variation).
        const interrupted =
          idx === 0 || !!prev?.comment || (prev?.variations.length ?? 0) > 0;
        const showNumber = node.color === "w" || interrupted;

        return (
          <span key={node.id}>
            {node.commentBefore && (
              <span className="text-[11px] text-muted-foreground italic mr-1 font-sans">
                {node.commentBefore}
              </span>
            )}
            {showNumber && (
              <span className="text-muted-foreground text-xs mr-0.5 select-none">
                {node.moveNumber}{node.color === "w" ? "." : "…"}
              </span>
            )}
            <button
              onClick={() =>
                depth === 0
                  ? onSelectMainline(idx + 1)
                  : onSelectFen(node.fen, node.from, node.to)
              }
              className={`inline text-xs px-0.5 rounded cursor-pointer hover:bg-muted/40 ${
                isActive ? "font-bold" : depth > 0 ? "opacity-90" : ""
              }`}
              style={isActive ? { color: BRAND } : undefined}
            >
              {node.san}
              {node.nags.length > 0 && (
                <span style={{ color: BRAND }}>{node.nags.join("")}</span>
              )}
            </button>{" "}
            {node.comment && (
              <span className="text-[11px] text-muted-foreground italic mr-1 font-sans">
                {node.comment}{" "}
              </span>
            )}
            {node.variations.map((varNodes, vi) => (
              <span
                key={vi}
                className="block my-0.5 ml-2 pl-2 border-l border-border/40 text-muted-foreground"
              >
                <span className="text-xs select-none">( </span>
                <MoveList
                  nodes={varNodes}
                  displayFen={displayFen}
                  depth={depth + 1}
                  onSelectMainline={onSelectMainline}
                  onSelectFen={onSelectFen}
                />
                <span className="text-xs select-none"> )</span>
              </span>
            ))}
          </span>
        );
      })}
    </span>
  );
}

export default function PgnViewerModal({ open, onOpenChange, pgn }: PgnViewerModalProps) {
  const [pgnNodes, setPgnNodes] = useState<PgnNode[]>([]);
  const [fens, setFens] = useState<string[]>([new Chess().fen()]);
  // S49-27: main-line last-move squares, index-aligned with fens.
  const [lastMoves, setLastMoves] = useState<Array<{ from: string; to: string } | null>>([null]);
  const [headers, setHeaders] = useState<Record<string, string | null>>({});
  const [parseError, setParseError] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  // S49-24: a sideline move the user clicked — overrides the main-line cursor.
  // null = following the main line at currentIndex.
  const [selectedFen, setSelectedFen] = useState<string | null>(null);
  // S49-27: from/to squares of the clicked sideline move (for the highlight).
  const [selectedLastMove, setSelectedLastMove] = useState<{ from: string; to: string } | null>(null);
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
  // ── S49-21 UCI state machine (bestmove-gated; see fix-6 handoff) ─────────────
  // searchingRef: a `go infinite` is in flight (no bestmove received yet).
  // pendingFenRef: position waiting for the engine's bestmove stop-ack.
  // Invariant: pendingFenRef !== null ⟹ searchingRef === true (a stop is in flight).
  const searchingRef = useRef(false);
  const pendingFenRef = useRef<string | null>(null);
  // Watchdog: if the engine never acks a stop with bestmove (wedged), restart it.
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startEngineRef = useRef<(() => void) | null>(null);

  // Single dispatch point — the ONLY place `position` + `go` are ever sent.
  // Sets sideToMoveRef at dispatch time so score normalization always matches
  // the position actually being searched.
  const dispatchSearch = useCallback((fen: string) => {
    const worker = stockfishRef.current;
    if (!worker) return;
    sideToMoveRef.current = fen.split(" ")[1] === "b" ? "b" : "w";
    searchingRef.current = true;
    worker.postMessage(`position fen ${fen}`);
    worker.postMessage("go infinite");
  }, []);

  // ── Parse PGN (S49-24: full tree — sidelines, comments, NAGs) ────────────────
  useEffect(() => {
    if (!open || !pgn) return;
    try {
      const { nodes, fens: newFens, lastMoves: newLastMoves, headers: newHeaders } = parsePgnTree(pgn);
      setParseError(nodes.length === 0 && pgn.trim().length > 0);
      setPgnNodes(nodes);
      setHeaders(newHeaders);
      setFens(newFens);
      setLastMoves(newLastMoves);
      setSelectedFen(null);
      setSelectedLastMove(null);
      setCurrentIndex(newFens.length - 1); // start at the final position
    } catch {
      setParseError(true);
      setPgnNodes([]);
      setHeaders({});
      setFens([new Chess().fen()]);
      setLastMoves([null]);
      setSelectedFen(null);
      setSelectedLastMove(null);
      setCurrentIndex(0);
    }
  }, [pgn, open]);

  // ── Stockfish worker lifecycle (S49-10: restartable) ─────────────────────────
  const stopEngine = useCallback(() => {
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    if (stockfishRef.current) {
      try {
        stockfishRef.current.postMessage("quit");
        stockfishRef.current.terminate();
      } catch { /* noop */ }
      stockfishRef.current = null;
    }
    searchingRef.current = false;
    pendingFenRef.current = null;
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
        // S49-12: setoption is an INITIALIZATION command — configure the engine
        // exactly once per worker lifetime, here between uci and isready.
        // Hash 16MB: the WASM build can stall (observed around depth 9) when it
        // fills an undersized default hash table.
        worker.postMessage("setoption name Hash value 16");
        worker.postMessage("setoption name MultiPV value 3");
        worker.postMessage("isready");
        return;
      }
      if (line === "readyok") {
        // S49-7: engineReady flips here (not on uciok) so the evaluation effect
        // only fires once the engine has confirmed it is ready.
        searchingRef.current = false; // engine is idle after init
        setEngineReady(true);
        return;
      }

      // S49-21: `bestmove` is the engine's stop-acknowledgment — the ONLY safe
      // moment to start the next search. (It also arrives unsolicited on
      // terminal positions: mate/stalemate under `go infinite` emits
      // "bestmove (none)" immediately — handled identically, engine goes idle.)
      if (line.startsWith("bestmove")) {
        if (stopTimerRef.current) {
          clearTimeout(stopTimerRef.current);
          stopTimerRef.current = null;
        }
        searchingRef.current = false;
        const pending = pendingFenRef.current;
        if (pending) {
          pendingFenRef.current = null;
          dispatchSearch(pending);
        }
        return;
      }

      // S49-21: while a stop is in flight (pending set) or no search is running,
      // any info lines belong to a dying/previous search — ignore them so stale
      // evals/arrows/variations can never flash on the new position.
      if (pendingFenRef.current !== null || !searchingRef.current) return;

      // Depth updates from any info line while `go infinite` runs.
      const depthMatch = line.match(/\bdepth (\d+)/);
      if (depthMatch) setEngineDepth(parseInt(depthMatch[1], 10));

      // S49-11: MultiPV-aware parsing. With MultiPV=3 every PV info line carries
      // "multipv N"; route each line into its variation slot. multipv 1 is the
      // main line and also drives the eval bar, the arrow, and the Best: text.
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

  // Keep a ref to startEngine so the watchdog (created inside the eval effect)
  // can trigger a full restart without dependency cycles.
  useEffect(() => {
    startEngineRef.current = startEngine;
  }, [startEngine]);

  useEffect(() => {
    if (!open) return;
    if (engineEnabled) startEngine();
    return () => stopEngine();
  }, [open, engineEnabled, startEngine, stopEngine]);

  // ── Trigger evaluation when the viewed position changes ──────────────────────
  // S49-21: bestmove-gated UCI protocol (the pattern every real GUI uses).
  // Never send `position`/`go` while a search is in flight — send `stop`, park
  // the FEN, and let the bestmove handler dispatch it once the engine acks.
  // Rapid navigation only ever replaces the parked FEN; exactly one search is
  // in flight at any moment, and exactly one `stop` per stop-cycle.
  // S49-24: the position on the board — a clicked sideline move overrides the
  // main-line cursor. Everything downstream (board, engine, PV rendering)
  // derives from this single value.
  const displayFen = selectedFen ?? fens[currentIndex] ?? fens[0];

  useEffect(() => {
    const fen = displayFen;
    if (!engineReady || !stockfishRef.current || !fen) return;
    // Reset display state immediately for the new position.
    setBestMove(null);
    setEvaluation(null);
    setEngineDepth(0);
    setVariations([]);

    if (!searchingRef.current) {
      // Engine idle (after init, or after a terminal-position search ended) —
      // start directly.
      pendingFenRef.current = null;
      dispatchSearch(fen);
    } else if (pendingFenRef.current === null) {
      // Search in flight, no stop pending yet — park the FEN and send ONE stop.
      pendingFenRef.current = fen;
      stockfishRef.current.postMessage("stop");
      // Watchdog: a healthy engine acks `stop` with bestmove within ms. If it
      // ever wedges (the historical "engine death"), restart it — stopEngine
      // resets all refs and the engineReady toggle re-runs this effect, so the
      // current position is re-analyzed automatically. Self-healing.
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
      stopTimerRef.current = setTimeout(() => {
        stopTimerRef.current = null;
        console.warn("[PgnViewer] Engine did not ack stop within 3s — restarting worker.");
        startEngineRef.current?.();
      }, 3000);
    } else {
      // Already stopping — just replace the parked FEN (no second stop).
      pendingFenRef.current = fen;
    }
  }, [displayFen, engineReady, dispatchSearch]);

  // ── Keyboard navigation (main line; arrows leave any selected sideline) ──────
  useEffect(() => {
    if (!open) return;
    const leaveSideline = () => { setSelectedFen(null); setSelectedLastMove(null); };
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") { e.preventDefault(); leaveSideline(); setCurrentIndex((i) => Math.max(0, i - 1)); }
      if (e.key === "ArrowRight") { e.preventDefault(); leaveSideline(); setCurrentIndex((i) => Math.min(fens.length - 1, i + 1)); }
      if (e.key === "ArrowUp") { e.preventDefault(); leaveSideline(); setCurrentIndex(0); }
      if (e.key === "ArrowDown") { e.preventDefault(); leaveSideline(); setCurrentIndex(fens.length - 1); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, fens.length]);

  const goTo = useCallback((i: number) => {
    setSelectedFen(null);
    setSelectedLastMove(null);
    setCurrentIndex((prev) => {
      const next = Math.max(0, Math.min(fens.length - 1, i));
      return next === prev ? prev : next;
    });
  }, [fens.length]);

  // S49-24/S49-27: jump straight to a sideline position (board + engine follow;
  // the highlight shows the sideline move's squares).
  const selectFen = useCallback((fen: string, from: string, to: string) => {
    setSelectedFen(fen);
    setSelectedLastMove({ from, to });
  }, []);

  const arrows =
    bestMove && bestMove.length >= 4
      ? [{ startSquare: bestMove.slice(0, 2), endSquare: bestMove.slice(2, 4), color: ARROW_COLOR }]
      : [];

  // S49-27: last-move squares for the displayed position. Sideline selection
  // carries its own from/to; otherwise the main-line parallel array applies.
  // Index 0 (start position) is null — no highlight.
  const lastMoveSquares =
    selectedFen !== null ? selectedLastMove : lastMoves[currentIndex] ?? null;
  // v5 has NO `lastMove` option — per-square styles are the supported API.
  // The style lands on an inner overlay div, so the translucent terracotta
  // TINTS over the square color instead of replacing it.
  const lastMoveStyle = { backgroundColor: "rgba(232, 99, 58, 0.35)" };
  const squareStyles = lastMoveSquares
    ? { [lastMoveSquares.from]: lastMoveStyle, [lastMoveSquares.to]: lastMoveStyle }
    : {};

  const headerLine = [headers.White, headers.Black].filter(Boolean).join("  vs  ");
  const metaLine = [headers.Event, headers.Date, headers.Result].filter(Boolean).join(" · ");
  const evalPct = evalToPercent(evaluation);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* S49-25 — THE definitive sizing.
          (1) sm:max-w-[96vw] is load-bearing: the shadcn DialogContent base
              includes sm:max-w-lg (512px). tailwind-merge only collapses
              conflicts within the SAME variant, so a base max-w-[96vw] never
              beats the sm: variant — the dialog has been silently capped at
              512px on every desktop screen. This override removes the cap.
          (2) --board-size is a concrete viewport-based square consumed by BOTH
              the board wrapper and the eval bar, so they are pixel-identical
              and never depend on flex/percentage resolution.
              Desktop budget: 96vw dialog − 48 p-6 − 16 gap − 300 panel − 18
              eval bar+gap = 96vw−382 (384 used, 2px slack). Height: 90vh − 48
              p-6 − ~48 header − 16 gap = 90vh−112 (130 used for slack).
              Mobile (<sm): panel stacks below → width budget is 96vw−70.
              NOTE: Tailwind arbitrary values need _ for spaces — calc()
              REQUIRES spaces around minus or the rule is invalid CSS. */}
      <DialogContent className="max-w-[96vw] sm:max-w-[96vw] w-full h-[90vh] flex flex-col overflow-hidden p-6 [--board-size:min(calc(90vh_-_130px),calc(96vw_-_70px))] sm:[--board-size:min(calc(90vh_-_130px),calc(96vw_-_384px))]">
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-base">
            {headerLine || "Game Analysis"}
            {metaLine && (
              <span className="block text-xs font-normal text-muted-foreground mt-1">{metaLine}</span>
            )}
          </DialogTitle>
        </DialogHeader>

        {parseError ? (
          <p className="text-sm text-muted-foreground py-2 text-center shrink-0">
            This PGN couldn't be parsed. Showing an empty board.
          </p>
        ) : null}

        {/* S49-17: fixed-height main area — the dialog never resizes with
            content. Desktop: board left, panel right, the pair centered.
            Mobile: stacked, scrollable so the panel stays reachable. */}
        <div className="flex-1 flex flex-col sm:flex-row gap-4 min-h-0 overflow-y-auto sm:overflow-hidden items-center sm:items-start sm:justify-center">
          {/* S49-25: bar + board are BOTH sized by var(--board-size) — no
              flex-1, no self-start, no percentages. They cannot disagree. */}
          <div className="shrink-0 flex gap-1.5 items-start">
            {/* S49-19: clean eval bar — dark bg, orange fill, midpoint notch,
                NO floating label (the eval is shown in the engine panel). */}
            <div
              className="w-3 shrink-0 rounded-sm overflow-hidden relative"
              style={{ height: "var(--board-size)", backgroundColor: "#151B22" }}
              title={`Engine evaluation: ${evalLabel(evaluation)}`}
            >
              <div
                className="absolute bottom-0 left-0 right-0 transition-[height] duration-300"
                style={{ height: `${evalPct}%`, backgroundColor: BRAND }}
              />
              <div
                className="absolute left-0 right-0"
                style={{
                  top: "50%",
                  height: "2px",
                  backgroundColor: "rgba(244,239,230,0.4)",
                  zIndex: 2,
                }}
              />
            </div>
            {/* S49-25: explicit square — the largest that fits both the dialog
                height and the width beside the panel. */}
            <div style={{ width: "var(--board-size)", height: "var(--board-size)" }}>
              <Chessboard
                options={{
                  position: displayFen,
                  // S49-27: last-move tint on from/to squares (v5's API is
                  // squareStyles — there is no lastMove option).
                  squareStyles,
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

          {/* S49-25: right panel — fixed 300px wide, EXACTLY board-height on
              desktop (top and bottom edges align with the board), scrolls
              internally so its content can never change the dialog's size. */}
          <div className="w-full sm:w-[300px] shrink-0 flex flex-col gap-3 overflow-y-auto min-h-0 sm:h-[var(--board-size)]">
            <div className="flex-1 min-h-[120px] overflow-y-auto font-mono text-sm border border-border/40 rounded-md">
              {pgnNodes.length === 0 ? (
                <p className="text-xs text-muted-foreground p-3">No moves to display.</p>
              ) : (
                <div className="p-2 leading-relaxed">
                  {/* S49-24: full notation — sidelines, comments, NAGs. Every
                      move is clickable, sidelines included. */}
                  <MoveList
                    nodes={pgnNodes}
                    displayFen={displayFen}
                    depth={0}
                    onSelectMainline={goTo}
                    onSelectFen={selectFen}
                  />
                  {headers.Result && headers.Result !== "*" && (
                    <span className="text-xs text-muted-foreground ml-1 select-none">
                      {headers.Result}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Navigation controls */}
            <div className="flex items-center gap-1 shrink-0">
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
            <div className="flex items-center gap-2 shrink-0">
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
            <div className="text-xs text-muted-foreground font-mono space-y-0.5 shrink-0">
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
                      {uciToSan(bestMove, displayFen) ??
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
                            {pvToSan(v.pvUci, displayFen)}
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
