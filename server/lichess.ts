/**
 * Lichess API client.
 *
 * Public, unauthenticated endpoints used:
 *   - GET https://lichess.org/api/puzzle/daily
 *   - GET https://lichess.org/api/puzzle/{id}
 *   - GET https://lichess.org/api/user/{username}
 *
 * Lichess rate-limits unauthenticated requests to ~30 req/min. Response
 * shapes are documented at https://lichess.org/api.
 */

import { Chess } from "chess.js";

const BASE_URL = "https://lichess.org/api";
const USER_AGENT = "BooGMe/1.0 (https://boogme.com)";

/**
 * Curated puzzle IDs used when the client asks for a "random" / "next" puzzle.
 * Pull request from Lichess's public puzzle database (all are public IDs).
 * We rotate through them deterministically so users get variety without
 * requiring an authenticated Lichess account.
 */
const CURATED_PUZZLE_IDS = [
  "00008", "0000D", "0000H", "0000X", "0000Z",
  "00014", "0002W", "00048", "0005B", "0006G",
  "000D1", "000IE", "000Ia", "000PL", "000XD",
  "000Zo", "0012C", "001kB", "001oA", "001rJ",
];

export interface LichessPuzzle {
  id: string;
  rating: number;
  plays: number;
  initialPly: number;
  solution: string[]; // UCI moves
  themes: string[];
}

export interface LichessPuzzleResponse {
  game: {
    id: string;
    pgn: string; // space-separated SAN moves
    clock?: string;
    perf?: { key: string; name: string };
  };
  puzzle: LichessPuzzle;
}

export interface LichessPuzzleWithFen extends LichessPuzzleResponse {
  fen: string; // computed FEN at the puzzle's starting position
}

export interface LichessUserProfile {
  id: string;
  username: string;
  profile?: {
    country?: string;
    bio?: string;
  };
  perfs?: Record<string, { rating?: number; games?: number }>;
  count?: { all?: number; rated?: number };
  createdAt?: number;
}

async function lichessGet<T>(path: string): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": USER_AGENT,
    },
  });
  if (!response.ok) {
    throw new Error(`Lichess API ${path} failed: ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as T;
}

/**
 * Compute the FEN at a given ply by replaying the PGN through chess.js.
 * Uses loadPgn for robust parsing (handles annotations, move numbers,
 * whitespace). Walks history manually so we can stop at `initialPly`.
 *
 * If the PGN can't be parsed, throws — callers should catch and skip the
 * puzzle rather than silently return a corrupt starting position (which
 * was the pre-Sprint-6 bug).
 */
function computeFenAtPly(pgn: string, initialPly: number): string {
  // Lichess puzzle PGN is a plain sequence of SAN moves with no headers or
  // move numbers. Feed it to chess.js by playing moves one at a time.
  const game = new Chess();
  const moves = pgn.trim().split(/\s+/).filter(Boolean);

  const stopAt = Math.min(initialPly, moves.length);
  for (let i = 0; i < stopAt; i++) {
    const token = moves[i];
    // Skip PGN move numbers if they ever appear (e.g. "1." or "1...")
    if (/^\d+\.{1,3}$/.test(token)) continue;
    try {
      const result = game.move(token);
      if (!result) {
        throw new Error(`chess.js rejected move ${i}: "${token}"`);
      }
    } catch (err) {
      throw new Error(`Invalid move at ply ${i}: "${token}" (${err instanceof Error ? err.message : String(err)})`);
    }
  }

  return game.fen();
}

/**
 * Fetch the Lichess daily puzzle and return it with a computed FEN at the
 * puzzle's starting position.
 */
export async function getDailyPuzzle(): Promise<LichessPuzzleWithFen> {
  const data = await lichessGet<LichessPuzzleResponse>("/puzzle/daily");
  const fen = computeFenAtPly(data.game.pgn, data.puzzle.initialPly);
  return { ...data, fen };
}

/**
 * Fetch a specific puzzle by its Lichess puzzle ID.
 */
export async function getPuzzleById(id: string): Promise<LichessPuzzleWithFen> {
  // Sanitize id — Lichess puzzle IDs are alphanumeric
  if (!/^[a-zA-Z0-9]{1,16}$/.test(id)) {
    throw new Error(`Invalid Lichess puzzle ID: "${id}"`);
  }
  const data = await lichessGet<LichessPuzzleResponse>(`/puzzle/${encodeURIComponent(id)}`);
  const fen = computeFenAtPly(data.game.pgn, data.puzzle.initialPly);
  return { ...data, fen };
}

/**
 * Get a "random-ish" puzzle for variety. Tries the daily puzzle first, then
 * falls back to a curated list of puzzle IDs. Rotates deterministically
 * based on a seed so repeat calls with different seeds return different
 * puzzles. If all fetches fail, throws the last error.
 */
export async function getRotatingPuzzle(seed: number = Date.now()): Promise<LichessPuzzleWithFen> {
  // First call: daily puzzle (cached by Lichess, cheap)
  if (seed % 4 === 0) {
    try {
      return await getDailyPuzzle();
    } catch (err) {
      console.warn("[Lichess] Daily puzzle fetch failed, falling back to curated list:", err);
    }
  }

  // Otherwise, rotate through the curated list
  const startIndex = Math.floor(seed) % CURATED_PUZZLE_IDS.length;
  let lastError: unknown = null;
  for (let offset = 0; offset < CURATED_PUZZLE_IDS.length; offset++) {
    const id = CURATED_PUZZLE_IDS[(startIndex + offset) % CURATED_PUZZLE_IDS.length];
    try {
      return await getPuzzleById(id);
    } catch (err) {
      lastError = err;
      console.warn(`[Lichess] Puzzle ${id} failed, trying next:`, err);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("All Lichess puzzle fetches failed");
}

/**
 * Fetch a Lichess user profile. Used to verify a coach's claimed rating
 * and to pre-fill a student's starting rating from their Lichess username.
 */
export async function getPlayerProfile(username: string): Promise<LichessUserProfile> {
  // Lichess usernames are 2-20 chars, alphanumeric/underscore/hyphen
  if (!/^[a-zA-Z0-9_-]{2,20}$/.test(username)) {
    throw new Error(`Invalid Lichess username: "${username}"`);
  }
  return lichessGet<LichessUserProfile>(`/user/${encodeURIComponent(username)}`);
}

/**
 * Extract a flat ratings summary from a Lichess profile for UI display.
 */
export function summarizeRatings(profile: LichessUserProfile): {
  rapid?: number;
  blitz?: number;
  classical?: number;
  bullet?: number;
  totalGames?: number;
} {
  const perfs = profile.perfs || {};
  return {
    rapid: perfs.rapid?.rating,
    blitz: perfs.blitz?.rating,
    classical: perfs.classical?.rating,
    bullet: perfs.bullet?.rating,
    totalGames: profile.count?.all,
  };
}
