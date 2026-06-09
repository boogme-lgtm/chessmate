/**
 * Sprint 47 — PGN message content length (S47-1)
 *
 * The messages.send validator was raised from 4000 → 500,000 chars so large
 * annotated PGN files fit (the DB column was migrated text → mediumtext).
 * Tested through the real procedure: long content passes validation, oversized
 * content is rejected before the handler runs.
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
  vi.mocked(db.createMessage).mockResolvedValue({ id: 1 } as any);
});

describe("Sprint 47 — S47-1: messages.send content length", () => {
  it("S47-1a: accepts a 100,000-character PGN message", async () => {
    const caller = appRouter.createCaller(studentCtx());
    const content = "1. e4 e5 ".repeat(11112).slice(0, 100_000); // 100k chars
    expect(content.length).toBe(100_000);

    await caller.messages.send({ lessonId: 7, content, contentType: "pgn" });
    expect(db.createMessage).toHaveBeenCalledTimes(1);
    expect(vi.mocked(db.createMessage).mock.calls[0][0].content.length).toBe(100_000);
  });

  it("S47-1b: accepts exactly 500,000 characters", async () => {
    const caller = appRouter.createCaller(studentCtx());
    const content = "a".repeat(500_000);
    await caller.messages.send({ lessonId: 7, content, contentType: "pgn" });
    expect(db.createMessage).toHaveBeenCalledTimes(1);
  });

  it("S47-1c: rejects 500,001 characters before the handler runs", async () => {
    const caller = appRouter.createCaller(studentCtx());
    const content = "a".repeat(500_001);
    await expect(
      caller.messages.send({ lessonId: 7, content, contentType: "pgn" })
    ).rejects.toThrow();
    // Validation fails before any DB access.
    expect(db.getLessonById).not.toHaveBeenCalled();
    expect(db.createMessage).not.toHaveBeenCalled();
  });

  it("S47-1d: still rejects empty content", async () => {
    const caller = appRouter.createCaller(studentCtx());
    await expect(
      caller.messages.send({ lessonId: 7, content: "", contentType: "text" })
    ).rejects.toThrow();
  });
});
