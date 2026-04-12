import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock lichess module so tests don't hit the real Lichess API
vi.mock("./lichess", () => ({
  getRotatingPuzzle: vi.fn().mockResolvedValue({
    game: {
      id: "mock-game",
      pgn: "e4 e5 Nf3 Nc6",
    },
    puzzle: {
      id: "mock-puzzle",
      rating: 1500,
      plays: 100,
      initialPly: 2,
      solution: ["e2e4", "e7e5"],
      themes: ["opening", "short"],
    },
    fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2",
  }),
  getDailyPuzzle: vi.fn().mockResolvedValue({
    game: { id: "daily-game", pgn: "d4 d5" },
    puzzle: {
      id: "daily-puzzle",
      rating: 1200,
      plays: 500,
      initialPly: 1,
      solution: ["d2d4"],
      themes: ["opening"],
    },
    fen: "rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1",
  }),
  getPuzzleById: vi.fn().mockResolvedValue({
    game: { id: "specific-game", pgn: "c4 e5" },
    puzzle: {
      id: "00008",
      rating: 1600,
      plays: 200,
      initialPly: 1,
      solution: ["c2c4"],
      themes: ["endgame"],
    },
    fen: "rnbqkbnr/pppp1ppp/8/4p3/2P5/8/PP1PPPPP/RNBQKBNR b KQkq - 0 1",
  }),
}));

// Auto-mock db and email so routers can be imported
vi.mock("./db");
vi.mock("./emailService");
vi.mock("./nurtureEmailScheduler");
vi.mock("./resendWelcomeEmails");

function createTestContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("puzzle.getNext", () => {
  it("fetches a puzzle without difficulty", async () => {
    const caller = appRouter.createCaller(createTestContext());
    const result = await caller.puzzle.getNext();

    expect(result).toBeDefined();
    expect(result.puzzle).toBeDefined();
    expect(result.puzzle.solution).toBeInstanceOf(Array);
    expect(result.puzzle.rating).toBeTypeOf("number");
    expect(result.game).toBeDefined();
    expect(result.fen).toBeTypeOf("string");
  });

  it("fetches a puzzle with specific difficulty", async () => {
    const caller = appRouter.createCaller(createTestContext());
    const result = await caller.puzzle.getNext({ difficulty: "easier" });

    expect(result).toBeDefined();
    expect(result.puzzle.rating).toBeTypeOf("number");
    expect(result.fen).toBeTypeOf("string");
  });

  it("fetches a puzzle with a specific theme", async () => {
    const caller = appRouter.createCaller(createTestContext());
    const result = await caller.puzzle.getNext({ theme: "mateIn2" });

    expect(result).toBeDefined();
    expect(result.puzzle.themes).toBeInstanceOf(Array);
  });
});
