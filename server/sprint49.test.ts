/**
 * Sprint 49 — PGN viewer (S49-1)
 *
 * The analysis board is a pure frontend feature (PgnViewerModal.tsx). These
 * server smoke tests guard the contract it depends on:
 *   - messages.getForLesson returns contentType on each message (the UI branches
 *     "pgn" → clickable analysis board).
 *   - a 500,000-char PGN survives the send validator and round-trips back.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

vi.mock("./db");
vi.mock("./emailService");
vi.mock("./nurtureEmailScheduler");
vi.mock("./resendWelcomeEmails");

import * as db from "./db";

function studentCtx(): TrpcContext {
  return {
    user: { id: 1, role: "user", userType: "student", openId: "s", name: "Stu", email: "s@example.com" } as any,
    req: { protocol: "https", headers: {} } as any,
    res: { setHeader: vi.fn() } as any,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.getLessonById).mockResolvedValue({ id: 7, studentId: 1, coachId: 2 } as any);
  vi.mocked(db.markLessonMessagesRead).mockResolvedValue(undefined as any);
  vi.mocked(db.createMessage).mockImplementation(async (m: any) => ({ id: 1, ...m }) as any);
});

describe("Sprint 49 — messages.getForLesson exposes contentType", () => {
  it("S49-1a: each returned message includes its contentType", async () => {
    vi.mocked(db.getMessagesForLesson).mockResolvedValue([
      { id: 1, lessonId: 7, senderId: 1, contentType: "text", content: "hi" },
      { id: 2, lessonId: 7, senderId: 2, contentType: "pgn", content: "1. e4 e5" },
    ] as any);

    const caller = appRouter.createCaller(studentCtx());
    const thread = await caller.messages.getForLesson({ lessonId: 7 });

    expect(thread).toHaveLength(2);
    expect(thread.map((m: any) => m.contentType)).toEqual(["text", "pgn"]);
  });
});

describe("Sprint 49 — large PGN round-trip", () => {
  it("S49-1b: a 500,000-char PGN sends and comes back with contentType 'pgn'", async () => {
    const bigPgn = "1. e4 e5 ".repeat(55556).slice(0, 500_000);
    expect(bigPgn.length).toBe(500_000);

    const caller = appRouter.createCaller(studentCtx());
    const sent: any = await caller.messages.send({
      lessonId: 7,
      content: bigPgn,
      contentType: "pgn",
    });
    expect(sent.contentType).toBe("pgn");
    expect(sent.content.length).toBe(500_000);

    // Retrieval surfaces it with contentType intact.
    vi.mocked(db.getMessagesForLesson).mockResolvedValue([
      { id: 1, lessonId: 7, senderId: 1, contentType: "pgn", content: bigPgn },
    ] as any);
    const thread = await caller.messages.getForLesson({ lessonId: 7 });
    expect(thread[0].contentType).toBe("pgn");
    expect(thread[0].content.length).toBe(500_000);
  });
});
