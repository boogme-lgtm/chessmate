import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createTestContext(): TrpcContext {
  return {
    user: undefined,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("puzzle.getNext", () => {
  it("fetches a puzzle from Lichess API without difficulty", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.puzzle.getNext();

    expect(result).toBeDefined();
    expect(result.puzzle).toBeDefined();
    expect(result.puzzle.solution).toBeInstanceOf(Array);
    expect(result.puzzle.rating).toBeTypeOf("number");
    expect(result.game).toBeDefined();
    expect(result.fen).toBeTypeOf("string");
    expect(result.fen).toMatch(/^[rnbqkpRNBQKP1-8\/\s]+/);
  }, 10000); // 10s timeout for API call

  it("fetches a puzzle with specific difficulty", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.puzzle.getNext({ difficulty: "easier" });

    expect(result).toBeDefined();
    expect(result.puzzle).toBeDefined();
    expect(result.puzzle.solution).toBeInstanceOf(Array);
    expect(result.puzzle.rating).toBeTypeOf("number");
    expect(result.fen).toBeTypeOf("string");
  }, 10000);

  it("fetches a puzzle with a specific theme", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.puzzle.getNext({ theme: "mateIn2" });

    expect(result).toBeDefined();
    expect(result.puzzle).toBeDefined();
    expect(result.puzzle.themes).toBeInstanceOf(Array);
  }, 10000);
});
